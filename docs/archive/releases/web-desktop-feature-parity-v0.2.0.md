# 教师工作台 v0.2.0 Web / EXE 功能一致性审计

> 归档说明：历史版本资料，仅用于追溯当时的实现与发布过程。

## 1. 审计结论

v0.2.0 采用“一套 Vue 业务代码、一个 Node/SQLite 后端、一个产品版本号”的结构。Web 版与 Windows 便携版不是两套产品：Tauri 只负责启动本地后端、计算便携目录、向页面注入 API 地址和访问令牌，并承载同一个 `web/dist`。

因此，业务功能修改必须落在 `web/src`、`server` 或共享领域模块中，不能在 EXE 中复制一份页面再单独维护。

本轮确认并修复的实际差异是座位拖拽。旧实现依赖 HTML5 `dataTransfer`；浏览器中可用，但在 WebView2 实际运行中表现不一致。v0.2.0 已改为浏览器与 WebView2 都支持的 Pointer Events，并保留点击选座作为备用操作。

## 2. 统一架构

| 层次 | Web 运行 | EXE 运行 | 一致性约束 |
| --- | --- | --- | --- |
| Vue 页面 | `web/src` | 同一个 `web/src` 构建产物 | 禁止复制页面 |
| API 客户端 | `web/src/api.js` | 同一个 API 客户端 | 只允许基地址和令牌不同 |
| 后端业务 | `server` | 同一个 `server`，由内置 Node 启动 | 路由与数据库规则一致 |
| 数据库 | SQLite | SQLite | 同一迁移代码和 schema 版本 |
| 运行时适配 | 相对 `/api` | `127.0.0.1` 随机端口 + token | 仅限 `platform` 适配层 |
| 数据目录 | 项目 `data` | EXE 同级 `data` | 均由后端路径配置管理 |
| 产品版本 | `package.json` | Tauri/Cargo 跟随 | 构建前自动校验 |

## 3. 功能矩阵

状态含义：

- “共享”：Web 与 EXE 直接复用同一页面和 API。
- “自动化通过”：已有自动化测试覆盖关键数据链路。
- “Release 待验”：依赖 Windows WebView2 或系统交互，必须在最终 EXE/ZIP 上人工验证。

| 模块 | 共享页面/接口 | 当前结论 | v0.2.0 验证重点 |
| --- | --- | --- | --- |
| 概览 | `Overview.vue`、overview API | 共享 | 统计、提醒、备份导出 |
| 班级 | `Classes.vue`、classes API | 共享、自动化通过 | 新建、切换、编辑、删除前备份 |
| 学生 | `Students.vue`、students API | 共享、自动化通过 | 未建班级拦截、草稿保留、导入导出 |
| 座位 | `Seats.vue`、seats API | 共享、已修复、自动化通过 | Pointer 拖移、两人交换、空座移动、锁定阻止、保存重启 |
| 数据分析 | `Analytics.vue` | 共享 | 图表渲染与窗口缩放 |
| 成绩 | `Scores.vue`、scores API | 共享、自动化通过 | 建考试、录分、统计、离开未保存提醒 |
| 考勤 | `Attendance.vue`、attendance API | 共享、自动化通过 | 登记、保存、重载、统计、离开提醒 |
| 文档 | `Documents.vue`、documents API | 共享，Release 待验 | 文件选择、拖入、预览、下载、移动便携目录后访问 |
| 值日 | `Duties.vue`、duties API | 共享 | 分组、排班、弹窗打印 |
| 班委/学委 | `Leaders.vue`、`SubjectLeaders.vue` | 共享 | 选择、保存、回显 |
| 请假 | `Leaves.vue`、leaves API | 共享 | 新建、审批状态、考勤联动 |
| 家校沟通 | `Contacts.vue`、records/contacts API | 共享 | 新增、编辑、时间线 |
| 指南/更新记录 | `Guide.vue`、`Changelog.vue` | 共享 | 版本显示为 0.2.0 |
| 全量备份 | backup API | 共享、自动化通过 | 导出、恢复前快照、数据库兼容性 |

## 4. 已完成的代码级验证

### 4.1 版本契约

`package.json.version` 是人工维护的版本源。`scripts/version-contract.mjs` 会在测试和 Tauri 构建前校验：

- `package.json`；
- `src-tauri/tauri.conf.json`；
- `src-tauri/Cargo.toml`；
- `web/src/views/Changelog.vue`。

任一处不是 `0.2.0`，构建门禁失败。

### 4.2 座位移动规则

`web/src/domain/seatMovement.js` 统一处理移动和交换，保证：

- 空座移动只交换人员字段，不破坏物理座位的行列与锁定属性；
- 两个有人座位交换学生；
- 来源或目标锁定时拒绝移动；
- 无效来源、无效目标、同座位操作不修改布局。

`web/src/domain/pointerDrag.js` 统一处理指针状态，保证：

- 小于 6 像素的移动仍是普通点击；
- 超过阈值后才进入拖拽；
- 不同 pointer ID 的事件不会串扰；
- pointer cancel 会完整清理；
- 拖拽松手只产生一次移动意图，并抑制随后的 click。

### 4.3 核心工作流烟雾测试

`tests/workflow-smoke.test.js` 使用临时数据目录和真实本地服务，已经验证：

1. 新建班级；
2. 新建两名学生；
3. 保存并读取座位；
4. 保存并读取考勤；
5. 新建考试、保存并读取成绩；
6. 导出完整备份并检查班级、学生数据。

该测试走的就是 Web 与 EXE 共用的 HTTP API，不使用模拟数据库。

## 5. 浏览器能力审计

以下能力在 WebView2 中原则上可用，但仍需 Release 人工验证：

| 能力 | 使用位置 | 处理结论 |
| --- | --- | --- |
| `window.print()` | 座位表 | Web/EXE 共用，Release 检查打印对话框 |
| `window.open()` + 文档写入 | 值日表 | Release 检查新窗口及打印 |
| Blob + 临时下载链接 | 学生、班级、概览、Excel 导出 | Web/EXE 共用，Release 检查保存行为 |
| File input / FileReader | 学生导入、文档上传 | Web/EXE 共用，Release 检查中文文件名 |
| HTML5 文件拖入 | 文档管理 | 与座位拖拽用途不同，保留；Release 必测 |
| `localStorage` | 当前班级、值日周次 | Web/EXE 都支持；不作为核心业务数据库 |
| ECharts resize | 数据分析 | Web/EXE 都支持，检查窗口缩放 |

未发现页面写死开发机绝对路径。`localhost:5173` 只存在于 Tauri 开发配置，Release 使用打包后的相对静态资源。EXE 后端仅监听 `127.0.0.1` 随机端口，并要求随机 token；文件 URL 同样附带 token。

## 6. 最终发布门禁

只有同时满足以下条件，v0.2.0 才能宣告完成：

1. `npm test` 全部通过；
2. `npm run build` 通过；
3. 在 VS 2022 x64 开发环境中，MSVC `link.exe` 排 PATH 第一；
4. `npm run tauri:build` 生成 Release EXE；
5. `npm run package:portable` 生成 `教师工作台-v0.2.0-windows-x64-portable.zip`；
6. ZIP 解压到独立目录，关闭开发服务器后双击 EXE 可启动；
7. 在 Release 中完成核心页面巡检和座位 Pointer 拖拽；
8. 验证空 `data` 首启、保存后重启、中文/空格路径、整体移动目录后重启；
9. 核对 ZIP 内容、README、SHA-256；
10. 尚未验证的系统差异必须明确记录，不能用“开发模式可运行”代替。

## 7. v0.2.0 实际 QA 记录

执行日期：2026-08-05。

### 7.1 Web 实际操作

- 在隔离数据目录中启动 Node 后端和 Vite 页面；
- 通过页面新建班级和学生；
- 将学生从 `1,2` 拖到 `1,3`，页面立即显示目标变化；
- 保存布局并刷新页面，学生仍位于 `1,3`；
- 检查浏览器控制台，未发现 error 日志。

### 7.2 Release EXE 与 ZIP

- VS 2022 开发环境中 `where link` 第一项为 `Hostx64\x64\link.exe`，Anaconda linker 位于第二项；
- Rust toolchain 为 `stable-x86_64-pc-windows-msvc`；
- `npm run tauri:build` 成功生成 0.2.0 Release EXE；
- 最终 ZIP 解压到 `E:\Temp\教师 工作台 QA`，关闭开发服务器后可独立启动；
- 空 `data` 首次启动成功创建 `data\teacher.db`；
- 正常关闭主窗口后，内置 Node 后端没有残留；
- 在 Release EXE 中把学生从第 3 列拖到第 2 列并保存；
- 关闭并重启 EXE 后，概览座位缩略图仍显示学生位于第 2 列；
- 整体移动到 `E:\Temp\教师 工作台 QA 已移动 020` 后仍可启动，数据库仍在新目录的 EXE 同级 `data` 中；
- ZIP 展开目录包含 EXE、`resources`、`data`、`README.txt` 和 `manifest.json`，共 1095 个条目；
- SHA-256：`4f7c1b783692ee29bac6f2a69fd2461db0d98a2709443f4cd29a01109401274f`。

### 7.3 本轮未穷举的人工项目

自动化和源码审计覆盖了全部共享模块，实际 UI 重点验证了本次缺陷所在的学生/座位主链路。以下系统交互未在本轮逐项人工触发，应保留为正式发版清单：文档文件拖入、打印对话框、Excel 保存对话框、全量备份恢复的文件选择器，以及无 WebView2 Runtime 的干净目标机提示。它们不影响“一套业务代码”的结论，但不能标记为已人工通过。

## 8. 后续维护规则

- 每个功能只改共享 Vue 页面和共享后端。
- 新增桌面能力时先扩展 `web/src/platform` 适配接口，页面不得直接散落 Tauri 调用。
- 每次版本变更先改 `package.json.version`，再同步版本契约要求的文件。
- 数据库结构变更必须增加迁移版本，并在迁移前生成恢复备份。
- 任何“Web 能用、EXE 不能用”的问题先查浏览器能力和适配层，不复制业务页面。
- 每次发布同时记录 Web 验证和解压后 Release EXE 验证结果。
