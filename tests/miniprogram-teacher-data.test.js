import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'miniprogram/services/teacher-data.js');

test('teacher data service exposes a scoped loader for classes and students', async () => {
  const { loadTeacherData } = await import('../miniprogram/services/teacher-data.js');
  assert.equal(typeof loadTeacherData, 'function');
  assert.deepEqual(loadTeacherData.normalizeResponse({ ok: true, records: [{ uuid: 'class-1' }] }), {
    ok: true,
    records: [{ uuid: 'class-1' }],
    error: '',
  });
});

test('teacher data service rejects unsupported collections before a cloud call', async () => {
  const { loadTeacherData } = await import('../miniprogram/services/teacher-data.js');
  await assert.rejects(() => loadTeacherData({ collectionName: 'settings', datasetId: 'dataset-1' }), /暂不支持/);
});

test('index page presents class and student data states', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  assert.match(wxml, /班级/);
  assert.match(wxml, /学生/);
  assert.match(wxml, /loading/);
  assert.match(wxml, /error/);
  assert.match(wxml, /开始建立你的班级实验本/);
  assert.match(wxml, /导入已有 JSON 数据/);
  assert.match(wxml, /先看看工作台/);
});
