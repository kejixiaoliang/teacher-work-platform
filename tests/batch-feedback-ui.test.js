import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('attendance and score pages surface server-side skipped row details', () => {
  const attendance = fs.readFileSync('web/src/views/Attendance.vue', 'utf8');
  const scores = fs.readFileSync('web/src/views/Scores.vue', 'utf8');
  assert.match(attendance, /result\.skipped/);
  assert.match(scores, /result\.skipped/);
});

test('student and duty batch deletion surface partial failures', () => {
  const students = fs.readFileSync('web/src/views/Students.vue', 'utf8');
  const duties = fs.readFileSync('web/src/views/Duties.vue', 'utf8');
  assert.match(students, /Promise\.allSettled\(selected\.value\.map/);
  assert.match(students, /result\.status === 'fulfilled'/);
  assert.match(duties, /Promise\.allSettled\(list\.map/);
  assert.match(duties, /result\.status === 'fulfilled'/);
});
