import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSyncChange, createSyncQueueEntry, detectSyncConflict, validateSyncCursor } from '../shared/contracts/sync.js';

const record = { uuid: '123e4567-e89b-12d3-a456-426614174000', datasetId: 'dataset-1', name: '张三', revision: 2 };

test('sync change preserves stable identity and rejects whole-database payloads', () => {
  const change = buildSyncChange({ collection: 'students', record, clientId: 'desktop-1', baseRevision: 1 });
  assert.equal(change.operation, 'upsert');
  assert.equal(change.record.uuid, record.uuid);
  assert.throws(() => buildSyncChange({ collection: 'unknown', record, clientId: 'desktop-1' }), /白名单/);
  assert.throws(() => buildSyncChange({ collection: 'students', record: { datasetId: 'd1' }, clientId: 'desktop-1' }), /uuid/);
});

test('sync cursor and queue status remain diagnosable across retries', () => {
  const cursor = validateSyncCursor({ datasetId: 'dataset-1', updatedAt: new Date().toISOString(), changeId: null });
  assert.equal(cursor.ok, true);
  assert.equal(validateSyncCursor({ datasetId: '' }).ok, false);
  const queued = createSyncQueueEntry(buildSyncChange({ collection: 'students', record, clientId: 'desktop-1' }), { status: 'sent', attempts: 2 });
  assert.equal(queued.queueStatus, 'sent');
  assert.equal(queued.attempts, 2);
});

test('sync conflict is reported when server revision is ahead of the client base', () => {
  const incoming = buildSyncChange({ collection: 'students', record, clientId: 'desktop-1', baseRevision: 2 });
  assert.equal(detectSyncConflict({ incoming, current: { uuid: record.uuid, revision: 3 } }).conflict, true);
  assert.equal(detectSyncConflict({ incoming, current: { uuid: record.uuid, revision: 2 } }).conflict, false);
});
