import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('mini program keeps the client navigation groups and module order', () => {
  const workbench = read('miniprogram/pages/workbench/index.js');
  const expectedGroups = [
    ['常用', '学生管理', '座位管理'],
    ['学习分析', '数据分析', '成绩管理', '考勤管理', '表现量化'],
    ['班级事务', '文档管理', '值日管理', '班委学委', '课代表选择', '请假管理', '家校沟通'],
  ];

  for (const group of expectedGroups) {
    for (const name of group) assert.match(workbench, new RegExp(name));
  }
  assert.doesNotMatch(workbench, /班级与学生|日常记录|成绩与资料/);
  assert.doesNotMatch(workbench, /班级设置/);
});

test('mini program core pages use the client content vocabulary and real actions', () => {
  const home = read('miniprogram/pages/index/index.wxml');
  const workbench = read('miniprogram/pages/workbench/index.wxml');
  const settings = read('miniprogram/pages/settings/index.js');

  for (const label of ['今日工作台', '今日考勤', '今日请假', '值日安排', '近期考试', '数据管理']) {
    assert.match(home, new RegExp(label));
  }
  assert.match(home, /bindtap="openImport"/);
  assert.match(home, /bindtap="openWorkbench"/);
  assert.match(workbench, /feature-grid/);
  assert.match(workbench, /bindtap="openFeature"/);
  assert.match(settings, /数据/);
  assert.match(settings, /账号与授权/);
  assert.match(settings, /帮助/);
  assert.match(settings, /数据导入/);
  assert.match(settings, /兑换码/);
});

test('all client workbench modules have a registered mobile route or dedicated operation page', () => {
  const app = JSON.parse(read('miniprogram/app.json'));
  const workbench = read('miniprogram/pages/workbench/index.js');
  const requiredRoutes = [
    'pages/students/index',
    'pages/seats/index',
    'pages/analysis/index',
    'pages/scores/index',
    'pages/attendance/index',
    'pages/assessment/index',
    'pages/documents/index',
    'pages/duties/index',
    'pages/leaves/index',
    'pages/contacts/index',
    'pages/leaders/index',
    'pages/subject-leaders/index',
  ];

  for (const route of requiredRoutes) assert.ok(app.pages.includes(route), `missing route: ${route}`);
  for (const name of ['班委学委', '课代表选择']) assert.match(workbench, new RegExp(`pages\\/(?:leaders|subject-leaders)\\/index`));
  assert.doesNotMatch(workbench, /即将接入/);
});

test('shared mini program tokens stay aligned with the desktop palette and density', () => {
  const tokens = read('miniprogram/tokens.wxss');
  for (const color of ['#fff4dc', '#201b17', '#d64541', '#f2c84b', '#8bd6af', '#93c9d8']) assert.match(tokens, new RegExp(color));
  assert.match(tokens, /88rpx|94rpx|104rpx/);
  assert.doesNotMatch(tokens, /Inter|Roboto|Arial|system-ui|-apple-system/);
});
