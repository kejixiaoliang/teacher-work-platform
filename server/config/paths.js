import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
let dataDir = path.resolve(process.env.TEACHER_WORK_DATA_DIR || defaultRoot);

export function configureDataDir(dir) {
  if (!dir || typeof dir !== 'string') throw new Error('data directory is required');
  dataDir = path.resolve(dir);
  return dataDir;
}

export function getDataDir() { return dataDir; }

export function resolveDataPath(...segments) {
  if (!segments.length || segments.some(s => typeof s !== 'string' || !s || s === '.' || s === '..' || path.isAbsolute(s))) {
    throw new Error('unsafe data path segment');
  }
  const resolved = path.resolve(dataDir, ...segments);
  if (resolved !== dataDir && !resolved.startsWith(dataDir + path.sep)) throw new Error('unsafe data path escape');
  return resolved;
}

export function ensureDataLayout() {
  const paths = getDataPaths();
  for (const dir of Object.values(paths)) fs.mkdirSync(dir, { recursive: true });
  return paths;
}

export function getDataPaths() {
  return {
    dataDir,
    filesDir: path.join(dataDir, 'files'),
    backupDir: path.join(dataDir, 'backups'),
    logsDir: path.join(dataDir, 'logs'),
  };
}
