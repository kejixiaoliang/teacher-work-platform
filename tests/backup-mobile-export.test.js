import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const backup = require(path.join(root, 'cloudfunctions/backup-data/index.js'));

test('backup export envelope removes cloud ownership fields and preserves stable UUIDs', () => {
  const row = backup.exportRow({ _id: 'cloud-id', _openid: 'openid', ownerId: 'owner', datasetId: 'dataset', name: '班级', uuid: '11111111-1111-4111-8111-111111111111' }, 'classes');
  assert.deepEqual(row, { name: '班级', uuid: '11111111-1111-4111-8111-111111111111' });
  const generated = backup.exportRow({ _id: 'cloud-id', name: '无 UUID' }, 'classes');
  assert.match(generated.uuid, /^[0-9a-f-]{36}$/);
  const nested = backup.exportRow({ _id: 'revision-id', before: { _openid: 'openid', ownerId: 'owner', datasetId: 'dataset', value: 1 } }, 'assessment.revisions');
  assert.deepEqual(nested.before, { value: 1 });
});

test('mobile backup export is scoped, integrity protected and attachment explicit', () => {
  const source = fs.readFileSync(path.join(root, 'cloudfunctions/backup-data/index.js'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'miniprogram/services/backup-service.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'miniprogram/pages/backup/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'miniprogram/pages/backup/index.wxml'), 'utf8');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const settings = fs.readFileSync(path.join(root, 'miniprogram/pages/settings/index.js'), 'utf8');
  assert.match(source, /ownerId: context\.OPENID/);
  assert.match(source, /attachments: \{ included: false/);
  assert.match(source, /assessment/);
  assert.match(source, /attachIntegrity/);
  assert.match(service, /backup-data/);
  assert.match(service, /wx\.shareFileMessage/);
  assert.match(page, /wx\.showModal/);
  assert.match(page, /exportBackup/);
  assert.match(page, /pages\/import\/index/);
  assert.match(template, /完整备份/);
  assert.match(template, /附件不会包含在小程序备份中/);
  assert.match(template, /不会自动发送/);
  assert.ok(app.pages.includes('pages/backup/index'));
  assert.match(settings, /openBackup/);
});

test('backup export rejects missing dataset and unsupported actions before any database read', () => {
  assert.deepEqual(backup.normalizeRequest({ action: 'export' }), { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] });
  assert.equal(backup.normalizeRequest({ action: 'import', datasetId: 'dataset-1' }).code, 'ACTION_NOT_ALLOWED');
  assert.deepEqual(backup.normalizeRequest({ action: 'export', datasetId: ' dataset-1 ' }), { ok: true, action: 'export', datasetId: 'dataset-1' });
});
