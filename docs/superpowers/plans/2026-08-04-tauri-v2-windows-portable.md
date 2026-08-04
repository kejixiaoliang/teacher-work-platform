# 教师工作台 Tauri v2 Windows 绿色便携版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Vue 3 + Express + SQLite 外部 Web 原型转换为无需安装、无需用户预装 Node.js、解压 ZIP 后双击 EXE 即可运行的 Tauri v2 Windows 绿色便携版，并保证现有业务、用户文件和数据库升级安全。

**Architecture:** 第一版不重写成熟的 Express 业务后端，而是把后端编译成自包含 Node Sidecar，由 Tauri/Rust 负责定位便携目录、启动和关闭 Sidecar，并把随机回环端口及会话令牌通过 `desktopApi` 提供给 Vue。前端静态资源嵌入 Tauri 主 EXE；Sidecar 放在 `resources/`，用户数据固定写入主 EXE 同级 `data/`，数据库迁移前自动备份。最终交付物由自定义脚本从 Release 产物组装并生成 ZIP，不使用 MSI/NSIS。

**Tech Stack:** Vue 3、Vite 6、Element Plus、Node.js 22、Express 4、better-sqlite3 12、Tauri v2、Rust stable-msvc、Node 内置测试运行器、PowerShell QA、ZIP 便携包。

## Global Constraints

- 首版目标平台固定为 Windows x86-64，目标三元组为 `x86_64-pc-windows-msvc`。
- 最终交付物必须是 `教师工作台-vX.Y.Z-windows-portable.zip`，不是 MSI 或 NSIS 安装器。
- 用户必须先完整解压 ZIP，再双击 `教师工作台.exe`；不支持在压缩包内部直接运行。
- Vue UI 与现有 Express 业务逻辑优先复用，首版不进行 Rust 后端全量重写。
- 目标电脑不需要预装 Node.js；Node Sidecar 必须在发布阶段构建为自包含 EXE。
- 前端生产资源不依赖 Vite 开发服务器；`vite.config.js` 保持 `base: './'`。
- “不依赖 localhost”定义为：用户不需要启动 Vite、Node、批处理或固定端口服务。首版允许由 Tauri/Rust 自动管理、仅绑定随机 `127.0.0.1` 端口且带启动令牌的内部 Sidecar API；该内部实现不得暴露给用户操作，也不得依赖 3210 固定端口。
- Sidecar 只能监听 `127.0.0.1`，端口由操作系统动态分配，不使用固定 3210 端口。
- Sidecar 的所有 API 请求必须携带本次启动生成的随机令牌；禁止裸露无认证的本地 API。
- 用户数据固定写入主 EXE 同级 `data/`，不默认写入 AppData。
- 升级包不得包含或覆盖真实 `data/`、`backup/`、`logs/`。
- 用户导入文件必须复制到 `data/files/`；数据库不得永久保存用户原始绝对路径。
- 所有用户影响的路径都必须防止绝对路径逃逸和 `..` 路径穿越。
- Tauri/WebView 只获得必要能力；Sidecar 生命周期由 Rust 管理，不把任意进程执行权限暴露给前端。
- Rust 暴露给前端的结构使用 `#[serde(rename_all = "camelCase")]`；首版 JavaScript 使用 JSDoc 固定同名字段，暂不为打包任务引入全项目 TypeScript 迁移。
- Release 构建使用 Windows GUI 子系统，双击主 EXE不得弹出命令行窗口；Sidecar 也以隐藏窗口方式启动。
- 不删除现有用户数据，不覆盖工作区中与本计划无关的修改。
- `tauri dev` 成功不代表完成；必须关闭开发服务器，在独立中文/空格路径中解压最终 ZIP 并完成 Release QA。
- 首版默认依赖目标系统已有 Evergreen WebView2；README 必须说明检测和安装方法。固定 WebView2 Runtime 作为后续可选发行物，不进入首版最小范围。
- 每个数据库结构变化只追加新迁移；已发布迁移不可修改；迁移前必须创建恢复点。

---

## 1. 已确认的项目现状

本计划已逐项吸收项目内 `docs/tauri-portable-windows-handbook.md` 的桌宠便携版实践，但根据教师工作台存在 Express、better-sqlite3 和上传文件的事实，采用“受控 Node Sidecar”而不是立即把全部后端重写成 Rust。

### 1.1 现有结构

```text
teacher-work/
├─ web/                     # Vue 3 + Vite 前端
├─ server/                  # Express 后端
│  ├─ index.js
│  ├─ db.js                 # SQLite 初始化与 v1-v3 迁移
│  └─ routes/               # 12 组业务路由
├─ data/                    # 当前开发数据
├─ vite.config.js           # 已配置 base: './'
├─ package.json
└─ 启动.bat                 # 当前依赖系统 Node 和 localhost:3210
```

现有前端在 `web/src/api.js` 中统一使用相对 `/api/*` 请求，这为引入 `desktopApi` 提供了良好边界。现有数据库支持 `TEACHER_WORK_DATA_DIR`，但 `server/routes/classes.js` 和 `server/routes/backup.js` 等文件仍自行计算 `data/`，必须先统一路径来源。

### 1.2 已确认的构建环境

```text
Node.js: v22.15.0
npm: 10.9.2
rustc: 1.97.0
cargo: 1.97.0
```

普通 PowerShell 当前状态：

```text
where.exe link
→ D:\Anaconda3\Library\usr\bin\link.exe
```

该 `link.exe` 不是 Visual Studio MSVC 链接器。但重新通过标准 `vswhere.exe` 核查后，已经确认 Visual Studio Build Tools 2022、MSVC v14.44 和正确 linker 均已安装：

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe
```

在 `VsDevCmd.bat -arch=x64 -host_arch=x64` 环境中，`where.exe link` 的第一项已正确变为 Microsoft linker，第二项才是 Anaconda linker；Rust 活动工具链和目标均为 `x86_64-pc-windows-msvc`。因此这里是普通终端 PATH 优先级问题，不是缺少 Build Tools，也不需要重新安装或删除任何软件。正式 Tauri 构建必须在 VS 开发环境中进行。

处理方式固定为：从开始菜单打开 **Developer PowerShell for VS 2022** 或 **x64 Native Tools Command Prompt for VS 2022**，只修正当前构建终端的环境，再重新检查。禁止复制、重命名或删除 Anaconda 的 `link.exe`，也不为了本项目永久破坏 Anaconda PATH。

### 1.3 首版架构选择

采用 Sidecar 是为了在第一版最大程度复用现有业务：

```text
教师工作台.exe（Tauri）
├─ 内嵌 Vue/Vite Release 资源
├─ Rust 生命周期与便携路径管理
└─ resources/teacher-work-sidecar.exe
   ├─ Express REST API
   ├─ better-sqlite3
   └─ data/teacher.db + data/files/
```

后续如果要移除本地 HTTP 层，可逐模块把 `desktopApi` 的实现切换为 Tauri Command；这一演进不阻塞首版，也不要求重写 UI。

---

## 2. 文件结构与职责

### 2.1 计划新增文件

```text
server/
├─ app.js                         # createApp()，仅组装 Express，不监听端口
├─ runtime.js                     # startServer()/stopServer() 与 ready 握手
├─ config/
│  └─ paths.js                    # 唯一数据目录与安全子路径解析
├─ db/
│  ├─ index.js                    # 打开数据库、执行迁移、关闭连接
│  ├─ backup.js                   # 迁移前恢复点
│  ├─ validate.js                 # integrity/foreign key/schema 验证
│  └─ migrations.js               # 顺序化迁移注册表
└─ sidecar-entry.js               # 自包含 Sidecar 唯一入口

web/src/platform/
├─ desktopApi.js                  # Web/Tauri 运行环境适配器
└─ runtimeConfig.js               # apiBaseUrl/apiToken 运行态配置

src-tauri/
├─ Cargo.toml
├─ build.rs
├─ tauri.conf.json
├─ capabilities/default.json
├─ icons/
├─ src/
│  ├─ main.rs
│  ├─ lib.rs
│  ├─ paths.rs                    # EXE 同级便携路径
│  └─ sidecar.rs                  # Sidecar 启停、握手和进程清理
└─ binaries/.gitkeep              # 构建中间目录，不提交生成 EXE

scripts/
├─ check-tauri-toolchain.ps1      # MSVC/Rust/Node/WebView2 前置检查
├─ build-sidecar.mjs              # 编译并冒烟验证 Sidecar
├─ package-portable.mjs           # 组装目录、README、manifest 和 ZIP
└─ qa-portable.ps1                # 独立目录 Release 自动 QA

tests/
├─ server/
│  ├─ paths.test.js
│  ├─ runtime.test.js
│  ├─ auth.test.js
│  └─ migrations.test.js
├─ web/
│  └─ desktop-api.test.js
├─ packaging/
│  └─ portable-package.test.js
└─ fixtures/databases/
   └─ schema-v3-sample.db         # 脱敏旧库，生成脚本创建，不放真实数据
```

### 2.2 计划修改文件

- `package.json`：增加测试、Sidecar、Tauri、Release 和便携打包命令。
- `package-lock.json`：锁定新增依赖。
- `vite.config.js`：保留相对 base，区分 Web 开发代理与 Tauri Release。
- `web/src/api.js`：所有请求通过运行态 URL 和令牌构造器；不改变业务方法名称。
- `server/index.js`：降为传统 Web 模式入口，复用 `app.js` 和 `runtime.js`。
- `server/db.js`：兼容导出入口，实际职责迁移至 `server/db/`。
- `server/routes/classes.js`、`server/routes/backup.js`、`server/routes/documents.js`：统一使用路径服务。
- `.gitignore`：忽略 Rust/Sidecar/portable 构建产物，但保留源代码和测试夹具。
- `README.md`：增加 Web 开发、Tauri 开发和绿色包构建说明。
- `docs/第一版绿色便携包手动升级与数据库迁移方案.md`：补充最终实现路径和命令。

---

### Task 1: 建立工具链门禁和基线测试命令

**Files:**
- Create: `scripts/check-tauri-toolchain.ps1`
- Create: `tests/server/baseline.test.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run check:tauri`，失败时返回非零退出码。
- Produces: `npm test`，使用 `node --test` 执行 `tests/**/*.test.js`。

- [ ] **Step 1: 写工具链检查脚本测试契约**

在 `tests/server/baseline.test.js` 中验证项目关键入口存在且 `vite.config.js` 含 `base: './'`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('portable prerequisites remain explicit', () => {
  assert.equal(fs.existsSync('server/index.js'), true);
  assert.match(fs.readFileSync('vite.config.js', 'utf8'), /base:\s*['"]\.\/['"]/);
});
```

- [ ] **Step 2: 运行基线测试并确认当前缺少测试命令**

Run: `npm test`

Expected: FAIL，因为当前 `package.json` 没有 `test` script。

- [ ] **Step 3: 添加测试和工具链命令**

在 `package.json` 增加：

```json
{
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "check:tauri": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-tauri-toolchain.ps1"
  }
}
```

`check-tauri-toolchain.ps1` 必须检查 `node`、`npm`、`rustc`、`cargo`、`rustup`、活动 toolchain、PATH 第一优先级的 `link.exe` 和 WebView2 注册信息。不能在所有候选项中找到任意一个 MSVC linker 就放行；Cargo 实际命中的第一项必须是 Microsoft Linker：

```powershell
$ErrorActionPreference = 'Stop'
$commands = 'node','npm','rustc','cargo','rustup','link.exe'
foreach ($name in $commands) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required tool: $name"
  }
}
$allLinks = @(Get-Command link.exe -All)
$link = $allLinks | Select-Object -First 1
if (-not $link.Source -or $link.Source -notmatch 'Microsoft Visual Studio|BuildTools|VC\\Tools\\MSVC') {
  $found = ($allLinks.Source -join [Environment]::NewLine)
  throw "PATH-first link.exe is not MSVC. Open Developer PowerShell for VS 2022.`nFound:`n$found"
}
$versionInfo = (Get-Item -LiteralPath $link.Source).VersionInfo
if ($versionInfo.CompanyName -notmatch 'Microsoft') {
  throw "PATH-first link.exe is not published by Microsoft: $($link.Source)"
}
$activeToolchain = (& rustup show active-toolchain | Out-String).Trim()
if ($activeToolchain -notmatch 'x86_64-pc-windows-msvc') {
  throw "Rust active toolchain is not x86_64-pc-windows-msvc: $activeToolchain"
}
$hostTuple = (& rustc --print host-tuple).Trim()
if ($hostTuple -ne 'x86_64-pc-windows-msvc') { throw "Unexpected Rust target: $hostTuple" }
Write-Host "MSVC linker: $($link.Source)"
Write-Host "Linker product: $($versionInfo.ProductName)"
Write-Host "Linker company: $($versionInfo.CompanyName)"
Write-Host "Rust toolchain: $activeToolchain"
```

- [ ] **Step 4: 在 Visual Studio Developer PowerShell 中运行门禁**

Run: `npm run check:tauri`

Expected: 当前普通终端先 FAIL，报告 PATH 第一项是 `D:\Anaconda3\Library\usr\bin\link.exe`；在 Developer PowerShell for VS 2022 或调用 `VsDevCmd.bat -arch=x64 -host_arch=x64` 的构建终端中重新运行后 PASS，并输出 `MSVC 14.44.35207` linker 路径、ProductName、CompanyName 和 `stable-x86_64-pc-windows-msvc`。不得通过删除 Anaconda 文件解决。

- [ ] **Step 5: 生成原型依赖扫描记录**

在计划执行日志中保存以下只读扫描结果，并逐项标注“开发专用”“发布必须”或“需要移除”：

```powershell
rg -n "localhost|127\.0\.0\.1|https?://|[A-Za-z]:\\" web server vite.config.js package.json
rg -n "electron|preload|ipcRenderer|nodeIntegration" web server package.json
rg --files web server | Sort-Object
```

Expected: 记录 Vue/Vite 单入口、Express 本地服务、SQLite、`data/files/`、开发代理 3210，以及不存在 Electron API。任何新发现的生产绝对路径必须先进入本计划对应任务。

- [ ] **Step 6: 运行基线测试**

Run: `npm test`

Expected: PASS。

- [ ] **Step 7: 提交工具链门禁**

```bash
git add package.json package-lock.json .gitignore scripts/check-tauri-toolchain.ps1 tests/server/baseline.test.js
git commit -m "test: add Tauri toolchain preflight"
```

---

### Task 2: 统一便携数据路径并阻止路径逃逸

**Files:**
- Create: `server/config/paths.js`
- Create: `tests/server/paths.test.js`
- Modify: `server/db.js`
- Modify: `server/routes/classes.js`
- Modify: `server/routes/backup.js`
- Modify: `server/routes/documents.js`

**Interfaces:**
- Produces: `configureDataDir(dir: string): string`
- Produces: `getDataDir(): string`
- Produces: `resolveDataPath(...segments: string[]): string`
- Produces: `ensureDataLayout(): { dataDir: string, filesDir: string, backupDir: string, logsDir: string }`

- [ ] **Step 1: 写路径服务失败测试**

`tests/server/paths.test.js` 覆盖中文空格目录、绝对路径和 `..`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { configureDataDir, resolveDataPath } from '../../server/config/paths.js';

test('resolves paths inside configured portable data directory', () => {
  const root = path.resolve('tmp/教师 工作台/data');
  configureDataDir(root);
  assert.equal(resolveDataPath('files', 'a.pdf'), path.join(root, 'files', 'a.pdf'));
});

test('rejects traversal and absolute user segments', () => {
  assert.throws(() => resolveDataPath('files', '..', 'teacher.db'), /unsafe path/i);
  assert.throws(() => resolveDataPath('C:\\Windows\\win.ini'), /unsafe path/i);
});
```

- [ ] **Step 2: 运行测试确认模块不存在**

Run: `node --test tests/server/paths.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现唯一数据路径服务**

实现必须使用 `path.resolve` 后的前缀检查，并拒绝空段、`.`、`..` 和绝对子路径：

```js
let configuredDataDir;

export function configureDataDir(dir) {
  configuredDataDir = path.resolve(dir);
  return configuredDataDir;
}

export function getDataDir() {
  if (!configuredDataDir) {
    configureDataDir(process.env.TEACHER_WORK_DATA_DIR || path.join(process.cwd(), 'data'));
  }
  return configuredDataDir;
}

export function resolveDataPath(...segments) {
  if (segments.some(s => !s || s === '.' || s === '..' || path.isAbsolute(s))) {
    throw new Error('unsafe path segment');
  }
  const root = getDataDir();
  const resolved = path.resolve(root, ...segments);
  if (!resolved.startsWith(root + path.sep)) throw new Error('unsafe path escape');
  return resolved;
}
```

- [ ] **Step 4: 替换路由中的重复 data 目录计算**

`db.js` 和相关路由只能通过 `getDataDir()`、`resolveDataPath()` 获取数据库、上传和备份路径。用户提供的原始文件名只作为展示字段保存，磁盘文件继续使用程序生成的 `stored_name`。

- [ ] **Step 5: 运行路径与现有构建验证**

Run: `node --test tests/server/paths.test.js`

Expected: PASS。

Run: `$env:TEACHER_WORK_DATA_DIR="$env:TEMP\教师 工作台\data"; $env:SEED_DEMO='0'; $env:NO_OPEN='1'; npm start`

Expected: 服务在中文空格路径创建数据库，不写入项目 `data/`。

- [ ] **Step 6: 提交统一路径服务**

```bash
git add server/config/paths.js server/db.js server/routes/classes.js server/routes/backup.js server/routes/documents.js tests/server/paths.test.js
git commit -m "refactor: centralize portable data paths"
```

---

### Task 3: 建立数据库恢复点、迁移注册表和验证门禁

**Files:**
- Create: `server/db/index.js`
- Create: `server/db/backup.js`
- Create: `server/db/validate.js`
- Create: `server/db/migrations.js`
- Create: `tests/server/migrations.test.js`
- Modify: `server/db.js`

**Interfaces:**
- Produces: `openDatabase({ dataDir, appVersion }): Database`
- Produces: `getDatabaseVersion(db): number`
- Produces: `migrateDatabase(db, { appVersion, backupDir }): MigrationResult`
- Produces: `validateDatabase(db): { integrity: 'ok', foreignKeyErrors: unknown[] }`
- `MigrationResult`: `{ fromVersion: number, toVersion: number, backupPath: string | null }`

- [ ] **Step 1: 生成脱敏 v3 测试库并写失败测试**

测试使用临时目录创建 v3 数据库，插入一条班级和学生记录，然后调用尚不存在的 `migrateDatabase()`：

```js
test('backs up and migrates v3 without losing records', () => {
  const result = migrateDatabase(db, { appVersion: '1.0.0', backupDir });
  assert.equal(result.fromVersion, 3);
  assert.equal(result.toVersion, LATEST_DATABASE_VERSION);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM students').get().c, 1);
  assert.equal(fs.existsSync(result.backupPath), true);
});
```

再添加“比程序更新的数据库必须拒绝打开”和“迁移 SQL 失败后版本号保持不变”测试。

- [ ] **Step 2: 运行迁移测试确认失败**

Run: `node --test tests/server/migrations.test.js`

Expected: FAIL，因为新数据库模块尚不存在。

- [ ] **Step 3: 提取现有 v1-v3 迁移并建立不可变注册表**

`migrations.js` 使用显式版本：

```js
export const LATEST_DATABASE_VERSION = 3;
export const migrations = [
  { version: 1, name: 'initial-cleanup-and-aisle-mode', up: migrateV1 },
  { version: 2, name: 'student-follow-up-fields', up: migrateV2 },
  { version: 3, name: 'metric-source-field', up: migrateV3 },
];
```

全新数据库创建最新 schema 后直接设置最新版本；旧库严格执行 `current + 1` 到 `LATEST_DATABASE_VERSION`。

- [ ] **Step 4: 在迁移前创建 SQLite 一致性备份**

`backup.js` 使用 better-sqlite3 的备份能力或在关闭写事务时复制数据库，并写入 `backup.json`：

```js
{
  type: 'before-upgrade',
  fromAppVersion,
  toAppVersion,
  fromDatabaseVersion,
  toDatabaseVersion,
  createdAt,
  migrationStatus: 'pending'
}
```

只有检测到版本变化时才创建自动升级备份。

- [ ] **Step 5: 实现迁移后验证**

`validateDatabase()` 必须执行：

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

并验证核心表、关键索引和 `user_version`。任何失败都抛错，禁止启动业务。

- [ ] **Step 6: 保留 `server/db.js` 兼容入口**

现有路由仍可 `import db from '../db.js'`，但该文件只负责调用新模块并重新导出，避免一次性修改所有路由。

- [ ] **Step 7: 运行迁移测试与完整测试**

Run: `node --test tests/server/migrations.test.js`

Expected: PASS，包括备份、跨版本、失败回滚和过高版本拒绝。

Run: `npm test`

Expected: PASS。

- [ ] **Step 8: 提交迁移安全层**

```bash
git add server/db.js server/db tests/server/migrations.test.js
git commit -m "feat: add safe database migration recovery points"
```

---

### Task 4: 将 Express 拆成可嵌入应用与可控运行时

**Files:**
- Create: `server/app.js`
- Create: `server/runtime.js`
- Create: `tests/server/runtime.test.js`
- Create: `tests/server/auth.test.js`
- Modify: `server/index.js`

**Interfaces:**
- Produces: `createApp({ apiToken: string }): Express`
- Produces: `startServer({ host, port, apiToken, openBrowser }): Promise<RunningServer>`
- `RunningServer`: `{ host: string, port: number, baseUrl: string, close(): Promise<void> }`

- [ ] **Step 1: 写随机端口和认证失败测试**

测试调用 `startServer({ host: '127.0.0.1', port: 0, apiToken: 'test-token', openBrowser: false })`，验证：

```js
assert.notEqual(server.port, 0);
assert.equal((await fetch(`${server.baseUrl}/api/health`)).status, 401);
assert.equal((await fetch(`${server.baseUrl}/api/health`, {
  headers: { 'x-teacher-work-token': 'test-token' }
})).status, 200);
```

- [ ] **Step 2: 运行测试确认当前入口不可嵌入**

Run: `node --test tests/server/runtime.test.js tests/server/auth.test.js`

Expected: FAIL，因为 `startServer` 和注入令牌尚不存在。

- [ ] **Step 3: 提取 `createApp()`**

将中间件、路由、错误处理和静态 Web 托管移入 `server/app.js`。认证中间件挂在所有 `/api` 路由前，允许请求头或查询参数携带令牌：

```js
const supplied = req.get('x-teacher-work-token') || req.query.__token;
if (apiToken && supplied !== apiToken) {
  return res.status(401).json({ ok: false, error: '未授权的本地请求' });
}
```

查询参数只用于浏览器无法添加自定义头的文件预览/下载 URL，不写入日志。

- [ ] **Step 4: 实现随机端口运行时**

`runtime.js` 在 `server.address()` 后取得真实端口，关闭时等待 HTTP server 完成，并关闭数据库连接。

- [ ] **Step 5: 保留传统 Web 开发入口**

`server/index.js` 继续支持 `npm start`，默认端口 3210、仅绑定 127.0.0.1，并保持 `NO_OPEN=1` 行为。传统 Web 模式可以使用空令牌；Tauri Sidecar 必须传入非空令牌。

- [ ] **Step 6: 运行运行时、安全和 Web 模式测试**

Run: `node --test tests/server/runtime.test.js tests/server/auth.test.js`

Expected: PASS。

Run: `npm run dev`

Expected: Vue 开发代理和 Express 3210 模式保持可用。

- [ ] **Step 7: 提交可嵌入服务运行时**

```bash
git add server/app.js server/runtime.js server/index.js tests/server/runtime.test.js tests/server/auth.test.js
git commit -m "refactor: make Express server embeddable for desktop"
```

---

### Task 5: 构建自包含 Node Sidecar 并完成 better-sqlite3 风险门禁

**Files:**
- Create: `server/sidecar-entry.js`
- Create: `scripts/build-sidecar.mjs`
- Create: `tests/server/sidecar-smoke.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Sidecar arguments: `--data-dir <absolute-path> --api-token <token> --port 0 --app-version <semver>`
- Sidecar stdout ready line: `TEACHER_WORK_READY {"port":12345,"databaseVersion":3}`
- Sidecar stderr: 仅输出诊断信息，不输出 API token 或学生数据。

- [ ] **Step 1: 写 Sidecar 子进程冒烟测试**

测试启动生成的 Sidecar，等待 ready 行，带令牌请求 `/api/health`，创建数据库后终止进程：

```js
assert.match(readyLine, /^TEACHER_WORK_READY /);
assert.equal(health.ok, true);
assert.equal(fs.existsSync(path.join(tempDataDir, 'teacher.db')), true);
```

- [ ] **Step 2: 实现 Sidecar 入口参数解析**

入口必须拒绝缺失或相对 `--data-dir`、空令牌和非数字端口。成功启动后只输出一次机器可解析 ready 行；监听 SIGINT/SIGTERM，关闭 HTTP server 和数据库。

- [ ] **Step 3: 使用维护中的 `pkg` 实现构建脚本**

`scripts/build-sidecar.mjs` 必须：

1. 清理专用临时构建目录而不是用户目录；
2. 调用项目锁定的 Node Sidecar 编译器；
3. 把 better-sqlite3 原生绑定作为资产包含；
4. 输出 `build/sidecar/teacher-work-sidecar.exe`；
5. 立即在临时中文路径运行冒烟检查；
6. 冒烟失败时返回非零状态，禁止继续 Tauri 打包。

`package.json` 增加：

```json
{
  "scripts": {
    "build:sidecar": "node scripts/build-sidecar.mjs",
    "test:sidecar": "node --test tests/server/sidecar-smoke.test.js"
  }
}
```

- [ ] **Step 4: 运行自包含 Sidecar 风险门禁**

Run: `npm run build:sidecar`

Expected: 生成 Sidecar EXE。

Run: `npm run test:sidecar`

Expected: 在没有使用系统 `node.exe` 启动后端的情况下，SQLite 建库和健康请求 PASS。

- [ ] **Step 5: 如果单 EXE Sidecar 无法加载 better-sqlite3，执行既定回退方案**

回退不是跳过验证，而是改为在 `resources/runtime/` 携带 Node LTS 运行时、`server/` 生产文件和生产 `node_modules/`：

```text
resources/runtime/
├─ node.exe
├─ server/
└─ node_modules/
```

Rust 启动 `resources/runtime/node.exe resources/runtime/server/sidecar-entry.js ...`。`package-portable.mjs` 必须验证所有运行文件存在。两种方案都不得要求目标用户安装 Node；优先保留自包含 Sidecar EXE，只有该风险门禁失败才采用运行时目录。

- [ ] **Step 6: 提交可发布 Sidecar**

```bash
git add server/sidecar-entry.js scripts/build-sidecar.mjs tests/server/sidecar-smoke.test.js package.json package-lock.json .gitignore
git commit -m "feat: build self-contained desktop sidecar"
```

---

### Task 6: 建立 `desktopApi` 并保持 Web 模式兼容

**Files:**
- Create: `web/src/platform/runtimeConfig.js`
- Create: `web/src/platform/desktopApi.js`
- Create: `tests/web/desktop-api.test.js`
- Modify: `web/src/api.js`

**Interfaces:**
- Produces: `configureRuntime({ apiBaseUrl, apiToken, mode }): void`
- Produces: `getRuntimeConfig(): { apiBaseUrl: string, apiToken: string, mode: 'web' | 'tauri' }`
- Produces: `desktopApi.bootstrap(): Promise<RuntimeConfig>`
- Produces: `desktopApi.toApiUrl(path, { queryToken }): string`

- [ ] **Step 1: 写 Web/Tauri URL 构造失败测试**

```js
configureRuntime({ apiBaseUrl: 'http://127.0.0.1:45678', apiToken: 'secret', mode: 'tauri' });
assert.equal(desktopApi.toApiUrl('/api/classes'), 'http://127.0.0.1:45678/api/classes');
assert.match(desktopApi.toApiUrl('/api/documents/1/file', { queryToken: true }), /__token=secret/);
```

另测 Web 模式保持 `/api/classes` 相对 URL，且普通 fetch 请求带 `x-teacher-work-token` 头。

- [ ] **Step 2: 运行测试确认适配层不存在**

Run: `node --test tests/web/desktop-api.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现运行态适配器**

Web 模式默认：

```js
{ apiBaseUrl: '', apiToken: '', mode: 'web' }
```

Tauri 模式通过 `window.__TAURI_INTERNALS__` 检测，并调用 Rust `desktop_bootstrap` Command 获取 camelCase 配置。禁止在源码中写死生产端口。

- [ ] **Step 4: 改造统一请求函数**

`web/src/api.js` 保持现有 `api.classes`、`api.students` 等接口不变，只把 `fetch(url)` 改为 `fetch(desktopApi.toApiUrl(url), options)`，并在令牌非空时添加请求头。`documents.fileUrl/fileDl` 使用查询令牌生成 URL。

- [ ] **Step 5: 运行适配层、完整测试和 Web 回归**

Run: `node --test tests/web/desktop-api.test.js`

Expected: PASS。

Run: `npm test`

Expected: PASS。

Run: `npm run dev`

Expected: 所有现有页面继续通过 Vite proxy 使用 `/api`。

- [ ] **Step 6: 提交桌面适配层**

```bash
git add web/src/platform web/src/api.js tests/web/desktop-api.test.js
git commit -m "feat: add web and desktop API adapter"
```

---

### Task 7: 创建 Tauri v2 壳与最小权限配置

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/icons/*`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces Tauri command: `desktop_bootstrap() -> Result<DesktopBootstrap, String>`
- `DesktopBootstrap`: `{ apiBaseUrl: String, apiToken: String, dataDir: String, appVersion: String, databaseVersion: u32 }`

- [ ] **Step 1: 在通过 Task 1 门禁的终端安装 Tauri v2 依赖并生成壳**

Run: `npm install --save-dev @tauri-apps/cli@^2`

Run: `npm install @tauri-apps/api@^2`

创建 `src-tauri`，`beforeDevCommand` 使用 `npm run dev:web`，`beforeBuildCommand` 使用 `npm run build`，`frontendDist` 指向 `../web/dist`。

- [ ] **Step 2: 配置正式窗口和产品标识**

`tauri.conf.json` 至少包含：

```json
{
  "productName": "教师工作台",
  "version": "0.1.0",
  "identifier": "com.teacherwork.desktop",
  "build": {
    "beforeDevCommand": "npm run dev:web",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../web/dist"
  },
  "bundle": { "active": false }
}
```

`bundle.active=false` 表示首版不生成安装器；最终 ZIP 由自定义脚本构建。

- [ ] **Step 3: 配置 Windows GUI 子系统**

`main.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    teacher_work_lib::run();
}
```

- [ ] **Step 4: 配置最小 capability**

前端只允许调用注册的 `desktop_bootstrap` 等 Tauri Command。不授予任意 shell、任意文件系统或全磁盘 asset protocol 权限。Sidecar 由 Rust `std::process::Command` 启动，因此不需要向 WebView 开放 shell spawn 权限。

- [ ] **Step 5: 设置正式应用图标**

从确认后的源图生成 `.ico` 和 Tauri 所需尺寸。图标必须在 Release EXE 属性和任务栏中显示；若未来增加托盘，再单独设置托盘图标。本阶段不增加托盘和多窗口。

- [ ] **Step 6: 增加项目命令**

```json
{
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "npm run build:sidecar && tauri build --no-bundle"
  }
}
```

- [ ] **Step 7: 运行 Tauri 最小壳验证**

Run: `npm run tauri:dev`

Expected: 窗口打开 Vue UI；此时 Sidecar 生命周期尚未接入，API 未就绪属于预期。

Run: `npm run tauri:build`

Expected: 生成 `src-tauri/target/release/教师工作台.exe`，双击不弹命令行窗口。

- [ ] **Step 8: 检查 Release 前端资源引用**

Run: `rg 'src="/assets|href="/assets' web/dist`

Expected: 无输出；所有生成资源使用 `./assets/...` 或由 Vite 正确解析的相对引用。随后在关闭 Vite 后直接启动 Release EXE，确认不白屏。

- [ ] **Step 9: 提交 Tauri 壳**

```bash
git add src-tauri package.json package-lock.json
git commit -m "feat: scaffold Tauri v2 desktop shell"
```

---

### Task 8: 由 Rust 管理便携路径和 Sidecar 生命周期

**Files:**
- Create: `src-tauri/src/paths.rs`
- Create: `src-tauri/src/sidecar.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `server/sidecar-entry.js`
- Test: Rust unit tests in `src-tauri/src/paths.rs` and `src-tauri/src/sidecar.rs`

**Interfaces:**
- Produces: `PortablePaths::from_executable(exe: &Path) -> Result<PortablePaths>`
- `PortablePaths`: `{ root, resources, data, backup, logs, sidecar }`
- Produces: `SidecarManager::start(paths, appVersion) -> Result<DesktopBootstrap>`
- Produces: `SidecarManager::shutdown() -> Result<()>`

- [ ] **Step 1: 写 Rust 便携路径单元测试**

```rust
#[test]
fn derives_all_paths_from_executable_directory() {
    let paths = PortablePaths::from_executable(Path::new(r"D:\老师 资料\教师工作台.exe")).unwrap();
    assert_eq!(paths.data, PathBuf::from(r"D:\老师 资料\data"));
    assert_eq!(paths.sidecar, PathBuf::from(r"D:\老师 资料\resources\teacher-work-sidecar.exe"));
}
```

- [ ] **Step 2: 运行 Rust 测试确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，因为 `PortablePaths` 尚不存在。

- [ ] **Step 3: 实现 EXE 同级目录与可写检查**

Release 使用 `std::env::current_exe()` 的父目录。开发模式允许用仅在 debug 构建生效的环境变量覆盖根目录。创建 `data/`、`data/files/`、`backup/`、`logs/`，通过创建并删除探针文件确认可写。

- [ ] **Step 4: 实现安全 Sidecar 启动与 ready 握手**

Rust 生成至少 32 字节随机令牌，执行：

```text
resources/teacher-work-sidecar.exe
--data-dir <root/data>
--api-token <random-token>
--port 0
--app-version <version>
```

Windows 使用 `CREATE_NO_WINDOW`。Rust 读取 stdout，最多等待 15 秒，只接受 `TEACHER_WORK_READY {...}`，并确认端口位于 1～65535。超时或 Sidecar 提前退出时终止子进程并返回可显示错误。

- [ ] **Step 5: 注册 `desktop_bootstrap` Command**

Rust 返回：

```rust
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DesktopBootstrap {
    api_base_url: String,
    api_token: String,
    data_dir: String,
    app_version: String,
    database_version: u32,
}
```

前端只能读取启动结果，不能指定任意 Sidecar 路径或参数。

- [ ] **Step 6: 实现唯一实例生命周期和退出清理**

主窗口关闭即退出应用；Rust 在 `RunEvent::ExitRequested/Exit` 中关闭 Sidecar。首版不实现“关闭窗口隐藏到托盘”。Sidecar 意外退出时向主窗口发出错误事件，并禁止继续发起业务请求。

- [ ] **Step 7: 运行 Rust、Sidecar 和 Tauri 联调测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS。

Run: `npm run tauri:dev`

Expected: Vue 页面通过随机回环端口使用全部 API；关闭窗口后 Sidecar 进程退出；系统中没有遗留 `teacher-work-sidecar.exe`。

- [ ] **Step 8: 提交 Sidecar 生命周期**

```bash
git add src-tauri/src server/sidecar-entry.js
git commit -m "feat: manage portable sidecar lifecycle in Tauri"
```

---

### Task 9: 完成业务功能、文件安全和数据库升级回归

**Files:**
- Modify: `server/routes/documents.js`
- Modify: `server/routes/backup.js`
- Modify: `web/src/views/Documents.vue`
- Create: `tests/server/documents-security.test.js`
- Create: `tests/server/backup-restore.test.js`
- Create: `scripts/test-portable-migration.ps1`

**Interfaces:**
- 文件上传继续返回现有业务结构；新增字段保持 camelCase。
- 备份元数据包含 `appVersion`、`databaseVersion`、`createdAt`、`includesFiles`。

- [ ] **Step 1: 写文件路径穿越和备份恢复失败测试**

覆盖文件名 `../teacher.db`、绝对路径、伪造 stored name、跨班级文件访问、无令牌文件下载、数据库备份恢复后记录数一致。

- [ ] **Step 2: 运行测试确认现有薄弱点**

Run: `node --test tests/server/documents-security.test.js tests/server/backup-restore.test.js`

Expected: 至少路径服务集成或完整恢复元数据测试 FAIL。

- [ ] **Step 3: 收紧文件管理边界**

上传文件只保存程序生成的随机 `stored_name`，下载路径只能通过数据库记录和 `resolveDataPath('files', storedName)` 解析。响应禁止返回真实磁盘绝对路径。

- [ ] **Step 4: 完成升级前备份和用户完整备份区分**

自动迁移恢复点默认备份数据库；涉及文件迁移时备份完整 `data/`。用户点击“完整备份”时包含数据库和 `files/`，并生成元数据清单。

- [ ] **Step 5: 实现旧库跨版本测试脚本**

`test-portable-migration.ps1` 对每个脱敏夹具复制到临时中文路径，启动 Sidecar，等待迁移，执行 `integrity_check` 和核心 API 冒烟，再关闭进程。

- [ ] **Step 6: 运行全部回归**

Run: `npm test`

Expected: PASS。

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-portable-migration.ps1`

Expected: 全新库、v1、v2、v3 到最新版本全部 PASS；原有测试夹具不被修改。

- [ ] **Step 7: 提交数据安全回归**

```bash
git add server/routes web/src/views/Documents.vue tests/server scripts/test-portable-migration.ps1
git commit -m "test: harden portable files and database upgrades"
```

---

### Task 10: 自动组装绿色目录和 ZIP

**Files:**
- Create: `scripts/package-portable.mjs`
- Create: `tests/packaging/portable-package.test.js`
- Create: `packaging/README.template.txt`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run package:portable`
- Produces directory: `release/教师工作台-vX.Y.Z-windows-portable/教师工作台/`
- Produces ZIP: `release/教师工作台-vX.Y.Z-windows-portable.zip`

- [ ] **Step 1: 写打包结构失败测试**

测试从临时假 Release 文件组装包，并断言：

```js
assert.equal(exists('教师工作台/教师工作台.exe'), true);
assert.equal(exists('教师工作台/resources/teacher-work-sidecar.exe'), true);
assert.equal(exists('教师工作台/data'), true);
assert.equal(exists('教师工作台/README.txt'), true);
assert.equal(exists('教师工作台/data/teacher.db'), false);
```

还要验证 README 为 UTF-8，包含“必须完整解压”“不能单独移动 EXE”“SmartScreen”“WebView2”“备份 data”。

- [ ] **Step 2: 运行测试确认打包器不存在**

Run: `node --test tests/packaging/portable-package.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现可重复打包脚本**

脚本必须：

1. 从 `package.json` 读取 SemVer；
2. 检查主 EXE 和 Sidecar EXE 存在且大小非零；
3. 创建全新的版本专属 staging 目录；
4. 复制主 EXE 到根目录并重命名为 `教师工作台.exe`；
5. 复制 Sidecar 到 `resources/teacher-work-sidecar.exe`；
6. 创建空 `data/`、`backup/`、`logs/`；
7. 生成 UTF-8 `README.txt`；
8. 生成包含文件大小和 SHA-256 的 `manifest.json`；
9. 生成 ZIP；
10. 重新读取 ZIP 清单，确认没有 `teacher.db`、真实上传文件或开发绝对路径；
11. 禁止依赖 Tauri 某次构建产生的 `_up_`、`__up__` 等内部资源层级；缺少明确来源文件时直接失败；
12. 检查最终目录只有一层产品目录，不出现 `教师工作台/教师工作台/` 重复嵌套。

- [ ] **Step 4: 增加构建流水线命令**

```json
{
  "scripts": {
    "build:release": "npm run check:tauri && npm test && npm run build:sidecar && tauri build --no-bundle",
    "package:portable": "npm run build:release && node scripts/package-portable.mjs"
  }
}
```

正式发布流水线从干净依赖状态开始执行 `npm ci`，而不是用 `npm install` 静默修改锁文件。若当前工作目录用于持续开发，则在独立发布工作目录或 CI 中执行：

```powershell
npm ci
npm run package:portable
```

- [ ] **Step 5: 运行打包测试与真实打包**

Run: `node --test tests/packaging/portable-package.test.js`

Expected: PASS。

Run: `npm run package:portable`

Expected: 生成最终 ZIP，且脚本输出主 EXE、Sidecar、README 和 ZIP 的 SHA-256。

Run: `Get-ChildItem -Recurse release\教师工作台-v0.1.0-windows-portable`

Expected: 只包含运行所需 EXE、`resources/`、空 `data/`、`backup/`、`logs/`、README 和 manifest；不含源码、`.env`、密钥、测试缓存、Cargo target、node_modules 或安装器。

Run: `Get-Content -Raw -Encoding UTF8 'release\教师工作台-v0.1.0-windows-portable\教师工作台\README.txt'`

Expected: 中文完整可读，不出现 `锟斤拷`、`浣跨敤` 等乱码；人工再使用 Windows 记事本打开一次确认。

- [ ] **Step 6: 提交便携打包器**

```bash
git add scripts/package-portable.mjs tests/packaging/portable-package.test.js packaging/README.template.txt package.json .gitignore
git commit -m "build: package Windows portable ZIP"
```

---

### Task 11: 最终 ZIP 自动 QA 与人工验收

**Files:**
- Create: `scripts/qa-portable.ps1`
- Create: `docs/QA-绿色便携版验收记录.md`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run qa:portable -- <zip-path>`
- Produces QA report with PASS/FAIL/NOT VERIFIED for every acceptance item.

- [ ] **Step 1: 实现独立解压自动 QA**

脚本必须把 ZIP 解压到全新临时目录，目录名同时包含中文和空格，例如：

```text
%TEMP%\教师 工作台 QA\first-run\
```

自动检查：

- ZIP 可正常解压；
- 主 EXE 和 Sidecar 存在；
- 开发端口 3210 没有被本项目进程占用；
- 启动主 EXE 后创建 `data/teacher.db`；
- `logs/` 出现成功启动记录；
- 保存一条脱敏测试记录后退出；
- 再次启动后记录仍存在；
- 关闭窗口后 Sidecar 不残留。

- [ ] **Step 2: 增加移动目录后重启测试**

关闭程序后，把整个解压目录移动到另一个中文空格路径，重新启动并验证原数据仍存在，证明没有依赖首次解压绝对路径。

- [ ] **Step 3: 增加 WebView2 检测结果**

检测 Evergreen WebView2 注册表或运行时文件。未安装时把结果标记为 FAIL，并在报告中给出官方下载说明；不得把“当前开发机已安装”写成所有目标机器都已验证。

- [ ] **Step 4: 增加普通用户环境验证门禁**

把最终 ZIP 复制到一台没有源码、Node.js、Rust、Cargo 和 Visual Studio Build Tools 的普通 Windows 10/11 电脑或干净虚拟机，完成首次启动、保存、重启和退出测试。若当前没有该环境，发布记录必须标记 `NOT VERIFIED`，不得写成已验证；正式对外发布前该项必须转为 PASS。

- [ ] **Step 5: 执行最终自动 QA**

在关闭 `npm run dev`、`npm start` 和 `tauri dev` 的条件下运行：

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa-portable.ps1 -ZipPath release/教师工作台-v0.1.0-windows-portable.zip`

Expected: 所有自动检查 PASS，开发服务器未启动。

- [ ] **Step 6: 完成人工业务 QA**

至少人工验证：

```text
班级新增与修改
学生新增、修改、删除和恢复
Excel 导入导出
座位拖拽与自动排座
成绩录入与图表
考勤、请假、家校沟通
文档上传、预览、下载和删除恢复
完整备份与恢复
关闭窗口后再次启动
```

每项在 `docs/QA-绿色便携版验收记录.md` 标记 PASS、FAIL 或 NOT VERIFIED，并记录系统版本、WebView2 版本、ZIP SHA-256 和测试路径。

- [ ] **Step 7: 检查未签名程序体验和杀毒软件表现**

记录 Windows SmartScreen、Microsoft Defender 或其他常见杀毒软件是否出现提示或隔离。未购买代码签名证书不阻塞首版，但 README 和 QA 报告必须明确这是已知限制，不能声称不存在安全提示。

- [ ] **Step 8: 更新项目使用说明**

`README.md` 增加：

```text
npm run dev
npm test
npm run tauri:dev
npm run tauri:build
npm run package:portable
```

并说明最终发布必须以独立解压 ZIP 的 QA 结果为准。

- [ ] **Step 9: 提交 QA 工具和记录**

```bash
git add scripts/qa-portable.ps1 docs/QA-绿色便携版验收记录.md README.md
git commit -m "test: verify portable release end to end"
```

---

### Task 12: 第一版发布冻结与手动升级演练

**Files:**
- Create: `docs/RELEASE-绿色便携版-v0.1.0.md`
- Modify: `docs/第一版绿色便携包手动升级与数据库迁移方案.md`

**Interfaces:**
- Produces: 可交付 ZIP、校验摘要、构建命令、自动测试结果、人工 QA 结果和已知限制清单。

- [ ] **Step 1: 从上一正式数据基线演练升级**

准备旧程序目录和脱敏旧数据库，只用“关闭旧程序 → 覆盖程序/资源 → 启动新版”的用户流程升级。验证自动恢复点、数据库版本变化和业务数据保留。

- [ ] **Step 2: 演练刚升级即失败的联合回滚**

使用故意失败的测试迁移构建内部测试包，确认：

```text
迁移事务回滚
数据库版本不变
原数据库可打开
恢复点存在
新版不进入业务界面
换回旧程序后可以继续使用
```

测试迁移不得进入正式发布构建。

- [ ] **Step 3: 检查发布包不含用户数据和开发路径**

Run: `rg -a -n "E:\\CodeFile|C:\\Users\\kangt|teacher.db" release/教师工作台-v0.1.0-windows-portable`

Expected: 不出现开发机绝对路径；空目录不包含 `teacher.db`。如果二进制字符串产生误报，逐项解释并确认不是运行路径依赖。

- [ ] **Step 4: 写最终发布记录**

发布记录必须列出：

1. 最终 ZIP 路径和 SHA-256；
2. ZIP 目录结构；
3. 完整构建命令；
4. 自动化测试结果；
5. Release 独立解压人工 QA 结果；
6. 未验证事项；
7. SmartScreen、WebView2、代码签名和目录写权限限制；
8. 数据库版本和可升级来源版本；
9. 手动升级与回滚说明。

- [ ] **Step 5: 运行最终总门禁**

Run: `npm run check:tauri`

Run: `npm test`

Run: `npm run package:portable`

Run: `npm run qa:portable -- release/教师工作台-v0.1.0-windows-portable.zip`

Expected: 全部 PASS；任何失败都阻止声明完成。

- [ ] **Step 6: 提交发布记录**

```bash
git add docs/RELEASE-绿色便携版-v0.1.0.md docs/第一版绿色便携包手动升级与数据库迁移方案.md
git commit -m "docs: record first portable release"
```

---

## 3. 验收定义

只有同时满足以下条件，才能认为“外部 Web 原型已转换为 Windows 绿色便携版”：

- [ ] 最终 ZIP 生成成功；
- [ ] ZIP 在独立中文和空格目录中完整解压；
- [ ] 开发服务器和系统 Node 进程均未用于运行发布版；
- [ ] 双击 `教师工作台.exe` 不出现命令行窗口；
- [ ] 主窗口和全部核心业务页面正常工作；
- [ ] Sidecar 只监听随机 `127.0.0.1` 端口并要求令牌；
- [ ] 首次启动在 EXE 同级创建 `data/teacher.db`；
- [ ] 保存数据后退出、重启仍存在；
- [ ] 移动整个便携目录后仍能读取同一份数据；
- [ ] 文档上传文件被复制到 `data/files/`；
- [ ] 数据库迁移前自动备份且失败可恢复；
- [ ] 关闭主窗口后 Sidecar 不残留；
- [ ] ZIP 不包含真实用户数据和开发机绝对路径；
- [ ] README 明确完整解压、数据备份、SmartScreen 和 WebView2 限制；
- [ ] 自动化测试、Release QA、未验证事项和 SHA-256 均有书面记录。

## 4. 明确不进入首版范围的事项

- 在线自动更新助手；
- MSI/NSIS 安装器；
- 全量 Rust 后端重写；
- 托盘常驻、多窗口和关闭后隐藏；
- 全项目 JavaScript 到 TypeScript 迁移；
- 固定版本 WebView2 Runtime 大包；
- Windows 商业代码签名证书采购；
- 云端同步、多用户账号和远程数据库。

这些能力可以在首个绿色版通过验收后独立规划，避免扩大本轮转换风险。

## 5. 官方技术依据

- Tauri v2 Windows 开发依赖 Microsoft C++ Build Tools 和 WebView2，并要求 MSVC Rust 工具链。
- Tauri v2 支持把自包含 Node 程序作为 Sidecar，以避免目标用户另行安装 Node.js。
- Sidecar 文件名和目标架构必须匹配；本计划的自定义便携打包器负责按最终运行目录整理文件。
- Windows 10 1803 及更新版本通常随系统提供 WebView2，但最终仍需检测并向缺失用户提供安装说明。
- Tauri 官方 Windows 分发主要面向 MSI/NSIS；本项目的绿色 ZIP 使用 `tauri build --no-bundle` 加自定义打包脚本，因此必须自行完成最终目录和解压运行验证。
