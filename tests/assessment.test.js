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
