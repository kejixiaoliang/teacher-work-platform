const ExcelJS = require('exceljs');

const MAX_BASE64_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 500;
const STUDENT_COLUMNS = [
  ['school_no', '学号'], ['name', '姓名'], ['gender', '性别'], ['birth_date', '出生日期'],
  ['phone', '联系电话'], ['parent_phone', '家长电话'], ['is_boarding', '是否住宿'],
  ['interest_duty', '兴趣特长/职务'], ['health_note', '健康状况/过敏史'], ['height_cm', '身高cm'],
  ['vision_left', '左眼视力'], ['vision_right', '右眼视力'], ['is_myopia', '是否近视'],
  ['grade_level', '成绩等级'], ['seat_note', '特殊座位需求'], ['remark', '备注'], ['uuid', '稳定 UUID'],
];

function text(value) { return String(value ?? '').trim(); }
function safeCell(value) { const valueText = text(value); return /^[=+\-@]/.test(valueText) ? `'${valueText}` : valueText; }
function normalizeHeader(value) { return text(value).normalize('NFKC').replace(/[\s*：:（）()【】\[\]<>]/g, '').toLowerCase(); }
function cellValue(cell) { return cell?.value?.text ?? cell?.value?.result ?? cell?.value ?? ''; }
function worksheetRows(worksheet) {
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => { values[column - 1] = cellValue(cell); });
    rows.push({ rowNumber, values });
  });
  return rows;
}
function detectHeader(rows, aliases) {
  let best = null;
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const columnMap = {};
    rows[index].values.forEach((value, column) => { const field = aliases.get(normalizeHeader(value)); if (field && columnMap[field] == null) columnMap[field] = column; });
    if (columnMap.name != null && (!best || Object.keys(columnMap).length > Object.keys(best.columnMap).length)) best = { rowIndex: index, columnMap };
  }
  if (!best) throw new Error('未识别到 Excel 表头，请使用教师工作台模板');
  return best;
}
function parseStudentRows(rows) {
  const aliases = new Map();
  STUDENT_COLUMNS.forEach(([field, label]) => aliases.set(normalizeHeader(label), field));
  aliases.set('学生姓名', 'name'); aliases.set('学生学号', 'school_no');
  const header = detectHeader(rows, aliases);
  const result = [];
  for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
    const values = rows[index].values;
    if (!values.some((value) => text(value))) continue;
    const row = { _row: rows[index].rowNumber };
    for (const field of new Set(aliases.values())) row[field] = safeCell(values[header.columnMap[field]]);
    if (!text(row.name)) row._error = '姓名为空';
    result.push(row);
  }
  if (result.length > MAX_ROWS) throw new Error(`单次最多处理 ${MAX_ROWS} 行学生数据`);
  return result;
}
function parseScoreRows(rows) {
  const header = rows[0]?.values || [];
  const normalized = header.map(normalizeHeader);
  const noColumn = normalized.findIndex((value) => ['学号', '学生学号', 'number', 'no'].includes(value));
  const nameColumn = normalized.findIndex((value) => ['姓名', '学生姓名', '学生', 'name'].includes(value));
  if (noColumn < 0 && nameColumn < 0) throw new Error('未找到学号或姓名列');
  const subjectColumns = header.map((value, column) => ({ subject: text(value), column })).filter((item) => item.subject && item.column !== noColumn && item.column !== nameColumn);
  if (!subjectColumns.length) throw new Error('未找到成绩科目列');
  const result = [];
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index].values;
    if (!values.some((value) => text(value))) continue;
    for (const { subject, column } of subjectColumns) if (text(values[column])) result.push({ row: rows[index].rowNumber, schoolNo: safeCell(values[noColumn]), studentName: safeCell(values[nameColumn]), subject: safeCell(subject), score: values[column] });
  }
  if (result.length > MAX_ROWS) throw new Error(`单次最多处理 ${MAX_ROWS} 条成绩`);
  return result;
}
async function parseWorkbook(base64, kind) {
  const buffer = Buffer.from(String(base64 || ''), 'base64');
  if (!buffer.length || buffer.length > MAX_BASE64_BYTES) throw new Error('Excel 文件不能为空且不能超过 8 MB');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel 文件没有工作表');
  const rows = worksheetRows(worksheet);
  return kind === 'scores' ? parseScoreRows(rows) : parseStudentRows(rows);
}
function addRows(worksheet, headers, rows) {
  worksheet.addRow(headers.map(safeCell));
  rows.slice(0, MAX_ROWS).forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.columns.forEach((column) => { column.width = Math.min(32, Math.max(12, ...worksheet.getColumn(column.number).values.map((value) => text(value).length + 2))); });
}
async function buildStudentWorkbook(rows = []) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('学生名单');
  addRows(worksheet, STUDENT_COLUMNS.map(([, label]) => label), rows.map((row) => STUDENT_COLUMNS.map(([field]) => safeCell(row[field] ?? row[field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]))));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
}
async function buildScoreWorkbook({ subjects = [], rows = [] } = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('成绩');
  addRows(worksheet, ['学号', '姓名', ...subjects], rows.map((row) => [row.schoolNo ?? row.school_no, row.name, ...subjects.map((subject) => row.values?.[subject] ?? '')]));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
}
function normalizeRequest(event = {}) {
  const action = text(event.action);
  if (!['parseStudents', 'parseScores', 'exportStudents', 'exportScores'].includes(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['Excel 操作不支持'] };
  return { ok: true, action };
}
async function main(event = {}) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  if (!cloud.getWXContext()?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const request = normalizeRequest(event);
  if (!request.ok) return request;
  try {
    if (request.action === 'parseStudents' || request.action === 'parseScores') return { ok: true, action: request.action, rows: await parseWorkbook(event.contentBase64, request.action === 'parseScores' ? 'scores' : 'students') };
    if (request.action === 'exportStudents') return { ok: true, action: request.action, fileBase64: await buildStudentWorkbook(Array.isArray(event.rows) ? event.rows : []) };
    return { ok: true, action: request.action, fileBase64: await buildScoreWorkbook({ subjects: Array.isArray(event.subjects) ? event.subjects : [], rows: Array.isArray(event.rows) ? event.rows : [] }) };
  } catch (error) { return { ok: false, code: 'EXCEL_INVALID', errors: [error?.message || 'Excel 文件处理失败'] }; }
}

module.exports = { MAX_BASE64_BYTES, MAX_ROWS, STUDENT_COLUMNS, normalizeHeader, worksheetRows, detectHeader, parseStudentRows, parseScoreRows, parseWorkbook, buildStudentWorkbook, buildScoreWorkbook, normalizeRequest, main };
