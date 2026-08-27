import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexes = fs.readFileSync(path.join(root, 'cloudbase/database/indexes.md'), 'utf8');
const permissions = fs.readFileSync(path.join(root, 'cloudbase/database/permissions.md'), 'utf8');

test('cloudbase index contract covers scoped business queries', () => {
  for (const indexName of [
    'ownerId_1',
    'ownerId_1_createdAt_-1',
    'ownerId_1_sourceExportId_1',
    'ownerId_1_datasetId_1_batchType_1_classUuid_1_createdAt_-1',
    'ownerId_1_datasetId_1',
  ]) assert.match(indexes, new RegExp('`' + indexName + '`'));
  assert.match(indexes, /ownerId.*datasetId/);
  assert.match(indexes, /索引不是权限控制/);
});

test('cloudbase permissions keep the initial collections private', () => {
  assert.match(permissions, /PRIVATE/);
  assert.match(indexes, /不开放匿名读取/);
  assert.match(indexes, /必须同时写入 `_openid`/);
});
