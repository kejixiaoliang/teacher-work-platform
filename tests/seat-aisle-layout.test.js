import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('middle aisle is placed after the left half and double aisles use cumulative boundaries', () => {
  const source = fs.readFileSync('web/src/views/Seats.vue', 'utf8');
  assert.match(source, /c\s*===\s*Math\.floor\(total\s*\/\s*2\)\s*\+\s*1/);
  assert.match(source, /const\s+left\s*=\s*Math\.ceil\(total\s*\/\s*3\)/);
  assert.match(source, /c\s*===\s*left\s*\+\s*1\s*\|\|\s*c\s*===\s*left\s*\+\s*middle\s*\+\s*1/);
  assert.doesNotMatch(source, /c\s*===\s*Math\.ceil\(cols\.value\s*\/\s*2\)/);
});
