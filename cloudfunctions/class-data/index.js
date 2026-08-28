const crypto = require('node:crypto');
const ACTIONS = new Set(['query', 'create', 'update', 'delete']);
const TEXT_FIELDS = ['name', 'academicYear', 'term', 'headTeacher', 'remark'];
function normalize(event = {}) {
  const action = String(event.action || '').trim(); const datasetId = String(event.datasetId || '').trim(); const uuid = String(event.uuid || '').trim();
  if (!ACTIONS.has(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该班级操作'] };
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (action !== 'create' && action !== 'query' && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['班级 uuid 不能为空'] };
  if (action === 'query') return { ok: true, action, datasetId, uuid };
  const input = event.class || {}; const name = String(input.name || '').trim();
  if (!name || name.length > 120) return { ok: false, code: 'NAME_REQUIRED', errors: ['班级名称不能为空且不能超过 120 个字符'] };
  const seatRows = Number(input.seatRows ?? input.seat_rows ?? 6); const seatCols = Number(input.seatCols ?? input.seat_cols ?? 8);
  if (!Number.isInteger(seatRows) || seatRows < 1 || seatRows > 20 || !Number.isInteger(seatCols) || seatCols < 1 || seatCols > 20) return { ok: false, code: 'SEAT_LAYOUT_INVALID', errors: ['座位行列应为 1 至 20 的整数'] };
  const aisleMode = Number(input.aisleMode ?? input.aisle_mode ?? 1);
  if (![0, 1, 2].includes(aisleMode)) return { ok: false, code: 'AISLE_MODE_INVALID', errors: ['过道模式应为均分、中间走道或双走道'] };
  return { ok: true, action, datasetId, uuid, fields: { name, academicYear: String(input.academicYear ?? input.academic_year ?? '').trim(), term: String(input.term || '').trim(), seatRows, seatCols, aisleMode, headTeacher: String(input.headTeacher ?? input.head_teacher ?? '').trim(), remark: String(input.remark || '').trim() } };
}
function sanitize(fields = {}) { const result = {}; for (const key of TEXT_FIELDS) if (fields[key] !== undefined) result[key] = String(fields[key]).trim().slice(0, 500); for (const key of ['seatRows', 'seatCols', 'aisleMode']) if (Number.isFinite(Number(fields[key]))) result[key] = Number(fields[key]); return result; }
async function main(event) {
  const cloudModule = await import('wx-server-sdk'); const cloud = cloudModule.default || cloudModule; cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] }; const request = normalize(event); if (!request.ok) return request;
  const db = cloud.database(); const scope = { ownerId: context.OPENID, datasetId: request.datasetId };
  if (request.action === 'query') { const result = await db.collection('classes').where({ ...scope, ...(request.uuid ? { uuid: request.uuid } : {}), deletedAt: null }).limit(100).get(); return { ok: true, action: 'query', records: result.data }; }
  const now = new Date().toISOString();
  if (request.action === 'create') { const uuid = crypto.randomUUID(); const result = await db.collection('classes').add({ data: { ...sanitize(request.fields), ...scope, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } }); return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 }; }
  const found = await db.collection('classes').where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get(); if (!found.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] }; const row = found.data[0]; const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') { await db.collection('classes').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } }); return { ok: true, action: 'delete', uuid: request.uuid, revision }; }
  await db.collection('classes').doc(row._id).update({ data: { ...sanitize(request.fields), updatedAt: now, revision } }); return { ok: true, action: 'update', uuid: request.uuid, revision };
}
module.exports = { ACTIONS, normalize, sanitize, main };
