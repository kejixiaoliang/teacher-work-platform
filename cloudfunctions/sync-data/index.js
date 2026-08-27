const COLLECTIONS = ['classes', 'students', 'seats', 'attendance', 'leaves', 'follow_up_tasks', 'contacts', 'documents', 'exams', 'scores', 'assessment_categories', 'assessment_items', 'assessment_records', 'duties'];

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (event.action !== 'status') return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['当前仅支持同步状态检查'] };
  return { ok: true, action: 'status', datasetId };
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const request = normalizeRequest(event);
  if (!request.ok) return request;
  const db = cloud.database();
  const counts = {};
  for (const collectionName of COLLECTIONS) {
    const result = await db.collection(collectionName).where({ ownerId: context.OPENID, datasetId: request.datasetId }).count();
    counts[collectionName] = result.total || 0;
  }
  return { ok: true, action: 'status', datasetId: request.datasetId, counts, mode: 'status_only', message: '当前为状态检查；首次同步前仍需明确确认数据方向和冲突策略。' };
}

module.exports = { COLLECTIONS, normalizeRequest, main };
