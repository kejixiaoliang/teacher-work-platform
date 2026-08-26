import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportPlan, commitImport } from '../cloudfunctions/import-data/import-plan.cjs';

const now = '2026-08-26T12:00:00.000Z';
const exportId = '66666666-6666-4666-8666-666666666666';
const classUuid = '77777777-7777-4777-8777-777777777777';
const studentUuid = '88888888-8888-4888-8888-888888888888';

function payload() {
  return {
    format: 'teacher-work-backup', formatVersion: 1, appVersion: '0.7.0', databaseVersion: 7,
    exportId, exportedAt: now, source: { platform: 'desktop' },
    content: {
      classes: [{ uuid: classUuid, name: '一班', ownerId: 'forged-owner' }],
      students: [{ uuid: studentUuid, classUuid, name: '学生甲' }],
      studentHistory: [], seats: [], seatLayouts: [], documents: [], duties: [], exams: [], scores: [],
      attendance: [], studentRecords: [], leaves: [], contacts: [],
      assessment: { categories: [], items: [], records: [], revisions: [] }, followUpTasks: [], settings: {},
    },
    attachments: { included: false, omittedCount: 0 },
    integrity: { algorithm: 'sha256', scope: 'canonical-json-without-integrity-value', value: 'test' },
  };
}

function fakeDb(existingBatches = [], failCollection = '') {
  const calls = [];
  const collections = new Map([
    ['import_batches', existingBatches], ['datasets', []], ['classes', []], ['students', []],
  ]);
  const db = {
    calls,
    collection(name) {
      return {
        where(query) {
          return { get: async () => ({ data: collections.get(name).filter((row) => row.ownerId === query.ownerId && row.sourceExportId === query.sourceExportId) }) };
        },
        add: async ({ data }) => {
          calls.push({ action: 'add', name, data });
          if (name === failCollection) throw new Error('fake write failure');
          const row = { ...data, _id: `${name}-${collections.get(name).length + 1}` };
          collections.get(name).push(row);
          return { _id: row._id };
        },
        doc(id) {
          return { update: async ({ data }) => { calls.push({ action: 'update', name, id, data }); return {}; } };
        },
      };
    },
  };
  return db;
}

test('builds a new dataset import plan and overrides forged ownerId', () => {
  const plan = buildImportPlan({ payload: payload(), ownerId: 'wx-owner', datasetId: 'dataset-1', now });
  assert.equal(plan.ok, true);
  assert.equal(plan.dataset.ownerId, 'wx-owner');
  assert.equal(plan.classes[0].ownerId, 'wx-owner');
  assert.equal(plan.students[0].datasetId, 'dataset-1');
  assert.equal(plan.batch.status, 'pending');
});

test('rejects a repeated export before any write', async () => {
  const db = fakeDb([{ ownerId: 'wx-owner', sourceExportId: exportId, status: 'completed' }]);
  const result = await commitImport({ db, payload: payload(), ownerId: 'wx-owner', datasetId: 'dataset-1', now });
  assert.deepEqual(result, { ok: false, code: 'DUPLICATE_EXPORT', stage: 'commit' });
  assert.equal(db.calls.length, 0);
});

test('commits dataset, batch, classes and students in order', async () => {
  const db = fakeDb();
  const result = await commitImport({ db, payload: payload(), ownerId: 'wx-owner', datasetId: 'dataset-1', now });
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'commit');
  assert.deepEqual(db.calls.filter((call) => call.action === 'add').map((call) => call.name), ['datasets', 'import_batches', 'classes', 'students']);
  assert.equal(db.calls[2].data.ownerId, 'wx-owner');
  assert.equal(db.calls[3].data._openid, 'wx-owner');
});

test('marks the batch and dataset failed when a business write fails', async () => {
  const db = fakeDb([], 'students');
  const result = await commitImport({ db, payload: payload(), ownerId: 'wx-owner', datasetId: 'dataset-1', now });
  assert.deepEqual(result, {
    ok: false,
    stage: 'commit',
    code: 'IMPORT_FAILED',
    errors: ['导入过程中发生错误，批次已标记为失败'],
  });
  assert.equal(db.calls.filter((call) => call.action === 'update').length, 2);
});
