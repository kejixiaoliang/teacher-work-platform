import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all mini program pages use the shared mobile layout tokens', async () => {
  const pagesRoot = path.join(root, 'miniprogram', 'pages');
  const pages = (await fs.readdir(pagesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  assert.equal(pages.length, 28);
  for (const page of pages) {
    const wxss = await fs.readFile(path.join(pagesRoot, page.name, 'index.wxss'), 'utf8');
    const wxml = await fs.readFile(path.join(pagesRoot, page.name, 'index.wxml'), 'utf8');
    assert.match(wxss, /tokens\.wxss/);
    assert.match(wxml, /class="[^"]*page/);
  }
});

test('mobile identity entry uses native WeChat auth language and no web login form', async () => {
  const app = await fs.readFile(path.join(root, 'miniprogram', 'app.js'), 'utf8');
  const settings = await fs.readFile(path.join(root, 'miniprogram', 'pages', 'settings', 'index.wxml'), 'utf8');
  const identity = await fs.readFile(path.join(root, 'miniprogram', 'pages', 'identity', 'index.wxml'), 'utf8');
  const tokens = await fs.readFile(path.join(root, 'miniprogram', 'tokens.wxss'), 'utf8');
  assert.match(app, /traceUser:\s*true/);
  assert.match(app, /identityMode:\s*'wechat-native'/);
  assert.match(settings, /identity-summary/);
  assert.match(settings, /openIdentity/);
  assert.match(identity, /微信身份已就绪/);
  assert.doesNotMatch(identity, /type="password"|账号密码登录|OAuth/);
  assert.match(tokens, /safe-area-inset-bottom/);
  assert.match(tokens, /min-height:84rpx/);
});
