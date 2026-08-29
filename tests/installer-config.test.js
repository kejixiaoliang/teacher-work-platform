import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readJson = name => JSON.parse(fs.readFileSync('src-tauri/' + name, 'utf8'));

test('installed Tauri profile builds a signed current-user NSIS package', () => {
  const config = readJson('tauri.installed.conf.json');
  assert.equal(config.version, '0.9.0');
  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.targets, ['nsis']);
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.bundle.windows.nsis.installMode, 'currentUser');
});

test('portable Tauri profile keeps bundling disabled', () => {
  const config = readJson('tauri.portable.conf.json');
  assert.equal(config.version, '0.9.0');
  assert.equal(config.bundle.active, false);
  assert.equal(config.bundle.createUpdaterArtifacts, false);
});

test('build scripts keep installed and portable Cargo targets separate', () => {
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts['tauri:build:installed'], /build-tauri\.mjs installed/);
  assert.match(scripts['tauri:build:portable'], /build-tauri\.mjs portable/);
  assert.match(fs.readFileSync('scripts/build-tauri.mjs', 'utf8'), /CARGO_TARGET_DIR/);
});
