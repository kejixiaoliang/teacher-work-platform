import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('student creation and import require an existing class', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-work-class-guard-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'class-guard-secret';
  const { startServer } = await import(`../server/runtime.js?classGuard=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const post = async (url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-teacher-work-token': token,
      },
      body: JSON.stringify(body),
    });
    return response.json();
  };
  const listStudents = async () => {
    const response = await fetch(`${running.baseUrl}/api/students`, {
      headers: { 'x-teacher-work-token': token },
    });
    return (await response.json()).data;
  };

  try {
    const missing = await post('/api/students', { name: '未分班学生' });
    assert.deepEqual(missing, { ok: false, error: '请先创建并选择有效班级' });

    const unknown = await post('/api/students', { name: '错误班级', class_id: 999999 });
    assert.deepEqual(unknown, { ok: false, error: '请先创建并选择有效班级' });

    const imported = await post('/api/students/import', {
      class_id: 999999,
      students: [{ _row: 2, name: '错误导入' }],
    });
    assert.deepEqual(imported, { ok: false, error: '请先创建并选择有效班级' });
    assert.equal((await listStudents()).length, 0);

    const createdClass = await post('/api/classes', { name: '一班' });
    assert.equal(createdClass.ok, true);
    const valid = await post('/api/students', {
      name: '正常学生',
      class_id: createdClass.data.id,
    });
    assert.equal(valid.ok, true);
    assert.equal((await listStudents()).length, 1);
  } finally {
    await running.close();
  }
});
