const MAX_STUDENT_FILE_BYTES = 5 * 1024 * 1024;

const FIELD_ALIASES = {
  school_no: ['学号', '学生学号'],
  name: ['姓名', '学生姓名', '姓名必填'],
  gender: ['性别', '性别男/女'],
  birth_date: ['出生日期', '生日'],
  phone: ['联系电话', '电话', '学生电话'],
  parent_phone: ['家长电话', '家长联系电话'],
  is_boarding: ['是否住宿', '是否住宿是/否', '住宿'],
  interest_duty: ['兴趣特长/职务', '兴趣特长', '职务/特长'],
  health_note: ['健康状况/过敏史', '健康状况', '健康情况'],
  height_cm: ['身高cm', '身高', '身高cm'],
  vision_left: ['左眼视力', '左眼'],
  vision_right: ['右眼视力', '右眼'],
  is_myopia: ['是否近视', '是否近视是/否', '近视'],
  grade_level: ['成绩等级', '成绩等级优/良/中/待提高', '成绩'],
  seat_note: ['特殊座位需求', '座位需求'],
  remark: ['备注'],
};

const FIELD_ORDER = Object.keys(FIELD_ALIASES);
const YES_VALUES = new Set(['是', 'true', '1', 'y', 'yes', '√', '✓', '有']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStudentHeader(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[\s*：:（）()【】\[\]<>]/g, '').toLowerCase();
}

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) ALIAS_TO_FIELD.set(normalizeStudentHeader(alias), field);
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const normalized = text(value).replace(/厘米|cm/gi, '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value) {
  if (typeof value === 'boolean') return value;
  return YES_VALUES.has(text(value).toLowerCase());
}

function parseCsv(textValue) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(textValue || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  row.push(cell);
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows;
}

function detectHeader(rows) {
  let best = null;
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const columnMap = {};
    let matched = 0;
    rows[rowIndex].forEach((value, columnIndex) => {
      const field = ALIAS_TO_FIELD.get(normalizeStudentHeader(value));
      if (field && columnMap[field] == null) { columnMap[field] = columnIndex; matched += 1; }
    });
    if (columnMap.name != null && (!best || matched > best.matched)) best = { rowIndex, columnMap, matched };
  }
  if (!best) throw new Error('未识别到学生名单表头，请使用桌面端模板并另存为 CSV');
  return best;
}

function normalizeRecord(input = {}, rowNumber) {
  const value = (...keys) => {
    for (const key of keys) if (input[key] != null) return input[key];
    return '';
  };
  const record = {
    _row: rowNumber,
    school_no: text(value('school_no', 'schoolNo')),
    name: text(value('name')),
    gender: text(value('gender')) || '男',
    birth_date: text(value('birth_date', 'birthDate')),
    phone: text(value('phone')),
    parent_phone: text(value('parent_phone', 'parentPhone')),
    is_boarding: bool(value('is_boarding', 'isBoarding')),
    interest_duty: text(value('interest_duty', 'interestDuty')),
    health_note: text(value('health_note', 'healthNote')),
    height_cm: number(value('height_cm', 'heightCm')),
    vision_left: number(value('vision_left', 'visionLeft')),
    vision_right: number(value('vision_right', 'visionRight')),
    is_myopia: bool(value('is_myopia', 'isMyopia')),
    grade_level: text(value('grade_level', 'gradeLevel')),
    seat_note: text(value('seat_note', 'seatNote')),
    remark: text(value('remark')),
  };
  const uuid = text(value('uuid'));
  if (UUID_PATTERN.test(uuid)) record.uuid = uuid;
  return record;
}

function identity(record) {
  const schoolNo = text(record.school_no ?? record.schoolNo).toLowerCase();
  if (schoolNo) return { key: `school:${schoolNo}`, label: `学号 ${text(record.school_no ?? record.schoolNo)}` };
  const name = text(record.name).toLowerCase();
  const birthDate = text(record.birth_date ?? record.birthDate);
  if (birthDate) return { key: `name-birth:${name}|${birthDate}`, label: `姓名和出生日期 ${text(record.name)} / ${birthDate}` };
  return { key: '', label: '' };
}

export function precheckStudentRows(rows = [], existingStudents = []) {
  const accepted = [];
  const fails = [];
  const existingKeys = new Set(existingStudents.filter((item) => text(item.name)).map((item) => identity(item).key).filter(Boolean));
  const fileKeys = new Set();
  for (const record of rows) {
    if (!text(record.name)) { fails.push({ row: record._row, reason: '姓名为空，请填写姓名列' }); continue; }
    const itemIdentity = identity(record);
    if (itemIdentity.key && fileKeys.has(itemIdentity.key)) {
      fails.push({ row: record._row, name: record.name, reason: `${itemIdentity.label} 在文件中重复` });
      continue;
    }
    if (itemIdentity.key) fileKeys.add(itemIdentity.key);
    if (itemIdentity.key && existingKeys.has(itemIdentity.key)) {
      fails.push({ row: record._row, name: record.name, reason: `${itemIdentity.label} 已存在于当前班级` });
      continue;
    }
    accepted.push(record);
  }
  return { rows: accepted, fails };
}

export function parseStudentRosterText(payload, { fileName = '', existingStudents = [] } = {}) {
  const lowerName = String(fileName).toLowerCase();
  let format;
  let rows;
  if (lowerName.endsWith('.json')) {
    let parsed;
    try { parsed = JSON.parse(String(payload || '')); } catch { throw new Error('文件不是合法 JSON'); }
    if (parsed?.format !== 'teacher-work-student-roster' || parsed?.formatVersion !== 1 || !Array.isArray(parsed.students)) {
      throw new Error('JSON 不是 teacher-work-student-roster v1 学生名单');
    }
    format = 'json';
    rows = parsed.students.map((student, index) => normalizeRecord(student, index + 1));
  } else if (lowerName.endsWith('.csv')) {
    format = 'csv';
    const csvRows = parseCsv(payload);
    const header = detectHeader(csvRows);
    rows = csvRows.slice(header.rowIndex + 1).map((values, index) => ({ values, rowNumber: header.rowIndex + index + 2 }))
      .filter(({ values }) => values.some((value) => text(value) !== ''))
      .map(({ values, rowNumber }) => {
      const input = {};
      for (const field of FIELD_ORDER) input[field] = values[header.columnMap[field]] ?? '';
      return normalizeRecord(input, rowNumber);
    });
  } else {
    throw new Error('仅支持学生名单 CSV 或规范 JSON 文件');
  }
  const checked = precheckStudentRows(rows, existingStudents);
  return { format, rows: checked.rows, fails: checked.fails, total: rows.length };
}

function readFile(filePath) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath, encoding: 'utf8', success: (result) => resolve(result.data), fail: reject,
  }));
}

export function chooseStudentRosterFile() {
  return new Promise((resolve, reject) => wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['csv', 'json'],
    success: (result) => {
      const file = result.tempFiles?.[0];
      if (!file) return reject(new Error('未选择文件'));
      if (file.size > MAX_STUDENT_FILE_BYTES) return reject(new Error('学生名单文件不能超过 5 MB'));
      resolve(file);
    },
    fail: reject,
  }));
}

export async function previewStudentRosterFile(file, existingStudents = []) {
  if (!file?.path) throw new Error('文件路径无效');
  const payload = await readFile(file.path);
  return parseStudentRosterText(payload, { fileName: file.name || file.path, existingStudents });
}

export function buildStudentImportRequest({ datasetId, classUuid, fileName = '', fileFormat = '', rows, precheckFailures = [] } = {}) {
  const scopedDatasetId = String(datasetId || '').trim();
  const scopedClassUuid = String(classUuid || '').trim();
  if (!scopedDatasetId) throw new Error('请先选择数据集');
  if (!scopedClassUuid) throw new Error('请先选择班级');
  if (!Array.isArray(rows) || !rows.length) throw new Error('没有可导入的学生');
  if (!Array.isArray(precheckFailures)) throw new Error('预检失败明细格式无效');
  if (rows.length + precheckFailures.length > 200) throw new Error('单次最多处理 200 行学生数据');
  return {
    action: 'import', datasetId: scopedDatasetId, classUuid: scopedClassUuid,
    fileName: String(fileName || '').trim() || '学生名单',
    fileFormat: ['csv', 'json'].includes(fileFormat) ? fileFormat : 'unknown',
    students: rows,
    precheckFailures: precheckFailures.map((failure) => ({
      row: Number(failure.row) || 0,
      name: String(failure.name || '').slice(0, 80),
      reason: String(failure.reason || '预检失败').slice(0, 200),
    })),
  };
}

export function mergeStudentImportResult({ total = 0, localFails = [], response = {} } = {}) {
  const success = Array.isArray(response.success) ? response.success : [];
  const failMap = new Map();
  for (const failure of [...(Array.isArray(localFails) ? localFails : []), ...(Array.isArray(response.fail) ? response.fail : [])]) {
    const normalized = { row: Number(failure.row) || 0, name: String(failure.name || ''), reason: String(failure.reason || '导入失败') };
    failMap.set(`${normalized.row}|${normalized.name}|${normalized.reason}`, normalized);
  }
  const fail = [...failMap.values()];
  return {
    ok: response.ok === true,
    success,
    fail,
    counts: { total, success: success.length, failed: fail.length },
  };
}

function chinaTime(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

export function normalizeStudentImportHistory(response = {}) {
  if (response?.ok !== true || !Array.isArray(response.records)) {
    return { ok: false, error: response?.errors?.[0] || '导入历史返回格式无效', records: [] };
  }
  return {
    ok: true,
    error: '',
    records: response.records.map((record) => ({
      importBatchId: String(record.importBatchId || ''),
      fileName: String(record.sourceFileName || '学生名单'),
      fileFormat: ['csv', 'json'].includes(record.sourceFormat) ? record.sourceFormat : 'unknown',
      resultStatus: ['completed', 'partial', 'failed'].includes(record.resultStatus) ? record.resultStatus : 'completed',
      totalCount: Number(record.totalCount) || 0,
      successCount: Number(record.successCount) || 0,
      failedCount: Number(record.failedCount) || 0,
      failures: (Array.isArray(record.failures) ? record.failures : []).slice(0, 50).map((failure) => ({
        row: Number(failure.row) || 0,
        name: String(failure.name || ''),
        reason: String(failure.reason || '导入失败'),
      })),
      createdAtText: chinaTime(record.createdAt),
    })),
  };
}

export { MAX_STUDENT_FILE_BYTES };
