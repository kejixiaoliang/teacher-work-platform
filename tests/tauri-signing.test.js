import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveSigningPrivateKey } from '../scripts/tauri-signing.mjs';

test('falls back to reading the Tauri signing private key from a file path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-work-signing-'));
  const keyPath = path.join(tempDir, 'stable.key');
  await fs.writeFile(keyPath, '  test-private-key\n', 'utf8');

  try {
    assert.equal(
      resolveSigningPrivateKey({ privateKey: '', privateKeyPath: keyPath }),
      'test-private-key',
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('prefers an explicitly supplied Tauri signing private key over a file path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-work-signing-'));
  const keyPath = path.join(tempDir, 'stable.key');
  await fs.writeFile(keyPath, 'file-private-key', 'utf8');

  try {
    assert.equal(
      resolveSigningPrivateKey({ privateKey: ' env-private-key ', privateKeyPath: keyPath }),
      'env-private-key',
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
