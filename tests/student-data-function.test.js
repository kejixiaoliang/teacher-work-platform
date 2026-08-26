import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/student-data/index.js'), 'utf8');

test('student write function validates scoped actions and required names', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.equal(normalizeRequest({ action: 'create', student: { name: '  张三  ' } }).code, 'DATASET_REQUIRED');
  assert.equal(normalizeRequest({ action: 'create', datasetId: 'ds', student: {} }).code, 'NAME_REQUIRED');
  assert.equal(normalizeRequest({ action: 'update', datasetId: 'ds', student: { name: '张三' } }).code, 'UUID_REQUIRED');
  assert.deepEqual(normalizeRequest({ action: 'create', datasetId: 'ds', student: { name: '  张三  ', ownerId: 'forged', unknown: 'x' } }), {
    ok: true, action: 'create', datasetId: 'ds', uuid: '', fields: { name: '张三' },
  });
});

test('student write function uses server scope, stable uuid and soft deletion', () => {
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /deletedAt: now/);
  assert.match(source, /revision/);
  assert.doesNotMatch(source, /event\.ownerId/);
});
