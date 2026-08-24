import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractBackupArchive } from '../server/utils/backup-archive.js';

test('exports and restores database plus document files as a zip', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-backup-http-'));
  process.env.TEACHER_WORK_DATA_DIR = dataDir;
  process.env.SEED_DEMO = '0';
  const token = 'backup-archive-http-secret';
  const { startServer } = await import(`../server/runtime.js?backup-archive=${Date.now()}`);
  const running = await startServer({ port: 0, apiToken: token, openBrowser: false });
  const json = async (method, url, body) => {
    const response = await fetch(`${running.baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${method} ${url}`);
    return response.json();
  };
  try {
    const cls = await json('POST', '/api/classes', { name: '备份附件班', seat_rows: 1, seat_cols: 1 });
    const student = await json('POST', '/api/students', {
      class_id: cls.data.id, school_no: '001', name: '恢复校验学生', status: '在读',
    });
    const form = new FormData();
    form.append('class_id', String(cls.data.id));
    form.append('file', new Blob(['backup attachment']), '附件.txt');
    const upload = await fetch(`${running.baseUrl}/api/documents`, {
      method: 'POST', headers: { 'x-teacher-work-token': token }, body: form,
    });
    assert.equal(upload.status, 200);
    const archiveResponse = await fetch(`${running.baseUrl}/api/backup/export`, {
      headers: { 'x-teacher-work-token': token },
    });
    assert.equal(archiveResponse.status, 200);
    assert.match(archiveResponse.headers.get('content-type') || '', /application\/zip/);
    const zipPath = path.join(dataDir, 'export.zip');
    fs.writeFileSync(zipPath, Buffer.from(await archiveResponse.arrayBuffer()));
    const extracted = await extractBackupArchive(zipPath, path.join(dataDir, 'extracted'));
    assert.equal(extracted.payload.version, 2);
    assert.equal(extracted.files.length, 1);

    const storedName = fs.readdirSync(path.join(dataDir, 'files'))[0];
    fs.rmSync(path.join(dataDir, 'files', storedName));
    const restoreForm = new FormData();
    restoreForm.append('backup', new Blob([fs.readFileSync(zipPath)]), 'teacher-work-backup.zip');
    const restored = await fetch(`${running.baseUrl}/api/backup/import`, {
      method: 'POST', headers: { 'x-teacher-work-token': token }, body: restoreForm,
    });
    assert.equal(restored.status, 200);
    const restoredBody = await restored.json();
    assert.equal(restoredBody.ok, true);
    assert.equal(restoredBody.data.classes, 1);
    const classesAfterRestore = await json('GET', '/api/classes');
    assert.equal(classesAfterRestore.data.length, 1);
    assert.equal(classesAfterRestore.data[0].name, '备份附件班');
    assert.equal(fs.readFileSync(path.join(dataDir, 'files', storedName), 'utf8'), 'backup attachment');
    const snapshots = fs.readdirSync(path.join(dataDir, 'backups')).filter(name => name.endsWith('.db'));
    assert.ok(snapshots.length >= 1, '恢复前应保留数据库快照');

    const invalidPayload = structuredClone(extracted.payload);
    const restoredStudent = invalidPayload.tables.find(t => t.table === 'students').rows.find(row => row.id === student.data.id);
    restoredStudent.class_id = 999999;
    const invalidRestore = await fetch(`${running.baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(invalidPayload),
    });
    assert.equal(invalidRestore.status, 500);
    assert.match((await invalidRestore.json()).error, /恢复失败/);
    const classesAfterRejectedRestore = await json('GET', '/api/classes');
    assert.equal(classesAfterRejectedRestore.data[0].name, '备份附件班');
    const studentsAfterRejectedRestore = await json('GET', `/api/students?class_id=${cls.data.id}`);
    assert.equal(studentsAfterRejectedRestore.data[0].name, '恢复校验学生');
  } finally {
    await running.close();
  }
});
