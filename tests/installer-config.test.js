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
  assert.match(scripts['package:installed'], /tauri:build:installed/);
  const buildScript = fs.readFileSync('scripts/build-tauri.mjs', 'utf8');
  assert.match(buildScript, /CARGO_TARGET_DIR/);
  assert.match(buildScript, /TAURI_UPDATER_PUBLIC_KEY/);
  assert.match(buildScript, /TEACHER_WORK_UPDATE_ENDPOINT/);
  assert.doesNotMatch(buildScript, /example\.com/);
});

test('installed updater configuration keeps production values outside the repository', () => {
  const config = readJson('tauri.installed.conf.json');
  assert.equal(config.plugins.updater.pubkey, '__SET_VIA_TAURI_UPDATER_PUBLIC_KEY__');
  assert.deepEqual(config.plugins.updater.endpoints, ['__SET_VIA_TEACHER_WORK_UPDATE_ENDPOINT__']);
});

test('installed build stages the bundled Node runtime and server resources', () => {
  const buildScript = fs.readFileSync('scripts/build-tauri.mjs', 'utf8');
  const runtimeScript = fs.readFileSync('scripts/prepare-tauri-runtime.mjs', 'utf8');
  assert.match(buildScript, /runtimeDir/);
  assert.match(buildScript, /resources/);
  assert.match(buildScript, /runtimeDir, '\/'/);
  assert.match(buildScript, /'resources\/'/);
  assert.match(buildScript, /prepareTauriRuntime/);
  assert.match(runtimeScript, /node\.exe/);
  assert.match(runtimeScript, /['"]install['"]/);
});

test('installed build requires a secure updater endpoint', () => {
  const buildScript = fs.readFileSync('scripts/build-tauri.mjs', 'utf8');
  assert.match(buildScript, /new URL\(endpoint\)/);
  assert.match(buildScript, /https:/);
});
