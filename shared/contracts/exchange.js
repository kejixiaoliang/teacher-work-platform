export const EXCHANGE_FORMAT = 'teacher-work-backup';
export const EXCHANGE_FORMAT_VERSION = 1;

export const EXCHANGE_COLLECTIONS = Object.freeze([
  'classes', 'students', 'studentHistory', 'seats', 'seatLayouts', 'documents',
  'duties', 'exams', 'scores', 'attendance', 'studentRecords', 'leaves', 'contacts',
  'assessment', 'followUpTasks', 'settings',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSESSMENT_COLLECTIONS = Object.freeze(['categories', 'items', 'records', 'revisions']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validateRows(name, rows, errors) {
  if (!Array.isArray(rows)) {
    errors.push(`content.${name} 必须是数组`);
    return;
  }
  const uuids = new Set();
  rows.forEach((row, index) => {
    if (!isObject(row)) {
      errors.push(`content.${name}[${index}] 必须是对象`);
      return;
    }
    if (!isUuid(row.uuid)) {
      errors.push(`content.${name}[${index}].uuid 无效`);
      return;
    }
    if (uuids.has(row.uuid)) errors.push(`content.${name} 存在重复 uuid：${row.uuid}`);
    uuids.add(row.uuid);
  });
}

export function validateExchangeEnvelope(payload) {
  const errors = [];
  if (!isObject(payload)) return { ok: false, errors: ['交换包必须是对象'] };

  if (payload.format !== EXCHANGE_FORMAT) errors.push('format 不匹配');
  if (payload.formatVersion !== EXCHANGE_FORMAT_VERSION) errors.push('formatVersion 不支持');
  if (typeof payload.appVersion !== 'string' || !payload.appVersion.trim()) errors.push('appVersion 无效');
  if (!Number.isSafeInteger(payload.databaseVersion) || payload.databaseVersion < 1) errors.push('databaseVersion 无效');
  if (!isUuid(payload.exportId)) errors.push('exportId 无效');
  if (typeof payload.exportedAt !== 'string' || !Number.isFinite(Date.parse(payload.exportedAt))) errors.push('exportedAt 无效');
  if (!isObject(payload.source)) errors.push('source 必须是对象');
  if (!isObject(payload.content)) errors.push('content 必须是对象');
  if (!isObject(payload.attachments)) {
    errors.push('attachments 必须是对象');
  } else {
    if (typeof payload.attachments.included !== 'boolean') errors.push('attachments.included 无效');
    if (!Number.isSafeInteger(payload.attachments.omittedCount) || payload.attachments.omittedCount < 0) {
      errors.push('attachments.omittedCount 无效');
    }
  }
  if (!isObject(payload.integrity)) errors.push('integrity 必须是对象');

  if (!isObject(payload.content)) return { ok: errors.length === 0, errors };
  for (const name of EXCHANGE_COLLECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(payload.content, name)) {
      errors.push(`content 缺少集合：${name}`);
      continue;
    }
    if (name === 'settings') {
      if (!isObject(payload.content[name])) errors.push('content.settings 必须是对象');
    } else if (name === 'assessment') {
      const assessment = payload.content[name];
      if (!isObject(assessment)) {
        errors.push('content.assessment 必须是对象');
      } else {
        for (const child of ASSESSMENT_COLLECTIONS) {
          if (!Object.prototype.hasOwnProperty.call(assessment, child)) errors.push(`content.assessment 缺少集合：${child}`);
          else validateRows(`assessment.${child}`, assessment[child], errors);
        }
      }
    } else {
      validateRows(name, payload.content[name], errors);
    }
  }
  return { ok: errors.length === 0, errors };
}
