const crypto = require('node:crypto');
const TYPES = new Set(['事假', '病假']);
const STATUSES = new Set(['待审批', '已批准', '已销假']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const uuid = typeof event.uuid === 'string' ? event.uuid.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'create', 'update', 'delete'].includes(event.action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该请假操作'] };
  if (event.action === 'query') return { ok: true, action: 'query', datasetId, classUuid };
  if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
  if (event.action !== 'create' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['请假 uuid 不能为空'] };
  const leave = event.leave || {};
  const startDate = String(leave.startDate || leave.start_date || '');
  const endDate = String(leave.endDate || leave.end_date || startDate);
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) return { ok: false, code: 'DATE_INVALID', errors: ['请假日期无效'] };
  const studentUuid = typeof leave.studentUuid === 'string' ? leave.studentUuid.trim() : '';
  if (!studentUuid) return { ok: false, code: 'STUDENT_REQUIRED', errors: ['学生 uuid 不能为空'] };
  const type = TYPES.has(leave.type) ? leave.type : '事假';
  const status = STATUSES.has(leave.status) ? leave.status : '已批准';
  return { ok: true, action: event.action, datasetId, classUuid, uuid, leave: { studentUuid, type, startDate, endDate, days: Number(leave.days) > 0 ? Number(leave.days) : 1, reason: String(leave.reason || '').trim(), status, remark: String(leave.remark || '').trim() } };
}

function recordUuid(classUuid, studentUuid, startDate) {
  const hex = crypto.createHash('sha256').update(`${classUuid}:${studentUuid}:${startDate}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
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
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId };
  if (request.action === 'query') {
    const result = await db.collection('leaves').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}) }).orderBy('startDate', 'desc').limit(100).get();
    return { ok: true, action: 'query', records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = recordUuid(request.classUuid, request.leave.studentUuid, request.leave.startDate);
    const result = await db.collection('leaves').add({ data: { ...request.leave, ...scope, classUuid: request.classUuid, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  const current = await db.collection('leaves').where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!current.data.length) return { ok: false, code: 'LEAVE_NOT_FOUND', errors: ['请假记录不存在'] };
  const row = current.data[0];
  const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') {
    await db.collection('leaves').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  await db.collection('leaves').doc(row._id).update({ data: { ...request.leave, classUuid: request.classUuid, updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = { TYPES, STATUSES, normalizeRequest, recordUuid, main };
