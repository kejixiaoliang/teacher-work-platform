import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('class display labels and subject templates persist through the API', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-customization-api-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'customization-api-secret';
  const { startServer } = await import(`../server/runtime.js?customization-api=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    return { response, json };
  };
  try {
    const created = await request('POST', '/api/classes', { name: '配置 API 班' });
    assert.equal(created.response.status, 200);
    const classId = created.json.data.id;
    const labels = await request('PUT', `/api/classes/${classId}/customization`, { labels: { 'student.boarding': '住宿状态' } });
    assert.equal(labels.response.status, 200);
    const readLabels = await request('GET', `/api/classes/${classId}/customization`);
    assert.equal(readLabels.json.data.labels['student.boarding'], '住宿状态');
    const saved = await request('PUT', `/api/classes/${classId}/subject-templates`, { name: '本校中考', subjects: ['语文', '数学', '英语'] });
    assert.equal(saved.response.status, 200);
    const listed = await request('GET', `/api/classes/${classId}/subject-templates`);
    assert.deepEqual(listed.json.data[0].subjects, ['语文', '数学', '英语']);
    const updated = await request('PUT', `/api/classes/${classId}/subject-templates/${saved.json.data.id}`, { name: '本校中考', subjects: ['语文', '数学'] });
    assert.equal(updated.response.status, 200);
    const removed = await request('DELETE', `/api/classes/${classId}/subject-templates/${saved.json.data.id}`);
    assert.equal(removed.response.status, 200);
    const invalid = await request('PUT', `/api/classes/${classId}/customization`, { labels: { arbitrary: '不允许' } });
    assert.equal(invalid.response.status, 400);
  } finally {
    await running.close();
  }
});
