import test from 'node:test';
import assert from 'node:assert/strict';

test('student function supports scoped list and recycle actions', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.deepEqual(normalizeRequest({ datasetId: 'ds', action: 'list' }), { ok: true, action: 'list', datasetId: 'ds', trashed: false });
  assert.equal(normalizeRequest({ datasetId: 'ds', action: 'restore' }).code, 'UUIDS_REQUIRED');
  assert.deepEqual(normalizeRequest({ datasetId: 'ds', action: 'purge', uuids: ['s1', 's1'] }), { ok: true, action: 'purge', datasetId: 'ds', uuids: ['s1'] });
});

test('student list page exposes recycle and delete actions', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile('miniprogram/pages/students/index.js', 'utf8');
  const wxml = await fs.readFile('miniprogram/pages/students/index.wxml', 'utf8');
  assert.match(source, /listStudentData/);
  assert.match(source, /action: 'restore'/);
  assert.match(source, /action: 'purge'/);
  assert.match(wxml, /回收站/);
  assert.match(wxml, /deleteStudent/);
});
