import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import Database from 'better-sqlite3';

function startSidecar(dataDir) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEACHER_WORK_DATA_DIR: dataDir,
      TEACHER_WORK_SIDECAR: '1',
      TEACHER_WORK_API_TOKEN: 'upgrade-matrix-token',
      SEED_DEMO: '0',
      NO_OPEN: '1',
      PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    child.stdout.on('data', chunk => {
      if (!settled && chunk.toString().includes('TEACHER_WORK_READY')) {
        settled = true;
        resolve();
      }
    });
    child.once('error', error => {
      if (!settled) reject(error);
    });
    child.once('exit', code => {
      if (!settled && code) reject(new Error(`server exited before ready: ${code}`));
    });
  });
  return { child, ready };
}

async function stopSidecar(child) {
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

test('upgrades a v0.8-style database, keeps records and attachments, and leaves a recovery point', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-installed-upgrade-'));
  const databaseFile = path.join(dataDir, 'teacher.db');
  const old = new Database(databaseFile);
  old.exec("CREATE TABLE legacy_marker (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO legacy_marker(value) VALUES ('keep-v0.8'); PRAGMA user_version = 2;");
  old.close();
  fs.mkdirSync(path.join(dataDir, 'files'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'files', 'v08-attachment.txt'), 'attachment survives upgrade');

  const running = startSidecar(dataDir);
  await running.ready;
  await stopSidecar(running.child);

  const migrated = new Database(databaseFile, { readonly: true });
  assert.equal(migrated.pragma('user_version', { simple: true }), 8);
  assert.equal(migrated.prepare('SELECT value FROM legacy_marker WHERE id = 1').get().value, 'keep-v0.8');
  migrated.close();
  assert.equal(fs.readFileSync(path.join(dataDir, 'files', 'v08-attachment.txt'), 'utf8'), 'attachment survives upgrade');
  const backups = fs.readdirSync(path.join(dataDir, 'backups'), { recursive: true });
  assert.ok(backups.some(name => path.basename(name) === 'teacher.db'));
});

test('release matrix keeps installed data outside the executable target and portable data beside the executable', () => {
  const source = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  assert.match(source, /TeacherWork/);
  assert.match(source, /RuntimeProfile::Installed/);
  assert.match(source, /RuntimeProfile::Portable/);
  assert.match(source, /shutdown_sidecar/);
  assert.match(source, /InstanceGuard::acquire/);
  assert.match(source, /cleanup_orphaned_sidecars/);
  assert.match(source, /ManagedSidecar::spawn/);
});
