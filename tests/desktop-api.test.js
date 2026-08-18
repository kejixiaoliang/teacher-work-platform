import test from 'node:test';
import assert from 'node:assert/strict';
import { configureRuntime, getRuntimeConfig, toApiUrl } from '../web/src/platform/runtimeConfig.js';

test('desktop runtime does not place the long-lived API token into file URLs', () => {
  configureRuntime({ apiBaseUrl: 'http://127.0.0.1:45678', apiToken: 'secret token', mode: 'tauri' });
  assert.equal(toApiUrl('/api/classes'), 'http://127.0.0.1:45678/api/classes');
  assert.equal(toApiUrl('/api/documents/1/file'), 'http://127.0.0.1:45678/api/documents/1/file');
  assert.doesNotMatch(toApiUrl('/api/documents/1/file', true), /__token/);
  assert.equal(getRuntimeConfig().mode, 'tauri');
});
