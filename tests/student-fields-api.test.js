import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('preset student fields can be hidden/renamed while values remain stored', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-student-fields-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'student-fields-secret';
  const { startServer } = await import(`../server/runtime.js?student-fields=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, { method, headers: { 'content-type': 'application/json', 'x-teacher-work-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, json: await response.json() };
  };
  try {
    const cls = await request('POST', '/api/classes', { name: '字段班' });
    const classId = cls.json.data.id;
    const fields = await request('GET', `/api/student-fields?class_id=${classId}`);
    assert.equal(fields.response.status, 200);
    assert.ok(fields.json.data.some(field => field.fieldKey === 'id_card'));
    await request('PUT', `/api/student-fields/id_card?class_id=${classId}`, { enabled: true, label: '身份证号' });
    const created = await request('POST', '/api/students', { class_id: classId, name: '字段学生', customFields: { id_card: '110101200001010011' } });
    assert.equal(created.response.status, 200);
    const students = await request('GET', `/api/students?class_id=${classId}`);
    assert.equal(students.json.data[0].customFields.id_card, '110101200001010011');
    await request('PUT', `/api/student-fields/id_card?class_id=${classId}`, { enabled: false, label: '身份证号' });
    const hidden = await request('GET', `/api/students?class_id=${classId}`);
    assert.equal(hidden.json.data[0].customFields.id_card, '110101200001010011');
    const order = await request('PUT', `/api/student-fields/order?class_id=${classId}`, { fieldKeys: fields.json.data.map(field => field.fieldKey).reverse() });
    assert.equal(order.response.status, 200);
  } finally {
    await running.close();
  }
});
