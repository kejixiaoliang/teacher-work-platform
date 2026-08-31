import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(file, 'utf8');

test('installed NSIS package closes the app tree before copying files', () => {
  const config = JSON.parse(read('src-tauri/tauri.installed.conf.json'));
  const hook = read('src-tauri/windows/hooks.nsh');

  assert.equal(config.bundle.windows.nsis.installerHooks, './windows/hooks.nsh');
  assert.match(hook, /NSIS_HOOK_PREINSTALL/);
  assert.match(hook, /taskkill\.exe/);
  assert.match(hook, /teacher-work\.exe/);
  assert.match(hook, /\/T/);
  assert.match(hook, /\/F/);
});

test('installer cleanup only targets the bundled runtime belonging to this install', () => {
  const hook = read('src-tauri/windows/hooks.nsh');

  assert.match(hook, /ExecutablePath/);
  assert.match(hook, /resources[\\/]+runtime[\\/]+node\.exe/);
  assert.doesNotMatch(hook, /taskkill\.exe.*node\.exe/);
});

test('desktop runtime has a single-instance and managed-sidecar contract', () => {
  const rust = read('src-tauri/src/lib.rs');
  const cargo = read('src-tauri/Cargo.toml');

  assert.match(cargo, /windows-sys/);
  assert.match(rust, /CreateMutexW/);
  assert.match(rust, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(rust, /cleanup.*sidecar|sidecar.*cleanup/is);
});
