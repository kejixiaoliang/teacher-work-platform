import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

function startServer(dataDir) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEACHER_WORK_DATA_DIR: dataDir,
      TEACHER_WORK_SIDECAR: '1',
      TEACHER_WORK_API_TOKEN: 'test-token',
      SEED_DEMO: '0',
      NO_OPEN: '1',
      PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    const onData = chunk => {
      output += chunk.toString();
      const match = output.match(/TEACHER_WORK_READY\s+(\{[^\r\n]+\})/);
      if (match) resolve(JSON.parse(match[1]).port);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', code => {
      if (code) reject(new Error(`server exited ${code}: ${output}`));
    });
  });
  return { child, ready };
}

async function stopServer(child) {
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

async function apiRequest(port, method, url, body) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-teacher-work-token': 'test-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function createFixture(port) {
  const cls = await apiRequest(port, 'POST', '/api/classes', {
    name: '量化测试班', academic_year: '2026-2027', term: '第一学期',
  });
  const student = await apiRequest(port, 'POST', '/api/students', {
    class_id: cls.body.data.id, name: '测试学生', school_no: 'A001',
  });
  return { classId: cls.body.data.id, studentId: student.body.data.id };
}

test('v4 creates assessment tables and seeds rules once', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-'));
  const { child, ready } = startServer(dataDir);
  await ready;
  await stopServer(child);

  const file = path.join(dataDir, 'teacher.db');
  const db = new Database(file, { readonly: true });
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE 'assessment_%'
    ORDER BY name
  `).all().map(row => row.name);
  assert.deepEqual(tables, [
    'assessment_categories',
    'assessment_items',
    'assessment_record_revisions',
    'assessment_records',
  ]);
  assert.equal(db.pragma('user_version', { simple: true }), 4);
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM assessment_items').get().c >= 5);
  const itemCount = db.prepare('SELECT COUNT(*) AS c FROM assessment_items').get().c;
  db.close();

  const second = startServer(dataDir);
  await second.ready;
  await stopServer(second.child);
  const reopened = new Database(file, { readonly: true });
  assert.equal(reopened.prepare('SELECT COUNT(*) AS c FROM assessment_items').get().c, itemCount);
  reopened.close();
});

test('records batch scores, rejects duplicate daily entries, and keeps revisions', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-api-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  assert.equal(categories.status, 200);
  const item = categories.body.data.flatMap(category => category.items)
    .find(candidate => candidate.name === '课堂迟到');
  assert.ok(item);

  const first = await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId,
    date: '2026-08-15',
    itemId: item.id,
    studentIds: [fixture.studentId],
    remark: '第一次记录',
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.count, 1);
  assert.equal(first.body.data.skipped.length, 0);

  const duplicate = await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId,
    date: '2026-08-15',
    itemId: item.id,
    studentIds: [fixture.studentId],
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.data.count, 0);
  assert.equal(duplicate.body.data.skipped[0].reasonCode, 'DAILY_DUPLICATE');

  const records = await apiRequest(port, 'GET', `/api/assessment/records?class_id=${fixture.classId}`);
  const record = records.body.data[0];
  const missingReason = await apiRequest(port, 'PUT', `/api/assessment/records/${record.id}`, {
    remark: '修正后的备注',
  });
  assert.equal(missingReason.status, 200);

  const edited = await apiRequest(port, 'PUT', `/api/assessment/records/${record.id}`, {
    behaviorDate: '2026-08-16', reason: '教师确认实际发生日期',
  });
  assert.equal(edited.status, 200);

  const revisions = await apiRequest(port, 'GET', `/api/assessment/records/${record.id}/revisions`);
  assert.equal(revisions.status, 200);
  assert.equal(revisions.body.data.length, 2);
  assert.equal(revisions.body.data.at(-1).action, 'edit');

  const voided = await apiRequest(port, 'POST', `/api/assessment/records/${record.id}/void`, { reason: '误记' });
  assert.equal(voided.status, 200);
  const restored = await apiRequest(port, 'POST', `/api/assessment/records/${record.id}/restore`, { reason: '确认记录有效' });
  assert.equal(restored.status, 200);
  await stopServer(server.child);
});
