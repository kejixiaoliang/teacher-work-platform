import test from 'node:test';
import assert from 'node:assert/strict';
import { configureRuntime, getRuntimeConfig, toApiUrl } from '../web/src/platform/runtimeConfig.js';

test('desktop runtime builds authenticated API and file URLs', () => {
  configureRuntime({ apiBaseUrl: 'http://127.0.0.1:45678', apiToken: 'secret token', mode: 'tauri' });
  assert.equal(toApiUrl('/api/classes'), 'http://127.0.0.1:45678/api/classes');
  assert.match(toApiUrl('/api/documents/1/file', true), /__token=secret\+token/);
  assert.equal(getRuntimeConfig().mode, 'tauri');
});
