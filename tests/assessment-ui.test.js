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
  assert.match(api, /student: \(id, q\)/);
  assert.match(view, /openStudentDetails/);
  assert.match(view, /student-detail-drawer/);
  assert.match(router, /\/assessment/);
  assert.match(app, /表现量化/);
  assert.match(view, /学生表现量化/);
});

test('assessment view exposes rule management, batch scoring, and revision actions', () => {
  const view = fs.readFileSync('web/src/views/Assessment.vue', 'utf8');
  for (const text of ['固定分值', '全班', '值日组', '班委组', '修正原因', '查看修正历史', '撤销记录', '恢复记录']) {
    assert.match(view, new RegExp(text));
  }
});

test('assessment reloads discard stale class and period responses', () => {
  const view = fs.readFileSync('web/src/views/Assessment.vue', 'utf8');
  assert.match(view, /useSeqLoad/);
  assert.match(view, /recordsSeq\.seq\(\)/);
  assert.match(view, /statsSeq\.seq\(\)/);
  assert.match(view, /recordsSeq\.isStale/);
  assert.match(view, /statsSeq\.isStale/);
});
