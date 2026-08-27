const crypto = require('node:crypto');
const STATUSES = new Set(['出勤', '迟到', '请假', '缺勤']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const date = typeof event.date === 'string' ? event.date.trim() : '';
  const month = typeof event.month === 'string' ? event.month.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
  if (!['query', 'save', 'monthlySummary'].includes(event.action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该考勤操作'] };
  if (event.action === 'monthlySummary') {
    if (!MONTH_RE.test(month)) return { ok: false, code: 'MONTH_INVALID', errors: ['月份格式应为 YYYY-MM'] };
    return { ok: true, action: event.action, datasetId, classUuid, month, rows: [] };
  }
  if (!DATE_RE.test(date)) return { ok: false, code: 'DATE_INVALID', errors: ['日期格式应为 YYYY-MM-DD'] };
  if (event.action === 'save' && !Array.isArray(event.rows)) return { ok: false, code: 'ROWS_REQUIRED', errors: ['考勤记录必须是数组'] };
  return { ok: true, action: event.action, datasetId, classUuid, date, month, rows: event.rows || [] };
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
  if (request.action === 'monthlySummary') {
    const result = await db.collection('attendance').where({ ownerId: context.OPENID, datasetId: request.datasetId, classUuid: request.classUuid, date: db.command.gte(`${request.month}-01`).and(db.command.lt(`${request.month === request.month.slice(0, 4) + '-12' ? Number(request.month.slice(0, 4)) + 1 : request.month.slice(0, 4)}-${request.month.endsWith('-12') ? '01' : String(Number(request.month.slice(5, 7)) + 1).padStart(2, '0')}-01`)) }).limit(5000).get();
    const summaries = new Map();
    for (const row of result.data) {
      const summary = summaries.get(row.studentUuid) || { studentUuid: row.studentUuid, present: 0, late: 0, leave: 0, absent: 0, total: 0 };
      if (row.status === '出勤') summary.present += 1;
      if (row.status === '迟到') summary.late += 1;
      if (row.status === '请假') summary.leave += 1;
      if (row.status === '缺勤') summary.absent += 1;
      summary.total += 1;
      summaries.set(row.studentUuid, summary);
    }
    return { ok: true, action: 'monthlySummary', month: request.month, rows: [...summaries.values()] };
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
