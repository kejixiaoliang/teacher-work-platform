import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = fs.readFileSync(path.join(root, 'miniprogram/services/import-service.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'miniprogram/pages/import/index.js'), 'utf8');
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

test('mini program import flow chooses JSON and calls preview then commit', () => {
  assert.match(service, /wx\.chooseMessageFile/);
  assert.match(service, /action: 'preview'/);
  assert.match(service, /action: 'commit'/);
  assert.match(page, /previewSelectedFile/);
  assert.match(page, /confirmImport/);
});

test('mini program import flow caps file size and does not select ZIP', () => {
  assert.match(service, /5 \* 1024 \* 1024/);
  assert.doesNotMatch(service, /zip/i);
  assert.ok(app.pages.includes('pages/import/index'));
});
