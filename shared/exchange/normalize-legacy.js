import crypto from 'node:crypto';
import { EXCHANGE_COLLECTIONS } from '../contracts/exchange.js';

const LEGACY_TABLES = new Set(EXCHANGE_COLLECTIONS.filter((name) => !['assessment', 'settings'].includes(name)));

function emptyContent() {
  return Object.fromEntries(EXCHANGE_COLLECTIONS.map((name) => [
    name,
    name === 'settings'
      ? {}
      : name === 'assessment'
        ? { categories: [], items: [], records: [], revisions: [] }
        : [],
  ]));
}

function legacyUuid(tableName, id) {
  const digest = crypto.createHash('sha256').update(`teacher-work:${tableName}:${id}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${(parseInt(digest.slice(16, 18), 16) & 0x3f | 0x80).toString(16)}${digest.slice(18, 20)}-${digest.slice(20, 32)}`;
}

function normalizeRow(tableName, row, errors) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    errors.push(`${tableName} 存在无效记录`);
    return null;
  }
  if (!row.uuid && !Number.isSafeInteger(row.id)) {
    errors.push(`${tableName} 记录缺少 id 或 uuid`);
    return null;
  }
  const { id, ...businessFields } = row;
  return {
    ...businessFields,
    uuid: row.uuid || legacyUuid(tableName, id),
    ...(Number.isSafeInteger(id) ? { legacyId: id } : {}),
  };
}

function normalizeCurrent(payload) {
  const content = emptyContent();
  const input = payload.content && typeof payload.content === 'object' ? payload.content : {};
  for (const name of EXCHANGE_COLLECTIONS) {
    if (name === 'settings') content.settings = input.settings && typeof input.settings === 'object' ? structuredClone(input.settings) : {};
    else if (name === 'assessment') {
      const assessment = input.assessment && typeof input.assessment === 'object' ? input.assessment : {};
      for (const child of ['categories', 'items', 'records', 'revisions']) {
        content.assessment[child] = Array.isArray(assessment[child]) ? structuredClone(assessment[child]) : [];
      }
    } else if (Array.isArray(input[name])) content[name] = structuredClone(input[name]);
  }
  return {
    ok: true,
    source: { format: payload.format, formatVersion: payload.formatVersion, appVersion: payload.appVersion || '' },
    content,
    warnings: [],
    errors: [],
  };
}

export function normalizeLegacyPayload(payload) {
  if (payload?.format === 'teacher-work-backup' && payload.formatVersion === 1) return normalizeCurrent(payload);

  const errors = [];
  const warnings = [];
  if (payload?.app !== 'teacher-work' || ![1, 2].includes(payload?.version) || !Array.isArray(payload?.tables)) {
    return { ok: false, source: { format: 'unknown' }, content: emptyContent(), warnings, errors: ['不是受支持的 legacy tables v1/v2 格式'] };
  }

  const content = emptyContent();
  const groups = new Map();
  for (const group of payload.tables) {
    if (!group || typeof group.table !== 'string' || !Array.isArray(group.rows)) {
      errors.push('legacy tables 存在无效数据表');
      continue;
    }
    if (!LEGACY_TABLES.has(group.table)) {
      warnings.push(`忽略未知数据表：${group.table}`);
      continue;
    }
    groups.set(group.table, group.rows);
  }

  const classUuidById = new Map();
  for (const row of groups.get('classes') || []) {
    const normalized = normalizeRow('classes', row, errors);
    if (!normalized) continue;
    content.classes.push(normalized);
    if (Number.isSafeInteger(row.id)) classUuidById.set(row.id, normalized.uuid);
  }

  for (const [tableName, rows] of groups) {
    if (tableName === 'classes') continue;
    for (const row of rows) {
      const normalized = normalizeRow(tableName, row, errors);
      if (!normalized) continue;
      if (tableName === 'students' && row.class_id !== undefined) {
        const classUuid = classUuidById.get(row.class_id);
        if (!classUuid) {
          errors.push(`students 记录 class_id=${row.class_id} 无法解析父班级`);
          continue;
        }
        normalized.classUuid = classUuid;
        delete normalized.class_id;
      }
      content[tableName].push(normalized);
    }
  }

  return {
    ok: errors.length === 0,
    source: { format: 'legacy-tables', formatVersion: payload.version },
    content,
    warnings,
    errors,
  };
}
