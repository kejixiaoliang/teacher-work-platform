import fs from 'node:fs';

export function resolveSigningPrivateKey({
  privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY,
  privateKeyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH,
} = {}) {
  const directKey = typeof privateKey === 'string' ? privateKey.trim() : '';
  if (directKey) return directKey;

  const filePath = typeof privateKeyPath === 'string' ? privateKeyPath.trim() : '';
  if (!filePath) return '';

  let fileKey;
  try {
    fileKey = fs.readFileSync(filePath, 'utf8').trim();
  } catch (error) {
    throw new Error(`无法读取 Tauri updater 私钥文件：${filePath}`, { cause: error });
  }

  if (!fileKey) throw new Error(`Tauri updater 私钥文件为空：${filePath}`);
  return fileKey;
}
