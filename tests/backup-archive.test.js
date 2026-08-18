import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackupArchive, extractBackupArchive } from '../server/utils/backup-archive.js';

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('creates and extracts a backup zip with database payload and file hashes', async () => {
  const root = tempDir('teacher-backup-archive-');
  const source = path.join(root, 'source');
  const target = path.join(root, 'target');
  fs.mkdirSync(source);
  fs.mkdirSync(target);
  const attachment = path.join(source, 'photo.pdf');
  fs.writeFileSync(attachment, '%PDF-1.7\narchive test');
  const zipPath = path.join(root, 'backup.zip');

  await createBackupArchive({
    payload: { app: 'teacher-work', version: 2, files: [{ storedName: 'photo.pdf' }] },
    files: [{ storedName: 'photo.pdf', sourcePath: attachment }],
    output: zipPath,
  });

  const result = await extractBackupArchive(zipPath, target);
  assert.equal(result.payload.version, 2);
  assert.equal(result.files.length, 1);
  assert.equal(fs.readFileSync(path.join(target, 'files', 'photo.pdf'), 'utf8'), '%PDF-1.7\narchive test');
  assert.match(result.files[0].sha256, /^[a-f0-9]{64}$/);
});

test('rejects unsafe and duplicate archive paths before extraction', async () => {
  const root = tempDir('teacher-backup-archive-invalid-');
  const zipPath = path.join(root, 'invalid.zip');
  const target = path.join(root, 'target');
  fs.mkdirSync(target);
  await assert.rejects(
    extractBackupArchive(zipPath, target),
    /ENOENT|zip/i,
  );
});
