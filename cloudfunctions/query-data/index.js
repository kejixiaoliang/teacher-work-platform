const ALLOWED_COLLECTIONS = new Set(['classes', 'students']);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeQuery(event = {}) {
  const collectionName = typeof event.collectionName === 'string' ? event.collectionName.trim() : '';
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const requestedLimit = Number(event.limit);
  const requestedOffset = Number(event.offset);
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

  if (!ALLOWED_COLLECTIONS.has(collectionName)) {
    return { ok: false, code: 'COLLECTION_NOT_ALLOWED', errors: ['暂不支持读取该数据集合'] };
  }
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  return { ok: true, collectionName, datasetId, limit, offset };
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };

  const query = normalizeQuery(event);
  if (!query.ok) return query;

  const db = cloud.database();
  const result = await db.collection(query.collectionName)
    .where({ ownerId: context.OPENID, datasetId: query.datasetId })
    .skip(query.offset)
    .limit(query.limit)
    .get();

  return {
    ok: true,
    collectionName: query.collectionName,
    datasetId: query.datasetId,
    offset: query.offset,
    limit: query.limit,
    total: result.data.length,
    records: result.data,
  };
}

module.exports = { ALLOWED_COLLECTIONS, normalizeQuery, main };
