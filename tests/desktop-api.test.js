import test from 'node:test';
import assert from 'node:assert/strict';
import { configureRuntime, getRuntimeConfig, toApiUrl } from '../web/src/platform/runtimeConfig.js';
import fs from 'node:fs';

test('desktop runtime does not place the long-lived API token into file URLs', () => {
  configureRuntime({ apiBaseUrl: 'http://127.0.0.1:45678', apiToken: 'secret token', mode: 'tauri' });
  assert.equal(toApiUrl('/api/classes'), 'http://127.0.0.1:45678/api/classes');
  assert.equal(toApiUrl('/api/documents/1/file'), 'http://127.0.0.1:45678/api/documents/1/file');
  assert.doesNotMatch(toApiUrl('/api/documents/1/file', true), /__token/);
  assert.equal(getRuntimeConfig().mode, 'tauri');
});

test('desktop bootstrap reports the current database version', () => {
  const source = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  assert.match(source, /database_version:\s*5/);
});
