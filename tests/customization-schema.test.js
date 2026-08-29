import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function inspectFreshDatabase() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-customization-schema-'));
  const script = `import db from './server/db.js';
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
const columns = db.prepare('PRAGMA table_info(students)').all().map(row => row.name);
console.log(JSON.stringify({ version: db.pragma('user_version', { simple: true }), tables, columns }));
db.close();`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, TEACHER_WORK_DATA_DIR: dataDir, SEED_DEMO: '0' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split('\n').at(-1));
}

test('v8 creates non-schema custom field and class configuration tables', () => {
  const snapshot = inspectFreshDatabase();
  assert.equal(snapshot.version, 8);
  for (const table of ['student_field_definitions', 'student_field_values', 'class_display_labels', 'subject_templates']) {
    assert.equal(snapshot.tables.includes(table), true, `${table} should exist`);
  }
  assert.equal(snapshot.columns.includes('custom_field_1'), false);
});
