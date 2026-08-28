const crypto = require('node:crypto');

const COLLECTION_MAP = {
  classes: 'classes',
  students: 'students',
  studentHistory: 'student_metrics_history',
  seats: 'seats',
  seatLayouts: 'seat_layouts',
  documents: 'documents',
  duties: 'duties',
  exams: 'exams',
  scores: 'scores',
  attendance: 'attendance',
  studentRecords: 'student_records',
  leaves: 'leaves',
  contacts: 'contacts',
  followUpTasks: 'follow_up_tasks',
  importBatches: 'import_batches',
};
const ASSESSMENT_MAP = { categories: 'assessment_categories', items: 'assessment_items', records: 'assessment_records', revisions: 'assessment_revisions' };
const COLLECTIONS = [...Object.keys(COLLECTION_MAP), 'assessment', 'settings'];
const MAX_ROWS_PER_COLLECTION = 10000;
const CLASS_SCOPED = new Set(['classes', 'students', 'studentHistory', 'seats', 'seatLayouts', 'documents', 'duties', 'exams', 'scores', 'attendance', 'studentRecords', 'leaves', 'contacts', 'followUpTasks', 'importBatches']);

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('备份包含无效数字');
  return JSON.stringify(value);
}

function attachIntegrity(payload) {
  const next = JSON.parse(JSON.stringify(payload));
  next.integrity = { algorithm: 'sha256', scope: 'canonical-json-without-integrity-value', value: '' };
  next.integrity.value = crypto.createHash('sha256').update(canonicalize(next), 'utf8').digest('hex');
  return next;
}

function stableUuid(collectionName, sourceId) {
  const digest = crypto.createHash('sha256').update(`teacher-work:${collectionName}:${sourceId}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${(parseInt(digest.slice(16, 18), 16) & 0x3f | 0x80).toString(16)}${digest.slice(18, 20)}-${digest.slice(20, 32)}`;
}

function stripCloudFields(value) {
  if (Array.isArray(value)) return value.map(stripCloudFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['_id', '_openid', '_openid_', 'ownerId', 'datasetId'].includes(key)).map(([key, nested]) => [key, stripCloudFields(nested)]));
}

function exportRow(row = {}, collectionName = 'records') {
  const sourceId = row._id || row.uuid || crypto.randomUUID();
  const next = stripCloudFields(row);
  if (!next.uuid) next.uuid = stableUuid(collectionName, sourceId);
  return next;
}

async function getAll(query, max = MAX_ROWS_PER_COLLECTION) {
  const rows = [];
  for (let skip = 0; skip < max; skip += 1000) {
    const limit = Math.min(1000, max - skip);
    const result = await query.skip(skip).limit(limit).get();
    const page = Array.isArray(result.data) ? result.data : [];
    rows.push(...page);
    if (page.length < limit) return { rows, truncated: false };
  }
  const probe = await query.skip(max).limit(1).get();
  return { rows, truncated: Array.isArray(probe.data) && probe.data.length > 0 };
}

async function readCollection(db, collectionName, scope, classUuid = '') {
  try {
    return await getAll(db.collection(collectionName).where({ ...scope, ...(classUuid ? { classUuid } : {}) }));
  } catch (error) {
    if (/collection(?:\s+|.*)(?:not exist|does not exist|不存在)/i.test(String(error?.message || error))) return { rows: [], truncated: false };
    throw error;
  }
}

async function main(event = {}) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const request = normalizeRequest(event);
  if (!request.ok) return request;
  const { datasetId } = request;

  const db = cloud.database();
  const scope = { ownerId: context.OPENID, datasetId };
  if (request.classUuid) {
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid }).limit(1).get();
    if (!classResult.data?.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
  }
  const entries = await Promise.all(Object.entries(COLLECTION_MAP).map(async ([name, collectionName]) => [name, await readCollection(db, collectionName, scope, request.classUuid && CLASS_SCOPED.has(name) ? request.classUuid : '')]));
  const assessmentEntries = await Promise.all(Object.entries(ASSESSMENT_MAP).map(async ([name, collectionName]) => [name, await readCollection(db, collectionName, scope, request.classUuid && ['records', 'revisions'].includes(name) ? request.classUuid : '')]));
  const truncated = [...entries, ...assessmentEntries].filter(([, result]) => result.truncated).map(([name]) => name);
  if (truncated.length) return { ok: false, code: 'EXPORT_TOO_LARGE', errors: [`备份集合记录超过每集合 ${MAX_ROWS_PER_COLLECTION} 条上限：${truncated.join('、')}`] };

  const content = Object.fromEntries(COLLECTIONS.map((name) => [name, name === 'settings' ? {} : []]));
  for (const [name, result] of entries) content[name] = result.rows.map((row) => exportRow(row, name));
  for (const [name, result] of assessmentEntries) content.assessment[name] = result.rows.map((row) => exportRow(row, `assessment.${name}`));
  const payload = attachIntegrity({
    format: 'teacher-work-backup',
    formatVersion: 1,
    appVersion: '0.8.0',
    databaseVersion: 7,
    exportId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    source: { platform: 'miniprogram-cloudbase', product: 'teacher-work' },
    content,
    attachments: { included: false, omittedCount: content.documents.filter((row) => row.fileName || row.storedName).length },
  });
  return { ok: true, action: 'export', datasetId, ...(request.classUuid ? { classUuid: request.classUuid } : {}), backupScope: request.classUuid ? 'class' : 'dataset', payload, counts: Object.fromEntries(COLLECTIONS.map((name) => [name, name === 'assessment' || name === 'settings' ? Object.values(content[name]).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0) : content[name].length])) };
}

function normalizeRequest(event = {}) {
  if (event.action !== 'export') return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['当前仅支持完整备份导出'] };
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  if (classUuid && classUuid.length > 120) return { ok: false, code: 'CLASS_INVALID', errors: ['classUuid 无效'] };
  return { ok: true, action: 'export', datasetId, classUuid };
}

module.exports = { COLLECTIONS, COLLECTION_MAP, ASSESSMENT_MAP, CLASS_SCOPED, canonicalize, attachIntegrity, stableUuid, exportRow, getAll, normalizeRequest, main };
