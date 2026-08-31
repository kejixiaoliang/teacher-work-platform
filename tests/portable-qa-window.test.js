import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('portable QA closes the Tauri window instead of Process.MainWindowHandle', () => {
  const source = fs.readFileSync('scripts/qa-portable.ps1', 'utf8');
  assert.match(source, /Tao Thread Event Target/);
  assert.match(source, /EnumWindows/);
  assert.match(source, /PostMessage/);
  assert.doesNotMatch(source, /CloseMainWindow\(\)/);
});
