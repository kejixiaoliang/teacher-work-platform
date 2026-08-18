import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { issueFileAccess, consumeFileAccess, hasFileAccess } from '../server/security/file-access.js';

test('file access tokens expire and cannot be consumed for another document', async () => {
  const { token } = issueFileAccess(11, 100);
  assert.equal(hasFileAccess(token), true);
  assert.equal(consumeFileAccess(token, 12), false);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(hasFileAccess(token), false);
});

test('document file access uses a short-lived single-use token bound to one document', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-file-access-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const apiToken = 'file-access-api-secret';
  const { startServer } = await import(`../server/runtime.js?file-access=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken, openBrowser: false });
  const requestJson = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': apiToken },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${method} ${url}`);
    return response.json();
  };
  try {
    const cls = await requestJson('POST', '/api/classes', { name: '文件授权班', seat_rows: 1, seat_cols: 1 });
    const form = new FormData();
    form.append('class_id', String(cls.data.id));
    form.append('file', new Blob(['private file']), 'private.txt');
    const uploaded = await fetch(`${running.baseUrl}/api/documents`, {
      method: 'POST', headers: { 'x-teacher-work-token': apiToken }, body: form,
    });
    const documentId = (await uploaded.json()).data.id;
    const tokenResponse = await fetch(`${running.baseUrl}/api/documents/${documentId}/file-token`, {
      headers: { 'x-teacher-work-token': apiToken },
    });
    assert.equal(tokenResponse.status, 200);
    const { data: { token, expiresIn } } = await tokenResponse.json();
    assert.equal(expiresIn, 30000);
    const first = await fetch(`${running.baseUrl}/api/documents/${documentId}/file?__token=${encodeURIComponent(token)}`);
    assert.equal(first.status, 200);
    assert.equal(await first.text(), 'private file');
    const second = await fetch(`${running.baseUrl}/api/documents/${documentId}/file?__token=${encodeURIComponent(token)}`);
    assert.equal(second.status, 401);
    const anotherTokenResponse = await fetch(`${running.baseUrl}/api/documents/${documentId}/file-token`, {
      headers: { 'x-teacher-work-token': apiToken },
    });
    const { data: { token: anotherToken } } = await anotherTokenResponse.json();
    const ordinaryApi = await fetch(`${running.baseUrl}/api/classes?__token=${encodeURIComponent(anotherToken)}`);
    assert.equal(ordinaryApi.status, 401);
  } finally {
    await running.close();
  }
});
