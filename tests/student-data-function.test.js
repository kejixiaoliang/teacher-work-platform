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
    precheckFailures: [{ row: 8, name: '', reason: '姓名为空，请填写姓名列', ownerId: 'forged' }],
  });
  assert.deepEqual(request, {
    ok: true,
    action: 'import',
    datasetId: 'ds',
    classUuid: 'c1',
    fileName: '学生名单',
    fileFormat: 'unknown',
    students: [{ row: 7, fields: { school_no: '001', name: '张三' } }],
    rejected: [{ row: 8, name: '', reason: '姓名为空，请填写姓名列' }],
  });
});

test('student import history requires class scope', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.equal(normalizeRequest({ action: 'history', datasetId: 'ds' }).code, 'CLASS_REQUIRED');
  assert.deepEqual(normalizeRequest({ action: 'history', datasetId: ' ds ', classUuid: ' c1 ' }), {
    ok: true, action: 'history', datasetId: 'ds', classUuid: 'c1',
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
    recordHistory: false,
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
    recordHistory: false,
  });
  assert.equal(result.success.length, 0);
  assert.deepEqual(result.fail, [{ row: 2, name: '新学生', reason: `学生 UUID ${stableUuid} 已存在于当前数据集` }]);
  assert.equal(added.length, 0);
});

test('student import batch contract stores result metadata without trusting client ownership', async () => {
  const { buildStudentImportBatch } = await import('../cloudfunctions/student-data/index.js');
  const batch = buildStudentImportBatch({
    ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c1', fileName: ' 名单.csv ', fileFormat: 'csv',
    now: '2026-08-28T01:00:00.000Z', importBatchId: 'batch-1',
  });
  assert.deepEqual(batch, {
    importBatchId: 'batch-1', ownerId: 'wx-owner', _openid: 'wx-owner', datasetId: 'ds', classUuid: 'c1',
    batchType: 'student-roster', sourceFileName: '名单.csv', sourceFormat: 'csv', status: 'pending',
    resultStatus: 'pending', totalCount: 0, successCount: 0, failedCount: 0, failures: [],
    createdAt: '2026-08-28T01:00:00.000Z', completedAt: null,
  });
  assert.equal('clientOwnerId' in batch, false);
});

test('student import history query is scoped and newest first', async () => {
  const { listStudentImportHistory } = await import('../cloudfunctions/student-data/index.js');
  let whereQuery;
  const records = [
    { importBatchId: 'new', sourceFileName: '新名单.csv', sourceFormat: 'csv', resultStatus: 'completed', totalCount: 2, successCount: 2, failedCount: 0, failures: [], createdAt: '2026-08-28T02:00:00.000Z', completedAt: '2026-08-28T02:00:00.000Z', ownerId: 'wx-owner', _openid: 'wx-owner' },
    { importBatchId: 'old', sourceFileName: '旧名单.csv', sourceFormat: 'csv', resultStatus: 'partial', totalCount: 2, successCount: 1, failedCount: 1, failures: [{ row: 3, name: '李四', reason: '学号重复' }], createdAt: '2026-08-28T01:00:00.000Z', completedAt: '2026-08-28T01:00:00.000Z', ownerId: 'wx-owner', _openid: 'wx-owner' },
  ];
  const db = {
    collection(name) {
      assert.equal(name, 'import_batches');
      return {
        where(query) {
          whereQuery = query;
          return {
            orderBy(field, direction) {
              assert.equal(field, 'createdAt');
              assert.equal(direction, 'desc');
              return { limit: (count) => ({ get: async () => { assert.equal(count, 30); return { data: records }; } }) };
            },
          };
        },
      };
    },
  };
  const result = await listStudentImportHistory({ db, ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c1' });
  assert.deepEqual(whereQuery, { ownerId: 'wx-owner', datasetId: 'ds', batchType: 'student-roster', classUuid: 'c1' });
  assert.deepEqual(result, { ok: true, action: 'history', records: records.map(({ ownerId, _openid, ...record }) => record) });
});

test('student import persists a completed batch with partial failure details', async () => {
  const { importStudents } = await import('../cloudfunctions/student-data/index.js');
  const calls = [];
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
        add: async ({ data }) => { calls.push({ action: 'add', name, data }); return { _id: name === 'import_batches' ? 'batch-doc' : 'student-doc' }; },
        doc(id) {
          return { update: async ({ data }) => { calls.push({ action: 'update', name, id, data }); return {}; } };
        },
      };
    },
  };
  const result = await importStudents({
    db, ownerId: 'wx-owner', datasetId: 'ds', classUuid: 'c1', fileName: '名单.csv', fileFormat: 'csv',
    students: [
      { row: 2, fields: { school_no: '009', name: '重复学生' } },
      { row: 3, fields: { school_no: '010', name: '新学生' } },
    ],
    rejected: [], now: '2026-08-28T01:00:00.000Z', uuidFactory: () => 'new-uuid', batchUuidFactory: () => 'batch-uuid',
  });
  assert.equal(result.importBatchId, 'batch-uuid');
  assert.equal(result.historySaved, true);
  assert.deepEqual(calls.map((call) => `${call.action}:${call.name}`), ['add:import_batches', 'add:students', 'update:import_batches']);
  assert.deepEqual(calls[2].data, {
    status: 'completed', resultStatus: 'partial', totalCount: 2, successCount: 1, failedCount: 1,
    failures: [{ row: 2, name: '重复学生', reason: '学号 009 已存在于当前班级' }],
    completedAt: '2026-08-28T01:00:00.000Z',
  });
});
