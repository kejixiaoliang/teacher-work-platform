<div align="center">

# 📓 教师工作台 · 班主任版

**小亮实验室风格 · 单机即用 · 数据不出本机**

一份给班主任的「班级实验本」——管学生、排座位、记成绩、盯考勤、收文档、轮值日，全部装进浏览器，双击就能用。

![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)
![Element Plus](https://img.shields.io/badge/Element%20Plus-2.9-409eff?logo=element&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57?logo=sqlite&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![ECharts](https://img.shields.io/badge/ECharts-6-orange?logo=apacheecharts&logoColor=white)

</div>

---

## ✨ 它是什么

面向**班主任**（而非程序员）的单机 Web 应用：双击启动、浏览器即用、无需联网、无需账号。

> ⚠️ **这不是普通静态网页，也不是 localStorage 伪单机。**

这是一套**完整的「前端 + 后端 + 数据库」三层应用**：

- 🗄️ **真实数据库**：数据存入本地 **SQLite 数据库**（`data/teacher.db`），结构化建表、事务写入、索引查询——不是塞在浏览器 `localStorage` 里的字符串，浏览器清缓存、换电脑、换浏览器，数据都还在
- 🔌 **独立后端服务**：Express 提供完整的 REST API 层（13 组接口），所有读写都经过服务端校验与事务
- 🧩 **前后端分离**：Vue 3 前端通过 HTTP API 与后端通信，界面与数据彻底解耦

一句话：**它运行起来是一台完整的 Web 服务器 + 数据库**，只是这台服务器恰好跑在你自己的电脑上、只服务你自己。

界面采用「小亮实验室」风格——暖纸背景、手绘粗线、贴纸卡片，像一本创作者的实验笔记，而不是冷冰冰的管理后台。

---

## 🚀 快速开始（Windows）

```text
1. 双击 启动.bat
2. 首次运行自动安装依赖并构建界面（约 1-3 分钟）
3. 浏览器自动打开 http://localhost:3210
4. 关闭启动窗口即停止服务
```

> **备份数据** = 复制整个 `data\` 文件夹（SQLite 数据库 + 上传文件）。
> 应用内顶栏还有「备份数据」按钮（导出班级基础信息 JSON）。

### 开发模式

```bash
npm install
npm run dev        # 开发模式：Vite(5173) + API 服务(3210)，自动打开浏览器
npm run build      # 构建前端到 web/dist（自动生成 .gz，gzip 传输）
npm start          # 生产模式：Express 托管 web/dist + API（静态资源 gzip 压缩）
```

---

## 🗂 功能总览

### 首页 · 一眼看班

打开首页就是班级「信息大屏」：班级概况（人数/男女/近视/住宿/平均身高）、今日请假名单、最近家校沟通、班委与课代表一览、今日值日、座位缩略图、最近文档——**只看不编辑，就知道班里谁是谁**。

### 常用

| 模块 | 能力 |
|---|---|
| **学生管理** | 增删改查、搜索筛选（姓名/学号/性别/状态/近视/住宿）、Excel 批量导入导出（含标准模板）、详情抽屉（健康概览条 + 身高视力历史 + 成长档案 + 家校沟通）、回收站软删除 |
| **座位管理** | 网格排座、拖拽换座/交换、右键锁定/设空座、**自动排座**（身高/视力/男女搭配/成绩互助，近视坐中间）、平移轮换、历史布局回看恢复、打印座位表、颜色图例 |

### 学习分析

| 模块 | 能力 |
|---|---|
| **数据分析** | 身高分布、视力健康、成绩等级、性别构成、住宿情况五大图表（ECharts） |
| **成绩管理** | 考试管理（新增/编辑/删除）、成绩录入（手填 + **Excel 导入**）、排名与统计（平均/最高/优秀率/及格率）、学生进步趋势、**一键载入示例成绩** |
| **考勤管理** | 每日出勤登记（出勤/迟到/请假/缺勤）、月度统计表（弹性铺满，可拉宽） |

### 班级事务

| 模块 | 能力 |
|---|---|
| **文档管理** | 拖拽上传（图片/PDF/Office/文本，单文件 ≤200MB）、分类树 + **预设标签**（教案/试卷/课件/通知/家长信…）+ 自定义标签、图片/PDF/文本内嵌预览、重命名、回收站 |
| **值日管理** | 分组（每人一组、全局查重）、按周轮换、一键自动分组、打印值日表 |
| **班委学委** | 选任/编辑/解除班委、一键预设班委 |
| **课代表选择** | 各科课代表（每科一人、可兼任）、一键预设课代表 |
| **请假管理** | 事假/病假台账、起止日期自动算天数、销假、月份/学生/类型/状态筛选、今日请假统计 |
| **家校沟通** | 家访/电话/微信台账、月度统计（次数/涉及学生/家访/电话）、按学生/月份筛选 |
| **班级设置** | 多班支持、座位网格尺寸、教室布局（均分/中间走道/双走道）、删除确认 |

---

## 🎨 设计风格

小亮实验室（xiaoliang-lab）：

- **暖纸背景**：奶油纸 `#fff4dc` + 30px 网格纹理，模拟笔记本
- **手绘粗线**：4px 墨黑描边 `#201b17`，实色错位投影营造贴纸浮起感
- **强调色**：番茄红 `#f35b3f`、芥末黄 `#f2c84b`、薄荷绿 `#8bd6af`
- **组件语言**：胶囊按钮、贴纸页头、药丸标签、旋转角标——全站统一
- **克制**：粗边只留给一级容器，表格/输入框细边化，保证信息密度与可读性

---

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite 6 + Element Plus + ECharts（按需引入）+ exceljs |
| 后端 | Node.js + Express 4（独立 REST API 服务） |
| **数据库** | **better-sqlite3（SQLite）**：13 张业务表，外键级联、`UNIQUE` 约束、事务批量写入、查询索引——真正的数据库，不是浏览器存储 |
| 上传 | multer（扩展名白名单 + 班级归属校验 + 失败清理孤立文件） |
| 存储 | SQLite（`data/teacher.db`）+ 上传文件（`data/files/`） |
| 性能 | 路由懒加载、vendor 分块、静态资源 gzip、图表按需渲染、大列表分页 |

**数据流**：浏览器 → `fetch` → Express API（参数化 SQL + 校验 + 事务）→ SQLite。所有数据读写都经过服务端，前端只是展示层。

**安全加固**：全量 SQL 参数化、上传内容安全（nosniff + 按扩展名映射 MIME + 非图片强制下载）、跨班数据归属校验、删除操作事务化。

---

## 📁 目录结构

```text
teacher-work/
├─ 启动.bat            # 双击启动（首次自动装依赖+构建+开浏览器）
├─ package.json
├─ server/             # Node + Express 后端
│  ├─ index.js         # 入口：API 挂载 + 静态托管 + gzip + 错误处理
│  ├─ db.js            # SQLite 初始化 / 建表 / 迁移 / 种子
│  ├─ seating.js       # 自动排座算法
│  └─ routes/          # classes / students / seats / documents / duties /
│                      # scores / attendance / records / leaves / contacts
├─ web/                # Vue 3 前端
│  ├─ index.html
│  └─ src/
│     ├─ views/        # 13 个页面（路由懒加载）
│     ├─ components/   # EChart 等
│     ├─ composables/  # useSeqLoad（竞态防护）等
│     └─ style.css     # 小亮实验室设计系统（CSS 变量）
├─ data/               # 运行时生成：teacher.db + files/（备份=复制此目录）
└─ docs/               # PRD、审查报告等
```

---

## 📚 文档

- [项目开发全记录（时间线/决策/踩坑清单）](docs/项目开发全记录.md)
- [产品需求文档（PRD）](docs/PRD.md)
- [全面审查报告（功能/逻辑/交互/性能/安全）](docs/审查报告-2026-07-31.md)

---

<div align="center">

**数据仅存本机 · 隐私不出机器 · 关了窗口就是下班**

</div>
