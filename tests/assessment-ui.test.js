import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('exposes the assessment API and navigation entry', () => {
  const api = fs.readFileSync('web/src/api.js', 'utf8');
  const router = fs.readFileSync('web/src/router.js', 'utf8');
  const app = fs.readFileSync('web/src/App.vue', 'utf8');
  const view = fs.readFileSync('web/src/views/Assessment.vue', 'utf8');
  assert.match(api, /assessment:/);
  assert.match(api, /batchCreate/);
  assert.match(api, /monthly/);
  assert.match(router, /\/assessment/);
  assert.match(app, /表现量化/);
  assert.match(view, /学生表现量化/);
});
