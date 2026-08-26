import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUpdate, validateUpdateManifest, verifyPackageHash } from '../shared/update/manifest.js';
import crypto from 'node:crypto';

const sha256 = crypto.createHash('sha256').update('portable-package').digest('hex');
const manifest = { version: '0.8.0', url: 'https://example.com/teacher-work.zip', sha256, size: 123, notes: '更新说明' };

test('update manifest validates package metadata and never touches local data paths', () => {
  assert.equal(validateUpdateManifest(manifest).ok, true);
  assert.equal(shouldUpdate('0.7.0', manifest).update, true);
  assert.equal(shouldUpdate('0.8.0', manifest).update, false);
  assert.equal(verifyPackageHash(Buffer.from('portable-package'), sha256), true);
  assert.equal(verifyPackageHash(Buffer.from('teacher.db'), sha256), false);
});

test('invalid update manifests are rejected before download', () => {
  assert.equal(validateUpdateManifest({ ...manifest, sha256: 'bad' }).ok, false);
  assert.equal(shouldUpdate('0.7.0', { ...manifest, url: 'file:///teacher.db' }).reason, 'MANIFEST_INVALID');
});
