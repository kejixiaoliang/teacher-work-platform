import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
const moduleRegistry = fs.readFileSync(path.join(root, 'miniprogram/config/modules.js'), 'utf8');

test('mini program exposes the three planned navigation sections', () => {
  assert.deepEqual(app.tabBar.list.map((item) => item.text), ['首页', '工作台', '设置']);
  assert.deepEqual(app.tabBar.list.map((item) => item.pagePath), [
    'pages/index/index',
    'pages/workbench/index',
    'pages/settings/index',
  ]);
});

test('student management has a mobile list and detail route', () => {
  assert.ok(app.pages.includes('pages/students/index'));
  assert.ok(app.pages.includes('pages/student-detail/index'));
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  const modules = fs.readFileSync(path.join(root, 'miniprogram/config/modules.js'), 'utf8');
  const listPage = fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.js'), 'utf8');
  const detailPage = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.js'), 'utf8');
  assert.match(`${workbench}\n${modules}`, /pages\/students\/index/);
  assert.match(listPage, /listStudentData/);
  assert.match(listPage, /onKeywordInput/);
  assert.match(listPage, /onFilterChange/);
  assert.match(listPage, /followUpStatus/);
  assert.match(fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.wxml'), 'utf8'), /全部近视/);
  assert.match(detailPage, /uuid/);
});

test('student management exposes a create form backed by the scoped write service', () => {
  const listPage = fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.wxml'), 'utf8');
  assert.match(listPage, /writeStudentData/);
  assert.match(listPage, /action: 'create'/);
  assert.match(listPage, /datasetId: this\.data\.datasetId/);
  assert.match(template, /新增学生/);
  assert.match(template, /saveStudent/);
});

test('student detail exposes update and soft-delete actions', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.wxml'), 'utf8');
  assert.match(page, /action: 'update'/);
  assert.match(page, /action: 'delete'/);
  assert.match(template, /bindtap="startEdit"/);
  assert.match(template, /bindtap="deleteStudent"/);
});

test('student detail exposes the desktop profile records and related workflows', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.wxml'), 'utf8');
  assert.match(page, /callStudentProfile/);
  assert.match(page, /callFollowUpData/);
  assert.match(page, /collection: 'student_metrics_history'/);
  assert.match(page, /collection: 'student_records'/);
  assert.match(page, /openFollowUps/);
  assert.match(page, /openContacts/);
  assert.match(page, /const action = form\.uuid \? 'update' : 'create'/);
  assert.match(template, /健康与体征历史/);
  assert.match(template, /成长档案/);
  assert.match(template, /跟进事项/);
  assert.match(template, /家校沟通/);
  assert.match(template, /data-type="record" data-uuid="\{\{item\.uuid\}\}" bindtap="openProfile"/);
  assert.doesNotMatch(template, /后续阶段接入/);
});

test('attendance management exposes the existing four statuses and save flow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/attendance/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/attendance/index.wxml'), 'utf8');
  assert.ok(app.pages.includes('pages/attendance/index'));
  assert.match(page, /出勤/);
  assert.match(page, /迟到/);
  assert.match(page, /请假/);
  assert.match(page, /缺勤/);
  assert.match(page, /action: 'save'/);
  assert.match(page, /markAllPresent/);
  assert.match(page, /monthlySummary/);
  assert.match(page, /loadMonthly/);
  assert.match(page, /classes\[Number\(event\.detail\.value\)\]/);
  assert.match(template, /保存当天考勤/);
  assert.match(template, /一键全部出勤/);
  assert.match(template, /月度统计/);
  assert.match(template, /view === 'daily' && !rows\.length/);
});

test('leave management exposes client leave types, statuses and actions', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/leaves/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/leaves/index.wxml'), 'utf8');
  assert.ok(app.pages.includes('pages/leaves/index'));
  assert.match(page, /callLeaveData/);
  assert.match(page, /action: 'create'/);
  assert.match(page, /action: 'update'/);
  assert.match(template, /登记请假/);
  assert.match(template, /销假/);
});

test('follow-up management exposes the existing task workflow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/follow-up/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/follow-up/index.wxml'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'miniprogram/services/teacher-data.js'), 'utf8');
  assert.ok(app.pages.includes('pages/follow-up/index'));
  assert.match(page, /callFollowUpData/);
  assert.match(page, /pending/);
  assert.match(page, /completed/);
  assert.match(page, /openEdit/);
  assert.match(page, /action, datasetId/);
  assert.match(page, /changeStatus/);
  assert.match(page, /classUuid: options\?\.classUuid \|\| ''/);
  assert.match(page, /students\.records\.filter/);
  assert.match(template, /编辑/);
  assert.match(template, /重新打开/);
  assert.match(template, /取消/);
  assert.match(service, /follow-up-data/);
});

test('workbench and settings retain existing client feature names', () => {
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  for (const name of ['学生管理', '座位管理', '考勤管理', '表现量化', '成绩管理', '数据分析', '文档管理']) {
    assert.match(`${workbench}\n${moduleRegistry}`, new RegExp(name));
  }
  for (const name of ['数据导入', '数据同步', '使用指南', '版本更新']) assert.match(settings, new RegExp(name));
  assert.match(settings, /openSync/);
  assert.ok(app.pages.includes('pages/sync/index'));
  const syncPage = fs.readFileSync(path.join(root, 'miniprogram/pages/sync/index.js'), 'utf8');
  assert.match(syncPage, /getSyncStatus/);
});

test('settings exposes the server-authorized redeem code flow', () => {
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  const redeem = fs.readFileSync(path.join(root, 'miniprogram/pages/redeem/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/redeem/index'));
  assert.match(settings, /openRedeem/);
  assert.match(redeem, /action: 'redeem'/);
  assert.match(redeem, /callRedeemCode/);
});

test('workbench routes the remaining client modules to mobile operation views', () => {
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  const modules = fs.readFileSync(path.join(root, 'miniprogram/config/modules.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/business/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/business/index'));
  for (const name of ['成绩管理', '座位管理', '值日管理', '家校沟通', '文档管理', '数据分析']) assert.match(`${workbench}\n${modules}`, new RegExp(name));
  assert.match(page, /callBusinessData/);
  assert.match(page, /action: 'create'/);
  assert.match(page, /action: 'delete'/);
});

test('score management has dedicated exam, batch entry and analysis actions', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/scores/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/scores/index.wxml'), 'utf8');
  const fileService = fs.readFileSync(path.join(root, 'miniprogram/services/score-file-service.js'), 'utf8');
  assert.ok(app.pages.includes('pages/scores/index'));
  assert.match(page, /action: 'bulkSave'/);
  assert.match(page, /action: 'analysis'/);
  assert.match(page, /新建考试|saveExam/);
  assert.match(page, /editExam/);
  assert.match(page, /deleteExam/);
  assert.match(page, /loadTrend/);
  assert.match(page, /chooseScoreFile/);
  assert.match(page, /confirmScoreImport/);
  assert.match(page, /exportScoreFile/);
  assert.match(page, /async selectClass[\s\S]*collection: 'exams'/);
  assert.match(template, /选择成绩文件/);
  assert.match(template, /导出成绩 CSV/);
  assert.match(template, /导入预览/);
  assert.match(fileService, /wx\.shareFileMessage/);
});

test('seat management has a mobile grid with placement and lock actions', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/seats/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/seats/index.wxml'), 'utf8');
  assert.ok(app.pages.includes('pages/seats/index'));
  assert.match(page, /toggleLock/);
  assert.match(page, /autoArrange/);
  assert.match(page, /shift\(/);
  assert.match(page, /showHistory/);
  assert.match(page, /layoutHistory/);
  assert.match(page, /layoutSave/);
  assert.match(template, /自动排座/);
  assert.match(template, /历史布局/);
  assert.match(page, /save/);
  assert.match(template, /grid/);
  assert.match(template, /安排学生/);
  for (const label of ['行数', '列数', '均分', '中间走道', '双走道', '讲台', '座位备注']) assert.match(template, new RegExp(label));
  assert.match(page, /allStudents/);
  assert.match(page, /callClassData/);
  assert.match(page, /resizeGrid/);
});

test('duty management has a dedicated grouping and weekday workflow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/duties/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/duties/index.wxml'), 'utf8');
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/duties/index'));
  assert.match(page, /autoGroup/);
  assert.match(page, /groupDays/);
  assert.match(template, /一键自动分组/);
  assert.match(template, /data-action="presetLeaders"/);
  assert.match(template, /设置值日星期/);
  assert.match(`${workbench}\n${moduleRegistry}`, /pages\/duties\/index/);
});

test('home-school contact management has a dedicated mobile record workflow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/contacts/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/contacts/index.wxml'), 'utf8');
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/contacts/index'));
  assert.match(page, /contactStats/);
  assert.match(page, /action: 'create'/);
  assert.match(page, /action: 'update'/);
  assert.match(page, /classUuid: options\?\.classUuid \|\| ''/);
  assert.match(page, /wx\.showModal/);
  assert.match(template, /新增沟通/);
  assert.match(template, /沟通结果/);
  assert.match(`${workbench}\n${moduleRegistry}`, /pages\/contacts\/index/);
});

test('document management exposes metadata-only mobile operations', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/documents/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/documents/index.wxml'), 'utf8');
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/documents/index'));
  assert.match(page, /collection: 'documents'/);
  assert.match(page, /action: 'update'/);
  assert.match(template, /文件上传与预览仍由客户端负责/);
  assert.match(template, /新增文档/);
  assert.match(`${workbench}\n${moduleRegistry}`, /pages\/documents\/index/);
});

test('assessment management has a dedicated scoring and summary workflow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/assessment/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/assessment/index.wxml'), 'utf8');
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/assessment/index'));
  assert.match(page, /assessment_records/);
  assert.match(page, /action: 'create'/);
  assert.match(page, /action: 'update'/);
  assert.match(template, /记录表现/);
  assert.match(template, /加分/);
  assert.match(`${workbench}\n${moduleRegistry}`, /pages\/assessment\/index/);
  assert.match(page, /showHistory/);
  assert.match(page, /openRules/);
  assert.match(page, /batchSave/);
  assert.match(page, /voidRecord/);
  assert.match(page, /restoreRecord/);
  assert.match(template, /批量记分/);
  for (const label of ['手动多选', '全班', '值日组', '班委组', '月度统计', '学期累计', '分类汇总', '导出 CSV', '导出 JSON']) assert.match(template, new RegExp(label));
  assert.match(page, /assessmentStats/);
  assert.match(page, /exportAssessment/);
  assert.match(page, /allStudents/);
});

test('assessment rules page exposes category and item management', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/assessment-rules/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/assessment-rules/index.wxml'), 'utf8');
  assert.ok(app.pages.includes('pages/assessment-rules/index'));
  assert.match(page, /assessment_categories/);
  assert.match(page, /assessment_items/);
  assert.match(template, /新增行为项目/);
  assert.match(template, /当天允许重复/);
});

test('data analysis has a dedicated CloudBase summary page', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/analysis/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/analysis/index.wxml'), 'utf8');
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/analysis/index'));
  assert.match(page, /action: 'summary'/);
  assert.match(page, /callBusinessData/);
  assert.match(template, /数据概览/);
  for (const label of ['身高分布', '视力健康', '成绩等级分布', '性别构成', '住宿情况', '成绩统计', '表现量化']) assert.match(template, new RegExp(label));
  assert.match(template, /analysisWarning/);
  assert.match(page, /数据分析云函数版本过旧/);
  assert.match(`${workbench}\n${moduleRegistry}`, /pages\/analysis\/index/);
});
