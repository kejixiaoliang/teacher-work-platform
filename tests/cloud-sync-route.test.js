import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createServer } from 'node:http';
import { setAppSetting } from '../server/db.js';

const record = { uuid: '123e4567-e89b-12d3-a456-426614174000', datasetId: 'sync-route-test', name: '张三' };
async function request(server, method, url, body) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

test('cloud sync route persists a bounded local queue and validates cursors', async () => {
  setAppSetting('cloud-sync.queue.sync-route-test', '[]');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const change = { changeId: '123e4567-e89b-12d3-a456-426614174001', clientId: 'desktop-1', collection: 'students', operation: 'upsert', record, baseRevision: null, occurredAt: new Date().toISOString() };
    const queued = await request(server, 'POST', '/api/cloud-sync/queue', { datasetId: record.datasetId, changes: [change, change] });
    assert.equal(queued.status, 202);
    assert.equal(queued.body.data.accepted, 1);
    const status = await request(server, 'GET', `/api/cloud-sync/status?dataset_id=${record.datasetId}`);
    assert.equal(status.body.data.pending, 1);
    const cursor = await request(server, 'POST', '/api/cloud-sync/cursor/validate', { cursor: { datasetId: record.datasetId, updatedAt: new Date().toISOString(), changeId: null } });
    assert.equal(cursor.status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
