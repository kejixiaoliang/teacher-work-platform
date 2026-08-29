import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('subjects with saved scores cannot be removed from an exam', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-subjects-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'subject-config-secret';
  const { startServer } = await import(`../server/runtime.js?subjects=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, { method, headers: { 'content-type': 'application/json', 'x-teacher-work-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, json: await response.json() };
  };
  try {
    const cls = await request('POST', '/api/classes', { name: '科目保护班' });
    const classId = cls.json.data.id;
    const student = await request('POST', '/api/students', { class_id: classId, name: '成绩学生' });
    const exam = await request('POST', '/api/scores/exams', { class_id: classId, name: '期中', subjects: ['语文', '数学'] });
    await request('PUT', '/api/scores', { examId: exam.json.data.id, rows: [{ studentId: student.json.data.id, subject: '语文', score: 90 }] });
    const rejected = await request('PUT', `/api/scores/exams/${exam.json.data.id}`, { subjects: ['数学'] });
    assert.equal(rejected.response.status, 409);
    assert.equal(rejected.json.code, 'SUBJECT_HAS_SCORES');
    const allowed = await request('PUT', `/api/scores/exams/${exam.json.data.id}`, { subjects: ['语文', '数学', '物理'] });
    assert.equal(allowed.response.status, 200);
  } finally {
    await running.close();
  }
});
