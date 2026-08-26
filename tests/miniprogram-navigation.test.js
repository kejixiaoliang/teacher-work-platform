import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

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
  const listPage = fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.js'), 'utf8');
  const detailPage = fs.readFileSync(path.join(root, 'miniprogram/pages/student-detail/index.js'), 'utf8');
  assert.match(workbench, /pages\/students\/index/);
  assert.match(listPage, /collectionName: 'students'/);
  assert.match(listPage, /onKeywordInput/);
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

test('attendance management exposes the existing four statuses and save flow', () => {
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/attendance/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/attendance/index.wxml'), 'utf8');
  assert.ok(app.pages.includes('pages/attendance/index'));
  assert.match(page, /出勤/);
  assert.match(page, /迟到/);
  assert.match(page, /请假/);
  assert.match(page, /缺勤/);
  assert.match(page, /action: 'save'/);
  assert.match(template, /保存当天考勤/);
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
  const service = fs.readFileSync(path.join(root, 'miniprogram/services/teacher-data.js'), 'utf8');
  assert.ok(app.pages.includes('pages/follow-up/index'));
  assert.match(page, /callFollowUpData/);
  assert.match(page, /pending/);
  assert.match(page, /completed/);
  assert.match(service, /follow-up-data/);
});

test('workbench and settings retain existing client feature names', () => {
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  for (const name of ['班级设置', '学生管理', '座位管理', '考勤管理', '表现量化', '成绩管理', '数据分析', '文档管理']) {
    assert.match(workbench, new RegExp(name));
  }
  for (const name of ['数据导入', '数据同步', '使用指南', '版本更新']) assert.match(settings, new RegExp(name));
});

test('settings exposes the server-authorized redeem code flow', () => {
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  const redeem = fs.readFileSync(path.join(root, 'miniprogram/pages/redeem/index.js'), 'utf8');
  assert.ok(app.pages.includes('pages/redeem/index'));
  assert.match(settings, /openRedeem/);
  assert.match(redeem, /action: 'redeem'/);
  assert.match(redeem, /callRedeemCode/);
});
