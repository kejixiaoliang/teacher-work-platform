const crypto = require('node:crypto');
const STATUSES = new Set(['出勤', '迟到', '请假', '缺勤']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const date = typeof event.date === 'string' ? event.date.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
  if (!DATE_RE.test(date)) return { ok: false, code: 'DATE_INVALID', errors: ['日期格式应为 YYYY-MM-DD'] };
  if (!['query', 'save'].includes(event.action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该考勤操作'] };
  if (event.action === 'save' && !Array.isArray(event.rows)) return { ok: false, code: 'ROWS_REQUIRED', errors: ['考勤记录必须是数组'] };
  return { ok: true, action: event.action, datasetId, classUuid, date, rows: event.rows || [] };
}

function normalizeRows(rows) {
  const seen = new Set();
  const normalized = [];
  for (const row of rows) {
    const studentUuid = typeof row?.studentUuid === 'string' ? row.studentUuid.trim() : '';
    if (!studentUuid || seen.has(studentUuid)) continue;
    seen.add(studentUuid);
    normalized.push({ studentUuid, status: STATUSES.has(row.status) ? row.status : '出勤', remark: typeof row.remark === 'string' ? row.remark.trim() : '' });
  }
  return normalized;
}

function stableAttendanceUuid(classUuid, studentUuid, date) {
  const hex = crypto.createHash('sha256').update(`${classUuid}:${studentUuid}:${date}`).digest('hex').slice(0, 32);
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
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId, classUuid: request.classUuid, date: request.date };
  if (request.action === 'query') {
    const result = await db.collection('attendance').where(scope).limit(100).get();
    return { ok: true, action: 'query', date: request.date, rows: result.data };
  }
  const rows = normalizeRows(request.rows);
  const now = new Date().toISOString();
  for (const row of rows) {
    const existing = await db.collection('attendance').where({ ...scope, studentUuid: row.studentUuid }).limit(1).get();
    const data = { ...row, ...scope, updatedAt: now, source: 'miniprogram' };
    if (existing.data.length) {
      const revision = (existing.data[0].revision || 1) + 1;
      await db.collection('attendance').doc(existing.data[0]._id).update({ data: { ...data, revision } });
    } else {
      await db.collection('attendance').add({ data: { ...data, uuid: stableAttendanceUuid(request.classUuid, row.studentUuid, request.date), createdAt: now, deletedAt: null, revision: 1 } });
    }
  }
  return { ok: true, action: 'save', date: request.date, count: rows.length };
}

module.exports = { STATUSES, normalizeRequest, normalizeRows, stableAttendanceUuid, main };
