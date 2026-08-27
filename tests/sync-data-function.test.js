import test from 'node:test';
import assert from 'node:assert/strict';

test('sync status function requires a dataset and does not accept write actions', async () => {
  const sync = await import('../cloudfunctions/sync-data/index.js');
  assert.equal(sync.normalizeRequest({ action: 'status' }).code, 'DATASET_REQUIRED');
  assert.equal(sync.normalizeRequest({ action: 'commit', datasetId: 'ds' }).code, 'ACTION_NOT_ALLOWED');
  assert.deepEqual(sync.normalizeRequest({ action: 'status', datasetId: 'ds' }), { ok: true, action: 'status', datasetId: 'ds' });
  assert.ok(sync.COLLECTIONS.includes('students'));
});
