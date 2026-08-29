const FIELD_ALIASES = {
  school_no: ['学号', '学生学号'],
  name: ['姓名', '学生姓名', '姓名必填'],
  gender: ['性别', '性别男/女'],
  birth_date: ['出生日期', '生日'],
  phone: ['联系电话', '电话', '学生电话'],
  parent_phone: ['家长电话', '家长联系电话'],
  is_boarding: ['是否住宿', '是否住宿(是/否)', '住宿'],
  interest_duty: ['兴趣特长/职务', '兴趣特长', '职务/特长'],
  health_note: ['健康状况/过敏史', '健康状况', '健康情况'],
  height_cm: ['身高cm', '身高', '身高(cm)'],
  vision_left: ['左眼视力', '左眼'],
  vision_right: ['右眼视力', '右眼'],
  is_myopia: ['是否近视', '是否近视(是/否)', '近视'],
  grade_level: ['成绩等级', '成绩等级优/良/中/待提高', '成绩'],
  seat_note: ['特殊座位需求', '座位需求'],
  remark: ['备注'],
};

const FIELD_ORDER = Object.keys(FIELD_ALIASES);
const YES_VALUES = new Set(['是', 'true', '1', 'y', 'yes', '√', '✓', '有']);

export function normalizeStudentHeader(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[\s*：:（）()【】\[\]<>]/g, '').toLowerCase();
}

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) ALIAS_TO_FIELD.set(normalizeStudentHeader(alias), field);
}

function formatDate(date) {
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function rawCellValue(cell) {
  if (!cell) return '';
  let value = cell.value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) value = value.richText.map(part => part?.text || '').join('');
    else if (value instanceof Date) value = formatDate(value);
    else if ('text' in value) value = value.text;
    else if ('result' in value) value = value.result;
  }
  if ((value == null || value === '') && cell.text) value = cell.text;
  return value ?? '';
}

function stringValue(cell) {
  return String(rawCellValue(cell)).trim();
}

function numberValue(cell) {
  const value = stringValue(cell).replace(/厘米|cm/gi, '').replace(',', '.').trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(cell) {
  return YES_VALUES.has(stringValue(cell).toLowerCase());
}

function rowHasValues(row, columnMap, order = FIELD_ORDER) {
  return order.some(field => columnMap[field] && stringValue(row.getCell(columnMap[field])) !== '');
}

function detectHeader(ws, aliases = ALIAS_TO_FIELD, order = FIELD_ORDER) {
  let best = null;
  const maxRow = Math.min(ws.rowCount || 0, 10);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const columnMap = {};
    let matched = 0;
    for (let column = 1; column <= Math.max(ws.columnCount || 0, 16); column += 1) {
      const field = aliases.get(normalizeStudentHeader(stringValue(row.getCell(column))));
      if (field && columnMap[field] == null) {
        columnMap[field] = column;
        matched += 1;
      }
    }
    if (columnMap.name && (!best || matched > best.matched)) best = { rowNumber, columnMap, matched };
  }
  if (best) return { ...best, warning: '' };
  return {
    rowNumber: 1,
    columnMap: Object.fromEntries(order.map((field, index) => [field, index + 1])),
    warning: '未识别到标准表头，已按模板 A-P 列读取；请使用“下载导入模板”生成的表头。',
  };
}

export function parseStudentWorksheet(ws, configuredFields = null) {
  const aliases = new Map(ALIAS_TO_FIELD);
  const configured = Array.isArray(configuredFields) ? configuredFields.filter(field => field?.enabled !== false) : [];
  for (const field of configured) {
    if (field.fieldKey && field.label) aliases.set(normalizeStudentHeader(field.label), field.fieldKey);
  }
  const order = configured.length ? configured.map(field => field.fieldKey) : FIELD_ORDER;
  const header = detectHeader(ws, aliases, order);
  const rows = [];
  const fails = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= (ws.rowCount || 0); rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    if (!rowHasValues(row, header.columnMap, order)) continue;
    const cell = field => header.columnMap[field] ? row.getCell(header.columnMap[field]) : null;
    const record = {
      _row: rowNumber,
      school_no: stringValue(cell('school_no')),
      name: stringValue(cell('name')),
      gender: stringValue(cell('gender')) || '男',
      birth_date: stringValue(cell('birth_date')),
      phone: stringValue(cell('phone')),
      parent_phone: stringValue(cell('parent_phone')),
      is_boarding: booleanValue(cell('is_boarding')),
      interest_duty: stringValue(cell('interest_duty')),
      health_note: stringValue(cell('health_note')),
      height_cm: numberValue(cell('height_cm')),
      vision_left: numberValue(cell('vision_left')),
      vision_right: numberValue(cell('vision_right')),
      is_myopia: booleanValue(cell('is_myopia')),
      grade_level: stringValue(cell('grade_level')),
      seat_note: stringValue(cell('seat_note')),
      remark: stringValue(cell('remark')),
    };
    record.customFields = Object.fromEntries(order.filter(field => !FIELD_ORDER.includes(field) && header.columnMap[field] != null)
      .map(field => [field, stringValue(cell(field))]));
    if (!record.name) fails.push({ row: rowNumber, reason: '姓名为空，请填写姓名列' });
    else rows.push(record);
  }
  return { rows, fails, warning: header.warning, headerRow: header.rowNumber };
}
