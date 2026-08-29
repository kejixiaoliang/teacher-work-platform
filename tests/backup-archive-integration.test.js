import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractBackupArchive } from '../server/utils/backup-archive.js';
import { attachIntegrity, emptyContent } from '../server/utils/backup-format.js';

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
    assert.equal(extracted.payload.format, 'teacher-work-backup');
    assert.equal(extracted.payload.formatVersion, 2);
    assert.equal(extracted.payload.attachments.included, true);
    assert.equal(extracted.files.length, 1);

    const jsonResponse = await fetch(`${running.baseUrl}/api/backup/export-json`, {
      headers: { 'x-teacher-work-token': token },
    });
    assert.equal(jsonResponse.status, 200);
    const exchange = await jsonResponse.json();
    assert.equal(exchange.format, 'teacher-work-backup');
    assert.equal(exchange.formatVersion, 2);
    assert.equal(exchange.databaseVersion, 8);
    assert.equal(exchange.minReaderVersion, '0.8.0');
    assert.ok(exchange.content.studentFieldDefinitions);
    assert.ok(exchange.content.studentFieldValues);
    assert.ok(exchange.content.classDisplayLabels);
    assert.ok(exchange.content.subjectTemplates);
    assert.equal(exchange.attachments.included, false);
    assert.equal(exchange.content.classes.length, 1);
    assert.equal(exchange.content.students[0].uuid.length, 36);
    const removeSeededSourceClass = await fetch(`${running.baseUrl}/api/classes/${cls.data.id}`, {
      method: 'DELETE', headers: { 'x-teacher-work-token': token },
    });
    assert.equal(removeSeededSourceClass.status, 200);
    const updateOnSeededBlank = await fetch(`${running.baseUrl}/api/backup/update`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(exchange),
    });
    assert.equal(updateOnSeededBlank.status, 200);
    const seededUpdateClasses = await json('GET', '/api/classes');
    assert.equal(seededUpdateClasses.data.length, 1);
    const legacyPayload = {
      app: 'teacher-work',
      version: 1,
      exportedAt: exchange.exportedAt,
      files: [{ storedName: '附件.txt', size: 1, sha256: '0000000000000000000000000000000000000000000000000000000000000000' }],
      tables: [
        { table: 'classes', rows: exchange.content.classes.map(({ uuid, sourceId, ...row }) => row) },
        { table: 'students', rows: exchange.content.students.map(({ uuid, sourceId, ...row }) => row) },
      ],
    };
    const legacyRestore = await fetch(running.baseUrl + '/api/backup/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(legacyPayload),
    });
    assert.equal(legacyRestore.status, 200);
    const classesAfterLegacyRestore = await json('GET', '/api/classes');
    assert.equal(classesAfterLegacyRestore.data.length, 1);
    assert.equal(classesAfterLegacyRestore.data[0].name, '备份附件班');
    const jsonRestore = await fetch(`${running.baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(exchange),
    });
    assert.equal(jsonRestore.status, 200);

    const emptyPayload = attachIntegrity({
      format: exchange.format,
      formatVersion: exchange.formatVersion,
      appVersion: exchange.appVersion,
      databaseVersion: exchange.databaseVersion,
      exportId: '00000000-0000-4000-8000-000000000000',
      exportedAt: exchange.exportedAt,
      source: exchange.source,
      content: emptyContent(),
      attachments: { included: false, omittedCount: 0 },
    });
    const clearResponse = await fetch(running.baseUrl + '/api/backup/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(emptyPayload),
    });
    assert.equal(clearResponse.status, 200);
    assert.equal((await json('GET', '/api/classes')).data.length, 0);
    const freshJsonUpdate = await fetch(running.baseUrl + '/api/backup/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(exchange),
    });
    assert.equal(freshJsonUpdate.status, 200);
    const freshJsonUpdateBody = await freshJsonUpdate.json();
    assert.equal(freshJsonUpdateBody.data.classes, 1);
    const classesAfterFreshJsonUpdate = await json('GET', '/api/classes');
    assert.equal(classesAfterFreshJsonUpdate.data.length, 1);
    assert.equal(classesAfterFreshJsonUpdate.data[0].name, '备份附件班');
    const studentsAfterFreshJsonUpdate = await json('GET', '/api/students?class_id=' + classesAfterFreshJsonUpdate.data[0].id);
    assert.equal(studentsAfterFreshJsonUpdate.data.length, 1);
    assert.equal(studentsAfterFreshJsonUpdate.data[0].name, '恢复校验学生');

    const clearBeforeRestore = await fetch(running.baseUrl + '/api/backup/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(emptyPayload),
    });
    assert.equal(clearBeforeRestore.status, 200);
    const freshJsonRestore = await fetch(running.baseUrl + '/api/backup/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(exchange),
    });
    assert.equal(freshJsonRestore.status, 200);
    const classesAfterFreshJsonRestore = await json('GET', '/api/classes');
    assert.equal(classesAfterFreshJsonRestore.data.length, 1);
    assert.equal(classesAfterFreshJsonRestore.data[0].name, '备份附件班');
    const studentsAfterFreshJsonRestore = await json('GET', '/api/students?class_id=' + classesAfterFreshJsonRestore.data[0].id);
    assert.equal(studentsAfterFreshJsonRestore.data.length, 1);
    assert.equal(studentsAfterFreshJsonRestore.data[0].name, '恢复校验学生');

    const storedName = extracted.files[0].storedName;
    fs.rmSync(path.join(dataDir, 'files', storedName), { force: true });
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
    invalidPayload.integrity.value = '';
    const restoredStudent = invalidPayload.content.students.find(row => row.sourceId === student.data.id);
    restoredStudent.class_id = 999999;
    invalidPayload.integrity.value = 'invalid';
    const invalidRestore = await fetch(`${running.baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-teacher-work-token': token },
      body: JSON.stringify(invalidPayload),
    });
    assert.equal(invalidRestore.status, 400);
    assert.match((await invalidRestore.json()).error, /完整性校验失败/);
    const classesAfterRejectedRestore = await json('GET', '/api/classes');
    assert.equal(classesAfterRejectedRestore.data[0].name, '备份附件班');
    const studentsAfterRejectedRestore = await json('GET', `/api/students?class_id=${cls.data.id}`);
    assert.equal(studentsAfterRejectedRestore.data[0].name, '恢复校验学生');
  } finally {
    await running.close();
  }
});
