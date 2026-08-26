import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const fn = require(path.resolve('cloudfunctions/follow-up-data/index.js'));

test('follow-up function keeps existing statuses and validates task input', () => {
  assert.equal(fn.normalizeRequest({ action: 'create', datasetId: 'd1', classUuid: 'c1', task: { studentUuid: 's1', title: '家长沟通', dueDate: '2026-08-27' } }).ok, true);
  assert.equal(fn.normalizeRequest({ action: 'create', datasetId: 'd1', classUuid: 'c1', task: { studentUuid: 's1', title: '家长沟通', dueDate: '2026-02-30' } }).code, 'DATE_INVALID');
  assert.equal(fn.normalizeRequest({ action: 'query', datasetId: 'd1', status: 'in_progress' }).status, 'in_progress');
});

test('follow-up function scopes records and derives stable UUIDs', () => {
  const first = fn.normalizeRequest({ action: 'create', datasetId: 'd1', classUuid: 'c1', task: { studentUuid: 's1', title: '家长沟通' } });
  assert.equal(first.datasetId, 'd1');
  assert.equal(fn.recordUuid('c1', 's1', '家长沟通', ''), fn.recordUuid('c1', 's1', '家长沟通', ''));
  assert.match(fn.recordUuid('c1', 's1', '家长沟通', ''), /^[0-9a-f-]{36}$/);
});
