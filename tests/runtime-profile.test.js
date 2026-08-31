import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

test('desktop bootstrap declares the installed, portable, and dev runtime profiles', () => {
  assert.match(source, /runtime_profile/);
  assert.match(source, /installed/);
  assert.match(source, /portable/);
  assert.match(source, /dev/);
});

test('installed runtime stores data below LOCALAPPDATA while portable runtime stays beside the executable', () => {
  assert.match(source, /LOCALAPPDATA/);
  assert.match(source, /TeacherWork/);
  assert.match(source, /runtime_profile/);
  assert.match(source, /root\.join\("data"\)/);
});

test('desktop bootstrap exposes the selected runtime profile', () => {
  assert.match(source, /runtime_profile:\s*String/);
  assert.match(source, /runtime_profile:/);
});
