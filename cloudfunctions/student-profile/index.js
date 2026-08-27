const crypto = require('node:crypto');

const COLLECTIONS = new Set(['student_metrics_history', 'student_records']);
const ACTIONS = new Set(['query', 'create', 'update', 'delete']);
const TEXT_FIELDS = new Set(['term', 'source', 'type', 'content', 'date', 'remark']);

function normalize(event = {}) {
  const collection = String(event.collection || '').trim();
  const action = String(event.action || '').trim();
  const datasetId = String(event.datasetId || '').trim();
  const classUuid = String(event.classUuid || '').trim();
  const studentUuid = String(event.studentUuid || '').trim();
  const uuid = String(event.uuid || '').trim();
  if (!COLLECTIONS.has(collection)) return { ok: false, code: 'COLLECTION_NOT_ALLOWED', errors: ['学生档案集合不在白名单中'] };
  if (!ACTIONS.has(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['学生档案操作不支持'] };
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!classUuid || !studentUuid) return { ok: false, code: 'STUDENT_SCOPE_REQUIRED', errors: ['classUuid 和 studentUuid 不能为空'] };
  if (action !== 'create' && action !== 'query' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['档案记录 uuid 不能为空'] };
  if (action === 'create' && (!event.record || typeof event.record !== 'object' || Array.isArray(event.record))) return { ok: false, code: 'RECORD_INVALID', errors: ['档案记录无效'] };
  return { ok: true, collection, action, datasetId, classUuid, studentUuid, uuid, record: event.record || {} };
}

function sanitize(record = {}) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    if (['ownerId', 'datasetId', 'classUuid', 'studentUuid', '_id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt', 'revision'].includes(key)) continue;
    if (TEXT_FIELDS.has(key)) result[key] = String(value || '').trim().slice(0, 2000);
    else if (['height_cm', 'vision_left', 'vision_right'].includes(key)) {
      if (value === '' || value === null || value === undefined) continue;
      if (Number.isFinite(Number(value))) result[key] = Number(value);
    } else if (key === 'is_myopia' && typeof value === 'boolean') result[key] = value;
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
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId, classUuid: request.classUuid, studentUuid: request.studentUuid };
  const collection = db.collection(request.collection);
  if (request.action === 'query') {
    const result = await collection.where({ ...scope, deletedAt: null }).orderBy('createdAt', 'desc').limit(100).get();
    return { ok: true, records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...scope, ...sanitize(request.record), uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: request.record.source || 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  const found = await collection.where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!found.data.length) return { ok: false, code: 'PROFILE_RECORD_NOT_FOUND', errors: ['学生档案记录不存在'] };
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
