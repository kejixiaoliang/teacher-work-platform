import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdater } from '../web/src/desktop/updater.js';

test('browser environments report updater as unsupported without calling native APIs', async () => {
  let checkCalls = 0;
  const updater = createUpdater({
    isTauri: () => false,
    getRuntime: () => ({ runtimeProfile: 'installed' }),
    check: async () => { checkCalls += 1; },
  });

  assert.deepEqual(await updater.checkForUpdate(), { status: 'unsupported', reason: 'browser' });
  assert.equal(checkCalls, 0);
});

test('portable desktop environments do not expose executable automatic updates', async () => {
  let checkCalls = 0;
  const updater = createUpdater({
    isTauri: () => true,
    getRuntime: () => ({ runtimeProfile: 'portable' }),
    check: async () => { checkCalls += 1; },
  });

  assert.deepEqual(await updater.checkForUpdate(), { status: 'unsupported', reason: 'portable' });
  assert.equal(checkCalls, 0);
});

test('installed updater reports no update without manufacturing an update object', async () => {
  const updater = createUpdater({
    isTauri: () => true,
    getRuntime: () => ({ runtimeProfile: 'installed' }),
    check: async () => null,
  });

  assert.deepEqual(await updater.checkForUpdate(), { status: 'up-to-date' });
});

test('installed updater normalizes update metadata and download progress', async () => {
  const progress = [];
  let relaunchCalls = 0;
  const nativeUpdate = {
    version: '0.9.1',
    date: '2026-09-01T00:00:00Z',
    body: '修复稳定性问题',
    async downloadAndInstall(onEvent) {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 25 } });
      onEvent({ event: 'Finished', data: {} });
    },
  };
  const updater = createUpdater({
    isTauri: () => true,
    getRuntime: () => ({ runtimeProfile: 'installed' }),
    check: async () => nativeUpdate,
    relaunch: async () => { relaunchCalls += 1; },
  });

  const result = await updater.checkForUpdate();
  assert.deepEqual(
    { status: result.status, version: result.version, notes: result.notes, date: result.date },
    { status: 'available', version: '0.9.1', notes: '修复稳定性问题', date: '2026-09-01T00:00:00Z' },
  );
  const installed = await updater.installUpdate(result, { onProgress: event => progress.push(event) });
  assert.deepEqual(installed, { status: 'installed' });
  assert.deepEqual(progress, [
    { status: 'started', contentLength: 100 },
    { status: 'progress', downloaded: 25, contentLength: 100 },
    { status: 'finished' },
  ]);
  assert.equal(relaunchCalls, 0);
});

test('updater converts native failures to safe user-facing errors without stack traces', async () => {
  const updater = createUpdater({
    isTauri: () => true,
    getRuntime: () => ({ runtimeProfile: 'installed' }),
    check: async () => { throw new Error('network secret\n at internal stack'); },
  });

  const result = await updater.checkForUpdate();
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'check-failed');
  assert.equal(result.message, '暂时无法检查更新，请稍后重试。');
  assert.doesNotMatch(JSON.stringify(result), /internal stack|network secret/);
});
