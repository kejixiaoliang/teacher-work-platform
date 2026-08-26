import crypto from 'node:crypto';

const VERSION = /^\d+\.\d+\.\d+$/;
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function compareVersions(a, b) { return a.split('.').map(Number).reduce((sum, value, index) => sum + value * (1000 ** (2 - index)), 0) - b.split('.').map(Number).reduce((sum, value, index) => sum + value * (1000 ** (2 - index)), 0); }

export function validateUpdateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['更新清单必须是对象'] };
  if (!VERSION.test(manifest.version || '')) errors.push('version 无效');
  if (typeof manifest.url !== 'string' || !/^https?:\/\//.test(manifest.url)) errors.push('url 必须是 HTTPS/HTTP 地址');
  if (!validSha(manifest.sha256)) errors.push('sha256 无效');
  if (!Number.isSafeInteger(manifest.size) || manifest.size < 1) errors.push('size 无效');
  if (typeof manifest.notes !== 'string') errors.push('notes 无效');
  return { ok: errors.length === 0, errors };
}

export function shouldUpdate(currentVersion, manifest) {
  const checked = validateUpdateManifest(manifest);
  if (!checked.ok || !VERSION.test(currentVersion || '')) return { update: false, reason: 'MANIFEST_INVALID' };
  return { update: compareVersions(manifest.version, currentVersion) > 0, reason: compareVersions(manifest.version, currentVersion) > 0 ? 'NEWER_VERSION' : 'UP_TO_DATE', version: manifest.version };
}

export function verifyPackageHash(buffer, expectedSha256) {
  if (!Buffer.isBuffer(buffer) || !validSha(expectedSha256)) return false;
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase() === expectedSha256.toLowerCase();
}
