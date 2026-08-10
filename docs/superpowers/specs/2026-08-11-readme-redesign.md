# 教师工作台 README 重构设计

## 1. 目标

重写项目根目录 `README.md`，修复现有中文乱码和信息过时问题，让同一份文档同时服务普通教师用户与项目开发者。

README 采用“用户优先、开发者信息后置”的顺序。普通用户进入仓库后应能立即找到最新版下载、启动方式、数据位置、备份与升级提醒；开发者继续向下阅读时，应能准确了解 Web 与 EXE 的共用代码关系、开发命令、Windows 构建门禁、便携包生成方式和验证要求。

## 2. 读者与阅读路径

### 2.1 普通用户

普通用户无需了解 Node.js、Rust 或 Tauri。README 首屏提供以下信息：

- 产品用途与当前版本
- GitHub Releases 最新版下载入口
- ZIP 完整解压和双击 EXE 的启动步骤
- `data` 目录是用户数据目录
- 升级前备份 `data` 的提醒

### 2.2 开发者

开发者从功能概览继续阅读，获得以下信息：

- Vue 前端、Express 后端和 SQLite 数据库的关系
- Web 原型与 Tauri EXE 复用同一套 Vue 业务代码
- Web 与桌面环境仅通过适配层区分
- 本地开发、测试、构建和便携包 QA 命令
- MSVC `link.exe`、WebView2 和 Windows SDK 等构建前置条件

## 3. README 信息结构

README 按以下顺序组织：

1. 项目标题、当前版本、简短定位与技术徽章
2. 最新版 `v0.2.0` GitHub Release 下载入口
3. 普通用户快速开始
4. 便携目录、数据保存与文件移动规则
5. 手动升级、数据库迁移与备份提醒
6. 核心功能概览
7. Web 与 EXE 同源架构说明
8. 技术栈
9. 项目目录结构
10. 开发环境与常用命令
11. Tauri Windows 构建门禁
12. Release 构建、便携打包与 QA
13. 版本记录与详细文档入口
14. SmartScreen、WebView2、目录写入权限等已知限制
15. 数据安全与隐私说明

## 4. 内容原则

### 4.1 用户下载与源码分离

README 只把 GitHub Releases 描述为正式便携包下载位置。仓库中的 `release/` 是本地构建输出目录，受 `.gitignore` 排除，不应提示用户从源码目录下载 ZIP。

### 4.2 Web 与 EXE 是同一产品

README 不把 Web 与 EXE 描述为两套应用。文档明确说明：

- 两种运行方式共用 Vue 页面、业务规则、后端服务和数据库迁移逻辑
- Web 开发模式通过浏览器访问
- EXE 通过 Tauri v2 提供桌面壳和便携路径能力
- `desktopApi` 或同类环境适配层负责运行环境差异
- 产品版本号由项目版本契约统一校验

### 4.3 绿色便携版规则

用户说明必须包含：

- 下载后完整解压 ZIP
- 不在压缩包内直接运行
- 不单独移动 EXE
- 数据默认保存在应用目录的 `data/`
- 升级前退出程序并备份 `data/`
- 手动升级时替换程序文件，保留用户数据
- 不承诺任意旧版本都可无条件回滚数据库

### 4.4 命令以项目脚本为准

README 仅列出 `package.json` 中实际存在的命令：

```text
npm run dev
npm run build
npm test
npm start
npm run tauri:dev
npm run tauri:build
npm run package:portable
npm run qa:portable
```

不写未经验证或已经废弃的启动方式。

## 5. 事实来源

README 中的版本、命令和技术说明以以下文件为准：

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `scripts/package-portable.mjs`
- `scripts/qa-portable.ps1`
- `docs/web-desktop-feature-parity-v0.2.0.md`
- `docs/tauri-portable-windows-handbook.md`
- GitHub Releases `v0.1.0` 与 `v0.2.0`

不保留无法从当前项目核实的接口数量、数据表数量或性能数字。

## 6. 表达与排版

- 全文使用 UTF-8 中文，清除现有乱码
- 标题简短，减少装饰性表情和宣传口号
- 首屏优先给出可执行动作
- 普通用户说明使用短步骤和醒目提示
- 技术内容使用表格、代码块和相对路径链接
- 避免重复解释同一件事
- 详细迁移、构建和历史资料保留在 `docs/`，README 只提供摘要与入口

## 7. 验收标准

README 重写完成后应满足：

1. 文件以 UTF-8 正常显示，无乱码和损坏字符。
2. `v0.2.0` 下载链接指向 GitHub Releases，而非仓库内 ZIP。
3. `v0.1.0` 作为历史版本列出，`v0.2.0` 标明为最新版。
4. 普通用户在首屏附近能找到下载、解压、启动、数据目录和升级备份说明。
5. 文档明确 Web 与 EXE 共用同一套业务代码和版本号。
6. 所有 npm 命令均与 `package.json` 一致。
7. Windows 构建门禁包含 MSVC `link.exe`、Rust MSVC toolchain、Windows SDK 和 WebView2。
8. 便携包 QA 明确要求关闭开发服务器后，从独立解压目录启动最终 EXE。
9. README 中的本地文档链接均可解析到现有文件。
10. 修改后运行测试、版本契约检查、Web 构建与 Markdown 链接检查。

## 8. 范围边界

本次只重构根目录 README，不修改产品功能、UI、数据库、构建脚本或 Release 附件。若核对过程中发现代码与文档冲突，只在 README 中采用当前代码事实，并把需要另行处理的问题记录在交付说明中。
