import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/leave-data/index.js'), 'utf8');

test('leave function keeps client leave types, statuses and date validation', async () => {
  const { normalizeRequest, recordUuid } = await import('../cloudfunctions/leave-data/index.js');
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', classUuid: 'c', leave: { studentUuid: 's', startDate: '2026-08-26', type: '病假', status: '已批准' } }).ok, true);
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', classUuid: 'c', leave: { studentUuid: 's', startDate: 'bad' } }).code, 'DATE_INVALID');
  assert.equal(recordUuid('c', 's', '2026-08-26'), recordUuid('c', 's', '2026-08-26'));
});

test('leave function scopes all records to authenticated owner and dataset', () => {
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /datasetId: request\.datasetId/);
  assert.match(source, /deletedAt/);
  assert.match(source, /revision/);
  assert.doesNotMatch(source, /event\.ownerId/);
});
