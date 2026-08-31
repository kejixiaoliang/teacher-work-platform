import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('desktop runtime owns a single graceful shutdown lifecycle', () => {
  const source = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const guard = fs.readFileSync('src-tauri/src/process_guard.rs', 'utf8');
  assert.match(source, /CloseRequested/);
  assert.match(source, /window\.app_handle\(\)\.exit\(0\)/);
  assert.match(source, /window\.destroy\(\)/);
  assert.match(source, /WindowEvent::Destroyed/);
  assert.doesNotMatch(source, /api\.prevent_close\(\)/);
  assert.doesNotMatch(source, /std::process::exit\(0\)/);
  assert.match(source, /\.on_window_event\(/);
  assert.match(source, /window\.app_handle\(\)/);
  assert.match(source, /ExitRequested/);
  assert.match(source, /child:\s*Mutex<Option<ManagedSidecar>>/);
  assert.match(source, /child\.take\(\)/);
  assert.match(guard, /child\.wait\(\)/);
});
