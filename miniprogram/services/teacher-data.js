import { callCloudFunction } from './cloudbase.js';

export async function writeStudentData(input) {
  const result = await callCloudFunction('student-data', input);
  return result?.result || result;
}

export async function callAttendanceData(input) {
  const result = await callCloudFunction('attendance-data', input);
  return result?.result || result;
}

export async function callLeaveData(input) {
  const result = await callCloudFunction('leave-data', input);
  return result?.result || result;
}

export async function callFollowUpData(input) {
  const result = await callCloudFunction('follow-up-data', input);
  return result?.result || result;
}

export async function callRedeemCode(input) {
  const result = await callCloudFunction('redeem-code', input);
  return result?.result || result;
}

export async function callClassData(input) {
  const result = await callCloudFunction('class-data', input);
  return result?.result || result;
}

export async function callBusinessData(input) {
  const result = await callCloudFunction('business-data', input);
  return result?.result || result;
}

export async function callStudentProfile(input) {
  const result = await callCloudFunction('student-profile', input);
  return result?.result || result;
}

const ALLOWED_COLLECTIONS = new Set(['classes', 'students']);

function normalizeResponse(response) {
  const result = response?.result || response;
  if (result?.ok !== true || !Array.isArray(result.records)) {
    return { ok: false, records: [], error: result?.errors?.[0] || '云端数据返回格式无效' };
  }
  return { ok: true, records: result.records, error: '' };
}

async function loadTeacherData({ collectionName, datasetId } = {}) {
  if (!ALLOWED_COLLECTIONS.has(collectionName)) throw new Error('暂不支持读取该数据集合');
  if (typeof datasetId !== 'string' || !datasetId.trim()) throw new Error('请先选择数据集');
  try {
    return normalizeResponse(await callCloudFunction('query-data', {
      collectionName,
      datasetId: datasetId.trim(),
    }));
  } catch (error) {
    return { ok: false, records: [], error: error?.message || '读取云端数据失败' };
  }
}

loadTeacherData.normalizeResponse = normalizeResponse;

export { ALLOWED_COLLECTIONS, loadTeacherData };
