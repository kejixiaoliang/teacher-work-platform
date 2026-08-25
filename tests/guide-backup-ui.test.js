import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('guide explains both backup scopes and the overwrite warning', () => {
  const guide = fs.readFileSync('web/src/views/Guide.vue', 'utf8');
  assert.match(guide, /班级备份/);
  assert.match(guide, /教师工作台完整备份/);
  assert.match(guide, /覆盖当前库/);
  assert.match(guide, /不会把班级备份自动合并/);
});

test('class settings exposes an explicit class backup action', () => {
  const classes = fs.readFileSync('web/src/views/Classes.vue', 'utf8');
  assert.match(classes, /@click="exportClassBackup\(row\)"/);
  assert.match(classes, /api\.backup\.exportClass\(row\.id\)/);
});
