import crypto from 'node:crypto';

export const CLOUD_RECORD_META_FIELDS = Object.freeze([
  'uuid',
  'ownerId',
  'datasetId',
  'sourceImportBatchId',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'revision',
  'source',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set(['desktop', 'miniprogram', 'import']);

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function requiredText(value, field, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${field} 必须是非空字符串`);
}

function assertText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} 必须是非空字符串`);
}

function isoDate(value, field, errors) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) errors.push(`${field} 必须是有效 ISO 日期`);
}

export function buildCloudRecord({ row, ownerId, datasetId, sourceImportBatchId, now, source = 'import' }) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('row 必须是对象');
  if (!isUuid(row.uuid)) throw new TypeError('row.uuid 必须是稳定 UUID');
  assertText(ownerId, 'ownerId');
  assertText(datasetId, 'datasetId');
  if (!Number.isFinite(Date.parse(now))) throw new TypeError('now 必须是有效 ISO 日期');
  if (!SOURCES.has(source)) throw new TypeError('source 不支持');

  const { id, uuid, ...businessFields } = row;
  return {
    ...businessFields,
    uuid,
    ownerId,
    datasetId,
    ...(sourceImportBatchId ? { sourceImportBatchId } : {}),
    createdAt: row.createdAt || now,
    updatedAt: row.updatedAt || now,
    deletedAt: row.deletedAt || null,
    revision: Number.isSafeInteger(row.revision) && row.revision >= 1 ? row.revision : 1,
    source,
    ...(Number.isSafeInteger(id) ? { legacyId: id } : {}),
  };
}

export function validateCloudRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { ok: false, errors: ['云端记录必须是对象'] };
  if (!isUuid(record.uuid)) errors.push('uuid 无效');
  requiredText(record.ownerId, 'ownerId', errors);
  requiredText(record.datasetId, 'datasetId', errors);
  if (record.sourceImportBatchId !== undefined) requiredText(record.sourceImportBatchId, 'sourceImportBatchId', errors);
  isoDate(record.createdAt, 'createdAt', errors);
  isoDate(record.updatedAt, 'updatedAt', errors);
  if (record.deletedAt !== null && record.deletedAt !== undefined) isoDate(record.deletedAt, 'deletedAt', errors);
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) errors.push('revision 必须是正整数');
  if (!SOURCES.has(record.source)) errors.push('source 不支持');
  return { ok: errors.length === 0, errors };
}

export function buildImportBatch({ ownerId, sourceExportId, sourceAppVersion, sourceFormatVersion, datasetId, now }) {
  assertText(ownerId, 'ownerId');
  if (!isUuid(sourceExportId)) throw new TypeError('sourceExportId 必须是 UUID');
  assertText(sourceAppVersion, 'sourceAppVersion');
  if (!Number.isSafeInteger(sourceFormatVersion) || sourceFormatVersion < 1) throw new TypeError('sourceFormatVersion 无效');
  assertText(datasetId, 'datasetId');
  if (!Number.isFinite(Date.parse(now))) throw new TypeError('now 必须是有效 ISO 日期');
  return {
    importBatchId: crypto.randomUUID(),
    ownerId,
    sourceExportId,
    sourceAppVersion,
    sourceFormatVersion,
    datasetId,
    status: 'pending',
    createdAt: now,
    completedAt: null,
  };
}
