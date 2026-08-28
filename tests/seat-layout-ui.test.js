import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('seat grid keeps the first column reachable when the viewport is narrow', () => {
  const source = fs.readFileSync('web/src/views/Seats.vue', 'utf8');
  assert.match(source, /\.ws-body\s*\{[^}]*min-width:\s*0/);
  assert.match(source, /\.ws-canvas\s*\{[^}]*min-width:\s*0/);
  assert.match(source, /\.ws-canvas\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(source, /\.ws-canvas\s*\{[^}]*align-items:\s*stretch/);
  assert.match(source, /\.seat-grid\s*\{[^}]*width:\s*max-content/);
  assert.match(source, /\.seat-grid\s*\{[^}]*min-width:\s*100%/);
  assert.match(source, /\.seat-grid\s*\{[^}]*align-items:\s*flex-start/);
});
