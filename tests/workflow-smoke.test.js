import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('核心教学工作流通过统一 API 完成持久化与备份', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-work-workflow-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'workflow-smoke-secret';
  const { startServer } = await import(`../server/runtime.js?workflow=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });

  const request = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-teacher-work-token': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${method} ${url}`);
    const payload = await response.json();
    assert.equal(payload.ok, true, payload.error || `${method} ${url}`);
    return payload.data;
  };

  const expectBadRequest = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-teacher-work-token': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 400, `${method} ${url}`);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.code, 'INVALID_INPUT');
  };

  const expectBackupRejected = async payload => {
    const response = await fetch(`${running.baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-teacher-work-token': token,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400);
    const result = await response.json();
    assert.equal(result.code, 'INVALID_BACKUP');
  };

  const expectStatus = async (method, url, body, status, code) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-teacher-work-token': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, status, `${method} ${url}`);
    const payload = await response.json();
    if (code) assert.equal(payload.code, code);
    return payload;
  };

  try {
    await expectBadRequest('GET', '/api/attendance?class_id=not-an-id&date=2026-08-05');
    await expectBadRequest('GET', '/api/attendance?class_id=1&date=2026-02-30');
    await expectBadRequest('GET', '/api/scores/exams?class_id=1.5');
    const createdClass = await request('POST', '/api/classes', {
      name: '0.2.0 验证班', seat_rows: 2, seat_cols: 2,
    });
    await expectStatus('DELETE', '/api/students/999999', undefined, 404, 'STUDENT_NOT_FOUND');
    const spoofed = new FormData();
    spoofed.append('class_id', String(createdClass.id));
    spoofed.append('file', new Blob(['%PDF-1.7'], { type: 'image/png' }), 'spoof.png');
    const spoofedResponse = await fetch(`${running.baseUrl}/api/documents`, {
      method: 'POST', headers: { 'x-teacher-work-token': token }, body: spoofed,
    });
    assert.equal(spoofedResponse.status, 400);
    assert.equal((await spoofedResponse.json()).code, 'INVALID_FILE_CONTENT');

    const documentForm = new FormData();
    documentForm.append('class_id', String(createdClass.id));
    documentForm.append('file', new Blob(['%PDF-1.7\nvalid test'], { type: 'application/pdf' }), 'test.pdf');
    const documentResponse = await fetch(`${running.baseUrl}/api/documents`, {
      method: 'POST', headers: { 'x-teacher-work-token': token }, body: documentForm,
    });
    assert.equal(documentResponse.status, 200);
    const documentPayload = await documentResponse.json();
    assert.equal(documentPayload.ok, true);
    await request('DELETE', `/api/documents/${documentPayload.data.id}`);
    const first = await request('POST', '/api/students', {
      class_id: createdClass.id, school_no: '001', name: '甲同学', status: '在读',
    });
    const second = await request('POST', '/api/students', {
      class_id: createdClass.id, school_no: '002', name: '乙同学', status: '在读',
    });
    await expectStatus('PUT', '/api/contacts/999999', { student_id: first.id, topic: '不存在记录' }, 404, 'CONTACT_NOT_FOUND');
    await expectStatus('POST', '/api/leaves', {
      class_id: createdClass.id, student_id: first.id, start_date: '2026-02-30', end_date: '2026-02-28',
    }, 400, 'INVALID_INPUT');

    const savedSeats = await request('PUT', '/api/seats', {
      classId: createdClass.id,
      seats: [
        { studentId: first.id, row: 0, col: 0, locked: false },
        { studentId: second.id, row: 0, col: 1, locked: false },
      ],
    });
    assert.equal(savedSeats.count, 2);
    assert.equal((await request('GET', `/api/seats?class_id=${createdClass.id}`)).length, 2);

    const attendance = await request('PUT', '/api/attendance', {
      classId: createdClass.id,
      date: '2026-08-05',
      rows: [
        { studentId: first.id, status: '出勤', remark: '' },
        { studentId: second.id, status: '迟到', remark: '演练' },
      ],
    });
    assert.equal(attendance.count, 2);
    const attendanceRead = await request('GET', `/api/attendance?class_id=${createdClass.id}&date=2026-08-05`);
    assert.equal(attendanceRead.rows.length, 2);
    const skippedAttendance = await request('PUT', '/api/attendance', {
      classId: createdClass.id,
      date: '2026-08-06',
      rows: [{ studentId: 999999, status: '出勤', remark: '' }],
    });
    assert.equal(skippedAttendance.count, 0);
    assert.deepEqual(skippedAttendance.skipped, [{ studentId: 999999, reason: '学生不属于该班级或已删除' }]);

    const exam = await request('POST', '/api/scores/exams', {
      class_id: createdClass.id, name: '统一版本测试', date: '2026-08-05', subjects: ['语文'],
    });
    const savedScores = await request('PUT', '/api/scores', {
      examId: exam.id,
      rows: [
        { studentId: first.id, subject: '语文', score: 96 },
        { studentId: second.id, subject: '语文', score: 88 },
      ],
    });
    assert.equal(savedScores.count, 2);
    assert.equal((await request('GET', `/api/scores?exam_id=${exam.id}`)).length, 2);

    const backup = await request('GET', '/api/backup/export');
    assert.equal(backup.app, 'teacher-work');
    assert.ok(backup.tables.find(item => item.table === 'classes').rows.length >= 1);
    assert.ok(backup.tables.find(item => item.table === 'students').rows.length >= 2);
    await expectBackupRejected({ app: 'teacher-work', version: 1, tables: [] });
    await expectBackupRejected({
      ...backup,
      tables: [...backup.tables, { table: 'unknown', rows: [] }],
    });
    const invalidRowBackup = structuredClone(backup);
    invalidRowBackup.tables.find(item => item.table === 'classes').rows[0].unexpected = true;
    await expectBackupRejected(invalidRowBackup);
    assert.equal((await request('GET', '/api/classes')).length, 1);
  } finally {
    await running.close();
  }
});
