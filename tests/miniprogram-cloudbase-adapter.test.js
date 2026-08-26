import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adapter = fs.readFileSync(path.join(root, 'miniprogram/services/cloudbase.js'), 'utf8');

test('mini program CloudBase adapter uses native wx.cloud APIs', () => {
  assert.match(adapter, /wx\.cloud\.callFunction/);
  assert.match(adapter, /wx\.cloud\.database\(\)\.collection/);
  assert.doesNotMatch(adapter, /secretId|secretKey|accessKey|token\s*:/i);
});

test('mini program CloudBase adapter rejects unconfigured environments', () => {
  assert.match(adapter, /YOUR_CLOUDBASE_ENV_ID/);
  assert.match(adapter, /CloudBase 环境尚未配置/);
});
