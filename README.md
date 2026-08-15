<div align="center">

# 教师工作台

面向班主任的本地班级管理工具

支持 Windows 免安装绿色便携版，也支持浏览器开发运行。学生、座位、成绩、考勤、文档等数据默认保存在本机。

[![Version](https://img.shields.io/badge/version-0.4.0-f35b3f)](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.0)
![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db?logo=tauri&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57?logo=sqlite&logoColor=white)

</div>

## 下载最新版

当前稳定版本为 **v0.4.0**。

- [下载教师工作台 v0.4.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.0)
- [查看历史版本 v0.1.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.1.0)

普通用户请从 GitHub Releases 下载 Windows x64 绿色便携 ZIP。使用发布包不需要安装 Node.js、Rust，也不需要运行安装器。

> 必须先完整解压 ZIP，再双击“教师工作台.exe”。不要在压缩包内直接运行，也不要单独移动 EXE。

## 快速开始

1. 打开 [v0.4.0 Release 页面](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.0)。
2. 下载 `教师工作台-v0.4.0-windows-x64-portable.zip`。
3. 将整个 ZIP 解压到桌面、文档目录或其他有写入权限的位置。
4. 保持 EXE、`resources`、`data`、`backup` 和 `logs` 的相对位置不变。
5. 双击“教师工作台.exe”。
6. 首次启动后先建立班级，再录入或导入学生。

推荐目录结构如下。

```text
教师工作台/
├─ 教师工作台.exe
├─ resources/       程序运行资源
├─ data/            数据库与用户文件
├─ backup/          数据库迁移恢复点与备份
├─ logs/            运行与诊断日志
├─ manifest.json    发布包文件清单
└─ README.txt       便携版使用说明
```

## 数据保存与备份

教师工作台采用真正的便携数据目录。核心数据存放在应用目录旁的 `data/` 中，包括 SQLite 数据库和用户上传的文件。

- 复制整个应用目录，可以一起移动程序和数据。
- 日常备份至少应复制完整的 `data/`。
- 涉及版本升级时，建议同时保留 `backup/` 和 `logs/`。
- 不要把应用放在 `Program Files` 等普通用户可能没有写权限的位置。
- 不要只备份 `teacher.db` 后忽略 `data/files/` 中的上传文件。

## 手动升级

当前版本采用手动绿色升级方式。

1. 完全退出旧版应用，确认后台进程已经结束。
2. 复制旧版的 `data/`、`backup/` 和 `logs/` 作为升级前备份。
3. 下载并完整解压新版便携包。
4. 保留旧版用户数据，替换程序文件和 `resources/`。
5. 启动新版，等待数据库迁移完成。
6. 检查班级、学生、座位、成绩、考勤和文档是否正常。

数据库迁移前会创建恢复备份。数据库已经被新版升级后，不要只换回旧 EXE。旧程序可能无法正确读取新版数据库。需要回退时，应同时恢复匹配版本的程序和数据库备份。

详细规则见 [第一版绿色便携包手动升级与数据库迁移方案](docs/第一版绿色便携包手动升级与数据库迁移方案.md)。

## 核心功能

| 模块 | 主要能力 |
| --- | --- |
| 班级 | 多班级管理、学年学期、座位网格和教室布局设置 |
| 学生 | 新增编辑、搜索筛选、Excel 导入导出、成长档案、健康记录和回收站 |
| 座位 | 拖拽移动与交换、点击换座、锁定座位、自动排座、轮换、历史恢复和打印 |
| 成绩 | 考试管理、手动录入、Excel 导入、统计排名和趋势查看 |
| 考勤与请假 | 每日考勤、月度统计、请假台账和销假管理 |
| 表现量化 | 自定义行为规则、批量记分、月度/学期统计、修正留痕和 Excel/CSV/JSON 导出 |
| 值日 | 分组、轮换、自动分组和打印值日表 |
| 文档 | 上传、分类、标签、预览、重命名和回收站 |
| 班委与课代表 | 班委、课代表的选择、编辑和预设 |
| 家校沟通 | 家访、电话、微信等沟通记录和统计筛选 |
| 数据分析 | 班级结构、健康、成绩等图表概览 |
| 使用支持 | 内置使用指南和版本更新记录 |

v0.2.0 已统一浏览器与 WebView2 中的座位拖拽行为，并在学生录入与导入前检查班级是否存在。详细审计见 [Web 与 EXE 功能一致性基线](docs/web-desktop-feature-parity-v0.2.0.md)。

## Web 与 EXE 共用一套业务代码

项目不维护两套独立产品。浏览器版本和 Windows EXE 共用 Vue 页面、业务规则、Express API、SQLite 数据库迁移逻辑和产品版本号。

```text
Vue 业务界面
    ↓
运行环境适配层 desktopApi
    ↓
Express API
    ↓
SQLite 与用户文件

Tauri v2 负责桌面窗口、启动内置后端和计算便携目录
```

浏览器开发模式使用本地开发服务器。Tauri Release 使用 WebView2 加载同一套前端构建产物，并启动发布包中自带的 Node.js 后端。环境差异集中在 `web/src/platform/`，业务页面不为 EXE 单独维护副本。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、Vite 6、Element Plus、ECharts、ExcelJS |
| 后端 | Node.js、Express、Multer |
| 数据 | SQLite、better-sqlite3 |
| 桌面 | Tauri v2、Rust、Windows WebView2 |
| 测试 | Node.js Test Runner、PowerShell 便携包 QA |

## 项目结构

```text
teacher-work/
├─ web/             Vue 前端和运行环境适配层
├─ server/          Express API、SQLite、迁移和业务服务
├─ src-tauri/       Tauri v2 Windows 桌面壳
├─ scripts/         版本检查、便携打包和 QA 脚本
├─ tests/           单元、集成、迁移和工作流测试
├─ docs/            PRD、构建手册、升级方案和审计记录
├─ data/            Web 模式运行数据，本地生成且不提交
├─ package.json
└─ README.md
```

本地构建产生的 `web/dist/`、`src-tauri/target/` 和 `release/` 均不提交到源码仓库。正式 ZIP 作为附件发布在 GitHub Releases。

## 开发环境

Web 开发至少需要 Node.js 和 npm。Tauri Windows 构建还需要 Rust MSVC 工具链、Visual Studio C++ Build Tools、Windows SDK 和 Microsoft Edge WebView2 Runtime。

安装依赖并启动 Web 开发环境。

```powershell
npm install
npm run dev
```

常用命令如下。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动 Vite 前端和 Express 后端 |
| `npm test` | 运行自动化测试和产品版本契约检查 |
| `npm run build` | 构建 Web Release 资源到 `web/dist/` |
| `npm start` | 使用已构建的前端启动生产模式 Express 服务 |
| `npm run tauri:dev` | 启动 Tauri 开发模式 |
| `npm run tauri:build` | 构建不带安装器的 Tauri Release EXE |
| `npm run package:portable` | 整理完整便携目录并生成 ZIP |
| `npm run qa:portable -- -ZipPath <ZIP路径>` | 在临时中文路径中验证便携包首次启动和正常退出 |

## Windows 构建门禁

开始 Tauri 编译前先执行以下检查。

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
where.exe link
```

Windows x64 构建应使用 `stable-x86_64-pc-windows-msvc`。`where.exe link` 返回的第一项必须来自 Visual Studio MSVC，路径通常包含以下片段。

```text
Microsoft Visual Studio
VC\Tools\MSVC
Hostx64\x64
```

如果第一项是 Anaconda 的 `Library\usr\bin\link.exe`，请从开始菜单打开 Developer PowerShell for VS 2022 或 x64 Native Tools Command Prompt for VS 2022，在该终端中重新检查并构建。不要删除、重命名或复制 Anaconda 的同名文件。

完整排查方法见 [Tauri v2 Windows 免安装便携版开发与交付手册](docs/tauri-portable-windows-handbook.md)。

## 构建绿色便携包

在 MSVC 环境门禁通过后执行。

```powershell
npm test
npm run build
npm run tauri:build
npm run package:portable
```

如需把 Cargo 产物放到独立短路径，可在同一个 PowerShell 会话中设置 `CARGO_TARGET_DIR`。

```powershell
$env:CARGO_TARGET_DIR = 'C:\tmp\teacher-work-tauri-target'
npm run tauri:build
npm run package:portable
```

打包脚本会检查 Release EXE，复制运行资源，创建 `data/`、`backup/` 和 `logs/`，生成 UTF-8 使用说明与文件清单，最后输出 ZIP 和 SHA-256。

## 发布前 QA

`tauri dev` 能启动不代表发布完成。最终验收对象必须是 Release EXE 和 GitHub Release 使用的 ZIP。

```powershell
npm run qa:portable -- -ZipPath 'release\教师工作台-v0.4.0-windows-x64-portable.zip'
```

发布前至少检查以下场景。

- 关闭所有开发服务器后，从独立目录完整解压 ZIP。
- 在中文路径和包含空格的路径中双击 EXE。
- 使用空 `data/` 首次启动并生成数据库。
- 保存数据，退出应用，再次启动后确认数据仍在。
- 移动整个应用目录，再次启动并读取原有数据。
- 正常关闭窗口后，内置 Node.js 后端没有残留进程。
- 在普通 Windows 电脑或干净虚拟机上检查 WebView2 依赖。
- 人工检查文档拖入、打印、Excel 保存和文件选择器等系统交互。

## 已知限制

- 当前发布包未进行商业代码签名，Windows SmartScreen 可能在首次启动时提示风险。
- 应用需要 Microsoft Edge WebView2 Runtime。Windows 10 和 Windows 11 的常见环境通常已包含，但正式发布仍需在目标电脑验证。
- 便携数据写在应用目录旁，应用必须放在当前用户有写入权限的位置。
- EXE、`resources/` 和数据目录属于同一个便携应用，不支持只复制 EXE 使用。
- 数据库升级可能改变结构。程序回退必须配合相应数据库备份，不能把替换旧 EXE 当作完整回滚。

## 版本记录

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| [v0.4.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.0) | Latest | 学生表现量化、值日组精准记分、统计可视化、规则启用停用闭环与操作列优化 |
| [v0.2.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.2.0) | 历史 | 统一 Web 与 EXE 版本和业务代码，完善座位拖拽、班级前置校验、数据库迁移备份与便携 QA |
| [v0.1.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.1.0) | 历史版本 | 首个 Windows x64 绿色便携版本 |

## 详细文档

- [产品需求文档](docs/PRD.md)
- [项目开发全记录](docs/项目开发全记录.md)
- [Web 与 EXE 功能一致性基线](docs/web-desktop-feature-parity-v0.2.0.md)
- [Tauri v2 Windows 免安装便携版开发与交付手册](docs/tauri-portable-windows-handbook.md)
- [第一版绿色便携包手动升级与数据库迁移方案](docs/第一版绿色便携包手动升级与数据库迁移方案.md)
- [绿色便携版发布、升级与数据库迁移注意事项](docs/绿色便携版发布、升级与数据库迁移注意事项.md)

## 数据与隐私

项目默认在本机运行，不要求注册账号，也不会主动把班级数据上传到外部服务。请自行妥善保管便携目录、备份文件和导出的学生资料。

<div align="center">

数据保存在本机。退出应用后，工作台和内置后端会一起关闭。

</div>
