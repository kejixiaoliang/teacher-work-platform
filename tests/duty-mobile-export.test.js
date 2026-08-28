import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDutyCsv, buildDutyRoster } from '../miniprogram/services/duty-export-service.js';

const groups = [{ no: 2, groupDays: '1,3', members: [{ studentName: '甲' }, { studentName: '=危险' }] }, { no: 5, groupDays: '', members: [{ studentName: '乙' }] }];

test('duty roster rotates by sorted groups rather than assuming continuous numbers', () => {
  assert.deepEqual(buildDutyRoster(groups, 4).map((row) => row.groupNo), [2, 5, 2, 5]);
});

test('duty CSV exposes week, group, weekdays and members safely', () => {
  const csv = buildDutyCsv(groups, 2);
  assert.match(csv, /^\uFEFF周次,值日组,固定星期,值日学生/);
  assert.match(csv, /第 2 组/);
  assert.match(csv, /'=危险/);
});
