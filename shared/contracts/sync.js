import crypto from 'node:crypto';
import { EXCHANGE_COLLECTIONS } from './exchange.js';

const SYNC_OPERATIONS = Object.freeze(['upsert', 'delete']);
const QUEUE_STATUSES = Object.freeze(['pending', 'sent', 'acked', 'conflict', 'failed']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNC_COLLECTIONS = new Set([...EXCHANGE_COLLECTIONS.filter((name) => name !== 'settings'), 'assessment.categories', 'assessment.items', 'assessment.records', 'assessment.revisions']);

function isUuid(value) { return typeof value === 'string' && UUID_PATTERN.test(value); }
function isIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

export function validateSyncCursor(cursor) {
  const errors = [];
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return { ok: false, errors: ['同步游标必须是对象'] };
  if (typeof cursor.datasetId !== 'string' || !cursor.datasetId.trim()) errors.push('同步游标缺少 datasetId');
  if (cursor.updatedAt !== null && cursor.updatedAt !== undefined && !isIso(cursor.updatedAt)) errors.push('同步游标 updatedAt 无效');
  if (cursor.changeId !== null && cursor.changeId !== undefined && !isUuid(cursor.changeId)) errors.push('同步游标 changeId 无效');
  return { ok: errors.length === 0, errors };
}

export function buildSyncChange({ collection, operation = 'upsert', record, clientId, baseRevision = null, now = new Date().toISOString() } = {}) {
  if (!SYNC_COLLECTIONS.has(collection)) throw new TypeError('同步集合不在白名单中');
  if (!SYNC_OPERATIONS.includes(operation)) throw new TypeError('同步操作不支持');
  if (!record || typeof record !== 'object' || Array.isArray(record) || !isUuid(record.uuid)) throw new TypeError('同步记录必须包含稳定 uuid');
  if (typeof record.datasetId !== 'string' || !record.datasetId.trim()) throw new TypeError('同步记录必须包含 datasetId');
  if (typeof clientId !== 'string' || !clientId.trim()) throw new TypeError('clientId 不能为空');
  if (!isIso(now)) throw new TypeError('now 必须是有效时间');
  if (baseRevision !== null && (!Number.isSafeInteger(baseRevision) || baseRevision < 0)) throw new TypeError('baseRevision 无效');
  return { changeId: crypto.randomUUID(), clientId: clientId.trim(), collection, operation, record: { ...record }, baseRevision, occurredAt: now };
}

export function createSyncQueueEntry(change, { status = 'pending', attempts = 0, lastError = '' } = {}) {
  if (!change || !isUuid(change.changeId)) throw new TypeError('changeId 无效');
  if (!QUEUE_STATUSES.includes(status)) throw new TypeError('同步队列状态不支持');
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new TypeError('同步重试次数无效');
  return { ...change, queueStatus: status, attempts, lastError: String(lastError || ''), queuedAt: new Date().toISOString() };
}

export function detectSyncConflict({ incoming, current } = {}) {
  if (!incoming || !current || incoming.record?.uuid !== current.uuid) return { conflict: false, reason: '' };
  const base = incoming.baseRevision;
  const revision = current.revision;
  if (base === null || base === undefined || !Number.isSafeInteger(revision)) return { conflict: false, reason: '' };
  return revision > base ? { conflict: true, reason: 'SERVER_REVISION_AHEAD', serverRevision: revision, baseRevision: base } : { conflict: false, reason: '' };
}

export { QUEUE_STATUSES, SYNC_COLLECTIONS, SYNC_OPERATIONS };
