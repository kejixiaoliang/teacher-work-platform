import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('attendance and score pages surface server-side skipped row details', () => {
  const attendance = fs.readFileSync('web/src/views/Attendance.vue', 'utf8');
  const scores = fs.readFileSync('web/src/views/Scores.vue', 'utf8');
  assert.match(attendance, /result\.skipped/);
  assert.match(scores, /result\.skipped/);
});
