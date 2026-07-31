# 教师工作台 扩展计划（阶段三：班级管理与分析）

> 目标：在现有（班级/学生/座位/文档/值日/班委）基础上，新增 **数据分析看板、成绩管理、考勤管理、成长档案、家校沟通台账**，让班主任从「能管」升级到「会分析、好管理」。
> 状态：计划定稿，按步骤执行。

---

## 1. 范围（5 个功能，一次性实施）

| 编号 | 功能 | 形态 |
|---|---|---|
| A | 数据分析看板 | 新页面 /analytics，ECharts 可视化 |
| B | 成绩管理 | 新页面 /scores，考试+录入+排名+统计+趋势 |
| C | 考勤管理 | 新页面 /attendance，按日登记+按人统计 |
| D | 成长档案 | 学生详情抽屉新增 Tab |
| E | 家校沟通台账 | 学生详情抽屉新增 Tab |

## 2. 数据模型（新增 5 张表，server/db.js）

### exams 考试表
`id, class_id(FK), name(考试名如"期中考试"), date, subjects(JSON 数组如["语文","数学","英语"]), remark, created_at`

### exam_scores 成绩表（按 学生×科目 行式存储，灵活支持自定义科目）
`id, exam_id(FK), student_id(FK), subject, score, UNIQUE(exam_id, student_id, subject)`

### attendance 考勤表
`id, class_id(FK), student_id(FK), date(YYYY-MM-DD), status(出勤/迟到/请假/缺勤), remark, UNIQUE(class_id, student_id, date)`

### student_records 成长档案表
`id, student_id(FK), type(奖励/批评/评语/表现/其他), content(必填), date, remark, created_at`

### contacts 家校沟通表
`id, student_id(FK), date, method(家访/电话/微信/到校面谈), topic(事由), result(结果), remark, created_at`

## 3. 后端 API（server/routes/ 新增 3 个路由文件）

### routes/scores.js —— 成绩
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/scores/exams?class_id= | 考试列表（含科目数、学生数） |
| POST | /api/scores/exams | 新建考试 {class_id, name, date, subjects[]} |
| PUT | /api/scores/exams/:id | 更新考试 |
| DELETE | /api/scores/exams/:id | 删除考试（级联删成绩） |
| GET | /api/scores?exam_id= | 该考试全部成绩（平铺行，前端组装学生×科目矩阵） |
| PUT | /api/scores | 批量保存 {examId, rows:[{studentId, subject, score}]}（upsert） |
| GET | /api/scores/analysis?exam_id= | 统计：每科平均/最高/最低/优秀率(≥90)/及格率(≥60)、总分排名、分数段分布 |
| GET | /api/scores/trend?class_id=&student_id= | 某学生历次考试总分趋势 |

### routes/attendance.js —— 考勤
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/attendance?class_id=&date= | 某日登记（含未登记学生，默认出勤） |
| PUT | /api/attendance | 批量 upsert {classId, date, rows:[{studentId, status, remark}]} |
| GET | /api/attendance/stats?class_id=&month= | 按月统计：每人各状态天数 |

### routes/records.js —— 成长档案 + 家校沟通
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/students/:id/records | 成长记录列表 |
| POST | /api/students/:id/records | 新增 {type, content, date, remark} |
| DELETE | /api/students/:id/records/:rid | 删除 |
| GET | /api/students/:id/contacts | 沟通记录列表 |
| POST | /api/students/:id/contacts | 新增 {date, method, topic, result, remark} |
| DELETE | /api/students/:id/contacts/:cid | 删除 |

## 4. 前端页面

### /analytics 数据分析（Analytics.vue）
- ECharts（web/src/components/EChart.vue 通用封装：option + height，auto-resize）
- 图表：身高分布柱状图、近视率环形图、成绩等级饼图、性别/住宿占比
- 数据源：当前班级学生列表（前端计算，无需新 API）
- 顶部：当前班级统计概览卡片（人数/近视率/平均身高/住宿数）

### /scores 成绩管理（Scores.vue）
- 布局：左侧考试列表（新建/删除/选择）+ 右侧三个 Tab：
  - 录入：学生×科目 表格（可编辑单元格，批量保存）
  - 排名：总分排名表（姓名/各科/总分/排名）+ 各科统计卡片（平均/最高/优秀率/及格率）
  - 趋势：选择学生 → 历次考试总分折线图
- 交互：新建考试（名称/日期/科目多选可自定义）→ 选中考试 → 录入保存

### /attendance 考勤管理（Attendance.vue）
- 顶部：日期选择（默认今天）+ 保存按钮
- 表格：学生 × 状态（出勤/迟到/请假/缺勤 单选按钮组）+ 备注
- 统计 Tab：选月份 → 每人各状态天数汇总表

### 学生详情抽屉（Students.vue 扩展）
- 抽屉内改 el-tabs：基本信息 / 身高视力历史 / **成长档案** / **家校沟通**
- 成长档案：记录列表（类型标签+内容+日期）+ 新增弹窗 + 删除
- 家校沟通：记录列表（方式/日期/事由/结果）+ 新增弹窗 + 删除

## 5. 导航调整（App.vue）
- el-menu-item-group 分组：
  - 常用：概览首页、学生管理、座位管理
  - 学习分析：数据分析、成绩管理、考勤管理
  - 班级事务：文档管理、值日管理、班委学委
  - 底部（分隔）：班级设置

## 6. 实施步骤（按序执行，完成勾选）

- [ ] 1. 安装 echarts + 数据库 5 张新表迁移（已完成 ✅）
- [ ] 2. 后端 API：scores.js / attendance.js / records.js + 挂载
- [ ] 3. 前端 EChart.vue 通用组件
- [ ] 4. 前端 Analytics.vue（数据分析页）
- [ ] 5. 前端 Scores.vue（成绩管理页）
- [ ] 6. 前端 Attendance.vue（考勤管理页）
- [ ] 7. 学生详情抽屉扩展（成长档案 + 家校沟通 Tab）
- [ ] 8. 导航分组 + 路由 + api.js 扩展
- [ ] 9. 构建 + 联调验证（API 回归 + 页面 200）

## 7. 验收标准
- 5 个功能全部可操作，无控制台报错
- 成绩录入→排名→统计→趋势 数据一致
- 考勤按日保存后可查询、可统计
- 学生详情可添加/删除成长与沟通记录
- 导航分组清晰，页面风格与现有一致（薄荷绿 + 统一页头）
- 数据隐私：data/ 不入库
