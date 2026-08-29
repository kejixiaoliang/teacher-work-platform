# Tauri v2 Windows 免安装便携版开发与交付手册

> 文档状态：当前工程交付参考资料。

> 来源：Desktop Pet Player（“捉宠”）从 Web/Electron 原型迁移到 Tauri v2，并交付 Windows portable ZIP 的实践复盘。
>
> 用途：可直接交给另一个 AI，指导它把外部 Web 原型制作成解压即用的 Windows 应用。

## 1. 目标与边界

本手册的目标交付物不是安装器，而是一个免安装压缩包：

```text
产品名-v1.0.0-windows-x64-portable.zip
└─ 产品名\
   ├─ 产品名.exe
   ├─ resources\
   ├─ data\
   └─ README.txt
```

用户只需要下载、完整解压、双击 EXE。程序不创建开始菜单项，不需要卸载。

“免安装”不等于“物理上只有一个 EXE”。如果应用存在图片、音频、模型、模板、数据库或需要持久化的用户数据，最可靠的交付方式是“一个明显的 EXE 入口 + 配套目录”，然后整体压缩成一个 ZIP。只有完全不依赖外部资源、也不需要可编辑数据时，才值得追求真正的单文件 EXE。

Tauri 应用还依赖 Windows WebView2。Windows 10/11 的常见环境通常已有 WebView2，但正式交付前仍必须在目标用户环境验证，不能把“开发机能启动”当成兼容性证明。

## 2. 捉宠项目的最终架构经验

捉宠保留了 React、TypeScript、Vite 渲染层，用 Tauri/Rust 接管桌面能力：

```text
React / TypeScript
  UI、动画、页面状态、业务交互
          │
          │ invoke / event
          ▼
desktop API 适配层
          │
          ▼
Rust / Tauri
  文件系统、配置、资源路径、窗口、托盘、文件选择、系统调用
```

最重要的架构决定是：不要因为迁移到 Tauri 就重写整个 Web 原型。优先保留已有 UI，只建立一个统一的桌面 API 适配层，例如：

```ts
export interface DesktopApi {
  getStatus(): Promise<AppStatus>;
  saveConfig(config: AppConfig): Promise<void>;
  selectLocalFolder(): Promise<string | null>;
  openExternalUrl(url: string): Promise<void>;
}
```

React 组件不应到处直接调用 `invoke()`。所有 Tauri 调用集中在一个适配器中，能减少 Rust 字段改名、命令改名和测试替身带来的连锁修改。

## 3. 动手前先扫描原型

另一个 AI 应先回答这些问题，再决定实现方案：

1. 原型使用 React、Vue、原生 HTML，还是其他框架？
2. 是否已经使用 Vite？入口页面有几个？
3. 是否依赖 Node.js、Electron preload、浏览器扩展或本地 HTTP 服务？
4. 是否存在写死的 `localhost`、盘符路径或源码相对路径？
5. 是否有图片、字体、模型、音视频、数据库等外部资源？
6. 用户数据需要随便携目录移动，还是应该保存在 AppData？
7. 是否需要文件选择、托盘、多窗口、透明窗口、置顶、快捷键等桌面能力？
8. 目标系统是 Windows x64、ARM64，还是两者都要？

如果原型严重依赖 Node.js runtime 或 Electron 专属模块，应先做替代能力清单，不要直接删除原桌面实现。捉宠的经验是先做“可行性原型”，确认透明窗口、本地资源、托盘和打包都能工作后，再把 Tauri 变成主线。

## 4. Windows 构建环境门禁

Tauri 不是运行 `npm install` 后就一定能构建。Windows 开发机通常需要：

- Node.js 与 npm
- Rust 与 Cargo（MSVC toolchain）
- Visual Studio Build Tools 的 C++ 桌面构建工具
- Windows SDK
- Microsoft Edge WebView2 Runtime
- Tauri CLI

### 4.1 基础检查命令

在普通 PowerShell 中执行：

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
where.exe link
```

期望看到类似：

```text
v22.x.x
10.x.x
rustc 1.xx.x (...)
cargo 1.xx.x (...)
stable-x86_64-pc-windows-msvc (default)
C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\bin\Hostx64\x64\link.exe
```

关键点不是只看 `link.exe` 是否存在，而是检查 `where.exe link` 返回的第一项。Rust/MSVC 构建最终使用的是 PATH 中优先命中的链接器。

### 4.2 如何确认 link.exe 来自 MSVC

正确路径通常包含以下片段：

```text
Microsoft Visual Studio
VC\Tools\MSVC
Hostx64\x64
```

可进一步检查版本信息：

```powershell
$linkPath = (where.exe link | Select-Object -First 1)
$linkPath
(Get-Item -LiteralPath $linkPath).VersionInfo | Format-List ProductName,CompanyName,FileVersion
```

正确结果应指向 Microsoft，例如：

```text
ProductName : Microsoft® Visual Studio®
CompanyName : Microsoft Corporation
```

如果第一项类似：

```text
C:\Users\用户名\anaconda3\Library\usr\bin\link.exe
```

说明 Anaconda 的同名程序抢在 MSVC 前面。典型症状包括：

- Rust 在链接阶段失败；
- 日志提到无法识别 MSVC 参数；
- `link.exe` 能找到，但行为明显不像 Microsoft Linker；
- npm/前端构建成功，Cargo 最终链接失败。

推荐处理顺序：

1. 从开始菜单打开 **Developer PowerShell for VS 2022** 或 **x64 Native Tools Command Prompt for VS 2022**。
2. 在该终端重新执行 `where.exe link`，确认 MSVC 路径排第一。
3. 再执行 `cargo build` 或 `npm run tauri:build`。
4. 如果仍错误，检查是否确实安装了“使用 C++ 的桌面开发”和对应 Windows SDK。
5. 只调整当前构建终端的 PATH，避免为了一个项目永久破坏 Anaconda 环境。

不要通过复制、重命名或删除 Anaconda 的 `link.exe` 来解决冲突，也不要把一个来源不明的 `link.exe` 手工复制进项目。

### 4.3 确认 Rust 使用 MSVC toolchain

检查：

```powershell
rustup show active-toolchain
rustup target list --installed
```

Windows x64 应优先看到：

```text
stable-x86_64-pc-windows-msvc
x86_64-pc-windows-msvc
```

如果使用的是 GNU toolchain，不要在不理解后果的情况下混搭 MSVC Build Tools。可以显式安装并切换：

```powershell
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
```

切换后重新打开终端，再检查一次。

### 4.4 确认 WebView2

至少要在一台未安装开发工具的普通 Windows 电脑或干净虚拟机上启动最终 EXE。若应用启动失败或 WebView 创建失败，再检查 WebView2 Runtime。不要因为开发机安装了 Edge、Visual Studio 或其他软件就推断所有用户机器也满足条件。

## 5. 推荐实施顺序

### 阶段 A：最小 Tauri 壳

只完成：

- Tauri v2 工程初始化；
- 原型页面在 `tauri dev` 中渲染；
- 一个最小 Rust command 能被前端调用；
- 页面不依赖原来的外部开发服务器以外能力。

### 阶段 B：尽早构建 Release

尽早执行：

```powershell
npm run typecheck
npm test
npm run tauri:build
```

然后关闭 Vite 开发服务器，直接运行：

```text
src-tauri\target\release\应用内部名称.exe
```

此时验证白屏、资源路径、窗口和数据目录。不要等所有功能写完才第一次测试 Release。

### 阶段 C：建立稳定的便携目录模型

Release 程序中，以 EXE 所在目录作为便携根目录：

```rust
fn portable_root() -> Result<std::path::PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(std::path::Path::to_path_buf)
        .ok_or_else(|| "Cannot locate portable root".to_string())
}
```

建议目录语义：

```text
resources\          内置只读资源
resources\imported  用户导入后由应用托管的资源副本
data\               配置、状态、本地数据库、运行记录
```

开发模式可从仓库资源目录读取；Release 模式必须从 EXE 同级目录或 Tauri resource directory 读取。不要把开发路径带进生产代码。

### 阶段 D：自动生成 portable ZIP

增加一个脚本，例如：

```text
scripts/package-tauri-portable.mjs
```

脚本应完成：

1. 读取 `package.json` 中的版本号；
2. 检查 Release EXE 是文件；
3. 检查所有必需资源目录；
4. 清理旧的临时发布目录；
5. 创建单层产品目录；
6. 复制并重命名 EXE；
7. 复制并整理资源；
8. 创建空 `data` 目录；
9. 生成 UTF-8 `README.txt`；
10. 删除旧 ZIP；
11. 使用 `Compress-Archive` 创建新 ZIP；
12. 输出 ZIP 完整路径和目录结构。

建议命令：

```json
{
  "scripts": {
    "tauri:build": "tauri build",
    "package:portable": "tauri build && node scripts/package-tauri-portable.mjs"
  }
}
```

## 6. Vite 与前端资源避坑

### 6.1 必须使用相对 base

```ts
export default defineConfig({
  base: "./",
  plugins: [react()]
});
```

构建后抽查 HTML：

```powershell
rg 'src="/assets|href="/assets' dist
```

期望没有输出。正确资源引用应类似：

```html
src="./assets/..."
href="./assets/..."
```

绝对 `/assets/...` 在桌面协议或本地文件环境中经常导致白屏。

### 6.2 禁止生产环境依赖 localhost

检查：

```powershell
rg -n "localhost|127\.0\.0\.1|http://" src dist src-tauri
```

逐项判断是否只是开发配置。最终便携版不得要求用户启动 Vite、本地 Node 服务或额外批处理文件。

### 6.3 本地文件不能直接当浏览器 URL

不要把：

```text
C:\Users\name\image.png
```

直接放入 `<img src>`。应使用 Tauri asset protocol、`convertFileSrc`，或由 Rust 读取并通过受控接口返回。

权限范围只开放应用确实需要的目录。不要为了省事开放整个系统盘或全部文件系统。

## 7. Tauri 资源目录不是想当然的目录

`tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "resources": ["../resources/assets", "../resources/icons"]
  }
}
```

不代表构建后一定得到 `exe同级\resources`。Tauri 可能按照相对层级生成 `_up_` 或 `__up__` 目录。捉宠早期就遇到资源实际位于 `_up_\resources\default-pets` 的情况。

正确做法：

1. 真实执行 `tauri build`；
2. 用 `Get-ChildItem -Recurse src-tauri\target\release` 检查产物；
3. 找到资源的真实来源位置；
4. 由 portable 脚本把它们重排为稳定的 `resources\`；
5. Release 运行时优先读取 EXE 同级稳定结构。

不要只为某一次构建写死 `_up_`。Tauri 配置、版本或资源相对路径变化后，目录可能改变。打包脚本应在找不到预期目录时直接报错，禁止生成缺资源的 ZIP。

## 8. 便携数据模型与写权限

便携模式建议把配置写入：

```text
产品目录\data\config.json
```

优点：

- 复制整个文件夹即可迁移；
- 备份逻辑清晰；
- 删除或重命名 `data` 可模拟首次启动；
- 不会由历史 AppData 掩盖新包问题。

代价是产品目录必须可写。因此 README 应提醒用户把软件解压到桌面、下载目录、普通用户目录或 U 盘，不要放在 `C:\Program Files` 等受保护目录。

如果产品实际需要多用户隔离、企业管理或安装式升级，则应重新评估 AppData 模型，不要为了“便携”强行把所有数据放在 EXE 旁边。

## 9. 用户导入资源的安全策略

推荐流程：

1. 用户通过系统对话框选择文件或目录；
2. Rust 检查文件是否存在；
3. 验证必需文件与 JSON 格式；
4. 规范化 ID 和目标文件名；
5. 将允许的文件复制到应用管理目录；
6. 同 ID 已存在时请求覆盖确认；
7. 新资源完整复制成功后再更新配置；
8. 失败时保留原有资源和配置。

用户输入不得直接参与任意路径拼接。至少拒绝：

```text
..
../escape
..\escape
C:\absolute-path
包含路径分隔符的 ID
```

删除目录前，应规范化并验证最终目标仍位于允许的资源根目录内。

## 10. 窗口、托盘和透明效果

### 10.1 Release 隐藏黑色终端窗口

`src-tauri/src/main.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

必须是 `not(debug_assertions)`，这样 Release 是 GUI 程序，Debug 仍可保留终端日志。

### 10.2 关闭窗口不一定等于退出应用

有托盘的应用应明确：

```text
关闭按钮 → prevent_close + hide
托盘“打开” → 已存在则 show，不存在则创建
托盘“退出” → 显式退出整个应用
```

不要保存一个已被销毁的窗口引用后继续调用 `show()`。必须验证反复关闭、托盘恢复至少三次，不生成重复窗口、不崩溃。

### 10.3 托盘图标显式设置

不要假设托盘会自动继承应用图标。应在创建 tray 时显式提供图标，并检查 16、20、24、32 像素下的实际效果。

### 10.4 透明窗口是完整链路

Tauri 窗口配置通常需要：

```json
{
  "decorations": false,
  "transparent": true,
  "shadow": false
}
```

前端还需要：

```css
html,
body,
#root {
  background: transparent;
}
```

同时检查 WebView 背景、素材 Alpha 通道、窗口阴影和 Release 实际表现。透明、置顶、拖拽、任务栏隐藏等行为必须人工视觉 QA。

## 11. Rust 与 TypeScript 接口对齐

Rust：

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStatus {
    current_item: Option<ItemInfo>,
    data_dir: String,
}
```

TypeScript：

```ts
interface AppStatus {
  currentItem: ItemInfo | null;
  dataDir: string;
}
```

需要逐项确认：

- Rust `snake_case` 是否转换为 `camelCase`；
- `Option<T>` 是否在前端按 `T | null` 处理；
- invoke 命令名和参数名是否一致；
- Rust 错误是否能被前端转成可理解的提示；
- 事件载荷是否也遵循相同类型约定。

不要以 `any` 掩盖接口不一致。适配器应有单元测试，覆盖关键返回结构。

## 12. 自动打包脚本的质量要求

一个合格的 portable 脚本应“失败得足够早”。以下任何一项缺失都应终止：

- Release EXE；
- `dist` 前端产物；
- 必需的资源目录；
- 应用图标或运行期必需文件。

完成后再检查 ZIP 内容：

```powershell
Get-ChildItem -Recurse release\产品名
```

禁止出现：

- 源码；
- `.env`、密钥、令牌；
- 测试缓存；
- `node_modules`；
- Cargo `target`；
- 不必要的安装器；
- 多层重复产品目录。

### README 编码检查

打包脚本应使用 UTF-8 写入 `README.txt`，但指定 `utf8` 并不保证字符串源文本没有提前乱码。生成后应实际检查：

```powershell
Get-Content -Raw -Encoding UTF8 'release\产品名\README.txt'
```

再用 Windows 记事本打开一次，确认中文没有变成 `锟斤拷`、`浣跨敤` 等乱码。捉宠当前历史脚本中存在中文字符串乱码痕迹，这一点应作为后续维护时优先修复的事项。

## 13. 发布前验证矩阵

### 13.1 自动验证

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run package:portable
```

如果项目没有测试，至少补充：

- 桌面 API 返回结构测试；
- 路径计算测试；
- 配置默认值与读写测试；
- 用户输入路径安全测试；
- Vite `base: "./"` 防回归测试。

### 13.2 最终 ZIP 人工验证

1. 停止 Vite 和其他本地服务；
2. 把 ZIP 复制到仓库之外的临时目录；
3. 完整解压；
4. 从解压目录双击 EXE；
5. 验证不弹黑色终端；
6. 验证不白屏，图片、字体和样式完整；
7. 验证所有核心功能；
8. 修改配置并重启，确认数据保存；
9. 退出后确认任务管理器没有残留进程；
10. 将整个产品目录移动到另一个位置，再次启动；
11. 在中文路径和带空格路径下运行；
12. 使用空 `data` 目录模拟首次启动；
13. 在没有源码、Rust、Node.js 的普通用户电脑或虚拟机测试；
14. 检查 SmartScreen、杀毒软件和 WebView2 表现。

不要未经确认删除真实用户数据。模拟首次启动时，应复制整个 portable 目录到临时位置，或先备份 `data` 再操作。

### 13.3 最低发布门槛

以下任何一项失败，都不建议对外发送：

- 最终解压 EXE 无法启动；
- 仍依赖 localhost；
- 首次启动白屏或缺资源；
- 配置无法保存；
- 退出后残留后台进程；
- EXE 单独可见但 README 未说明必须保留配套目录；
- ZIP 包含密钥或开发文件；
- 从空数据环境启动失败；
- 只在开发机验证过，没有独立目录验证。

## 14. SmartScreen、签名与“免安装”的现实限制

未签名 EXE 可能显示“未知发布者”或触发 Microsoft Defender SmartScreen。少量可信内测可以在 README 中说明来源和校验方式，但不能承诺用户一定不会看到安全提示。

正式公开分发时建议：

- 使用可信代码签名证书；
- 给 ZIP 提供 SHA-256；
- 固定官方发布页面；
- 明确版本号和构建时间；
- 不频繁更换产品名、EXE 名和签名主体。

可计算校验值：

```powershell
Get-FileHash '.\release\产品名-v1.0.0-windows-x64-portable.zip' -Algorithm SHA256
```

## 15. 可直接交给另一个 AI 的任务指令

```text
请把当前外部 Web 原型制作成 Windows 免安装便携版应用，优先使用 Tauri v2。

最终交付不是安装器，而是一个 portable ZIP：

产品名-v1.0.0-windows-x64-portable.zip
└─ 产品名\
   ├─ 产品名.exe
   ├─ resources\（需要外部资源时保留）
   ├─ data\
   └─ README.txt

用户完整解压后，双击 EXE 即可运行，不需要安装。

开始修改前，请先扫描项目并报告：前端框架、构建工具、所有入口页面、Node/Electron 专属依赖、localhost 依赖、绝对路径、外部资源、持久化数据和桌面能力需求。尽量复用现有 UI，不要无必要重写。

先执行环境门禁：

node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
where.exe link

确认 Rust 使用 x86_64-pc-windows-msvc；确认 where.exe link 的第一项来自 Microsoft Visual Studio 的 VC\Tools\MSVC\...\Hostx64\x64。若第一项来自 Anaconda 等其他软件，请改用 Developer PowerShell for VS 2022 或仅修正当前构建终端 PATH，不要删除或覆盖其他软件文件。

实施要求：

1. 使用 Tauri v2 创建 Windows 桌面壳。
2. 保留现有 Web UI和业务逻辑，Tauri 调用集中到 desktopApi 适配层。
3. Vite 使用 base: "./"，最终构建不依赖 localhost。
4. Release 使用 windows_subsystem = "windows"，双击 EXE 不弹黑框。
5. 禁止写死开发机绝对路径；路径从 EXE、resource directory 或 data directory 动态计算。
6. 如果目标是真便携，配置和状态写到 EXE 同级 data；说明该模式要求产品目录可写。
7. 内置资源与用户数据分离。用户导入文件应复制到应用托管目录，不永久引用原始绝对路径。
8. 有外部资源时使用“EXE + resources + data”，不要为了单文件而牺牲可靠性。
9. 本地文件访问通过 Rust command 或最小范围 asset protocol，不开放整个磁盘。
10. Rust 返回字段与 TypeScript 类型严格一致，统一 camelCase，并处理 null 和错误。
11. 用户提供的路径、ID 和文件名必须防止路径穿越。
12. 如有托盘或多窗口，明确 hide、destroy、recreate 和 exit 的生命周期。
13. 显式配置应用图标和托盘图标。
14. 增加 package-portable 脚本，自动检查产物、整理目录、生成 UTF-8 README 和 ZIP。
15. 打包脚本遇到 EXE 或资源缺失必须失败，禁止生成残缺 ZIP。
16. README 告诉用户完整解压、不要单独移动 EXE、不要放进无写权限目录，并说明 SmartScreen/WebView2 限制。
17. 不要只验证 tauri dev；必须关闭开发服务器，验证最终 ZIP 解压后的 Release EXE。
18. 测试中文路径、空格路径、空 data 首次启动、保存后重启、移动整个目录后重启。
19. 在没有 Node、Rust 和源码的普通 Windows 环境验证。
20. 不得擅自删除用户数据、覆盖未提交改动或泄露 .env/密钥。

建议提供：

npm run dev
npm run typecheck
npm test
npm run tauri:dev
npm run tauri:build
npm run package:portable

最终请交付：

1. 可维护的 Tauri 项目；
2. 最终 portable ZIP；
3. ZIP 目录结构；
4. 构建与复现命令；
5. 自动化测试结果；
6. Release 解压运行的人工 QA 记录；
7. SHA-256；
8. 尚未验证的事项；
9. SmartScreen、代码签名、WebView2 和写入权限限制。

只有最终 ZIP 被复制到独立目录、完整解压、在关闭开发服务器后双击 EXE 正常运行，才算完成。
```

## 16. 一句话结论

优先追求“一个 ZIP、一个完整便携目录、一个清晰的 EXE 入口”，而不是盲目追求物理意义上的单文件 EXE；并且把最终 ZIP 在独立、干净、无开发环境的 Windows 场景中跑通，才算真正完成交付。
