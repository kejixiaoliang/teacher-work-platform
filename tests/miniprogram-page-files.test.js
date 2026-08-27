import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

test('every registered mini program page has its required source files', () => {
  for (const page of app.pages) {
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      const file = path.join(root, 'miniprogram', `${page}${extension}`);
      assert.equal(fs.existsSync(file), true, `registered page file missing: ${page}${extension}`);
    }
  }
});
