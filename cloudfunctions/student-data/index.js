const crypto = require('node:crypto');

const WRITABLE_FIELDS = new Set([
  'name', 'schoolNo', 'school_no', 'gender', 'birthDate', 'birth_date', 'phone',
  'parentPhone', 'parent_phone', 'isBoarding', 'is_boarding', 'interestDuty',
  'interest_duty', 'healthNote', 'health_note', 'heightCm', 'height_cm',
  'visionLeft', 'vision_left', 'visionRight', 'vision_right', 'isMyopia',
  'is_myopia', 'gradeLevel', 'grade_level', 'seatNote', 'seat_note', 'remark',
]);

function cleanFields(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (WRITABLE_FIELDS.has(key)) output[key] = value;
  }
  if (typeof output.name !== 'string' || !output.name.trim()) {
    return { ok: false, code: 'NAME_REQUIRED', errors: ['学生姓名不能为空'] };
  }
  output.name = output.name.trim();
  return { ok: true, fields: output };
}

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const uuid = typeof event.uuid === 'string' ? event.uuid.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['create', 'update', 'delete'].includes(event.action)) {
    return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该学生操作'] };
  }
  if (event.action !== 'create' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['学生 uuid 不能为空'] };
  if (event.action !== 'delete') {
    const cleaned = cleanFields(event.student);
    if (!cleaned.ok) return cleaned;
    return { ok: true, action: event.action, datasetId, uuid, fields: cleaned.fields };
  }
  return { ok: true, action: event.action, datasetId, uuid };
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
  const now = new Date().toISOString();
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId };

  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await db.collection('students').add({ data: {
      ...request.fields, ...scope, uuid, createdAt: now, updatedAt: now,
      deletedAt: null, revision: 1, source: 'miniprogram',
    } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }

  const query = db.collection('students').where({ ...scope, uuid: request.uuid, deletedAt: null });
  const current = await query.limit(1).get();
  if (!current.data.length) return { ok: false, code: 'STUDENT_NOT_FOUND', errors: ['未找到可操作的学生'] };
  const row = current.data[0];
  if (request.action === 'delete') {
    const revision = (row.revision || 1) + 1;
    await db.collection('students').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  const revision = (row.revision || 1) + 1;
  await db.collection('students').doc(row._id).update({ data: { ...request.fields, updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = { WRITABLE_FIELDS, cleanFields, normalizeRequest, main };
