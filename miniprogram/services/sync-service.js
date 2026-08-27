import { callCloudFunction } from './cloudbase.js';

export async function getSyncStatus(datasetId) {
  if (!datasetId) throw new Error('请先选择数据集');
  const response = await callCloudFunction('sync-data', { action: 'status', datasetId });
  return response?.result || response;
}
