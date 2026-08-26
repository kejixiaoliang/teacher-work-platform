import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudRecord, buildImportBatch, validateCloudRecord } from '../shared/contracts/cloud-record.js';

const now = '2026-08-26T12:00:00.000Z';
const uuid = '22222222-2222-4222-8222-222222222222';

test('builds an owned cloud record without trusting local ownership fields', () => {
  const record = buildCloudRecord({
    row: { id: 7, uuid, name: '脱敏学生', ownerId: 'forged-owner' },
    ownerId: 'wx-owner',
    datasetId: 'dataset-1',
    sourceImportBatchId: 'batch-1',
    now,
  });
  assert.equal(record.ownerId, 'wx-owner');
  assert.equal(record.legacyId, 7);
  assert.equal(record.revision, 1);
  assert.deepEqual(validateCloudRecord(record), { ok: true, errors: [] });
});

test('rejects records without stable identity or tenant scope', () => {
  assert.throws(() => buildCloudRecord({ row: { name: 'missing uuid' }, ownerId: 'owner', datasetId: 'dataset-1', now }), /稳定 UUID/);
  assert.throws(() => buildCloudRecord({ row: { uuid }, ownerId: '', datasetId: 'dataset-1', now }), /ownerId/);
  assert.deepEqual(validateCloudRecord({ uuid, ownerId: 'owner', datasetId: 'dataset-1', createdAt: now, updatedAt: now, revision: 0, source: 'import' }), {
    ok: false,
    errors: ['revision 必须是正整数'],
  });
});

test('creates a pending idempotent import batch envelope', () => {
  const batch = buildImportBatch({
    ownerId: 'wx-owner',
    sourceExportId: '33333333-3333-4333-8333-333333333333',
    sourceAppVersion: '0.7.0',
    sourceFormatVersion: 1,
    datasetId: 'dataset-1',
    now,
  });
  assert.match(batch.importBatchId, /^[0-9a-f-]{36}$/);
  assert.equal(batch.sourceExportId, '33333333-3333-4333-8333-333333333333');
  assert.equal(batch.status, 'pending');
  assert.equal(batch.completedAt, null);
});
