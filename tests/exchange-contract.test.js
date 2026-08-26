import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { EXCHANGE_COLLECTIONS, validateExchangeEnvelope } from '../shared/contracts/exchange.js';

function validEnvelope() {
  const content = Object.fromEntries(EXCHANGE_COLLECTIONS.map(name => [name, name === 'settings' ? {} : []]));
  content.assessment = { categories: [], items: [], records: [], revisions: [] };
  content.classes = [{ uuid: crypto.randomUUID(), name: '七年级一班' }];
  return {
    format: 'teacher-work-backup',
    formatVersion: 1,
    appVersion: '0.7.0',
    databaseVersion: 7,
    exportId: crypto.randomUUID(),
    exportedAt: '2026-08-26T00:00:00.000Z',
    source: { platform: 'desktop', product: 'teacher-work' },
    content,
    attachments: { included: false, omittedCount: 0 },
    integrity: { algorithm: 'sha256', scope: 'canonical-json-without-integrity-value', value: 'a'.repeat(64) },
  };
}

test('accepts a complete teacher-work-backup v1 envelope', () => {
  const result = validateExchangeEnvelope(validEnvelope());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects an envelope with a missing collection', () => {
  const payload = validEnvelope();
  delete payload.content.students;

  const result = validateExchangeEnvelope(payload);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('students')));
});

test('rejects duplicate UUIDs within one collection', () => {
  const payload = validEnvelope();
  const uuid = payload.content.classes[0].uuid;
  payload.content.classes.push({ uuid, name: '重复班级' });

  const result = validateExchangeEnvelope(payload);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('classes') && error.includes('uuid')));
});

test('rejects attachment metadata that would claim a negative omission count', () => {
  const payload = validEnvelope();
  payload.attachments.omittedCount = -1;

  const result = validateExchangeEnvelope(payload);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('omittedCount')));
});
