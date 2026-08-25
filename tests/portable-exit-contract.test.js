import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('desktop runtime explicitly exits when the main window close is requested', () => {
  const source = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  assert.match(source, /CloseRequested/);
  assert.match(source, /app\.exit\(0\)/);
  assert.doesNotMatch(source, /api\.prevent_close\(\)/);
  assert.match(source, /std::process::exit\(0\)/);
  assert.match(source, /\.on_window_event\(/);
  assert.match(source, /window\.app_handle\(\)/);
  assert.match(source, /ExitRequested/);
});
