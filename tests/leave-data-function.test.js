import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/leave-data/index.js'), 'utf8');

test('leave function keeps client leave types, statuses and date validation', async () => {
  const { normalizeRequest, recordUuid, datesInRange } = await import('../cloudfunctions/leave-data/index.js');
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', classUuid: 'c', leave: { studentUuid: 's', startDate: '2026-08-26', type: '病假', status: '已批准' } }).ok, true);
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', classUuid: 'c', leave: { studentUuid: 's', startDate: 'bad' } }).code, 'DATE_INVALID');
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', classUuid: 'c', leave: { studentUuid: 's', startDate: '2026-02-30' } }).code, 'DATE_INVALID');
  assert.equal(normalizeRequest({ action: 'delete', datasetId: 'ds', classUuid: 'c', uuid: 'l1' }).ok, true);
  assert.deepEqual(datesInRange('2026-08-30', '2026-09-01'), ['2026-08-30', '2026-08-31', '2026-09-01']);
  assert.equal(recordUuid('c', 's', '2026-08-26'), recordUuid('c', 's', '2026-08-26'));
});

test('leave function scopes all records to authenticated owner and dataset', () => {
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /datasetId: request\.datasetId/);
  assert.match(source, /deletedAt/);
  assert.match(source, /revision/);
  assert.match(source, /STUDENT_NOT_IN_CLASS/);
  assert.match(source, /LEAVE_CONFLICT/);
  assert.match(source, /syncAttendanceForLeave/);
  assert.match(source, /leaveUuid/);
  assert.match(source, /请假联动/);
  assert.match(source, /status !== '请假'/);
  assert.doesNotMatch(source, /event\.ownerId/);
});

test('leave attendance linkage preserves manual attendance and only clears linked leave rows', async () => {
  const { syncAttendanceForLeave, clearLinkedAttendance } = await import('../cloudfunctions/leave-data/index.js');
  const rows = [{ _id: 'manual', ownerId: 'o', datasetId: 'd', classUuid: 'c', studentUuid: 's', date: '2026-08-01', status: '迟到', remark: '教师登记', deletedAt: null, revision: 1 }];
  let nextId = 1;
  const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
  const collection = {
    where(query) { return { limit() { return { get: async () => ({ data: rows.filter((row) => matches(row, query)) }) }; } }; },
    add: async ({ data }) => { rows.push({ ...data, _id: `new-${nextId++}` }); return { _id: rows.at(-1)._id }; },
    doc(id) { return { update: async ({ data }) => { Object.assign(rows.find((row) => row._id === id), data); } }; },
  };
  const db = { collection: (name) => { assert.equal(name, 'attendance'); return collection; } };
  const leave = { uuid: 'l1', classUuid: 'c', studentUuid: 's', startDate: '2026-08-01', endDate: '2026-08-02', status: '已批准' };
  assert.equal(await syncAttendanceForLeave(db, { ownerId: 'o', datasetId: 'd' }, leave), 1);
  assert.equal(rows.find((row) => row.date === '2026-08-01').status, '迟到');
  assert.equal(rows.find((row) => row.date === '2026-08-02').leaveUuid, 'l1');
  assert.equal(await clearLinkedAttendance(db, { ownerId: 'o', datasetId: 'd' }, leave), 1);
  assert.equal(rows.find((row) => row._id === 'manual').deletedAt, null);
  assert.ok(rows.find((row) => row.leaveUuid === 'l1').deletedAt);
});
