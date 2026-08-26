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

test('workbench and settings retain existing client feature names', () => {
  const workbench = fs.readFileSync(path.join(root, 'miniprogram/pages/workbench/index.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  for (const name of ['班级设置', '学生管理', '座位管理', '考勤管理', '表现量化', '成绩管理', '数据分析', '文档管理']) {
    assert.match(workbench, new RegExp(name));
  }
  for (const name of ['数据导入', '数据同步', '使用指南', '版本更新']) assert.match(settings, new RegExp(name));
});
