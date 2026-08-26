import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { EXCHANGE_COLLECTIONS } from '../shared/contracts/exchange.js';

const require = createRequire(import.meta.url);
const { main, precheckImport } = require('../cloudfunctions/import-data/index.js');

function validPayload() {
  const content = Object.fromEntries(EXCHANGE_COLLECTIONS.map(name => [name, name === 'settings' ? {} : []]));
  content.assessment = { categories: [], items: [], records: [], revisions: [] };
  content.classes = [{ uuid: crypto.randomUUID(), name: '七年级一班' }];
  content.students = [{ uuid: crypto.randomUUID(), classUuid: content.classes[0].uuid, name: '张三' }];
  return {
    format: 'teacher-work-backup',
    formatVersion: 1,
    appVersion: '0.7.0',
    databaseVersion: 7,
    exportId: crypto.randomUUID(),
    exportedAt: '2026-08-26T00:00:00.000Z',
    source: { platform: 'desktop', product: 'teacher-work' },
    content,
    attachments: { included: false, omittedCount: 2 },
    integrity: { algorithm: 'sha256', scope: 'canonical-json-without-integrity-value', value: 'a'.repeat(64) },
  };
}

test('precheck returns collection counts without writing cloud data', () => {
  const result = precheckImport({ payload: validPayload() });

  assert.deepEqual(result, {
    ok: true,
    stage: 'precheck',
    counts: { classes: 1, students: 1 },
    omittedAttachmentCount: 2,
    errors: [],
  });
});

test('cloud function exposes the standard event handler entrypoint', () => {
  assert.equal(typeof main, 'function');
});

test('cloud function resolves its validator from the deployable function package', () => {
  const source = require('node:fs').readFileSync('cloudfunctions/import-data/index.js', 'utf8');

  assert.match(source, /require\('\.\/exchange-contract\.cjs'\)/);
});

test('precheck reports malformed JSON without throwing', () => {
  const result = precheckImport({ payload: '{not-json' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_JSON');
  assert.equal(result.stage, 'precheck');
});

test('precheck returns contract errors for an invalid envelope', () => {
  const payload = validPayload();
  delete payload.content.students;

  const result = precheckImport({ payload });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_EXCHANGE_PAYLOAD');
  assert.ok(result.errors.some(error => error.includes('students')));
});
