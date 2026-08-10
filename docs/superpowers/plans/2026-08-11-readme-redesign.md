# 教师工作台 README 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将根目录 README 重写为无乱码、用户下载优先、开发信息完整且与 v0.2.0 当前实现一致的项目入口文档。

**Architecture:** README 采用双层阅读路径，前半部分让普通教师完成下载、解压、启动、备份和手动升级，后半部分让开发者了解同源 Web/EXE 架构、开发命令、Windows 构建门禁与便携包 QA。所有事实从当前代码、构建脚本、项目文档和 GitHub Releases 中核验，不保留无法验证的数字。

**Tech Stack:** Markdown、Vue 3、Vite 6、Express、SQLite、Tauri v2、Rust MSVC、GitHub Releases

## Global Constraints

- 只修改 `README.md` 和本实施计划，不修改产品功能、数据库、构建脚本或 Release 附件。
- README 使用 UTF-8 中文，清除全部乱码字符。
- 正式下载只链接 GitHub Releases，不把本地 `release/` 描述为源码仓库交付目录。
- `v0.2.0` 标记为最新版，`v0.1.0` 标记为历史版本。
- Web 与 EXE 描述为同一产品、同一套 Vue 业务代码和同一版本号，仅运行环境适配不同。
- npm 命令必须来自当前 `package.json`。
- Windows 构建说明必须包含 MSVC `link.exe`、Rust MSVC toolchain、Windows SDK 和 WebView2。
- 最终便携包 QA 必须包含关闭开发服务器后从独立解压目录启动 EXE。

---

### Task 1: 建立 README 事实清单

**Files:**
- Read: `package.json`
- Read: `src-tauri/tauri.conf.json`
- Read: `src-tauri/Cargo.toml`
- Read: `scripts/package-portable.mjs`
- Read: `scripts/qa-portable.ps1`
- Read: `docs/web-desktop-feature-parity-v0.2.0.md`
- Read: `docs/tauri-portable-windows-handbook.md`
- Read: `docs/第一版绿色便携包手动升级与数据库迁移方案.md`

**Interfaces:**
- Consumes: 当前仓库代码、脚本、文档以及 GitHub Releases `v0.1.0`、`v0.2.0`
- Produces: README 可使用的版本、命令、目录、功能、构建条件和限制事实集合

- [ ] **Step 1: 核对统一版本号**

Run:

```powershell
npm run version:check
```

Expected: 输出 `产品版本检查通过：0.2.0`。

- [ ] **Step 2: 提取当前 npm 命令**

Run:

```powershell
node -e "const p=require('./package.json'); console.log(p.version); console.log(Object.keys(p.scripts).join('\n'))"
```

Expected: 版本为 `0.2.0`，命令包含 `dev`、`build`、`start`、`test`、`version:check`、`tauri:dev`、`tauri:build`、`package:portable`、`qa:portable`。

- [ ] **Step 3: 核对 GitHub Release 链接**

Run:

```powershell
gh release list --repo kejixiaoliang/teacher-work-platform --limit 10
```

Expected: `v0.2.0` 显示为 Latest，`v0.1.0` 显示为历史发布且不带 Latest。

- [ ] **Step 4: 核对项目结构和构建门禁**

Read the listed files and record only facts directly supported by them. Do not retain old README claims such as fixed API group counts or database table counts unless current code provides a single authoritative value.

### Task 2: 重写用户入口部分

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 的版本、Release、便携目录和升级事实
- Produces: README 前半部分，覆盖普通用户从下载到升级的完整路径

- [ ] **Step 1: 替换标题区和首屏信息**

Write a UTF-8 heading containing:

```markdown
# 教师工作台

面向班主任的本地班级管理工具。支持 Windows 免安装绿色便携版，也支持浏览器开发运行；数据默认保存在本机。
```

Keep concise technology badges only when their versions match `package.json` or configuration files.

- [ ] **Step 2: 添加最新版下载区**

Include direct links:

```markdown
- [下载教师工作台 v0.2.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.2.0)
- [查看历史版本 v0.1.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.1.0)
```

State that users must download and fully extract the ZIP before launching the EXE.

- [ ] **Step 3: 添加普通用户快速开始**

Document this exact sequence:

```text
下载 ZIP → 完整解压 → 保持整个目录结构 → 双击教师工作台.exe
```

Explain that users do not need Node.js, Rust or an installer when using the Release package.

- [ ] **Step 4: 添加数据和升级说明**

Explain that `data/` is stored beside the portable application, users must exit the application and back up `data/` before upgrading, and an older EXE must not be assumed compatible with a database already migrated by a newer version.

- [ ] **Step 5: 添加核心功能概览**

Summarize verified modules with short descriptions: classes, students, seats and drag-to-swap, scores, attendance, leave, duties, documents, class leaders, subject representatives, contacts, analytics, guide and changelog.

### Task 3: 重写开发者部分

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 的架构、脚本和平台条件事实
- Produces: README 后半部分，覆盖架构、开发、构建与 QA

- [ ] **Step 1: 说明 Web 与 EXE 同源架构**

Add a compact flow:

```text
Vue 业务界面 → 运行环境适配层 → Express API → SQLite
                         ↘ Tauri v2 桌面壳与便携路径
```

State that Web and EXE share business code and version contract; do not describe them as independently maintained products.

- [ ] **Step 2: 添加技术栈与目录结构**

List only current directories and responsibilities, including `web/`, `server/`, `src-tauri/`, `scripts/`, `tests/`, `docs/`, and the runtime-generated `data/`.

- [ ] **Step 3: 添加开发命令**

Document:

```powershell
npm install
npm run dev
npm test
npm run build
npm start
npm run tauri:dev
npm run tauri:build
npm run package:portable
npm run qa:portable
```

Briefly state what each command does without inventing unsupported parameters.

- [ ] **Step 4: 添加 Windows 构建门禁**

Include:

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
where.exe link
```

State that the first `link.exe` must be the Visual Studio MSVC linker rather than Anaconda, and reference `docs/tauri-portable-windows-handbook.md` for the full procedure.

- [ ] **Step 5: 添加打包与 QA 规则**

State that completion requires testing the Release EXE and final ZIP from a separate extracted directory with the development server stopped. Mention Chinese paths, paths containing spaces, empty first-run `data/`, restart persistence, moving the whole directory, SmartScreen and WebView2.

- [ ] **Step 6: 添加文档导航和已知限制**

Link to the existing PRD, portability handbook, manual upgrade/database migration plan, Web/desktop parity baseline and development history. Mention unsigned binaries, directory write permission and WebView2 dependency without presenting them as unresolved application defects.

### Task 4: 验证 README

**Files:**
- Test: `README.md`
- Test: project scripts and linked local Markdown files

**Interfaces:**
- Consumes: Tasks 2 and 3 完成后的 README
- Produces: 可提交、无乱码、链接和命令与项目一致的最终文档

- [ ] **Step 1: 扫描乱码与占位符**

Run:

```powershell
rg -n "锛|鈥|馃|TBD|TODO|待补充" README.md
```

Expected: no matches.

- [ ] **Step 2: 校验本地 Markdown 链接**

Extract relative `docs/*.md` targets from `README.md` and verify each one exists with `Test-Path -LiteralPath`.

Expected: every local documentation link resolves to an existing file.

- [ ] **Step 3: 校验项目版本与测试**

Run:

```powershell
npm test
```

Expected: all Node tests pass and the version contract reports `0.2.0`.

- [ ] **Step 4: 校验 Web Release 构建**

Run:

```powershell
npm run build
```

Expected: Vite build exits with code 0.

- [ ] **Step 5: 检查 Markdown 与 Git 差异**

Run:

```powershell
git diff --check
git diff -- README.md
git status -sb
```

Expected: no whitespace errors; only the planned README and plan changes are present.

- [ ] **Step 6: 提交 README**

```powershell
git add README.md docs/superpowers/plans/2026-08-11-readme-redesign.md
git commit -m "文档：重写项目 README 与绿色版使用指南"
```

Expected: a Chinese commit containing the implementation plan and rewritten README.
