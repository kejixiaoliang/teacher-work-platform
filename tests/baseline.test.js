import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('portable build keeps relative Vite assets', () => {
  assert.match(fs.readFileSync('vite.config.js', 'utf8'), /base:\s*['"]\.\/['"]/);
});
