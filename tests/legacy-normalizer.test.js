import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyPayload } from '../shared/exchange/normalize-legacy.js';

test('normalizes legacy classes and students with stable UUID relationships', () => {
  const result = normalizeLegacyPayload({
    app: 'teacher-work',
    version: 2,
    tables: [
      { table: 'classes', rows: [{ id: 1, name: '一班' }] },
      { table: 'students', rows: [{ id: 2, class_id: 1, name: '学生甲' }] },
    ],
  });
  assert.equal(result.ok, true);
  assert.match(result.content.classes[0].uuid, /^[0-9a-f-]{36}$/);
  assert.equal(result.content.classes[0].legacyId, 1);
  assert.equal(result.content.students[0].classUuid, result.content.classes[0].uuid);
  assert.deepEqual(result.errors, []);
});

test('preserves an existing UUID and warns about unknown tables', () => {
  const uuid = '44444444-4444-4444-8444-444444444444';
  const result = normalizeLegacyPayload({
    app: 'teacher-work',
    version: 1,
    tables: [
      { table: 'classes', rows: [{ id: 1, uuid, name: '一班' }] },
      { table: 'unknown_table', rows: [{ id: 9 }] },
    ],
  });
  assert.equal(result.content.classes[0].uuid, uuid);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /unknown_table/);
});

test('rejects a student whose parent class cannot be resolved', () => {
  const result = normalizeLegacyPayload({
    app: 'teacher-work',
    version: 2,
    tables: [{ table: 'students', rows: [{ id: 2, class_id: 99, name: '孤立学生' }] }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /class_id=99/);
  assert.equal(result.content.students.length, 0);
});

test('passes through current exchange content without dropping collections', () => {
  const result = normalizeLegacyPayload({
    format: 'teacher-work-backup',
    formatVersion: 1,
    appVersion: '0.7.0',
    databaseVersion: 7,
    exportId: '55555555-5555-4555-8555-555555555555',
    exportedAt: '2026-08-26T00:00:00.000Z',
    source: { platform: 'desktop' },
    content: { classes: [], students: [] },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.content.classes, []);
  assert.deepEqual(result.content.students, []);
  assert.deepEqual(result.content.settings, {});
});
