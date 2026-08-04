import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('desktop runtime uses a random port and protects APIs with a token', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), '教师 工作台-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const { startServer } = await import(`../server/runtime.js?test=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: 'test-secret', openBrowser: false });
  try {
    assert.ok(running.port > 0);
    assert.equal((await fetch(`${running.baseUrl}/api/health`)).status, 401);
    const response = await fetch(`${running.baseUrl}/api/health`, { headers: { 'x-teacher-work-token': 'test-secret' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally {
    await running.close();
  }
});

test('desktop API accepts Tauri WebView CORS preflight for JSON requests', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-work-cors-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const { startServer } = await import(`../server/runtime.js?cors=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: 'test-secret', openBrowser: false });
  try {
    const response = await fetch(`${running.baseUrl}/api/students`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://tauri.localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-teacher-work-token',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://tauri.localhost');
    assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
    assert.match(response.headers.get('access-control-allow-headers') || '', /x-teacher-work-token/i);
  } finally {
    await running.close();
  }
});
