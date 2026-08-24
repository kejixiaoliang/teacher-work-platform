import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function startServer(dataDir) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TEACHER_WORK_DATA_DIR: dataDir, TEACHER_WORK_SIDECAR: '1', TEACHER_WORK_API_TOKEN: 'workbench-token', SEED_DEMO: '0', NO_OPEN: '1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/TEACHER_WORK_READY\s+(\{[^\r\n]+\})/);
      if (match) resolve(JSON.parse(match[1]).port);
    });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', code => { if (code) reject(new Error(`server exited ${code}: ${output}`)); });
  });
  return { child, ready };
}

async function stopServer(child) {
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

async function request(port, method, url, body) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-teacher-work-token': 'workbench-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('today workbench aggregates actionable class items', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workbench-today-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const cls = await request(port, 'POST', '/api/classes', { name: '工作台测试班' });
  const classId = cls.body.data.id;
  const student = await request(port, 'POST', '/api/students', { class_id: classId, name: '工作台学生' });
  const studentId = student.body.data.id;
  const today = localDate();
  await request(port, 'POST', '/api/leaves', { class_id: classId, student_id: studentId, start_date: today, end_date: today, type: '病假' });
  await request(port, 'POST', '/api/follow-up-tasks', { class_id: classId, student_id: studentId, title: '今日跟进', due_date: today });
  await request(port, 'POST', '/api/follow-up-tasks', { class_id: classId, student_id: studentId, title: '逾期跟进', due_date: localDate(-1) });
  await request(port, 'POST', '/api/duties', { class_id: classId, student_id: studentId, role: '值日生', group_no: 1 });
  await request(port, 'POST', '/api/scores/exams', { class_id: classId, name: '近期考试', date: localDate(2), subjects: ['语文'] });

  const response = await request(port, 'GET', `/api/workbench/today?class_id=${classId}`);
  assert.equal(response.status, 200);
  const data = response.body.data;
  assert.equal(data.generatedAt, today);
  assert.equal(data.attendance.total, 1);
  assert.equal(data.attendance.请假, 1);
  assert.equal(data.leaves.length, 1);
  assert.equal(data.duties.length, 1);
  assert.equal(data.exams[0].name, '近期考试');
  assert.equal(data.followUps.length, 2);
  assert.equal(data.pendingFollowUps.length, 1);
  assert.equal(data.overdueFollowUps.length, 1);
  assert.equal(data.counts.pendingFollowUps, 2);
  assert.equal(data.counts.overdueFollowUps, 1);
  await stopServer(server.child);
});

test('today workbench rejects missing and unknown classes', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workbench-validation-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const missing = await request(port, 'GET', '/api/workbench/today');
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, 'INVALID_INPUT');
  const unknown = await request(port, 'GET', '/api/workbench/today?class_id=999999');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.code, 'CLASS_NOT_FOUND');
  await stopServer(server.child);
});
