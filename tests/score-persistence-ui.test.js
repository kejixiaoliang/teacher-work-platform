import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('scores page reloads persisted data when the route mounts again', () => {
  const source = fs.readFileSync('web/src/views/Scores.vue', 'utf8');
  assert.match(
    source,
    /watch\(\(\) => store\.currentClassId,[\s\S]*?loadExams\(\);[\s\S]*?loadStudents\(\);[\s\S]*?\},\s*\{\s*immediate:\s*true\s*\}\)/,
  );
});
