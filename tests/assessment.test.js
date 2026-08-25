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

async function apiBackupExport(port, dataDir) {
  const response = await fetch(`http://127.0.0.1:${port}/api/backup/export`, {
    headers: { 'x-teacher-work-token': 'test-token' },
  });
  const zipPath = path.join(dataDir, 'assessment-export.zip');
  fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  return extractBackupArchive(zipPath, path.join(dataDir, 'assessment-export'));
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
  assert.equal(db.pragma('user_version', { simple: true }), 7);
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

test('aggregates monthly and term rankings from active records', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-stats-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const secondStudent = await apiRequest(port, 'POST', '/api/students', {
    class_id: fixture.classId, name: '零分学生', school_no: 'A002',
  });
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  const positive = categories.body.data.flatMap(category => category.items).find(item => item.name === '积极发言');
  const repeatable = categories.body.data.flatMap(category => category.items).find(item => item.name === '获得表扬');
  await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId, date: '2026-08-01', itemId: positive.id, studentIds: [fixture.studentId],
  });
  await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId, date: '2026-08-02', itemId: repeatable.id, studentIds: [fixture.studentId],
  });
  const classUpdate = await apiRequest(port, 'PUT', `/api/classes/${fixture.classId}`, { term: '第二学期' });
  assert.equal(classUpdate.status, 200);
  await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId, date: '2026-09-01', itemId: positive.id, studentIds: [fixture.studentId],
  });

  const monthly = await apiRequest(port, 'GET', `/api/assessment/stats/monthly?class_id=${fixture.classId}&month=2026-08`);
  assert.equal(monthly.status, 200);
  assert.equal(monthly.body.data.ranking.length, 2);
  assert.equal(monthly.body.data.ranking[0].net, 4);
  assert.equal(monthly.body.data.ranking[1].net, 0);
  assert.equal(monthly.body.data.categories.length, 2);

  const monthlyDetail = await apiRequest(port, 'GET', `/api/assessment/stats/student/${fixture.studentId}?class_id=${fixture.classId}&month=2026-08`);
  assert.equal(monthlyDetail.status, 200);
  assert.equal(monthlyDetail.body.data.summary.recordCount, 2);
  assert.equal(monthlyDetail.body.data.summary.net, 4);

  const term = await apiRequest(port, 'GET', `/api/assessment/stats/term?class_id=${fixture.classId}&academic_year=2026-2027&term=第一学期`);
  assert.equal(term.status, 200);
  assert.equal(term.body.data.ranking[0].net, 4);
  assert.equal(term.body.data.ranking[0].recordCount, 2);
  const termDetail = await apiRequest(port, 'GET', `/api/assessment/stats/student/${fixture.studentId}?class_id=${fixture.classId}&academic_year=2026-2027&term=第一学期`);
  assert.equal(termDetail.status, 200);
  assert.equal(termDetail.body.data.summary.recordCount, 2);
  assert.equal(secondStudent.body.data.id > 0, true);
  await stopServer(server.child);
});

test('includes assessment rules, records, and revisions in backups', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-backup-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  const item = categories.body.data.flatMap(category => category.items).find(candidate => candidate.name === '积极发言');
  await apiRequest(port, 'POST', '/api/assessment/records/batch', { classId: fixture.classId, date: '2026-08-15', itemId: item.id, studentIds: [fixture.studentId] });
  const exported = await apiBackupExport(port, dataDir);
  const tables = exported.payload.tables;
  assert.deepEqual(tables.map(table => table.table).filter(name => name.startsWith('assessment_')), [
    'assessment_categories', 'assessment_items', 'assessment_records', 'assessment_record_revisions',
  ]);
  assert.equal(tables.find(table => table.table === 'assessment_records').rows.length, 1);
  await stopServer(server.child);
});

test('rejects invalid months and disabled categories', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-validation-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  const category = categories.body.data[0];
  const item = category.items[0];
  const invalidMonth = await apiRequest(port, 'GET', `/api/assessment/stats/monthly?class_id=${fixture.classId}&month=2026-13`);
  assert.equal(invalidMonth.status, 400);
  const disabled = await apiRequest(port, 'PUT', `/api/assessment/categories/${category.id}`, { name: category.name, isActive: false });
  assert.equal(disabled.status, 200);
  const blocked = await apiRequest(port, 'POST', '/api/assessment/records/batch', {
    classId: fixture.classId, date: '2026-08-16', itemId: item.id, studentIds: [fixture.studentId],
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, 'CATEGORY_DISABLED');
  await stopServer(server.child);
});

test('protects assessment history from student and class deletion', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-history-protection-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  const item = categories.body.data.flatMap(category => category.items).find(candidate => candidate.name === '积极发言');
  await apiRequest(port, 'POST', '/api/assessment/records/batch', { classId: fixture.classId, date: '2026-08-16', itemId: item.id, studentIds: [fixture.studentId] });
  const purge = await apiRequest(port, 'POST', '/api/students/purge', { ids: [fixture.studentId] });
  assert.equal(purge.status, 409);
  assert.equal(purge.body.code, 'STUDENT_HAS_ASSESSMENT_HISTORY');
  const removeClass = await apiRequest(port, 'DELETE', `/api/classes/${fixture.classId}`);
  assert.equal(removeClass.status, 409);
  assert.equal(removeClass.body.code, 'CLASS_HAS_ASSESSMENT_HISTORY');
  const records = await apiRequest(port, 'GET', `/api/assessment/records?class_id=${fixture.classId}`);
  assert.equal(records.body.data.length, 1);
  await stopServer(server.child);
});

test('keeps item and score snapshots in correction history', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-assessment-revision-snapshot-'));
  const server = startServer(dataDir);
  const port = await server.ready;
  const fixture = await createFixture(port);
  const categories = await apiRequest(port, 'GET', '/api/assessment/categories');
  const items = categories.body.data.flatMap(category => category.items).filter(item => item.allowDailyRepeat === false);
  const firstItem = items[0];
  const secondItem = items.find(item => item.id !== firstItem.id);
  await apiRequest(port, 'POST', '/api/assessment/records/batch', { classId: fixture.classId, date: '2026-08-16', itemId: firstItem.id, studentIds: [fixture.studentId] });
  const records = await apiRequest(port, 'GET', `/api/assessment/records?class_id=${fixture.classId}`);
  const edited = await apiRequest(port, 'PUT', `/api/assessment/records/${records.body.data[0].id}`, { itemId: secondItem.id, reason: '修正行为项目' });
  assert.equal(edited.status, 200);
  const revisions = await apiRequest(port, 'GET', `/api/assessment/records/${records.body.data[0].id}/revisions`);
  assert.equal(revisions.body.data[0].action, 'edit');
  assert.ok(revisions.body.data[0].changedFields.includes('scoreSnapshot'));
  assert.equal(revisions.body.data[0].after.itemNameSnapshot, secondItem.name);
  await stopServer(server.child);
});
