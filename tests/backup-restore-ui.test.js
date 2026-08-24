import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('restore flow reloads classes through the exported loadClasses function', () => {
  const overview = fs.readFileSync('web/src/views/Overview.vue', 'utf8');
  assert.match(overview, /import\s*\{[^}]*loadClasses[^}]*\}\s*from ['"]\.\.\/store\.js['"]/);
  assert.match(overview, /await\s+loadClasses\(\{\s*throwOnError:\s*true\s*\}\)/);
  assert.doesNotMatch(overview, /store\.loadClasses\(\)/);
});

test('multipart restore reports local network failures with actionable text', () => {
  const api = fs.readFileSync('web/src/api.js', 'utf8');
  assert.match(api, /无法连接到本地服务，请确认程序仍在运行/);
  assert.match(api, /恢复请求超时，请检查程序状态后重试/);
});
