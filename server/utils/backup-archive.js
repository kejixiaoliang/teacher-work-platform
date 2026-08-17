import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import unzipper from 'unzipper';

export const MAX_ARCHIVE_FILES = 5000;
export const MAX_ARCHIVE_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_ARCHIVE_FILE_BYTES = 200 * 1024 * 1024;

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function safeArchivePath(entryPath) {
  if (typeof entryPath !== 'string' || !entryPath || entryPath.includes('\\') || path.posix.isAbsolute(entryPath)) {
    throw new Error('备份包含不安全的归档路径');
  }
  const normalized = path.posix.normalize(entryPath);
  if (normalized !== entryPath || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('备份包含不安全的归档路径');
  }
  if (normalized === 'backup.json') return normalized;
  if (!normalized.startsWith('files/') || normalized.slice(6).includes('/')) {
    throw new Error('备份包含不支持的归档条目');
  }
  const storedName = normalized.slice(6);
  if (!storedName || storedName === '.' || storedName === '..' || path.basename(storedName) !== storedName) {
    throw new Error('备份包含不安全的文件名');
  }
  return normalized;
}

function assertSourceFile(sourcePath) {
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile() || stat.size > MAX_ARCHIVE_FILE_BYTES) throw new Error('备份文件不存在或超过单文件限制');
}

export async function createBackupArchive({ payload, files = [], output }) {
  if (!output || !payload || !Array.isArray(files) || files.length > MAX_ARCHIVE_FILES) {
    throw new Error('备份归档参数无效');
  }
  const seen = new Set(['backup.json']);
  let totalBytes = Buffer.byteLength(JSON.stringify(payload));
  const outputStream = fs.createWriteStream(output);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const result = new Promise((resolve, reject) => {
    outputStream.on('close', resolve);
    outputStream.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(outputStream);
  archive.append(JSON.stringify(payload, null, 2), { name: 'backup.json' });
  for (const file of files) {
    const entryPath = safeArchivePath(`files/${file?.storedName || ''}`);
    if (seen.has(entryPath)) throw new Error('备份包含重复文件');
    seen.add(entryPath);
    assertSourceFile(file.sourcePath);
    const size = fs.statSync(file.sourcePath).size;
    totalBytes += size;
    if (totalBytes > MAX_ARCHIVE_TOTAL_BYTES) throw new Error('备份文件总大小超过限制');
    archive.file(file.sourcePath, { name: entryPath });
  }
  await archive.finalize();
  await result;
}

export async function extractBackupArchive(zipPath, targetDir) {
  const directory = await unzipper.Open.file(zipPath);
  fs.mkdirSync(targetDir, { recursive: true });
  const seen = new Set();
  const files = [];
  let payload = null;
  let totalBytes = 0;
  if (directory.files.length > MAX_ARCHIVE_FILES + 1) throw new Error('备份文件数量超过限制');
  for (const entry of directory.files) {
    const entryPath = safeArchivePath(entry.path);
    if (seen.has(entryPath)) throw new Error('备份包含重复归档条目');
    seen.add(entryPath);
    if (entry.type !== 'File') throw new Error('备份包含目录或不支持的归档条目');
    const size = Number(entry.vars?.uncompressedSize || 0);
    if (size > MAX_ARCHIVE_FILE_BYTES || (totalBytes += size) > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new Error('备份展开大小超过限制');
    }
    if (entryPath === 'backup.json') {
      payload = JSON.parse((await entry.buffer()).toString('utf8'));
      continue;
    }
    const storedName = entryPath.slice(6);
    const outputPath = path.join(targetDir, 'files', storedName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await pipeline(entry.stream(), fs.createWriteStream(outputPath, { flags: 'wx' }));
    files.push({ storedName, size: fs.statSync(outputPath).size, sha256: sha256File(outputPath), path: outputPath });
  }
  if (!payload || !seen.has('backup.json')) throw new Error('备份缺少 backup.json');
  return { payload, files };
}
