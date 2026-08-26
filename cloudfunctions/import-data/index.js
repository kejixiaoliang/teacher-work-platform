const { validateExchangeEnvelope } = require('./exchange-contract.cjs');
const { commitImport } = require('./import-plan.cjs');
const crypto = require('node:crypto');

function parsePayload(event) {
  if (typeof event?.payload === 'string') {
    try {
      return { payload: JSON.parse(event.payload) };
    } catch {
      return { error: { code: 'INVALID_JSON', errors: ['payload 不是合法 JSON'] } };
    }
  }
  return { payload: event?.payload };
}

function countRows(content, name) {
  if (name === 'assessment') {
    return Object.values(content.assessment || {}).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0);
  }
  return Array.isArray(content[name]) ? content[name].length : 0;
}

function precheckImport(event) {
  const parsed = parsePayload(event);
  if (parsed.error) return { ok: false, stage: 'precheck', ...parsed.error };

  const result = validateExchangeEnvelope(parsed.payload);
  if (!result.ok) {
    return { ok: false, stage: 'precheck', code: 'INVALID_EXCHANGE_PAYLOAD', errors: result.errors };
  }

  return {
    ok: true,
    stage: 'precheck',
    counts: {
      classes: countRows(parsed.payload.content, 'classes'),
      students: countRows(parsed.payload.content, 'students'),
    },
    omittedAttachmentCount: parsed.payload.attachments.omittedCount,
    errors: [],
  };
}

function previewImport(event) {
  const parsed = parsePayload(event);
  if (parsed.error) return { ok: false, stage: 'preview', ...parsed.error };
  const payload = parsed.payload;
  const validation = validateExchangeEnvelope(payload);
  if (!validation.ok) return { ok: false, stage: 'preview', code: 'INVALID_EXCHANGE_PAYLOAD', errors: validation.errors };
  return {
    ok: true,
    stage: 'preview',
    sourceExportId: payload.exportId,
    sourceAppVersion: payload.appVersion,
    counts: { classes: payload.content.classes.length, students: payload.content.students.length },
    omittedAttachmentCount: payload.attachments.omittedCount,
    datasetId: event.datasetId || crypto.randomUUID(),
    errors: [],
  };
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, stage: 'auth', code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  if (event?.action === 'preview') return previewImport(event);
  if (event?.action === 'commit') {
    const parsed = parsePayload(event);
    if (parsed.error) return { ok: false, stage: 'commit', ...parsed.error };
    const datasetId = typeof event.datasetId === 'string' && event.datasetId.trim() ? event.datasetId.trim() : crypto.randomUUID();
    return commitImport({ db: cloud.database(), payload: parsed.payload, ownerId: context.OPENID, datasetId, now: new Date().toISOString() });
  }
  return precheckImport(event);
}

module.exports = { main, precheckImport, previewImport };
