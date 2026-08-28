import { callCloudFunction } from './cloudbase.js';

function writeFile(filePath, data) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({
    filePath,
    data,
    encoding: 'utf8',
    success: () => resolve(filePath),
    fail: reject,
  }));
}

function safeName(value) {
  return String(value || '教师工作台').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
}

export async function exportBackupFile({ datasetId, className = '教师工作台' } = {}) {
  if (!datasetId) throw new Error('请先选择数据集');
  if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH || typeof wx.getFileSystemManager !== 'function') throw new Error('当前微信版本不支持本地文件导出');
  const response = await callCloudFunction('backup-data', { action: 'export', datasetId });
  const result = response?.result || response;
  if (!result?.ok || !result.payload) throw new Error(result?.errors?.[0] || '完整备份导出失败');
  const fileName = `教师工作台-完整备份-${safeName(className)}-${new Date().toISOString().slice(0, 10)}.json`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  await writeFile(filePath, JSON.stringify(result.payload, null, 2));
  return { filePath, fileName, payload: result.payload, counts: result.counts || {} };
}

export function shareBackupFile({ filePath, fileName } = {}) {
  if (!filePath || !fileName) return Promise.reject(new Error('备份文件路径无效'));
  if (typeof wx === 'undefined' || typeof wx.shareFileMessage !== 'function') return Promise.reject(new Error('当前微信版本不支持文件分享'));
  return new Promise((resolve, reject) => wx.shareFileMessage({
    filePath,
    fileName,
    success: () => resolve(filePath),
    fail: reject,
  }));
}

