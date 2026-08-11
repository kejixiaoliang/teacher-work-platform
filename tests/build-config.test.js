import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('build config filters only the known VueUse annotation warning', () => {
  const source = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(source, /INVALID_ANNOTATION/);
  assert.match(source, /@vueuse\/core/);
  assert.match(source, /warn\(warning\)/);
});
