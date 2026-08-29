import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildManifest, buildChecksums } from '../scripts/generate-update-manifest.mjs';

async function createAssets() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-update-manifest-'));
  const installer = path.join(root, '教师工作台_0.9.0_x64-setup.exe');
  const signature = path.join(root, `${path.basename(installer)}.sig`);
  await fs.writeFile(installer, 'installer-fixture');
  await fs.writeFile(signature, 'signature-fixture\n');
  return { root, installer, signature };
}

test('generates a Tauri Windows x64 manifest with absolute asset URLs and notes', async () => {
  const assets = await createAssets();
  const manifest = await buildManifest({
    version: '0.9.0',
    installer: assets.installer,
    signature: assets.signature,
    endpointRoot: 'https://updates.example.test/teacher-work/stable/',
    notes: '支持安装版自动更新。',
    pubDate: '2026-08-29T00:00:00.000Z',
  });

  assert.equal(manifest.version, '0.9.0');
  assert.equal(manifest.platforms['windows-x86_64'].signature, 'signature-fixture');
  assert.match(manifest.platforms['windows-x86_64'].url, /^https:\/\//);
  assert.match(manifest.platforms['windows-x86_64'].url, /教师工作台|%E/);
  assert.equal(manifest.notes, '支持安装版自动更新。');
  assert.equal(manifest.pub_date, '2026-08-29T00:00:00.000Z');
});

test('writes SHA-256 records for the installer and signature assets', async () => {
  const assets = await createAssets();
  const checksums = await buildChecksums({
    version: '0.9.0',
    installer: assets.installer,
    signature: assets.signature,
  });

  assert.equal(checksums.version, '0.9.0');
  assert.equal(checksums.files.installer.size, 17);
  assert.match(checksums.files.installer.sha256, /^[a-f0-9]{64}$/);
  assert.match(checksums.files.signature.sha256, /^[a-f0-9]{64}$/);
});

test('rejects invalid versions, relative endpoints, missing assets, and empty signatures', async () => {
  const assets = await createAssets();

  await assert.rejects(
    buildManifest({
      version: '0.9',
      installer: assets.installer,
      signature: assets.signature,
      endpointRoot: 'https://updates.example.test/',
      notes: 'notes',
    }),
    /合法 SemVer/,
  );
  await assert.rejects(
    buildManifest({
      version: '0.9.0',
      installer: assets.installer,
      signature: assets.signature,
      endpointRoot: 'updates.example.test/',
      notes: 'notes',
    }),
    /绝对 HTTP URL/,
  );
  await assert.rejects(
    buildManifest({
      version: '0.9.0',
      installer: path.join(assets.root, 'missing.exe'),
      signature: assets.signature,
      endpointRoot: 'https://updates.example.test/',
      notes: 'notes',
    }),
    /文件不存在或为空/,
  );
  await fs.writeFile(assets.signature, '');
  await assert.rejects(
    buildManifest({
      version: '0.9.0',
      installer: assets.installer,
      signature: assets.signature,
      endpointRoot: 'https://updates.example.test/',
      notes: 'notes',
    }),
    /签名文件不存在或为空/,
  );
});

test('keeps five local updater fixture states available without production endpoints', async () => {
  const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'update-source');
  const names = ['no-update', 'available', 'signature-error', 'missing-resource', 'offline'];
  for (const name of names) {
    const file = path.join(fixtureRoot, `${name}.json`);
    const fixture = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.ok(fixture.platforms['windows-x86_64']);
    assert.match(fixture.platforms['windows-x86_64'].url, /^http:\/\/127\.0\.0\.1:/);
  }
});
