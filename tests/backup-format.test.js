import test from 'node:test';
import assert from 'node:assert/strict';
import { attachIntegrity, canonicalize, emptyContent, stableUuid, verifyIntegrity } from '../server/utils/backup-format.js';

test('canonical JSON is independent of object key order', () => {
  assert.equal(canonicalize({ z: 1, a: { y: 2, x: 3 } }), canonicalize({ a: { x: 3, y: 2 }, z: 1 }));
});

test('exchange payload integrity detects changes', () => {
  const payload = attachIntegrity({ format: 'teacher-work-backup', content: emptyContent() });
  assert.equal(verifyIntegrity(payload), true);
  payload.content.classes.push({ uuid: 'changed' });
  assert.equal(verifyIntegrity(payload), false);
});

test('stable record UUID is deterministic and scoped by table', () => {
  assert.equal(stableUuid('students', 12), stableUuid('students', 12));
  assert.notEqual(stableUuid('students', 12), stableUuid('classes', 12));
});
