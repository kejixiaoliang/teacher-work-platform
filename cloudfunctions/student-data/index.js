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
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const action = event.action || 'list';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['list', 'create', 'update', 'delete', 'restore', 'purge'].includes(action)) {
    return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该学生操作'] };
  }
  if (['update', 'delete'].includes(action) && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['学生 uuid 不能为空'] };
  if (action === 'list') return { ok: true, action, datasetId, classUuid, trashed: event.trashed === true };
  if (['restore', 'purge'].includes(action)) {
    const uuids = Array.isArray(event.uuids) ? event.uuids.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [];
    if (!uuids.length) return { ok: false, code: 'UUIDS_REQUIRED', errors: ['未选择学生'] };
    return { ok: true, action, datasetId, uuids: [...new Set(uuids)] };
  }
  if (action !== 'delete') {
    const cleaned = cleanFields(event.student);
    if (!cleaned.ok) return cleaned;
    return { ok: true, action, datasetId, uuid, classUuid, fields: cleaned.fields };
  }
  return { ok: true, action, datasetId, uuid, classUuid };
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

  if (request.action === 'list') {
    const result = await db.collection('students').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: request.trashed ? db.command.neq(null) : null }).orderBy('schoolNo', 'asc').limit(500).get();
    return { ok: true, action: 'list', trashed: request.trashed, records: result.data };
  }

  if (request.action === 'restore' || request.action === 'purge') {
    const rows = await db.collection('students').where({ ...scope, uuid: db.command.in(request.uuids), deletedAt: db.command.neq(null) }).limit(500).get();
    if (request.action === 'restore') {
      const skipped = [];
      let count = 0;
      for (const row of rows.data) {
        if (row.schoolNo) {
          const duplicate = await db.collection('students').where({ ...scope, schoolNo: row.schoolNo, deletedAt: null }).limit(1).get();
          if (duplicate.data.length) { skipped.push({ uuid: row.uuid, name: row.name, reason: `学号 ${row.schoolNo} 已被在册学生占用` }); continue; }
        }
        await db.collection('students').doc(row._id).update({ data: { deletedAt: null, updatedAt: now, revision: (row.revision || 1) + 1 } });
        count += 1;
      }
      return { ok: true, action: 'restore', count, skipped };
    }
    const blocked = [];
    for (const row of rows.data) {
      const history = await db.collection('assessment_records').where({ ...scope, studentUuid: row.uuid }).limit(1).get();
      if (history.data.length) blocked.push(row.name || row.uuid);
    }
    if (blocked.length) return { ok: false, code: 'STUDENT_HAS_ASSESSMENT_HISTORY', errors: [`${blocked.join('、')} 存在表现量化历史，不能彻底删除`] };
    for (const row of rows.data) await db.collection('students').doc(row._id).remove();
    return { ok: true, action: 'purge', count: rows.data.length };
  }

  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await db.collection('students').add({ data: {
      ...request.fields, ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), uuid, createdAt: now, updatedAt: now,
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
