import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const redeem = require(path.resolve('cloudfunctions/redeem-code/index.js'));
const admin = require(path.resolve('cloudfunctions/admin/index.js'));

test('license codes are normalized and hashed without storing plaintext', () => {
  assert.equal(redeem.normalizeCode(' abcd-1234 '), 'ABCD-1234');
  assert.notEqual(redeem.hashCode('ABCD-1234'), 'ABCD-1234');
  assert.equal(redeem.validUntil('permanent').ok, true);
  assert.equal(redeem.validUntil('version', null, '').code, 'VERSION_REQUIRED');
  assert.equal(redeem.grantState({ expiresAt: null, revokedAt: null }).state, 'active');
  assert.equal(redeem.grantState({ expiresAt: '2020-01-01T00:00:00.000Z', revokedAt: null }, Date.parse('2021-01-01T00:00:00.000Z')).state, 'expired');
  assert.equal(redeem.grantState({ expiresAt: null, revokedAt: '2026-01-01T00:00:00.000Z' }).state, 'revoked');
});

test('admin actions require the configured single WeChat identity', () => {
  assert.equal(admin.isAdmin({ OPENID: 'owner' }, { ADMIN_OPENID: 'owner' }), true);
  assert.equal(admin.isAdmin({ OPENID: 'other' }, { ADMIN_OPENID: 'owner' }), false);
  assert.equal(admin.validUntil('annual', null, '').code, 'EXPIRY_REQUIRED');
  assert.equal(admin.validUntil('version', '2027-01-01T00:00:00.000Z', '').code, 'VERSION_REQUIRED');
});
