import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend exposes access-control API and route module metadata', () => {
  const api = fs.readFileSync('web/src/api.js', 'utf8');
  const router = fs.readFileSync('web/src/router.js', 'utf8');
  assert.match(api, /access:/);
  assert.match(api, /unlockModule/);
  assert.match(api, /switchMode/);
  assert.match(router, /module: 'scores'/);
  assert.match(router, /module: 'contacts'/);
});

test('app exposes teacher and classroom mode controls', () => {
  const app = fs.readFileSync('web/src/App.vue', 'utf8');
  assert.match(app, /开启班级公开模式/);
  assert.match(app, /教师入口/);
  assert.match(app, /设置教师主密码/);
  assert.match(app, /班级公开模式/);
});

test('router provides a protected-module fallback route', () => {
  const router = fs.readFileSync('web/src/router.js', 'utf8');
  const locked = fs.readFileSync('web/src/views/AccessLocked.vue', 'utf8');
  assert.match(router, /access-locked/);
  assert.match(router, /beforeEach/);
  assert.match(locked, /此模块已保护/);
});

test('class settings exposes privacy controls', () => {
  const view = fs.readFileSync('web/src/views/Classes.vue', 'utf8');
  assert.match(view, /隐私与访问控制/);
  assert.match(view, /修改教师主密码/);
  assert.match(view, /恢复密钥/);
  assert.match(view, /班级模式开放模块/);
  assert.match(view, /自动回锁/);
});
