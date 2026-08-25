<div align="center">

# 教师工作台

面向班主任的本地班级管理工具

学生 · 座位 · 成绩 · 考勤 · 文档 · 家校沟通 · 数据备份

[![Version](https://img.shields.io/badge/version-0.7.0-f35b3f)](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.7.0)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-2563eb)](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.7.0)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db?logo=tauri&logoColor=white)](https://tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)

**下载即用 · 本地优先 · 支持完整备份 · 源码可见、非商业使用许可**

</div>

## 目录

- [给老师：5 分钟开始使用](#给老师5-分钟开始使用)
- [下载与运行](#下载与运行)
- [备份、恢复与更新导入](#备份恢复与更新导入)
- [教师模式与班级公开模式](#教师模式与班级公开模式)
- [功能总览](#功能总览)
- [升级与数据安全](#升级与数据安全)
- [开发者：本地运行与构建](#开发者本地运行与构建)
- [授权协议](#授权协议)

## 给老师：5 分钟开始使用

推荐第一次使用时按下面顺序操作：

1. 下载并完整解压 Windows x64 便携包。
2. 双击“教师工作台.exe”，在“班级设置”中创建班级。
3. 进入“学生管理”，下载 Excel 模板，填写学生信息后导入。
4. 在“班级设置”中设置教师密码，并确认教师模式、班级公开模式的访问范围。
5. 根据需要使用座位、考勤、成绩、值日、文档和家校沟通等模块。
6. 第一次录入重要数据后，进入“概览首页 → 数据管理”，下载一份“完整备份（含附件）”。

> 建议：完整备份至少保存一份在应用目录之外，例如 U 盘、移动硬盘或可信的云盘位置。备份文件包含学生、成绩和文档等敏感信息，请妥善保管。

## 下载与运行

当前稳定版本：**v0.7.0**

- [下载教师工作台 v0.7.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.7.0)
- [查看全部 GitHub Releases](https://github.com/kejixiaoliang/teacher-work-platform/releases)

普通用户只需要下载 Release 页面中的 Windows x64 绿色便携 ZIP，不需要安装 Node.js、Rust，也不需要运行安装器。

### 正确启动方式

1. 完整下载 ZIP，不要只下载其中的 EXE。
2. 将 ZIP 解压到桌面、文档目录或其他有写入权限的位置。
3. 保持 EXE、`resources`、`data`、`backup` 和 `logs` 的相对位置不变。
4. 双击“教师工作台.exe”。不要在压缩包内直接运行，也不要单独移动 EXE。

便携目录大致如下：

```text
教师工作台/
├─ 教师工作台.exe       主程序
├─ resources/            运行资源
├─ data/                 SQLite 数据库与上传文件
├─ backup/               数据库迁移恢复点
├─ logs/                 运行与诊断日志
├─ manifest.json         发布包文件清单
└─ README.txt            便携版使用说明
```

## 备份、恢复与更新导入

### 四种数据操作怎么选

| 操作 | 包含什么 | 是否包含附件 | 会不会清空当前工作台 | 适用场景 |
| --- | --- | --- | --- | --- |
| 完整备份（含附件） | 全部班级、业务数据和上传文件 | 是 | 不适用 | 日常备份、换电脑、升级前留档 |
| 导出 JSON（不含附件） | 全部结构化数据和附件元数据 | 否 | 不适用 | 跨版本迁移、数据交换、云端/小程序对接 |
| 从备份恢复 | ZIP、v1 JSON 或旧版 tables JSON | 按文件类型 | **会覆盖** | 空白工作台恢复、整体回滚 |
| 更新导入 JSON | 将 JSON 作为新的数据集追加 | 否 | **不会清空** | 向已有工作台追加或更新数据 |

### 推荐操作流程

**换电脑或恢复到空白工作台**

1. 在旧工作台选择“完整备份（含附件）”。
2. 将 ZIP 复制到新电脑。
3. 在新工作台进入“概览首页 → 数据管理 → 从备份恢复”。
4. 选择 ZIP，确认覆盖提示，等待恢复完成。
5. 检查班级、学生、成绩、考勤、文档数量是否正确。

**只迁移结构化数据**

1. 在旧工作台选择“导出 JSON（不含附件）”。
2. 在新工作台选择“从备份恢复”，上传 JSON。
3. JSON 会恢复班级、学生、座位、成绩、考勤等结构化信息，但不会恢复附件文件。

**向已有工作台追加数据**

1. 准备导出的 v1 JSON 或旧版 JSON。
2. 在“概览首页 → 数据管理”选择“更新导入 JSON”。
3. 查看导入预览，确认新增数据集后继续。
4. 导入完成后系统会自动刷新，各模块无需重新打开或再次手动载入。

### 重要安全规则

- “从备份恢复”会覆盖当前工作台，操作前必须先备份当前数据。
- JSON 文件不包含附件内容；需要恢复文档附件时必须使用完整 ZIP。
- 旧版本导出的 JSON 支持导入新版本，但建议导入前先保留原始文件和当前工作台完整备份。
- 不要手动编辑 ZIP 或 JSON；如导入失败，保留错误提示和原始文件，先不要重复覆盖恢复。
- 密码、恢复密钥和访问模式属于本机访问控制设置，不会被普通数据备份覆盖。

## 教师模式与班级公开模式

| 模式 | 用途 | 默认可用内容 |
| --- | --- | --- |
| 教师工作台模式 | 日常维护和处理敏感数据 | 学生隐私、成绩、文档、备份恢复、更新导入、访问策略 |
| 班级公开模式 | 课堂投屏和公开查看 | 允许公开的班级、座位和值日等模块 |

使用建议：

- 录入学生、查看成绩、管理文档、备份恢复时切换到教师模式。
- 课堂投屏或公开展示时使用班级公开模式。
- 班级公开模式下，成绩、隐私档案、文档和数据管理等敏感模块默认受保护。
- 自动锁定后会回到班级公开模式；处理敏感数据前先确认顶部当前模式。
- 忘记密码时使用设置密码时保存的恢复密钥；恢复密钥也应像密码一样妥善保管。

## 功能总览

| 模块 | 主要能力 |
| --- | --- |
| 班级设置 | 多班级、学年学期、教室布局、隐私模式和教师访问控制 |
| 学生管理 | 学生档案、搜索筛选、Excel 导入导出、健康记录和回收站 |
| 座位管理 | 拖拽移动、座位交换、锁定、自动排座、轮换、历史恢复和打印 |
| 成绩管理 | 考试与科目、批量录入、Excel 导入、统计排名、趋势和历史数据 |
| 考勤与请假 | 每日考勤、月度统计、请假台账、销假和 Excel 导出 |
| 表现量化 | 自定义行为规则、批量记分、月度/学期统计、修正历史和多格式导出 |
| 值日管理 | 分组、轮换、自动分组、精准记分和值日表打印 |
| 文档管理 | 上传、分类、标签、预览、重命名、下载和回收站 |
| 班委与课代表 | 班委、课代表选择、编辑和预设 |
| 家校沟通 | 家访、电话、微信等沟通记录与筛选统计 |
| 数据分析 | 班级结构、健康、成绩和表现数据图表 |
| 数据管理 | 完整 ZIP 备份、JSON 导出、恢复、更新导入和自定义保存路径 |

桌面版中，学生、考勤、请假、成绩、表现量化、文档和数据备份等导出操作支持选择保存路径；浏览器开发模式仍使用浏览器下载。打印功能使用系统打印流程。

## 升级与数据安全

当前便携版采用手动升级：

1. 完全退出旧版应用，确认后台进程已经结束。
2. 使用旧版的“完整备份（含附件）”保存一份 ZIP，并复制到应用目录之外。
3. 下载并完整解压新版便携包到新目录。
4. 将旧版 `data/` 复制到新版目录；如需保留诊断记录，再复制 `backup/` 和 `logs/`。
5. 启动新版，等待数据库迁移完成。
6. 检查班级、学生、座位、成绩、考勤、文档和附件是否正常。

数据库升级前会创建恢复备份。新版数据库升级后，不要只换回旧 EXE；需要回退时，必须同时恢复匹配版本的程序和数据库备份。

## 开发者：本地运行与构建

### 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、Vite 6、Element Plus、ECharts、ExcelJS |
| 后端 | Node.js、Express、Multer |
| 数据 | SQLite、better-sqlite3 |
| 桌面 | Tauri v2、Rust、Windows WebView2 |
| 测试 | Node.js Test Runner、PowerShell 便携包 QA |

浏览器版本和 Windows EXE 共用 Vue 页面、业务规则、Express API、SQLite 迁移逻辑和产品版本号。Tauri 负责桌面窗口、内置后端和便携目录；运行环境差异集中在 `web/src/platform/`。

### 启动 Web 开发环境

至少需要 Node.js 和 npm：

```powershell
npm install
npm run dev
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动 Vite 前端和 Express 后端 |
| `npm test` | 运行自动化测试和版本契约检查 |
| `npm run build` | 构建 Web Release 资源 |
| `npm start` | 启动已构建的生产模式服务 |
| `npm run tauri:dev` | 启动 Tauri 开发模式 |
| `npm run tauri:build` | 构建 Windows Release EXE |
| `npm run package:portable` | 生成 Windows 绿色便携 ZIP |
| `npm run qa:portable -- -ZipPath <ZIP路径>` | 验证便携包启动、数据目录和正常退出 |

### Windows 构建门禁

Tauri 构建还需要 Rust MSVC 工具链、Visual Studio C++ Build Tools、Windows SDK 和 WebView2 Runtime。构建前检查：

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
where.exe link
```

Windows x64 应使用 `stable-x86_64-pc-windows-msvc`。`where.exe link` 的第一项必须来自 Visual Studio MSVC，通常包含 `Microsoft Visual Studio`、`VC\Tools\MSVC` 和 `Hostx64\x64`。

### 发布前构建与 QA

```powershell
npm test
npm run build
npm run tauri:build
npm run package:portable
npm run qa:portable -- -ZipPath 'release\教师工作台-v0.7.0-windows-x64-portable.zip'
```

发布前至少检查：中文路径、包含空格的路径、空数据目录首次启动、退出后数据持久化、移动整个应用目录、WebView2 依赖、Excel 保存、文件选择器、文档拖入和正常关闭后无残留 Node.js 进程。

本地构建产生的 `web/dist/`、`src-tauri/target/` 和 `release/` 不提交到源码仓库；正式 ZIP 作为附件发布在 GitHub Releases。

## 项目结构

```text
teacher-work/
├─ web/             Vue 前端和运行环境适配层
├─ server/          Express API、SQLite、迁移和业务服务
├─ src-tauri/       Tauri v2 Windows 桌面壳
├─ scripts/         版本检查、便携打包和 QA 脚本
├─ tests/           单元、集成、迁移和工作流测试
├─ docs/            产品、架构、构建和升级文档
├─ data/            Web 模式运行数据，本地生成且不提交
└─ package.json
```

## 已知限制

- 当前发布包未进行商业代码签名，Windows SmartScreen 可能在首次启动时提示风险。
- 应用需要 Microsoft Edge WebView2 Runtime，目标电脑应提前确认环境。
- 数据默认保存在应用目录旁，应用必须放在当前用户有写入权限的位置。
- EXE、`resources/` 和数据目录属于同一个便携应用，不支持只复制 EXE 使用。
- 当前 v0.7.0 本地版默认不主动上传数据；未来云端或小程序版本需以对应版本的隐私说明为准。

## 版本记录

| 版本 | 状态 | 主要内容 |
| --- | --- | --- |
| [v0.7.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.7.0) | 最新 | 数据备份、恢复、更新导入、旧 JSON 兼容、统一导出、自定义保存路径、成绩持久化和 Excel 导入修复 |
| [v0.6.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.6.0) | 历史 | 班级公开模式、教师工作台模式、教师密码保护、访问控制和自动锁定 |
| [v0.5.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.5.0) | 历史 | 班主任日常工作台、结构化跟进事项和首页工作流聚合 |
| [v0.4.2](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.2) | 历史 | 完整备份恢复、附件迁移、文件授权和 Blob 预览下载 |
| [v0.4.1](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.1) | 历史 | 稳定性审计与核心模块细节优化 |
| [v0.4.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.4.0) | 历史 | 学生表现量化、值日组记分、统计可视化和操作列优化 |
| [v0.2.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.2.0) | 历史 | Web 与 EXE 统一、座位拖拽、班级前置校验和便携 QA |
| [v0.1.0](https://github.com/kejixiaoliang/teacher-work-platform/releases/tag/v0.1.0) | 历史 | 首个 Windows x64 绿色便携版本 |

## 详细文档

- [产品需求文档](docs/PRD.md)
- [项目开发全记录](docs/项目开发全记录.md)
- [教师工作台 v0.7.0 数据备份、导入、恢复、导出规划](docs/教师工作台-v0.7.0-数据备份导入恢复导出规划.md)
- [教师工作台 v0.7.0 详细实施规划](docs/教师工作台-v0.7.0-详细实施规划.md)
- [教师工作台 JSON 备份交换格式 v1 规范](docs/教师工作台-JSON备份交换格式-v1规范.md)
- [Tauri v2 Windows 免安装便携版开发与交付手册](docs/tauri-portable-windows-handbook.md)
- [绿色便携版发布、升级与数据库迁移注意事项](docs/绿色便携版发布、升级与数据库迁移注意事项.md)

## 授权协议

本项目采用[《教师工作台源代码可见与非商业使用许可协议》](LICENSE)，不是 MIT、Apache-2.0、GPL 等传统开源许可证。

- 个人学习、研究、评估和非商业教育活动可以免费使用。
- 商业学校、培训机构、企业内部使用、收费课程、商业部署、SaaS 服务、销售、出租、转售以及对外提供衍生版本，均需事先取得版权所有者的书面商业授权。
- 修改源码后仅限非商业内部使用；未经商业授权，不得对外发布或提供在线服务。
- 第三方依赖和素材继续遵守各自的原始许可证。

商业合作、授权范围和费用需要另行签署书面协议。正式商业合作前，建议由专业法律人士审核授权条款。

## 数据与隐私

当前 v0.7.0 本地版默认在本机运行，不要求注册账号，也不会主动把班级数据上传到外部服务。请妥善保管便携目录、备份文件和导出的学生资料。未来云端或小程序版本的具体数据处理方式，以对应版本的隐私说明为准。

<div align="center">

数据保存在本机。退出应用后，工作台和内置后端会一起关闭。

</div>
