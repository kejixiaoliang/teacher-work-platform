import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/student-data/index.js'), 'utf8');

test('student write function validates scoped actions and required names', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.equal(normalizeRequest({ action: 'create', student: { name: '  张三  ' } }).code, 'DATASET_REQUIRED');
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', student: {} }).code, 'NAME_REQUIRED');
  assert.equal(normalizeRequest({ action: 'update', datasetId: 'ds', student: { name: '张三' } }).code, 'UUID_REQUIRED');
  assert.deepEqual(normalizeRequest({ action: 'create', datasetId: 'ds', student: { name: '  张三  ', ownerId: 'forged', unknown: 'x' } }), {
    ok: true, action: 'create', datasetId: 'ds', uuid: '', classUuid: '', fields: { name: '张三' },
  });
});

test('student write function uses server scope, stable uuid and soft deletion', () => {
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /deletedAt: now/);
  assert.match(source, /revision/);
  assert.doesNotMatch(source, /event\.ownerId/);
});

test('student import requires class scope and caps each batch', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.equal(normalizeRequest({ action: 'import', datasetId: 'ds', students: [{ name: '张三' }] }).code, 'CLASS_REQUIRED');
  assert.equal(normalizeRequest({ action: 'import', datasetId: 'ds', classUuid: 'c1', students: [] }).code, 'STUDENTS_REQUIRED');
  assert.equal(normalizeRequest({ action: 'import', datasetId: 'ds', classUuid: 'c1', students: Array.from({ length: 201 }, () => ({ name: '学生' })) }).code, 'IMPORT_LIMIT_EXCEEDED');
  const request = normalizeRequest({
    action: 'import', datasetId: 'ds', classUuid: 'c1',
    students: [{ _row: 7, school_no: '001', name: ' 张三 ', ownerId: 'forged' }],
  });
  assert.deepEqual(request, {
    ok: true,
    action: 'import',
    datasetId: 'ds',
    classUuid: 'c1',
    students: [{ row: 7, fields: { school_no: '001', name: '张三' } }],
    rejected: [],
  });
});

test('student import rechecks duplicates and writes only scoped rows', async () => {
  const { importStudents } = await import('../cloudfunctions/student-data/index.js');
  const added = [];
  const collections = {
    classes: [{ uuid: 'c1', ownerId: 'wx-owner', datasetId: 'ds', deletedAt: null }],
    students: [{ uuid: 'existing', ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c1', schoolNo: '009', name: '已有学生', deletedAt: null }],
  };
  const db = {
    collection(name) {
      return {
        where(query) {
          const data = (collections[name] || []).filter((row) => Object.entries(query).every(([key, value]) => row[key] === value));
          return { limit: () => ({ get: async () => ({ data }) }) };
        },
        add: async ({ data }) => { added.push(data); return { _id: `student-${added.length}` }; },
      };
    },
  };

  const result = await importStudents({
    db,
    ownerId: 'wx-owner',
    datasetId: 'ds',
    classUuid: 'c1',
    students: [
      { row: 2, fields: { school_no: '009', name: '重复学生' } },
      { row: 3, fields: { school_no: '010', name: '新学生' } },
    ],
    rejected: [{ row: 4, name: '', reason: '学生姓名不能为空' }],
    now: '2026-08-28T00:00:00.000Z',
    uuidFactory: () => 'new-uuid',
  });

  assert.deepEqual(result, {
    ok: true,
    action: 'import',
    success: [{ row: 3, name: '新学生', uuid: 'new-uuid' }],
    fail: [
      { row: 4, name: '', reason: '学生姓名不能为空' },
      { row: 2, name: '重复学生', reason: '学号 009 已存在于当前班级' },
    ],
    counts: { total: 3, success: 1, failed: 2 },
  });
  assert.equal(added.length, 1);
  assert.equal(added[0].ownerId, 'wx-owner');
  assert.equal(added[0].datasetId, 'ds');
  assert.equal(added[0].classUuid, 'c1');
  assert.equal(added[0].ownerId === 'forged', false);
});

test('student import rejects a stable uuid already used in another class of the dataset', async () => {
  const { importStudents } = await import('../cloudfunctions/student-data/index.js');
  const stableUuid = 'b71dbe10-393f-4d2d-96bc-e35144136020';
  const added = [];
  const collections = {
    classes: [{ uuid: 'c1', ownerId: 'wx-owner', datasetId: 'ds', deletedAt: null }],
    students: [{ uuid: stableUuid, ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c2', schoolNo: 'old', name: '另一班学生', deletedAt: null }],
  };
  const db = {
    collection(name) {
      return {
        where(query) {
          const data = (collections[name] || []).filter((row) => Object.entries(query).every(([key, value]) => row[key] === value));
          return { limit: () => ({ get: async () => ({ data }) }) };
        },
        add: async ({ data }) => { added.push(data); return { _id: 'unexpected' }; },
      };
    },
  };
  const result = await importStudents({
    db, ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c1', now: '2026-08-28T00:00:00.000Z',
    students: [{ row: 2, uuid: stableUuid, fields: { school_no: '010', name: '新学生' } }],
  });
  assert.equal(result.success.length, 0);
  assert.deepEqual(result.fail, [{ row: 2, name: '新学生', reason: `学生 UUID ${stableUuid} 已存在于当前数据集` }]);
  assert.equal(added.length, 0);
});
