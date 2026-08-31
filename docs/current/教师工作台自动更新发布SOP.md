# 教师工作台自动更新发布 SOP

## 1. 适用范围

这份文档用于教师工作台以后所有安装版和自动更新版本。目标是让每个版本都经过同一套工作区、测试、构建、托管、验收和回滚流程，避免出现代码已经完成、安装包却不能启动，或者更新文件已经上传、`latest.json` 却指向错误资产的情况。

默认策略是先测试、后稳定；先不可变版本资产、后更新清单；先真实验收、后对外发布。

## 2. 开始新版本时怎么告诉助手

推荐使用下面这句话。

```text
教师工作台 vX.Y.Z 功能已完成，请按自动更新发布 SOP 处理。
目标版本：X.Y.Z
发布形式：安装版 / 便携版 / 两者
更新渠道：先测试 / 直接准备稳定版
主要改动：……
是否涉及数据库结构或备份格式：是 / 否
```

如果暂时不清楚细节，可以说。

```text
教师工作台新版本已完成，按默认发布流程推进，先测试，不要直接发布稳定更新。
```

默认情况下，助手需要从主分支建立独立 worktree 和 `codex/` 分支，先读最近计划、发布清单和复盘文档，再开始工作。

## 3. 固定目录和分支约定

### Git

```text
主分支：master 或项目实际主分支
分支前缀：codex/
示例：codex/v0.9.1-auto-update
Worktree：仓库根目录\.worktrees\v0.9.1-auto-update
```

不要在主分支直接改代码。不要使用 `git reset --hard`、`git checkout --` 覆盖用户未提交的工作。

### CloudBase

固定使用不可变版本目录。

```text
teacher-work-updates/test/vX.Y.Z/
teacher-work-updates/stable/vX.Y.Z/
teacher-work-updates/test/latest.json
teacher-work-updates/stable/latest.json
```

`vX.Y.Z` 目录中的安装包和签名文件上传后不原地覆盖。出现问题时发布递增版本或新的修复版本，不替换用户已经下载过的原始资产。

### 本地构建资产

安装版构建资产通常位于。

```text
src-tauri\target\installed\release\bundle\nsis\
```

便携版构建资产使用项目既有的 `release\` 输出目录。以后每个完成的版本都必须生成便携版 ZIP，即使本次主要发布安装版和自动更新，也不能省略便携版构建与记录。最终对外发放前，可以把需要手工发送的安装包复制到专门的交付目录，但不能把私钥或内部配置复制进去。

## 4. 发布前要确认的边界

每个版本开始时先确认以下内容。

- 发布安装版、便携版，还是两者；
- 是否修改数据库结构、备份格式或附件格式；
- 是否接入自动更新；
- 测试环境和稳定环境使用哪个 CloudBase 环境；
- 是否有外部测试人员或另一台 Windows 电脑；
- 是否采用 Windows Authenticode；
- 稳定发布是否已经得到用户明确确认。

Tauri updater 签名和 Windows Authenticode 必须分开记录。

| 项目 | 作用 | v0.9.0 状态 |
| --- | --- | --- |
| Tauri updater 签名 | 验证更新包没有被篡改 | 必须，已使用 |
| Windows Authenticode | 提升 Windows 对发布者的信任 | 可选，本版本明确不采用 |

如果不采用 Authenticode，必须写入版本发布清单，并告诉发布方可能出现 SmartScreen 或未知发布者提示。不能把未签名安装包描述成“已完成 Windows 代码签名”。

## 5. 标准执行顺序

```text
建立 worktree 和分支
  → 阅读计划与历史复盘
  → 写本版本计划
  → 先补测试，再改代码
  → 运行针对性测试和全量测试
  → 构建测试安装包
  → 本机安装和更新验收
  → 上传 CloudBase 测试目录
  → 另一台 Windows 电脑验收
  → 使用生产 updater 密钥构建候选包
  → 复核资产和公网下载
  → 最后上传 stable/latest.json
  → 记录版本结果和回滚信息
```

任何核心阶段失败，都回到对应阶段处理。不能通过“忽略安装错误”、手工替换程序目录或直接修改 `latest.json` 来绕过门禁。

## 6. 分阶段提交规则

每完成一个可验证阶段就提交一次。提交信息使用英文 Conventional Commit。

```text
feat: add ...
fix: prevent ...
test: cover ...
build: prepare ...
docs: record ...
chore: update ...
```

每次提交前执行。

```powershell
git diff --check
git status --short
git diff --stat
```

推荐的提交顺序如下。

1. 版本计划和风险说明。
2. 版本契约和配置。
3. 运行 profile 或桌面层改动。
4. updater 核心链路和回归测试。
5. 更新页面和备份确认。
6. 构建脚本、清单生成器和 QA 工具。
7. 测试包和 CloudBase 测试记录。
8. 外部验收结果。
9. 稳定发布结果和 SOP 补充。

## 7. 代码和测试门禁

### 7.1 版本检查

package、Cargo、Tauri 配置和前端更新记录必须一致。

```powershell
npm run version:check
```

### 7.2 测试优先

涉及新行为或故障修复时，先写能够捕获原问题的测试，再实现修复。至少要经历一次失败到通过的过程。

重点覆盖以下内容。

- 安装版和便携版数据目录隔离；
- sidecar 关闭、终止和等待；
- 单实例和精确进程匹配；
- updater 无更新、发现更新、签名错误、资源不存在和断网；
- 更新前备份数据库和附件；
- 迁移失败保留恢复点；
- native updater 对象不进入 Vue 深层响应式；
- 安装器配置和 NSIS hook 存在。

### 7.3 全量验证

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
git diff --check
```

每个版本都要同时生成两种交付产物，并分别记录构建结果。便携版不接入 Tauri 自动安装，继续使用手动替换方式；安装版才接入 updater。

```powershell
npm run tauri:build:portable
npm run package:portable
npm run tauri:build:installed
```

检查便携版 ZIP 位于 `release\`，文件名和版本号正确，压缩包可解压，包含便携版 EXE 及其运行所需资源。便携版是否上传 CloudBase 要在发布范围中明确记录：如果要让用户在线下载，就随稳定版本资产一并上传；如果只向指定用户手工发放，则保留本地或专用交付目录，不要误写入自动更新清单。

### 7.4 原生对象规则

Tauri、浏览器和系统原生对象不能直接放入 Vue 深层响应式状态。需要保存时使用普通数据快照、`shallowRef` 或非响应式变量。错误信息给用户时只暴露可理解的状态，不展示原生堆栈。

## 8. 构建安装版

安装版构建需要从仓库外安全位置读取 Tauri updater 私钥，不能把私钥内容写到仓库、日志、截图、清单或 CloudBase。

构建入口需要得到以下两个变量。

```text
TAURI_UPDATER_PUBLIC_KEY
TEACHER_WORK_UPDATE_ENDPOINT
```

私钥可以通过安全路径变量传入，具体读取方式以仓库内 `scripts/tauri-signing.mjs` 为准。更新地址必须是 HTTPS。

示例流程如下，实际密钥路径由本机安全配置提供。

```powershell
$env:TAURI_UPDATER_PUBLIC_KEY = Get-Content -Raw '安全目录\teacher-work-stable.key.pub'
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = '安全目录\teacher-work-stable.key'
$env:TEACHER_WORK_UPDATE_ENDPOINT = 'https://更新域名/teacher-work-updates/test/latest.json'
npm run tauri:build:installed
```

构建完成后检查版本、`.exe`、`.exe.sig`、运行时资源、`installer.nsi` 中的 `hooks.nsh`、HTTPS endpoint，以及 Git diff 中没有私钥内容。

## 8.1 构建便携版

便携版不需要 updater 私钥，也不会通过 `latest.json` 自动安装。构建完成后执行：

```powershell
npm run tauri:build:portable
npm run package:portable
```

至少检查以下项目：

- `release\教师工作台-vX.Y.Z-windows-x64-portable.zip` 存在且大小大于 0；
- ZIP 能够正常解压，便携版 EXE 可以启动；
- EXE 同级的 `data`、`backups` 和 `logs` 规则没有被破坏；
- 便携版没有被错误地写入安装版的 `latest.json` 或当作自动更新包；
- 如果对外上传，单独计算 ZIP 的 SHA-256，并记录下载地址和哈希。

## 9. 生成清单和哈希

使用仓库内的生成器，不手工编辑签名字段。

```powershell
node scripts/generate-update-manifest.mjs `
  --version 0.9.0 `
  --installer '安装包路径' `
  --signature '签名路径' `
  --endpoint-root 'https://域名/teacher-work-updates/test/v0.9.0/' `
  --notes '教师工作台 v0.9.0 更新说明' `
  --output 'latest.json 输出路径' `
  --checksums-output 'checksums.json 输出路径'
```

生成器必须检查版本是合法 SemVer，平台字段是 `windows-x86_64`，URL 是绝对 HTTPS 地址，资产存在且大小大于 0，签名字段非空，中文文件名由脚本自动编码。

## 10. 本机 Windows 验收

### 新安装

- 从最终 `.exe` 安装；
- 桌面图标启动；
- 关闭后再次启动；
- 确认内置 Node 和 server 可用；
- 确认数据库首次创建和迁移成功。

### 更新

- 从旧版本检查更新；
- 观察更新说明和版本号；
- 点击更新前备份确认；
- 确认数据库和附件保留；
- 确认应用退出、安装和重启；
- 更新后再次打开并检查数据；
- 不能出现 `better_sqlite3.node` 或 `runtime\node.exe` 写入错误。

### 进程和文件占用

- 应用正常打开时覆盖安装；
- 后台服务运行时覆盖安装；
- 模拟异常退出残留后覆盖安装；
- 确认没有无关 `node.exe` 被结束；
- 确认应用关闭后本安装目录的 Node sidecar 不残留；
- 发生文件写入错误时选择中止并重新定位，不选择忽略。

### 数据安全

- 用旧版本导出的完整备份恢复；
- 确认数据库、附件和恢复点存在；
- 卸载不删除用户数据目录；
- 重新安装可以读回旧数据。

## 11. CloudBase 测试部署

先确认环境 ID，不使用模糊别名代替完整环境 ID。测试资产建议使用纯英文文件名，避免外部分享链路改写中文 URL。

测试上传顺序如下。

1. 上传安装包到 `teacher-work-updates/test/vX.Y.Z/`。
2. 上传同名 `.sig`。
3. 上传 `checksums.json`。
4. 准备测试 `latest.json`，使其指向测试版本目录。
5. 最后上传测试 `latest.json`。
6. 通过 CloudBase 文件清单核对对象名称和大小。
7. 从公网下载测试包并复核 SHA-256。

测试清单和稳定清单不能混用。测试期间不修改 `stable/latest.json`。

## 12. 外部验收

另一台 Windows 电脑或测试人员至少验证安装、桌面启动、检查更新、自动更新下载和安装、更新后重启、数据和附件保留、备份恢复、安装过程中没有文件写入错误、VPN 开关状态和 Windows 系统代理状态、Windows 版本和设备架构。

反馈必须包含截图、安装包文件名、发生步骤和网络状态。只有“安装成功”不能代替更新链路验收。

## 13. 稳定发布

稳定发布必须得到用户明确确认。确认后执行以下顺序。

1. 使用生产 Tauri updater 公钥和私钥重新构建安装版，不复用测试构建目录里的资产。
2. 同时生成并核对本版本便携版 ZIP。
3. 生成稳定版本目录 `teacher-work-updates/stable/vX.Y.Z/`。
4. 如果发布范围包含在线便携版，上传便携 ZIP；否则记录为本地/专用渠道交付。
5. 上传安装包、`.sig` 和 `checksums.json`。
6. 查询云端对象是否存在、大小是否正确。
7. 从公网重新下载安装包和 `.sig`；若上传便携版，也重新下载 ZIP，计算 SHA-256 并与本地清单比较。
8. 生成正式 `latest.json`，URL 指向不可变的 `stable/vX.Y.Z/` 目录。便携版下载地址不写入 updater 清单，除非项目另有专门的便携版清单。
9. 最后上传 `teacher-work-updates/stable/latest.json`。
10. 重新下载正式 `latest.json`，核对版本、notes、HTTPS URL 和签名字段。
11. 记录发布时间、版本目录、更新地址、哈希、测试结果和回滚位置。

`latest.json` 是用户能否发现更新的开关，必须最后上传。资产未完成公网复核前，不能上传它。

## 14. 回滚规则

如果稳定版出现严重问题，先暂停继续修改 `stable/latest.json`，保留已经发布的版本资产，不原地覆盖。根据问题决定让 `latest.json` 暂时指向上一版本，或发布递增修复版本。保留用户数据目录和 `pre-update-*` 恢复点，数据库回滚使用匹配版本的程序和备份，不能只替换 EXE。

## 15. 常见问题速查

| 现象 | 优先检查 |
| --- | --- |
| 安装后闪退 | `resources\runtime`、`resources\app`、日志和 updater endpoint 是否为 HTTPS |
| `Symbol(nativeUpdate)` Proxy 错误 | 原生 updater 对象是否被 Vue 深层代理 |
| `node.exe` 或 `better_sqlite3.node` 无法写入 | 应用树、sidecar、NSIS hook、PowerShell `$` 转义和重复 relaunch |
| CloudBase `INVALID_REQUEST` | URL 是否手工编码错误，优先使用 ASCII 文件名 |
| VPN 开关影响检查更新 | Windows 系统代理、DNS、路由策略和目标 HTTPS URL |
| 检查不到更新 | `latest.json` 是否最后上传、版本是否高于本机、URL 是否公网可达 |
| 签名失败 | `.sig` 是否和安装包成对、是否使用同一 updater 私钥、公钥是否匹配 |
| 用户看到未知发布者 | 当前版本未采用 Authenticode，属于已记录的发布限制 |

## 16. 阶段状态报告模板

```text
当前阶段：
已完成：
验证结果：
提交：
下一步：
需要用户操作：
```

如果存在阻塞，要写清楚阻塞的事实、已经检查过的内容和用户需要提供的材料，不用“应该可以”代替验证结果。

## 17. v0.9.0 参考结果

```text
CloudBase 环境：teacher-work-d5ge50r1f621766b2
稳定更新清单：teacher-work-updates/stable/latest.json
版本资产目录：teacher-work-updates/stable/v0.9.0/
安装包 SHA-256：cd2684761c92c5cfaa6018b3f39a92a85fd54fc2bdbef74de2d065ea8f13e774
.sig SHA-256：691011b7960225af7f349133221ce6bbde722298751a6b352934f1b60dbcdb41
Authenticode：明确不采用
```

以后发布 v0.9.1 或 v1.0.0 时，不能把这些版本号直接覆盖成旧版本。应创建新的版本目录，重新构建、重新签名、重新生成清单，并让用户明确知道这次发布是否采用 Authenticode。
