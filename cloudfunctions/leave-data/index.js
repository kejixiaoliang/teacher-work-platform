const crypto = require('node:crypto');
const TYPES = new Set(['事假', '病假']);
const STATUSES = new Set(['待审批', '已批准', '已销假']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function datesInRange(startDate, endDate, maxDays = 365) {
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) return [];
  const dates = []; const cursor = new Date(`${startDate}T00:00:00.000Z`); const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end && dates.length < maxDays) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return cursor <= end ? [] : dates;
}

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const uuid = typeof event.uuid === 'string' ? event.uuid.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'create', 'update', 'delete'].includes(event.action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该请假操作'] };
  if (event.action === 'query') return { ok: true, action: 'query', datasetId, classUuid };
  if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
  if (event.action !== 'create' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['请假 uuid 不能为空'] };
  if (event.action === 'delete') return { ok: true, action: 'delete', datasetId, classUuid, uuid };
  const leave = event.leave || {};
  const startDate = String(leave.startDate || leave.start_date || '');
  const endDate = String(leave.endDate || leave.end_date || startDate);
  const range = datesInRange(startDate, endDate);
  if (!range.length) return { ok: false, code: 'DATE_INVALID', errors: ['请假日期无效或跨度超过 365 天'] };
  const studentUuid = typeof leave.studentUuid === 'string' ? leave.studentUuid.trim() : '';
  if (!studentUuid) return { ok: false, code: 'STUDENT_REQUIRED', errors: ['学生 uuid 不能为空'] };
  const type = TYPES.has(leave.type) ? leave.type : '事假';
  const status = STATUSES.has(leave.status) ? leave.status : '已批准';
  const days = leave.days == null || leave.days === '' ? range.length : Number(leave.days);
  if (!Number.isFinite(days) || days <= 0 || days > 365) return { ok: false, code: 'DAYS_INVALID', errors: ['请假天数应为 1 至 365'] };
  return { ok: true, action: event.action, datasetId, classUuid, uuid, leave: { studentUuid, type, startDate, endDate, days, reason: String(leave.reason || '').trim().slice(0, 2000), status, remark: String(leave.remark || '').trim().slice(0, 2000) } };
}

function recordUuid(classUuid, studentUuid, startDate) {
  const hex = crypto.createHash('sha256').update(`${classUuid}:${studentUuid}:${startDate}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function clearLinkedAttendance(db, scope, leave) {
  const linked = await db.collection('attendance').where({ ...scope, classUuid: leave.classUuid, studentUuid: leave.studentUuid, leaveUuid: leave.uuid, deletedAt: null }).limit(500).get();
  const now = new Date().toISOString(); let count = 0;
  for (const row of linked.data) {
    if (row.status !== '请假' || row.remark !== '请假联动') continue;
    await db.collection('attendance').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision: (row.revision || 1) + 1 } }); count += 1;
  }
  return count;
}

async function syncAttendanceForLeave(db, scope, leave) {
  if (leave.status === '已销假') return 0;
  const dates = datesInRange(leave.startDate, leave.endDate); const now = new Date().toISOString(); let count = 0;
  for (const date of dates) {
    const attendanceScope = { ...scope, classUuid: leave.classUuid, studentUuid: leave.studentUuid, date };
    const existing = await db.collection('attendance').where({ ...attendanceScope, deletedAt: null }).limit(1).get();
    if (existing.data.length) continue;
    await db.collection('attendance').add({ data: { ...attendanceScope, status: '请假', remark: '请假联动', leaveUuid: leave.uuid, uuid: recordUuid(leave.classUuid, leave.studentUuid, date), createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } }); count += 1;
  }
  return count;
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
    const result = await db.collection('leaves').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: null }).orderBy('startDate', 'desc').limit(500).get();
    return { ok: true, action: 'query', records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = recordUuid(request.classUuid, request.leave.studentUuid, request.leave.startDate);
    const student = await db.collection('students').where({ ...scope, classUuid: request.classUuid, uuid: request.leave.studentUuid, deletedAt: null }).limit(1).get();
    if (!student.data.length || student.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    const duplicate = await db.collection('leaves').where({ ...scope, uuid, deletedAt: null }).limit(1).get();
    if (duplicate.data.length) return { ok: false, code: 'LEAVE_CONFLICT', errors: ['该学生在同一开始日期已有请假记录'] };
    const result = await db.collection('leaves').add({ data: { ...request.leave, ...scope, classUuid: request.classUuid, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    const attendanceCount = await syncAttendanceForLeave(db, scope, { ...request.leave, classUuid: request.classUuid, uuid });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1, attendanceCount };
  }
  const current = await db.collection('leaves').where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!current.data.length) return { ok: false, code: 'LEAVE_NOT_FOUND', errors: ['请假记录不存在'] };
  const row = current.data[0];
  const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') {
    const attendanceCount = await clearLinkedAttendance(db, scope, row);
    await db.collection('leaves').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision, attendanceCount };
  }
  const student = await db.collection('students').where({ ...scope, classUuid: request.classUuid, uuid: request.leave.studentUuid, deletedAt: null }).limit(1).get();
  if (!student.data.length || student.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
  await clearLinkedAttendance(db, scope, row);
  await db.collection('leaves').doc(row._id).update({ data: { ...request.leave, classUuid: request.classUuid, updatedAt: now, revision } });
  const attendanceCount = await syncAttendanceForLeave(db, scope, { ...request.leave, classUuid: request.classUuid, uuid: request.uuid });
  return { ok: true, action: 'update', uuid: request.uuid, revision, attendanceCount };
}

module.exports = { TYPES, STATUSES, isValidDate, datesInRange, normalizeRequest, recordUuid, clearLinkedAttendance, syncAttendanceForLeave, main };
