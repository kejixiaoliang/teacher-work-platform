const crypto = require('node:crypto');
const { validateExchangeEnvelope } = require('./exchange-contract.cjs');

function assertText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} 必须是非空字符串`);
}

function cloudRecord(row, ownerId, datasetId, importBatchId, now) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('业务记录必须是对象');
  const { id, uuid, ownerId: ignoredOwnerId, ...businessFields } = row;
  if (typeof uuid !== 'string' || !uuid.trim()) throw new TypeError('业务记录缺少 uuid');
  return {
    ...businessFields,
    uuid,
    ownerId,
    datasetId,
    sourceImportBatchId: importBatchId,
    createdAt: row.createdAt || now,
    updatedAt: row.updatedAt || now,
    deletedAt: row.deletedAt || null,
    revision: Number.isSafeInteger(row.revision) && row.revision >= 1 ? row.revision : 1,
    source: 'import',
    _openid: ownerId,
    ...(Number.isSafeInteger(id) ? { legacyId: id } : {}),
  };
}

function buildImportPlan({ payload, ownerId, datasetId, now }) {
  assertText(ownerId, 'ownerId');
  assertText(datasetId, 'datasetId');
  assertText(now, 'now');
  const validation = validateExchangeEnvelope(payload);
  if (!validation.ok) return { ok: false, code: 'INVALID_EXCHANGE_PAYLOAD', errors: validation.errors };

  const importBatchId = crypto.randomUUID();
  const classes = payload.content.classes.map((row) => cloudRecord(row, ownerId, datasetId, importBatchId, now));
  const students = payload.content.students.map((row) => cloudRecord(row, ownerId, datasetId, importBatchId, now));
  return {
    ok: true,
    dataset: {
      datasetId,
      ownerId,
      _openid: ownerId,
      name: `导入数据集 ${payload.exportId.slice(0, 8)}`,
      sourceImportBatchId: importBatchId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    batch: {
      importBatchId,
      ownerId,
      _openid: ownerId,
      sourceExportId: payload.exportId,
      sourceAppVersion: payload.appVersion,
      sourceFormatVersion: payload.formatVersion,
      datasetId,
      status: 'pending',
      createdAt: now,
      completedAt: null,
    },
    classes,
    students,
    omittedAttachmentCount: payload.attachments.omittedCount,
  };
}

async function commitImport({ db, payload, ownerId, datasetId, now }) {
  const plan = buildImportPlan({ payload, ownerId, datasetId, now });
  if (!plan.ok) return { ...plan, stage: 'precheck' };
  const duplicate = await db.collection('import_batches').where({ ownerId, sourceExportId: payload.exportId }).get();
  if (duplicate.data.length) return { ok: false, code: 'DUPLICATE_EXPORT', stage: 'commit' };

  let datasetIdRef;
  let batchIdRef;
  try {
    const datasetResult = await db.collection('datasets').add({ data: plan.dataset });
    datasetIdRef = datasetResult._id;
    const batchResult = await db.collection('import_batches').add({ data: plan.batch });
    batchIdRef = batchResult._id;
    for (const row of plan.classes) await db.collection('classes').add({ data: row });
    for (const row of plan.students) await db.collection('students').add({ data: row });
    await db.collection('import_batches').doc(batchIdRef).update({ data: { status: 'completed', completedAt: now } });
    await db.collection('datasets').doc(datasetIdRef).update({ data: { status: 'active', updatedAt: now } });
    return {
      ok: true,
      stage: 'commit',
      datasetId,
      importBatchId: plan.batch.importBatchId,
      counts: { classes: plan.classes.length, students: plan.students.length },
      omittedAttachmentCount: plan.omittedAttachmentCount,
    };
  } catch (error) {
    if (batchIdRef) await db.collection('import_batches').doc(batchIdRef).update({ data: { status: 'failed', completedAt: now, errorCode: 'IMPORT_FAILED' } });
    if (datasetIdRef) await db.collection('datasets').doc(datasetIdRef).update({ data: { status: 'failed', updatedAt: now } });
    return { ok: false, stage: 'commit', code: 'IMPORT_FAILED', errors: ['导入过程中发生错误，批次已标记为失败'] };
  }
}

module.exports = { buildImportPlan, commitImport };
