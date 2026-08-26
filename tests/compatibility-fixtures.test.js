import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExchangeEnvelope } from '../shared/contracts/exchange.js';
import { verifyIntegrity } from '../server/utils/backup-format.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

test('v1 compatibility fixture is valid and integrity-protected', () => {
  const payload = readFixture('exchange-v1-empty.json');
  assert.deepEqual(validateExchangeEnvelope(payload), { ok: true, errors: [] });
  assert.equal(verifyIntegrity(payload), true);
});

test('legacy tables fixture remains available as a migration input', () => {
  const payload = readFixture('legacy-tables-v2-minimal.json');
  assert.equal(payload.app, 'teacher-work');
  assert.equal(payload.version, 2);
  assert.deepEqual(payload.tables.map((table) => table.table), ['classes', 'students']);
});
