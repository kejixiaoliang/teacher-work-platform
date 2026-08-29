import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('duty roster distinguishes fixed weekdays from legacy weekly rotation', () => {
  const source = fs.readFileSync('web/src/views/Duties.vue', 'utf8');
  assert.match(source, /isWeekdayMode/);
  assert.match(source, /今天无值日/);
  assert.match(source, /label="星期"/);
  assert.match(source, /return ['"]未安排['"]/);
  assert.doesNotMatch(source, /把学生分成 N 组，每周轮换一组/);
  assert.doesNotMatch(source, /<el-table-column prop="week" label="周次"/);
});
