import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { extractBackupArchive } from '../server/utils/backup-archive.js';

function startServer(dataDir) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TEACHER_WORK_DATA_DIR: dataDir, TEACHER_WORK_SIDECAR: '1', TEACHER_WORK_API_TOKEN: 'task-token', SEED_DEMO: '0', NO_OPEN: '1', PORT: '0' },
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
    headers: { 'content-type': 'application/json', 'x-teacher-work-token': 'task-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('v5 creates follow-up task table and preserves it on restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-follow-up-migration-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  await stopServer(server.child);

  const db = new Database(path.join(dataDir, 'teacher.db'), { readonly: true });
  assert.equal(db.pragma('user_version', { simple: true }), 8);
  assert.deepEqual(db.prepare("PRAGMA table_info(follow_up_tasks)").all().map(column => column.name), [
    'id', 'class_id', 'student_id', 'title', 'content', 'status', 'due_date', 'result',
    'source_type', 'source_id', 'created_at', 'updated_at', 'completed_at',
  ]);
  db.close();

  const second = startServer(dataDir);
  await second.ready;
  await stopServer(second.child);
});

test('follow-up tasks enforce class ownership and support status transitions', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-follow-up-api-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const classResponse = await request(port, 'POST', '/api/classes', { name: '跟进测试班' });
  const classId = classResponse.body.data.id;
  const studentResponse = await request(port, 'POST', '/api/students', { class_id: classId, name: '待跟进学生' });
  const studentId = studentResponse.body.data.id;

  const created = await request(port, 'POST', '/api/follow-up-tasks', {
    class_id: classId, student_id: studentId, title: '联系家长', content: '反馈近期学习状态', due_date: '2026-08-25',
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.data.status, 'pending');
  assert.equal(created.body.data.student_id, studentId);

  const listed = await request(port, 'GET', `/api/follow-up-tasks?class_id=${classId}&status=pending`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  assert.equal(listed.body.data[0].student_name, '待跟进学生');

  const started = await request(port, 'PUT', `/api/follow-up-tasks/${created.body.data.id}`, { status: 'in_progress' });
  assert.equal(started.status, 200);
  assert.equal(started.body.data.status, 'in_progress');

  const completed = await request(port, 'PUT', `/api/follow-up-tasks/${created.body.data.id}`, { status: 'completed', result: '已完成家长沟通' });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.completed_at.length > 0, true);
  assert.equal(completed.body.data.result, '已完成家长沟通');

  const invalidDate = await request(port, 'POST', '/api/follow-up-tasks', { class_id: classId, student_id: studentId, title: '无效日期', due_date: '2026-02-30' });
  assert.equal(invalidDate.status, 400);
  assert.equal(invalidDate.body.code, 'INVALID_INPUT');

  const otherClass = await request(port, 'POST', '/api/classes', { name: '其他班级' });
  const crossClass = await request(port, 'POST', '/api/follow-up-tasks', { class_id: otherClass.body.data.id, student_id: studentId, title: '越权事项' });
  assert.equal(crossClass.status, 400);
  assert.equal(crossClass.body.code, 'INVALID_INPUT');
  await stopServer(server.child);
});

test('full backup includes follow-up tasks', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-follow-up-backup-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const cls = await request(port, 'POST', '/api/classes', { name: '备份跟进班' });
  const student = await request(port, 'POST', '/api/students', { class_id: cls.body.data.id, name: '备份学生' });
  await request(port, 'POST', '/api/follow-up-tasks', { class_id: cls.body.data.id, student_id: student.body.data.id, title: '备份事项' });
  const response = await fetch(`http://127.0.0.1:${port}/api/backup/export`, { headers: { 'x-teacher-work-token': 'task-token' } });
  assert.equal(response.status, 200);
  const zipPath = path.join(dataDir, 'follow-up-export.zip');
  fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  const extracted = await extractBackupArchive(zipPath, path.join(dataDir, 'follow-up-export'));
  assert.equal(extracted.payload.content.followUpTasks.length, 1);
  assert.equal(extracted.payload.content.followUpTasks[0].title, '备份事项');
  await stopServer(server.child);
});
