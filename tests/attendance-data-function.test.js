import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/attendance-data/index.js'), 'utf8');

test('attendance function validates date, class and supported statuses', async () => {
  const { normalizeRequest, normalizeRows, stableAttendanceUuid } = await import('../cloudfunctions/attendance-data/index.js');
  assert.equal(normalizeRequest({ action: 'query', datasetId: 'ds', classUuid: 'c', date: '2026-08-26' }).ok, true);
  assert.equal(normalizeRequest({ action: 'query', datasetId: 'ds', classUuid: 'c', date: 'bad' }).code, 'DATE_INVALID');
  assert.equal(normalizeRequest({ action: 'monthlySummary', datasetId: 'ds', classUuid: 'c', month: '2026-08' }).ok, true);
  assert.equal(normalizeRequest({ action: 'monthlySummary', datasetId: 'ds', classUuid: 'c', month: '2026-13' }).code, 'MONTH_INVALID');
  assert.deepEqual(normalizeRows([
    { studentUuid: 's1', status: '迟到' }, { studentUuid: 's1', status: '缺勤' }, { studentUuid: 's2', status: '未知' },
  ]), [{ studentUuid: 's1', status: '迟到', remark: '' }, { studentUuid: 's2', status: '出勤', remark: '' }]);
  assert.match(stableAttendanceUuid('c1', 's1', '2026-08-26'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(stableAttendanceUuid('c1', 's1', '2026-08-26'), stableAttendanceUuid('c1', 's1', '2026-08-26'));
});

test('attendance function scopes reads and writes to the authenticated teacher', () => {
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /collection\('attendance'\)/);
  assert.match(source, /studentUuid/);
  assert.match(source, /deletedAt: null/);
  assert.match(source, /revision = \(existing\.data\[0\]\.revision \|\| 1\) \+ 1/);
  assert.doesNotMatch(source, /event\.ownerId/);
});
