import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('auto grouping defaults to five weekday groups', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-duty-default-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'duty-default-secret';
  const { startServer } = await import(`../server/runtime.js?duty-default=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, { method, headers: { 'content-type': 'application/json', 'x-teacher-work-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, json: await response.json() };
  };
  try {
    const cls = await request('POST', '/api/classes', { name: '值日班' });
    const classId = cls.json.data.id;
    for (let i = 0; i < 10; i += 1) await request('POST', '/api/students', { class_id: classId, name: `学生${i + 1}` });
    const grouped = await request('POST', '/api/duties/auto-group', { class_id: classId });
    assert.equal(grouped.json.data.groupCount, 5);
    const duties = await request('GET', `/api/duties?class_id=${classId}`);
    assert.deepEqual([...new Set(duties.json.data.filter(d => d.role === '值日生').map(d => d.week_days))].sort(), ['1', '2', '3', '4', '5']);
  } finally {
    await running.close();
  }
});
