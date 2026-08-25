import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('access API switches mode and protects sensitive modules', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-work-access-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const { startServer } = await import(`../server/runtime.js?access=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: 'access-token', openBrowser: false });
  const headers = { 'content-type': 'application/json', 'x-teacher-work-token': 'access-token' };
  try {
    const setup = await fetch(`${running.baseUrl}/api/access/password`, {
      method: 'POST', headers, body: JSON.stringify({ password: 'teacher-secret' }),
    });
    assert.equal(setup.status, 200);
    const setupData = await setup.json();
    assert.match(setupData.data.recoveryKey, /^[a-f0-9]{32}$/);
    const enterClassroom = await fetch(`${running.baseUrl}/api/access/mode`, {
      method: 'POST', headers, body: JSON.stringify({ mode: 'classroom', password: 'teacher-secret' }),
    });
    assert.equal(enterClassroom.status, 200);
    const protectedResponse = await fetch(`${running.baseUrl}/api/scores/exams?class_id=1`, {
      headers: { 'x-teacher-work-token': 'access-token' },
    });
    assert.equal(protectedResponse.status, 403);
    const unlock = await fetch(`${running.baseUrl}/api/access/unlock-module`, {
      method: 'POST', headers, body: JSON.stringify({ module: 'scores', password: 'teacher-secret' }),
    });
    assert.equal(unlock.status, 200);
    const enterTeacher = await fetch(`${running.baseUrl}/api/access/mode`, {
      method: 'POST', headers, body: JSON.stringify({ mode: 'teacher', password: 'teacher-secret' }),
    });
    assert.equal(enterTeacher.status, 200);
    const policies = await fetch(`${running.baseUrl}/api/access/policies`, {
      method: 'PUT', headers, body: JSON.stringify({ policies: { documents: 'open' } }),
    });
    assert.equal(policies.status, 200);
    assert.equal((await policies.json()).data.policies.documents, 'open');

    const reset = await fetch(`${running.baseUrl}/api/access/password/reset`, {
      method: 'POST', headers, body: JSON.stringify({ recoveryKey: setupData.data.recoveryKey, nextPassword: 'new-teacher-secret' }),
    });
    assert.equal(reset.status, 200);
    assert.match((await reset.json()).data.recoveryKey, /^[a-f0-9]{32}$/);
  } finally {
    await running.close();
  }
});
