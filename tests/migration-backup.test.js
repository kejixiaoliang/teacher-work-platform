import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

test('creates a recovery backup before upgrading an old database', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-migrate-'));
  const file = path.join(dataDir, 'teacher.db');
  const old = new Database(file);
  old.exec('CREATE TABLE legacy_marker (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO legacy_marker(value) VALUES (\'keep\'); PRAGMA user_version = 2;');
  old.close();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TEACHER_WORK_DATA_DIR: dataDir, TEACHER_WORK_SIDECAR: '1', TEACHER_WORK_API_TOKEN: 'x', SEED_DEMO: '0', NO_OPEN: '1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => { if (chunk.toString().includes('TEACHER_WORK_READY')) resolve(); });
    child.once('error', reject);
    child.once('exit', code => { if (code) reject(new Error(`server exited ${code}`)); });
  });
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
  const backups = fs.readdirSync(path.join(dataDir, 'backups'), { recursive: true });
  assert.ok(backups.some(name => path.basename(name) === 'teacher.db'));
  const migrated = new Database(file, { readonly: true });
  assert.equal(migrated.pragma('user_version', { simple: true }), 3);
  migrated.close();
});
