import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('document card actions do not bubble into a second preview', () => {
  const source = fs.readFileSync('web/src/views/Documents.vue', 'utf8');
  assert.match(source, /@click\.stop="preview\(f\)"/);
  assert.match(source, /@click\.stop="download\(f\)"/);
});

test('document preview exposes loading, error and unsupported-location states', () => {
  const source = fs.readFileSync('web/src/views/Documents.vue', 'utf8');
  assert.match(source, /previewLoading/);
  assert.match(source, /previewError/);
  assert.match(source, /unsupported/);
  assert.match(source, /location/);
  assert.doesNotMatch(source, /if \(!\['图片', 'PDF', '文本'\]\.includes\(f\.category\)\) \{\s*download\(f\);/);
});

test('document file reads have an abort timeout', () => {
  const source = fs.readFileSync('web/src/api.js', 'utf8');
  const readFileBlock = source.slice(source.indexOf('readFile: async'), source.indexOf('\n  },\n  duties:', source.indexOf('readFile: async')));
  assert.match(readFileBlock, /AbortController/);
  assert.match(readFileBlock, /signal:\s*ctrl\.signal/);
});
