import { callCloudFunction } from './cloudbase.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function readFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: (result) => resolve(result.data),
      fail: reject,
    });
  });
}

export function chooseJsonFile() {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (result) => {
        const file = result.tempFiles?.[0];
        if (!file) return reject(new Error('未选择文件'));
        if (file.size > MAX_FILE_BYTES) return reject(new Error('JSON 文件不能超过 5 MB'));
        resolve(file);
      },
      fail: reject,
    });
  });
}

export async function previewSelectedFile(file) {
  if (!file?.path) throw new Error('文件路径无效');
  const payload = await readFile(file.path);
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('文件不是合法 JSON');
  }
  return callCloudFunction('import-data', { action: 'preview', payload: JSON.stringify(parsed) });
}

export function commitImport({ payload, datasetId }) {
  if (!payload) return Promise.reject(new Error('缺少待导入数据'));
  return callCloudFunction('import-data', {
    action: 'commit',
    datasetId,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

export { MAX_FILE_BYTES };
