import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { configureDataDir, getDataPaths, resolveDataPath } from '../server/config/paths.js';

test('resolves portable paths under a configured Chinese directory', () => {
  const root = path.resolve('tmp/教师 工作台/data');
  configureDataDir(root);
  assert.equal(resolveDataPath('files', 'a.pdf'), path.join(root, 'files', 'a.pdf'));
  assert.equal(getDataPaths().backupDir, path.join(root, 'backups'));
});

test('rejects traversal and absolute path segments', () => {
  assert.throws(() => resolveDataPath('files', '..', 'teacher.db'), /unsafe/i);
  assert.throws(() => resolveDataPath('C:\\Windows\\win.ini'), /unsafe/i);
});
