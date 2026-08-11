import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('scores page exposes reusable subject template controls', () => {
  const source = fs.readFileSync('web/src/views/Scores.vue', 'utf8');
  assert.match(source, /subjectTemplates/);
  assert.match(source, /saveSubjectTemplate/);
  assert.match(source, /applySubjectTemplate/);
});
