const crypto = require('node:crypto');
const COLLECTIONS = new Set(['seats', 'duties', 'scores', 'contacts', 'documents', 'assessment_records']);
const ACTIONS = new Set(['query', 'summary', 'create', 'update', 'delete']);
const TEXT_FIELDS = ['name', 'title', 'content', 'remark', 'method', 'topic', 'result', 'role', 'subject', 'date', 'fileName', 'storedName'];

function normalize(event = {}) {
  const collection = String(event.collection || '').trim();
  const action = String(event.action || '').trim();
  const datasetId = String(event.datasetId || '').trim();
  const uuid = String(event.uuid || '').trim();
  if (!COLLECTIONS.has(collection)) return { ok: false, code: 'COLLECTION_NOT_ALLOWED', errors: ['业务集合不在白名单中'] };
  if (!ACTIONS.has(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['业务操作不支持'] };
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'summary', 'create'].includes(action) && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['业务记录 uuid 不能为空'] };
  if (action === 'create' && (!event.record || typeof event.record !== 'object' || Array.isArray(event.record))) return { ok: false, code: 'RECORD_INVALID', errors: ['业务记录无效'] };
  return { ok: true, collection, action, datasetId, uuid, classUuid: String(event.classUuid || '').trim(), record: event.record || {} };
}

function sanitize(record) {
  const result = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (['ownerId', 'datasetId', '_id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt', 'revision'].includes(key)) continue;
    if (TEXT_FIELDS.includes(key)) result[key] = String(value || '').trim().slice(0, 2000);
    else if (['row', 'col', 'score', 'studentId', 'examId', 'groupNo'].includes(key) && Number.isFinite(Number(value))) result[key] = Number(value);
    else if (typeof value === 'boolean' || value === null || typeof value === 'string' || Number.isFinite(value)) result[key] = value;
  }
  return result;
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const request = normalize(event);
  if (!request.ok) return request;
  const db = cloud.database();
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId };
  if (request.action === 'summary') {
    const collections = [...COLLECTIONS];
    const counts = {};
    for (const collection of collections) counts[collection] = (await db.collection(collection).where(scope).count()).total;
    return { ok: true, counts };
  }
  const collection = db.collection(request.collection);
  if (request.action === 'query') {
    const result = await collection.where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: null }).limit(100).get();
    return { ok: true, records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  const found = await collection.where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!found.data.length) return { ok: false, code: 'RECORD_NOT_FOUND', errors: ['业务记录不存在'] };
  const row = found.data[0];
  const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') {
    await collection.doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  await collection.doc(row._id).update({ data: { ...sanitize(request.record), updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = { COLLECTIONS, ACTIONS, normalize, sanitize, main };
