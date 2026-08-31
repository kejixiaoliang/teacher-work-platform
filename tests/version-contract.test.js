import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVersionContract } from '../scripts/version-contract.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture({ packageVersion = '0.4.0', tauriVersion = '0.4.0', cargoVersion = '0.4.0', changelogVersion = '0.4.0' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-work-version-'));
  fs.mkdirSync(path.join(root, 'src-tauri'), { recursive: true });
  fs.mkdirSync(path.join(root, 'web', 'src', 'views'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: packageVersion }));
  fs.writeFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), JSON.stringify({ version: tauriVersion }));
  fs.writeFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), `[package]\nname = "teacher-work"\nversion = "${cargoVersion}"\n`);
  fs.writeFileSync(path.join(root, 'web', 'src', 'views', 'Changelog.vue'), `const releases = [{ version: '${changelogVersion}' }];\n`);
  return root;
}

test('matching product versions satisfy the build contract', () => {
  assert.deepEqual(validateVersionContract(fixture()), { version: '0.4.0' });
});

test('v0.9.0 release metadata is ready for the installer milestone', () => {
  assert.deepEqual(validateVersionContract(projectRoot), { version: '0.9.0' });
});

test('Cargo product version mismatch identifies Cargo.toml', () => {
  assert.throws(() => validateVersionContract(fixture({ cargoVersion: '0.1.0' })), /Cargo\.toml.*0\.4\.0/);
});

test('Tauri product version mismatch identifies tauri.conf.json', () => {
  assert.throws(() => validateVersionContract(fixture({ tauriVersion: '0.1.0' })), /tauri\.conf\.json.*0\.4\.0/);
});

test('missing current release notes identifies Changelog.vue', () => {
  assert.throws(() => validateVersionContract(fixture({ changelogVersion: '2026.08' })), /Changelog\.vue.*0\.4\.0/);
});
