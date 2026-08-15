# 学生日常行为表现量化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在教师工作台中加入全班级共用规则的学生日常行为记分、月度/学期统计、可追溯修正和多格式导出能力。

**Architecture:** 在现有 Express + better-sqlite3 后端中新增独立的 `assessment` 路由和 v4 数据库迁移；记分记录保存行为名称、分类和分值快照，修正历史单独存表。Vue 前端新增 `/assessment` 页面，复用现有班级 store、API 请求封装、Element Plus 表格/弹窗和动态 ExcelJS 导出模式；统计由后端按有效记录聚合，导出使用当前筛选结果。

**Tech Stack:** Vue 3、Vue Router、Element Plus、Express 4、better-sqlite3、SQLite、Node.js `node:test`、ExcelJS、Vite。

## Global Constraints

- 所有班级共用一套行为分类和行为项目；记分记录必须绑定班级和学生。
- 行为项目使用固定整数分值，记分时不得临时修改，建议范围为 `-100` 至 `+100`。
- 历史记分保存分类名称、行为名称和分值快照；后续规则修改不改变历史统计。
- 同一学生、同一天、同一行为项目默认只能记一次；行为项目可配置 `allow_daily_repeat`。
- 历史记录不主动删除；已录入记录可以编辑，但修改学生、项目、日期或分值时必须填写修正原因。
- 撤销和恢复必须写入修正历史；统计默认只计算 `status = 'active'` 的记录。
- 批量记分支持单人、多选、全班、值日组和班委组；批量操作为每名学生生成独立记录并共享 `batch_id`。
- 月度统计使用 `behavior_date` 的自然月；学期统计使用班级 `academic_year` + `term`，排名只在当前班级内进行。
- 不新增宿舍组、学习小组、账号权限或云端同步能力。
- 新增数据库表后必须同步全量备份、班级备份、恢复校验和迁移测试。
- 每个任务完成后运行对应的最小测试，再提交独立 commit；最终必须通过 `npm test` 和 `npm run build`。

---

## 文件结构与职责

### 新增文件

- `server/routes/assessment.js`：分类、行为项目、记分、修正、统计 API。
- `web/src/views/Assessment.vue`：行为记分、流水、统计和规则管理页面。
- `web/src/utils/exportAssessment.js`：Excel、CSV、JSON 导出格式化。
- `tests/assessment.test.js`：后端 API、迁移、重复规则、修正历史和统计回归测试。
- `docs/superpowers/plans/2026-08-15-student-behavior-assessment.md`：本实施计划。

### 修改文件

- `server/db.js`：新增 v4 表结构、迁移和预置规则。
- `server/app.js`：挂载 `/api/assessment`。
- `server/routes/backup.js`：加入新表的全量/班级备份和恢复范围。
- `web/src/api.js`：增加 `api.assessment` 请求方法。
- `web/src/router.js`：增加 `/assessment` 路由。
- `web/src/App.vue`：增加导航入口和页面标题映射。
- `web/src/views/Assessment.vue` 之外不新增表现量化页面；现有成绩、考勤页面不改变业务含义。

### 已确认的实现口径

- 月度和学期排名展示当前班级全部在读学生；没有记录的学生显示为 0 分，便于教师发现未记录对象。
- 行为分类和项目有历史使用记录时只允许停用，不提供物理删除。
- 批量记分遇到部分学生重复时，未冲突学生成功写入，冲突学生返回逐行跳过原因；前端显示成功数和明细。
- 同一批次的批量记录支持整体撤销，但每条记录仍保留独立修正历史。
- 学期筛选默认使用当前班级的 `academic_year` 与 `term`，页面允许切换到该班级已有学期选项。

## Implementation Tasks

### Task 1: 建立 v4 数据模型和预置行为规则

**Files:**
- Modify: `server/db.js`（表结构、`DATABASE_VERSION`、迁移函数）
- Test: `tests/assessment.test.js`

**Interfaces:**
- Produces tables `assessment_categories`, `assessment_items`, `assessment_records`, `assessment_record_revisions`。
- Produces `DATABASE_VERSION = 4` and idempotent migration from v3。
- Produces pre-seeded categories/items only when the new tables are empty。

- [ ] **Step 1: Write migration and data-model tests**

在 `tests/assessment.test.js` 中建立独立临时数据目录，加载 `server/db.js`，断言新库包含四张表、`PRAGMA user_version` 为 4，并断言预置项目至少包含课堂表现、学习习惯、卫生劳动、文明纪律、荣誉表现五类。增加重复加载不会增加预置项目数量的测试。

```js
test('v4 creates assessment tables and seeds rules once', () => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE 'assessment_%'
    ORDER BY name
  `).all().map(row => row.name);
  assert.deepEqual(tables, [
    'assessment_categories',
    'assessment_items',
    'assessment_record_revisions',
    'assessment_records',
  ]);
  assert.equal(db.pragma('user_version', { simple: true }), 4);
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM assessment_items').get().c >= 5);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/assessment.test.js`

Expected: FAIL because the tables and v4 migration do not exist.

- [ ] **Step 3: Implement the schema and migration**

在 `server/db.js` 中：

1. 将 `DATABASE_VERSION` 从 3 改为 4。
2. 在现有建表 SQL 中新增四张表和索引。
3. 在 `migrate()` 中增加 `< 4` 分支，使用事务创建数据并设置 `user_version = 4`。
4. 创建五类预置分类和基础行为项目，插入时按空表判断，避免重复种子。
5. 为 `assessment_records` 保存 `batch_id`、快照字段、`status`、时间字段。
6. 为 `assessment_record_revisions` 保存 `before_json`、`after_json`、`changed_fields_json` 和 `reason`。

预置分值使用整数，重复策略按设计文档配置；所有文本字段使用现有项目的长度校验约束。

- [ ] **Step 4: Run focused tests and migration regression**

Run: `node --test tests/assessment.test.js tests/migration-backup.test.js`

Expected: PASS，且现有数据库迁移备份测试不回归。

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/assessment.test.js
git commit -m "功能：新增学生行为量化数据模型"
```

### Task 2: 实现后端规则和记分 API

**Files:**
- Create: `server/routes/assessment.js`
- Modify: `server/app.js`
- Modify: `server/validation.js`（复用或补充整数、日期、文本校验）
- Test: `tests/assessment.test.js`

**Interfaces:**
- `GET /api/assessment/categories` returns active/inactive categories and items。
- `POST /api/assessment/categories` and `PUT /api/assessment/categories/:id` manage categories。
- `POST /api/assessment/items` and `PUT /api/assessment/items/:id` manage fixed-score items。
- `GET /api/assessment/records` returns filtered record rows。
- `POST /api/assessment/records/batch` accepts `{ classId, date, itemId, studentIds, remark }` and returns `{ count, skipped, details, batchId }`。
- `PUT /api/assessment/records/:id` edits a record and creates an `edit` revision。
- `POST /api/assessment/records/:id/void` and `/restore` create corresponding revisions。
- `GET /api/assessment/records/:id/revisions` returns immutable revision history。
- `POST /api/assessment/batches/:batchId/void` voids all active records in a batch。

- [ ] **Step 1: Add failing API contract tests**

在 `tests/assessment.test.js` 中通过现有 `createApp`/HTTP 测试模式覆盖：分类和项目 CRUD、单人记分、批量记分、跨班级学生拒绝、停用项目拒绝、固定分值、每日重复拦截/允许重复、编辑原因校验、撤销/恢复和修正历史。

```js
test('rejects a second same-day record when the item disallows repeats', async () => {
  const first = await request('POST', '/api/assessment/records/batch', {
    classId, date: '2026-08-15', itemId: nonRepeatItemId, studentIds: [studentId], remark: '',
  });
  assert.equal(first.status, 200);
  const second = await request('POST', '/api/assessment/records/batch', {
    classId, date: '2026-08-15', itemId: nonRepeatItemId, studentIds: [studentId], remark: '',
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.data.count, 0);
  assert.equal(second.body.data.skipped[0].reasonCode, 'DAILY_DUPLICATE');
});
```

- [ ] **Step 2: Run focused API tests and verify failure**

Run: `node --test tests/assessment.test.js`

Expected: FAIL because the router is not mounted and endpoints do not exist.

- [ ] **Step 3: Implement category/item endpoints**

在 `server/routes/assessment.js` 中实现分类和项目查询/新增/编辑/停用：

- 所有名称先 `text()` 校验并 trim。
- 项目分值使用有限整数校验并限制在 `-100..100`。
- 有历史记录的分类/项目不物理删除。
- 停用项目仍通过查询接口返回，供历史记录显示，但不允许新建记分。
- 编辑项目只影响未来记录，后端不更新 `assessment_records` 快照。

- [ ] **Step 4: Implement transactional batch scoring**

批量记分流程必须在事务中完成：

1. 校验班级存在。
2. 校验项目存在且启用。
3. 校验行为日期为有效 `YYYY-MM-DD`。
4. 校验所有学生存在、未软删除且属于班级。
5. 根据项目的 `allow_daily_repeat` 查询同日有效重复。
6. 为每名未冲突学生插入独立记录，并写入同一个 `batch_id`。
7. 为冲突或无效行生成明确的 `reasonCode`、学生和说明。
8. 返回成功数量、跳过明细和批次 ID。

- [ ] **Step 5: Implement edit, void, restore and revision snapshots**

编辑接口接收允许修改的业务字段和 `reason`，由服务端读取旧记录，构造前后快照，计算 `changed_fields_json`，然后在同一个事务中更新当前记录并插入 revision。修改学生、项目、日期或分值来源时要求非空原因；备注单独变化时原因可为空。撤销/恢复也插入前后快照。

- [ ] **Step 6: Mount router and run tests**

在 `server/app.js` 增加 `import assessmentRouter from './routes/assessment.js'` 和 `app.use('/api/assessment', assessmentRouter)`。

Run: `node --test tests/assessment.test.js tests/workflow-smoke.test.js`

Expected: PASS，且原有核心工作流测试不受新路由影响。

- [ ] **Step 7: Commit**

```bash
git add server/routes/assessment.js server/app.js server/validation.js tests/assessment.test.js
git commit -m "功能：新增学生行为量化记分接口"
```

### Task 3: 实现统计 API 和班级/学期口径

**Files:**
- Modify: `server/routes/assessment.js`
- Test: `tests/assessment.test.js`

**Interfaces:**
- `GET /api/assessment/stats/daily?class_id=&date=` returns active daily records and totals。
- `GET /api/assessment/stats/monthly?class_id=&month=` returns all in-read students with score totals and category summary。
- `GET /api/assessment/stats/term?class_id=&academic_year=&term=` returns term ranking and category summary。
- `GET /api/assessment/stats/student/:id?class_id=&from=&to=` returns student totals, detail rows and revision metadata。

- [ ] **Step 1: Add failing aggregation tests**

准备至少两个学生、正分、负分、已撤销记录、不同分类和不同月份的样本，断言：

- 月度统计只包含目标月份。
- 学期统计包含学期内所有月份。
- 已撤销记录不计入合计。
- 没有记录的在读学生返回 0 分。
- 净分排序为降序，同分按加分降序，再按姓名升序。
- 分类统计返回记录数、加分、扣分、净分和学生数。

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/assessment.test.js`

Expected: FAIL because the stats endpoints are not implemented.

- [ ] **Step 3: Implement daily, monthly, term and student aggregation**

使用 SQL 聚合有效记录，并通过 `students` 左连接确保所有在读学生出现。月份使用 `behavior_date >= firstDay AND behavior_date < nextMonth`，避免依赖本地时区。学期范围由请求的班级学年/学期标识过滤；若请求学期为空，读取当前班级字段。

返回结构统一包含：

```js
{
  ranking: [{ studentId, name, positive, negative, net, recordCount }],
  categories: [{ categoryName, recordCount, positive, negative, net, studentCount }],
  records: [],
  filters: { classId, month, academicYear, term }
}
```

- [ ] **Step 4: Run tests and build**

Run: `node --test tests/assessment.test.js && npm run build`

Expected: PASS，构建仅产生符合现有规则的 chunk 警告，不出现编译错误。

- [ ] **Step 5: Commit**

```bash
git add server/routes/assessment.js tests/assessment.test.js
git commit -m "功能：增加行为量化统计接口"
```

### Task 4: 接入前端 API、路由和导航

**Files:**
- Modify: `web/src/api.js`
- Modify: `web/src/router.js`
- Modify: `web/src/App.vue`
- Test: `tests/assessment-ui.test.js`

**Interfaces:**
- `api.assessment.categories.list()`、`createCategory()`、`updateCategory()`。
- `api.assessment.items.create()`、`update()`、`disable()`。
- `api.assessment.records.list()`、`batchCreate()`、`update()`、`void()`、`restore()`、`revisions()`、`voidBatch()`。
- `api.assessment.stats.daily()`、`monthly()`、`term()`、`student()`。

- [ ] **Step 1: Add failing static contract tests**

断言 `api.js` 暴露 assessment 方法，路由包含 `/assessment`，导航包含“表现量化”，并且页面组件能够被路由导入。

- [ ] **Step 2: Run the focused UI contract test and verify failure**

Run: `node --test tests/assessment-ui.test.js`

Expected: FAIL because the API namespace, route and view do not exist.

- [ ] **Step 3: Implement API wrappers**

在 `web/src/api.js` 中继续使用现有 `request()` 和 `toQuery()`，不要在页面中直接调用 `fetch`。批量保存方法保留后端返回的 `count`、`skipped`、`details` 和 `batchId`，让页面展示逐行反馈。

- [ ] **Step 4: Implement route and navigation entry**

在 `web/src/router.js` 以懒加载方式注册 `/assessment`；在 `web/src/App.vue` 的学习分析/班级事务分组中增加入口，并保持当前菜单高亮和页面标题规则。

- [ ] **Step 5: Run static test and build**

Run: `node --test tests/assessment-ui.test.js && npm run build`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add web/src/api.js web/src/router.js web/src/App.vue tests/assessment-ui.test.js
git commit -m "功能：接入学生行为量化前端入口"
```

### Task 5: 实现表现量化页面的规则管理和记分录入

**Files:**
- Create: `web/src/views/Assessment.vue`
- Test: `tests/assessment-ui.test.js`

**Interfaces:**
- 页面使用 `store.currentClassId` 和 `store.classes`，不新增第二套班级状态。
- 页面调用 Task 4 的 `api.assessment` 方法。
- 页面暴露可测试的文案/选择器：预置规则、行为日期、学生范围、固定分值、成功/跳过反馈、修正原因。

- [ ] **Step 1: Add failing UI contract tests**

静态检查页面包含：表现量化标题、行为分类/项目选择、固定分值展示、全班/值日组/班委组选择、学生多选、日期选择、批量保存、修正原因、编辑/撤销/恢复和修正历史入口。

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/assessment-ui.test.js`

Expected: FAIL because `Assessment.vue` does not exist.

- [ ] **Step 3: Implement rule management UI**

使用 Element Plus 表格和对话框实现分类及行为项目维护。行为项目编辑对话框必须展示：固定分值、是否允许当天重复、启用状态，以及“修改只影响以后记录，历史记录保留原快照”的提示。存在历史记录时只显示停用，不显示物理删除。

- [ ] **Step 4: Implement student target selection**

加载当前班级在读学生、值日组和班委组成员。选择范围切换时清理不属于当前范围的手动选择；全班、值日组和班委组都转换成 `studentIds` 数组。无对应分组时显示明确的空状态，不阻塞手动选择。

- [ ] **Step 5: Implement batch scoring form**

表单提交 `{ classId, date, itemId, studentIds, remark }`，分值只读显示。成功后清空学生选择并刷新流水/概览；有跳过项时使用通知和可展开明细显示学生、原因和原因码。切换班级、页面离开或关闭弹窗不应丢失已提交数据；未提交表单不需要复杂离开拦截。

- [ ] **Step 6: Implement record edit, void, restore and revision dialog**

流水行提供编辑、撤销、恢复和查看历史。编辑学生、行为项目、日期或分值来源变化时强制原因输入；备注单独变化时原因可选。撤销和恢复后刷新当前统计，查看历史时按时间倒序展示前后快照和原因。

- [ ] **Step 7: Run UI contract test and build**

Run: `node --test tests/assessment-ui.test.js && npm run build`

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add web/src/views/Assessment.vue tests/assessment-ui.test.js
git commit -m "功能：实现学生行为量化录入与规则管理"
```

### Task 6: 实现统计视图和多格式导出

**Files:**
- Create: `web/src/utils/exportAssessment.js`
- Modify: `web/src/views/Assessment.vue`
- Test: `tests/assessment-ui.test.js`
- Test: `tests/assessment-export.test.js`

**Interfaces:**
- `exportAssessmentExcel({ summary, records, categories, filename })` dynamically imports ExcelJS and downloads an `.xlsx` file。
- `exportAssessmentCsv({ rows, filename })` writes UTF-8 BOM CSV。
- `exportAssessmentJson({ filters, summary, records, categories, filename })` writes `schemaVersion: 1` JSON。

- [ ] **Step 1: Add failing export tests**

测试导出格式化函数：CSV 含 UTF-8 BOM、字段顺序稳定且正确转义逗号/引号/换行；JSON 含 `schemaVersion`、`exportedAt`、`filters`、`summary`、`records`、`categorySummary`；Excel 导出函数使用动态 ExcelJS 导入，不在初始页面静态导入。

- [ ] **Step 2: Run focused export tests and verify failure**

Run: `node --test tests/assessment-export.test.js`

Expected: FAIL because export helpers do not exist.

- [ ] **Step 3: Implement CSV and JSON exporters**

保持浏览器下载方式与现有导出工具一致，所有导出数据来自当前筛选后的接口结果。CSV 使用统一列名；JSON 不写入 token、磁盘路径或其他运行时敏感信息。

- [ ] **Step 4: Implement dynamic Excel exporter**

只在用户点击 Excel 导出时 `await import('exceljs')`。工作簿包含“统计汇总”“记分明细”“分类汇总”三个工作表；已撤销记录只有在用户显式勾选包含时才导出，并包含状态和撤销相关字段。

- [ ] **Step 5: Implement statistics tabs and filters**

在 `Assessment.vue` 增加今日、月度、学期、学生明细和分类贡献视图。默认展示当前班级全部在读学生；月份、学期、分类、加分/扣分方向和是否包含已撤销记录作为统一筛选状态。导出按钮读取同一筛选状态。

- [ ] **Step 6: Run tests and build**

Run: `node --test tests/assessment-export.test.js tests/assessment-ui.test.js && npm run build`

Expected: PASS，且 ExcelJS 仍在独立懒加载 chunk 中。

- [ ] **Step 7: Commit**

```bash
git add web/src/utils/exportAssessment.js web/src/views/Assessment.vue tests/assessment-export.test.js tests/assessment-ui.test.js
git commit -m "功能：增加行为量化统计与多格式导出"
```

### Task 7: 接入备份恢复、版本契约和全链路回归

**Files:**
- Modify: `server/routes/backup.js`
- Modify: `tests/migration-backup.test.js`
- Modify: `README.md`
- Modify: `web/src/views/Guide.vue`
- Modify: `web/src/views/Changelog.vue`
- Test: `tests/assessment.test.js`

**Interfaces:**
- 全量备份包含四张 assessment 表。
- 班级备份包含该班级的分类使用情况、项目快照、记分记录和修正历史；全局规则表至少保证可恢复。
- 恢复后外键、记录数量和有效统计结果一致。

- [ ] **Step 1: Add failing backup and workflow tests**

新增测试：备份包含新表；班级备份只包含目标班级记录；恢复后规则、记分记录和修正历史均存在；恢复后统计与恢复前一致；数据库从 v3 升级到 v4 会产生恢复点。

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/assessment.test.js tests/migration-backup.test.js`

Expected: FAIL because backup allowlists and validation do not know the new tables.

- [ ] **Step 3: Update backup table allowlists and class scoping**

在 `server/routes/backup.js` 的全量表清单加入四张表；班级备份为 `assessment_records` 和 `assessment_record_revisions` 增加目标班级/记录关联过滤。恢复前后继续使用现有事务和 schema 校验模式，并确保 `item_id` 指向的项目可恢复或历史快照可独立显示。

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds. Record any existing chunk-size warning without weakening warning filters.

- [ ] **Step 5: Update user-facing documentation**

在 `README.md` 功能列表增加表现量化；在 `web/src/views/Guide.vue` 增加规则、批量记分、月度/学期统计和修正留痕说明；在 `web/src/views/Changelog.vue` 增加当前版本的模块说明，但不要改写历史版本条目。

- [ ] **Step 6: Commit**

```bash
git add server/routes/backup.js tests/migration-backup.test.js README.md web/src/views/Guide.vue web/src/views/Changelog.vue
git commit -m "功能：完善行为量化备份与使用说明"
```

### Task 8: 最终验收和交付检查

**Files:**
- Test: all existing tests plus assessment tests

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all existing and new tests pass with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite build succeeds; new page is code-split; ExcelJS remains dynamically loaded.

- [ ] **Step 3: Verify the acceptance workflow manually or with smoke coverage**

完成以下闭环：预置规则 → 新增规则 → 值日组批量加分 → 全班批量扣分 → 重复拦截 → 月度排名 → 学期累计 → Excel/CSV/JSON 导出 → 编辑并填写原因 → 查看修正历史 → 撤销 → 恢复。

- [ ] **Step 4: Check repository state and generated files**

Run: `git status --short --branch`

Expected: only intentional source, test and documentation commits exist；`web/dist`、`node_modules` 等生成物不进入 Git。

## Spec Coverage Checklist

- [ ] 全班级共用规则：Tasks 1、2、5。
- [ ] 预置分类和行为项目：Task 1。
- [ ] 固定分值与历史快照：Tasks 1、2。
- [ ] 单人、多选、全班、值日组、班委组：Tasks 2、5。
- [ ] 每日重复规则：Tasks 2、3、5。
- [ ] 月度统计、学期累计、班级内排名：Task 3。
- [ ] 编辑、撤销、恢复和修正历史：Task 2、5。
- [ ] Excel、CSV、JSON 导出：Task 6。
- [ ] 备份、迁移和历史数据保留：Tasks 1、7。
- [ ] UI、API、迁移和回归测试：Tasks 1-8。
