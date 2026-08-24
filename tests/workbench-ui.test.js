import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('workbench API client and overview expose today workflow', () => {
  const api = fs.readFileSync('web/src/api.js', 'utf8');
  const overview = fs.readFileSync('web/src/views/Overview.vue', 'utf8');
  const students = fs.readFileSync('web/src/views/Students.vue', 'utf8');
  assert.match(api, /followUpTasks:/);
  assert.match(api, /today: classId => request\('GET', `\/api\/workbench\/today\?class_id=\$\{classId\}`\)/);
  assert.match(overview, /今日工作台|今日待办|跟进事项/);
  assert.match(students, /跟进事项/);
  assert.match(students, /completeFollowUpTask/);
});
