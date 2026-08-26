import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/query-data/index.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/query-data/package.json'), 'utf8'));

test('query function restricts reads to classes and students', async () => {
  const { normalizeQuery } = await import('../cloudfunctions/query-data/index.js');
  assert.deepEqual(normalizeQuery({ collectionName: 'classes', datasetId: 'dataset-1' }), {
    ok: true,
    collectionName: 'classes',
    datasetId: 'dataset-1',
    limit: 50,
    offset: 0,
  });
  assert.equal(normalizeQuery({ collectionName: 'settings', datasetId: 'dataset-1' }).code, 'COLLECTION_NOT_ALLOWED');
  assert.equal(normalizeQuery({ collectionName: 'students' }).code, 'DATASET_REQUIRED');
});

test('query function clamps pagination and scopes database queries by owner and dataset', () => {
  assert.match(source, /ownerId:\s*context\.OPENID/);
  assert.match(source, /datasetId:\s*query\.datasetId/);
  assert.match(source, /Math\.min\(requestedLimit, MAX_LIMIT\)/);
  assert.equal(pkg.type, 'commonjs');
  assert.equal(pkg.dependencies['wx-server-sdk'], 'latest');
});

test('query function uses an event handler entrypoint and no write API', () => {
  assert.match(source, /module\.exports\s*=\s*\{[^}]*main/);
  assert.doesNotMatch(source, /\.add\(|\.set\(|\.update\(|\.remove\(/);
});
