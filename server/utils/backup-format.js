import crypto from 'node:crypto';

export const EXCHANGE_FORMAT = 'teacher-work-backup';
export const EXCHANGE_FORMAT_VERSION = 2;
export const SUPPORTED_EXCHANGE_FORMAT_VERSIONS = Object.freeze([1, 2]);

export const EXCHANGE_COLLECTIONS = Object.freeze([
  'classes', 'students', 'studentHistory', 'seats', 'seatLayouts', 'documents',
  'duties', 'exams', 'scores', 'attendance', 'studentRecords', 'leaves', 'contacts',
  'assessment', 'followUpTasks', 'settings',
  'studentFieldDefinitions', 'studentFieldValues', 'classDisplayLabels', 'subjectTemplates',
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('备份包含无效数字');
  return JSON.stringify(value);
}

export function integrityValue(payload) {
  const copy = structuredClone(payload);
  copy.integrity = { ...(copy.integrity || {}), value: '' };
  return crypto.createHash('sha256').update(canonicalize(copy), 'utf8').digest('hex');
}

export function attachIntegrity(payload) {
  const next = structuredClone(payload);
  next.integrity = {
    algorithm: 'sha256',
    scope: 'canonical-json-without-integrity-value',
    value: '',
  };
  next.integrity.value = integrityValue(next);
  return next;
}

export function verifyIntegrity(payload) {
  if (!payload?.integrity || payload.integrity.algorithm !== 'sha256'
    || payload.integrity.scope !== 'canonical-json-without-integrity-value'
    || !/^[a-f0-9]{64}$/.test(payload.integrity.value || '')) return false;
  return integrityValue(payload) === payload.integrity.value;
}

export function stableUuid(tableName, recordId) {
  const digest = crypto.createHash('sha256').update(`teacher-work:${tableName}:${recordId}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${(parseInt(digest.slice(16, 18), 16) & 0x3f | 0x80).toString(16)}${digest.slice(18, 20)}-${digest.slice(20, 32)}`;
}

export function newExportId() {
  return crypto.randomUUID();
}

export function emptyContent() {
  return Object.fromEntries(EXCHANGE_COLLECTIONS.map(name => [name, name === 'settings' ? {} : []]));
}
