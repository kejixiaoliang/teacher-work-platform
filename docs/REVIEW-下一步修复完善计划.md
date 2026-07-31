# 教师工作台 全面审查报告与修复完善计划

> 审查范围：性能 / 逻辑 / 交互 / UI 细节（全项目 server + web）
> 方法：两份独立子代理审查（UI 交互细节 + 性能逻辑）合并去重，按严重度分级
> 状态：待执行，按 P0 → P1 → P2 分三批修复

---

## 一、P0 —— 严重功能缺陷（必须修）

### 1. 成绩页切换班级后录入功能不可用
- **位置**：`web/src/views/Scores.vue`（watch currentClassId 只重载考试、不重载学生、不重置 currentExam）
- **问题**：切班级后 `allStudents` 为空，录入表空白、无法录入成绩；`currentExam` 仍指向旧班级考试
- **修复**：切班级时统一 `loadExams() + loadStudents()`，重置 `currentExam = null / tab / trendStudentId`

### 2. 座位平移算法在「锁定 + 满座」时丢学生、错位
- **位置**：`server/routes/seats.js` POST /shift（循环实时更新 grid，目标占用时 findNearestFree 可能返回 null 直接跳过）
- **问题**：满员班级 + 锁定座位的常见场景，平移预览丢人、位置与预期不符
- **修复**：先快照原布局 → 对每个座位计算平移目标（跳过锁定）→ 目标被占时找该行/最近空位并记录 warning；无空位时保留原位并提示，而不是丢弃

## 二、P1 —— 中等（数据一致性 / 交互安全 / 体验）

### 3. 切班级绕过座位页「未保存修改」拦截
- **位置**：`App.vue` 顶栏班级下拉 + `Seats.vue` onBeforeRouteLeave
- **修复**：顶栏切换班级前检查座位页 dirty（可在 store 里放一个全局 dirty 标记，或切班级统一弹确认）

### 4. 软删除学生仍占座（幽灵座位）
- **位置**：`students.js` DELETE 只置 deleted_at；`seats.js` GET LEFT JOIN 仍显示
- **修复**：`seats.js` GET 过滤 `s.deleted_at IS NULL`（或前端标记已删学生为"已转出"灰显）

### 5. 删除班级后上传文件物理残留
- **位置**：`classes.js` DELETE /:id 只删 DB 记录
- **修复**：删除班级时同时删除 `data/files` 中该班文件的物理文件（按 stored_name 查 documents 后 unlink）

### 6. duties PUT 接口绕过唯一性/查重校验
- **位置**：`server/routes/duties.js` PUT /:id
- **修复**：PUT 时同样做班干部职务唯一 + 值日生一人一组校验（排除自身 id）

### 7. 学生更新时空值被存成字符串 `'null'`
- **位置**：`students.js` PUT（`String(null)` → `'null'`）
- **修复**：统一 `v == null ? null : v` 的空值处理

### 8. 各页面 load/操作无 try/catch（未处理 Promise rejection）
- **位置**：Students/Documents/Duties/Leaders/Classes/Seats/Overview 多处
- **修复**：统一给 load 和删除类操作加 try/catch + ElMessage.error

### 9. 成绩/考勤未保存修改切换时静默丢失
- **位置**：Scores.vue（切考试/切 tab）、Attendance.vue（切日期/切班级）
- **修复**：dirty 时切换弹确认

### 10. 座位右键菜单：点击外部不关闭、设为空座无确认
- **位置**：`Seats.vue` ctx-menu
- **修复**：全局 click 监听关闭菜单；「设为空座」加确认

### 11. 历史布局弹窗：15 列网格溢出 720px 弹窗
- **位置**：`Seats.vue` historyDetail 弹窗
- **修复**：弹窗内 `.seat-area` 加 `overflow-x:auto`（现有样式未生效于弹窗内部）

### 12. 数据分析页：无数据时空图无提示、班级构成饼图维度混叠
- **位置**：`Analytics.vue`
- **修复**：无学生时显示空态引导；饼图拆分为「性别」「住宿」两个独立图

### 13. 文档页主拖拽区无点击上传
- **位置**：`Documents.vue` 顶部 drop-zone
- **修复**：加 `@click` 打开文件选择器

### 14. 当前班级可直接删除（无特别标识）
- **位置**：`Classes.vue`
- **修复**：当前班级行加「当前」标签；删除时二次强确认

### 15. 前端竞态：快速切班级/切考试，旧响应覆盖新数据
- **位置**：Seats/Scores/Attendance 等 load
- **修复**：引入请求序号（loadSeq）丢弃过期响应

### 16. 数值/归属校验缺失（NaN 500、跨班写入）
- **位置**：`scores.js` PUT（Number('abc')=NaN）、`attendance.js` PUT 未校验学生归属
- **修复**：保存前校验 `Number.isFinite`；校验 studentId 属于该班

### 17. 打印值日表 HTML 拼接未转义（存储型 XSS）
- **位置**：`Duties.vue` printRoster（window.document.write 拼接姓名）
- **修复**：对姓名/班级名做 HTML 转义

## 三、P2 —— 轻微（UI 小细节 / 文案 / 性能优化）

### UI 与交互细节
- 18. **学号标 required 但实际不校验**（Students.vue）→ 统一校验或去掉星号
- 19. **详情抽屉时间戳未格式化**（`2025-08-01T12:00:00` → `2025-08-01 12:00`）
- 20. **空状态双重显示**：Attendance 月统计、Leaders 空表格 + 额外提示 → 只留一种
- 21. **表格列宽截断无 tooltip**：Students 学号/姓名、Leaders 学生、Classes 班级名 → 加 show-overflow-tooltip
- 22. **保存/删除按钮无 loading**（全局多处）→ 主要操作按钮加 :loading 防重复
- 23. **文案不一致**：「班级管理 vs 班级设置」（Overview 提示语）、保存/确认/确定混用、Documents 标签提示（"逗号分隔"两处不一致）
- 24. **成绩排名前三用 danger 红色**（与危险语义冲突）→ 改 success/金色
- 25. **打印座位表空座仍显示"空"** → 打印时隐藏空座文字
- 26. **自动分组双重确认**（弹窗 alert + 二次 confirm）→ 去掉二次确认
- 27. **按钮图标与 emoji 重复**（⚡ + MagicStick）→ 二选一
- 28. **当前班级下拉无 tooltip、班级名截断**
- 29. **Overview hero「排座位」主按钮与其他按钮视觉无区分** → 恢复主按钮层级
- 30. **身高分布标签 11px 偏小、190cm+ 归入"其他"**

### 性能
- 31. **Documents.load 每次 2 次请求**（筛选 + 全量收标签）→ 标签改为「上传/删除时单独刷新」或一次请求返回
- 32. **批量删除串行逐个请求**（Students batchDelete、Duties removeGroup）→ Promise.all 并行
- 33. **无索引**：students.class_id、documents.class_id、duties.class_id、各 student_id → 建索引（db.js 迁移）
- 34. **seats GET /layouts 全量 JSON.parse** 数人数 → 存储时同时记录人数列（迁移加列）或延迟解析
- 35. **Seats 模板渲染副作用写 grid**（seat() 内写对象）→ 改为纯读取 + 空座预初始化
- 36. **EChart 深监听 computed 每次全量 setOption** → 仅数据变化时更新

### 样式规范
- 37. **`.text-muted` 对比度不足**（#98a6a0 约 2.9:1）→ 加深为 #7a8a84
- 38. **`.page-head` 重复定义**（style.css 48-57 与 67 行）→ 合并
- 39. **全局字号层级不统一**（顶栏 17/页头 19/卡片 15）→ 定义设计 token

---

## 四、修复批次建议

| 批次 | 范围 | 预计改动 |
|---|---|---|
| **第一批（P0）** | #1 成绩切班修复、#2 平移算法重写 | 2 文件，后端 1 + 前端 1 |
| **第二批（P1）** | #3-#17 数据一致性、交互安全、错误处理 | 约 10 文件 |
| **第三批（P2）** | #18-#39 小细节、文案、性能、样式 | 全部页面 + db.js |

每批完成后构建 + 联调验证，批次间可提交 GitHub。
