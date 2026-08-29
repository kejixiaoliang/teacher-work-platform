import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('explicit auto-group counts prefill weekdays and reserve extra groups', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-duty-weekdays-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'duty-weekdays-secret';
  const { startServer } = await import(`../server/runtime.js?duty-weekdays=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  const createClassWithStudents = async (name, count) => {
    const cls = await request('POST', '/api/classes', { name });
    for (let i = 0; i < count; i += 1) {
      await request('POST', '/api/students', { class_id: cls.json.data.id, name: `${name}-${i + 1}` });
    }
    return cls.json.data.id;
  };
  const weekdays = async (classId) => {
    const result = await request('GET', `/api/duties?class_id=${classId}`);
    return [...new Set(result.json.data.filter(d => d.role === '值日生').map(d => d.week_days))].sort();
  };
  try {
    const five = await createClassWithStudents('五组班', 10);
    const fiveResult = await request('POST', '/api/duties/auto-group', { class_id: five, groupCount: 5 });
    assert.equal(fiveResult.status, 200);
    assert.deepEqual(await weekdays(five), ['1', '2', '3', '4', '5']);

    const six = await createClassWithStudents('六组班', 12);
    const sixResult = await request('POST', '/api/duties/auto-group', { class_id: six, groupCount: 6 });
    assert.equal(sixResult.status, 200);
    assert.deepEqual(await weekdays(six), ['1', '2', '3', '4', '5', '6']);

    const eight = await createClassWithStudents('八组班', 16);
    const eightResult = await request('POST', '/api/duties/auto-group', { class_id: eight, groupCount: 8 });
    assert.equal(eightResult.status, 200);
    assert.deepEqual(await weekdays(eight), ['0', '1', '2', '3', '4', '5', '6', '7']);
  } finally {
    await running.close();
  }
});

test('group-days accepts explicit unassigned marker and rejects mixed zero days', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-duty-weekday-edit-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'duty-weekday-edit-secret';
  const { startServer } = await import(`../server/runtime.js?duty-weekday-edit=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  try {
    const cls = await request('POST', '/api/classes', { name: '星期调整班' });
    const classId = cls.json.data.id;
    const student = await request('POST', '/api/students', { class_id: classId, name: '学生1' });
    await request('POST', '/api/duties', { class_id: classId, student_id: student.json.data.id, role: '值日生', group_no: 1, week_days: '1' });
    const unassigned = await request('PUT', '/api/duties/group-days', { class_id: classId, group_no: 1, week_days: '0' });
    assert.equal(unassigned.status, 200);
    const mixed = await request('PUT', '/api/duties/group-days', { class_id: classId, group_no: 1, week_days: '0,6' });
    assert.equal(mixed.status, 400);
  } finally {
    await running.close();
  }
});
