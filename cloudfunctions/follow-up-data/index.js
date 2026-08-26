const crypto = require('node:crypto');
const STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const uuid = typeof event.uuid === 'string' ? event.uuid.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'create', 'update', 'delete'].includes(event.action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该跟进事项操作'] };
  if (event.action === 'query') return { ok: true, action: 'query', datasetId, classUuid, status: STATUSES.has(event.status) ? event.status : '' };
  if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
  if (event.action !== 'create' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['跟进事项 uuid 不能为空'] };
  const task = event.task || {};
  const title = String(task.title || '').trim();
  const content = String(task.content || '').trim();
  const dueDate = String(task.dueDate || task.due_date || '');
  if (!title || title.length > 120 || content.length > 2000) return { ok: false, code: 'CONTENT_INVALID', errors: ['跟进事项标题或内容无效'] };
  if (dueDate && !validDate(dueDate)) return { ok: false, code: 'DATE_INVALID', errors: ['截止日期无效'] };
  const status = STATUSES.has(task.status) ? task.status : 'pending';
  return { ok: true, action: event.action, datasetId, classUuid, uuid, task: { studentUuid: String(task.studentUuid || '').trim(), title, content, dueDate, status, result: String(task.result || '').trim(), sourceType: String(task.sourceType || task.source_type || '').trim() } };
}

function recordUuid(classUuid, studentUuid, title, dueDate) {
  const hex = crypto.createHash('sha256').update(`${classUuid}:${studentUuid}:${title}:${dueDate}`).digest('hex').slice(0, 32);
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
    const result = await db.collection('follow_up_tasks').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), ...(request.status ? { status: request.status } : {}) }).orderBy('dueDate', 'asc').limit(100).get();
    return { ok: true, action: 'query', records: result.data };
  }
  if (!request.task.studentUuid) return { ok: false, code: 'STUDENT_REQUIRED', errors: ['学生 uuid 不能为空'] };
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = recordUuid(request.classUuid, request.task.studentUuid, request.task.title, request.task.dueDate);
    const result = await db.collection('follow_up_tasks').add({ data: { ...request.task, ...scope, classUuid: request.classUuid, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  const current = await db.collection('follow_up_tasks').where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!current.data.length) return { ok: false, code: 'FOLLOW_UP_TASK_NOT_FOUND', errors: ['跟进事项不存在'] };
  const row = current.data[0];
  const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') {
    await db.collection('follow_up_tasks').doc(row._id).update({ data: { status: 'cancelled', deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  await db.collection('follow_up_tasks').doc(row._id).update({ data: { ...request.task, classUuid: request.classUuid, updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = { STATUSES, normalizeRequest, recordUuid, validDate, main };
