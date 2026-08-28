# 教师工作台 修复执行清单（依据 docs/REVIEW-下一步修复完善计划.md）

> 归档说明：已结束阶段的计划资料，不再作为当前执行依据。
>
> 39 项问题 → 具体修复动作。按 P0 → P1 → P2 顺序执行，每批构建验证。
> 执行状态：✅ P0 全部、P1 全部、P2 大部分已完成并构建联调通过（详见提交记录）。

---

## 第一批 P0 —— 严重功能缺陷

- [x] **P0-1 成绩页切班级修复**（Scores.vue）
- [x] **P0-2 平移算法重写**（server/routes/seats.js POST /shift）

## 第二批 P1 —— 数据一致性 / 交互安全 / 错误处理

- [x] **P1-1 切班级绕过座位未保存拦截**（store.js + App.vue + Seats.vue）
  - 动作：store 加 `seatsDirty`；Seats watch dirty 同步；App 班级下拉 change 前若 seatsDirty 弹确认
- [x] **P1-2 软删除学生清座位**（students.js DELETE）
  - 动作：软删除时同时 `DELETE FROM seats WHERE student_id=?`
- [x] **P1-3 删除班级清物理文件**（classes.js DELETE /:id）
  - 动作：删班级前查该班 documents.stored_name，unlink data/files 下文件
- [x] **P1-4 duties PUT 补唯一性/查重校验**（duties.js PUT /:id）
  - 动作：role≠值日生查同 role（排除自身）；值日生查学生是否在别组（排除自身）
- [x] **P1-5 学生更新空值存 'null' 修复**（students.js PUT）
  - 动作：所有字段 `b[k] == null ? null : b[k]`；name 空值报错
- [x] **P1-6 各页 load/删除加 try/catch**（Students/Documents/Duties/Leaders/Classes/Seats/Overview）
  - 动作：load 与删除类操作统一 `try/catch + ElMessage.error`；openDetail 的 metrics/records/contacts 补 catch
- [x] **P1-7 成绩/考勤未保存切换确认**（Scores.vue selectExam、Attendance.vue loadDaily/watch）
  - 动作：dirty 时切换考试/日期/班级弹确认
- [x] **P1-8 座位右键菜单：外点关闭 + 设为空座确认**（Seats.vue）
  - 动作：document click 关闭菜单；菜单「设为空座」走确认
- [x] **P1-9 历史布局弹窗网格溢出**（Seats.vue 弹窗内 seat-wrap）
  - 动作：弹窗内 seat-wrap 限宽（约 88px）+ seat-area overflow 已有
- [x] **P1-10 Analytics 空态 + 饼图拆分**（Analytics.vue）
  - 动作：无学生显示空态；「班级构成」拆为「性别」「住宿」两图
- [x] **P1-11 文档页主拖拽区点击上传**（Documents.vue）
  - 动作：drop-zone 加 `@click="uploadVisible = true"`
- [x] **P1-12 当前班级删除标识**（Classes.vue）
  - 动作：当前班级行加「当前」tag；confirm 文案强化
- [x] **P1-13 竞态：loadSeq**（Seats loadSeats、Scores selectExam）
  - 动作：请求序号，过期响应丢弃
- [x] **P1-14 数值/归属校验**（scores.js PUT、attendance.js PUT）
  - 动作：score 非有限数跳过；attendance/scores 校验 studentId 属于该班
- [x] **P1-15 打印值日表 XSS 转义**（Duties.vue printRoster）
  - 动作：esc() 转义姓名/班级名后拼接

## 第三批 P2 —— UI 细节 / 文案 / 性能

- [x] **P2-1 学号 required 与实际不符**（Students.vue）→ 去掉 required 星号，保留唯一校验
- [x] **P2-2 抽屉时间戳格式化**（Students.vue）→ `slice(0,16).replace('T',' ')`
- [x] **P2-3 空状态双重显示**（Attendance stats、Leaders）→ 只留一种
- [x] **P2-4 列宽截断加 tooltip**（Students 学号/姓名、Leaders 学生、Classes 班级名）→ show-overflow-tooltip
- [x] **P2-5 主要操作按钮 loading**（saveEdit/saveScores/saveDaily/presetLeaders/saveExam）
- [x] **P2-6 文案统一**：Overview「班级管理」→「班级设置」；Documents 标签提示统一「逗号分隔」
- [x] **P2-7 排名前三红改金**（Scores.vue）→ warning 金色
- [x] **P2-8 打印隐藏空座文字**（Seats.vue print CSS）→ `.seat.empty .s-name{display:none}`
- [x] **P2-9 自动分组去双重确认**（Duties.vue）→ 弹窗内直接执行
- [x] **P2-10 按钮图标 emoji 重复**（Duties.vue ⚡+MagicStick）→ 二选一
- [x] **P2-11 班级下拉 tooltip/宽度**（App.vue）→ 宽度 160 + option title
- [x] **P2-12 Overview hero 主按钮层级**（Overview.vue）→ primary 按钮恢复实底
- [x] **P2-13 身高分布标签 12px + 190+ 处理**（Analytics.vue）
- [x] **P2-14 Documents 标签收集并行**（Documents.vue）→ Promise.all 两请求并行
- [x] **P2-15 批量删除并行**（Students batchDelete、Duties removeGroup）→ Promise.all
- [x] **P2-16 建索引**（db.js 迁移）→ students.class_id / documents.class_id / duties.class_id / 各 student_id
- [x] **P2-17 Seats seat() 渲染副作用**（Seats.vue）→ 纯读取，写操作前确保格子存在
- [x] **P2-18 EChart 去 deep 监听**（EChart.vue）
- [x] **P2-19 样式规范**（style.css）→ text-muted 加深、page-head 重复定义合并

---

## 完成标准
- 全部勾选项完成后：`npm run build` 通过 + 关键 API 回归（成绩/考勤/座位/值日/班级）+ 页面 200
- 分批提交 GitHub：P0 一批、P1 一批、P2 一批
