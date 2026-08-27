const MAX_SCORE_FILE_BYTES = 5 * 1024 * 1024;

function text(value) {
  return String(value ?? '').trim();
}

function parseCsv(payload) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(payload || '').replace(/^\uFEFF/, '');
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

function studentIndexes(students) {
  const byUuid = new Map();
  const bySchoolNo = new Map();
  const byName = new Map();
  for (const student of students) {
    if (student.uuid) byUuid.set(text(student.uuid), student);
    const schoolNo = text(student.schoolNo ?? student.school_no).toLowerCase();
    if (schoolNo) bySchoolNo.set(schoolNo, student);
    const name = text(student.name);
    if (name) {
      if (byName.has(name)) byName.set(name, null);
      else byName.set(name, student);
    }
  }
  return { byUuid, bySchoolNo, byName };
}

function resolveStudent(input, indexes) {
  const uuid = text(input.studentUuid);
  if (uuid && indexes.byUuid.has(uuid)) return indexes.byUuid.get(uuid);
  const schoolNo = text(input.schoolNo).toLowerCase();
  if (schoolNo && indexes.bySchoolNo.has(schoolNo)) return indexes.bySchoolNo.get(schoolNo);
  const name = text(input.studentName);
  return name ? indexes.byName.get(name) || null : null;
}

function normalizeEntries(entries, { students = [], subjects = [] } = {}) {
  const allowedSubjects = new Set(subjects.map(text).filter(Boolean));
  const indexes = studentIndexes(students);
  const seen = new Set();
  const rows = [];
  const fails = [];
  for (const entry of entries) {
    const row = Number(entry.row) || 0;
    const subject = text(entry.subject);
    const label = text(entry.schoolNo) || text(entry.studentName) || `第${row}行`;
    if (!allowedSubjects.has(subject)) {
      fails.push({ row, name: label, subject, reason: `科目“${subject}”不属于当前考试` });
      continue;
    }
    const student = resolveStudent(entry, indexes);
    if (!student) {
      fails.push({ row, name: label, subject, reason: '未匹配到当前班级学生' });
      continue;
    }
    if (entry.score == null || text(entry.score) === '') {
      fails.push({ row, name: student.name || label, subject, reason: '成绩为空' });
      continue;
    }
    const score = Number(entry.score);
    if (!Number.isFinite(score)) {
      fails.push({ row, name: student.name || label, subject, reason: `成绩“${text(entry.score)}”不是有效数字` });
      continue;
    }
    if (score < 0 || score > 150) {
      fails.push({ row, name: student.name || label, subject, reason: '成绩必须在 0 到 150 分之间' });
      continue;
    }
    const key = `${student.uuid}:${subject}`;
    if (seen.has(key)) {
      fails.push({ row, name: student.name || label, subject, reason: '同一学生和科目在文件中重复' });
      continue;
    }
    seen.add(key);
    rows.push({ row, studentUuid: student.uuid, studentName: student.name || label, subject, score });
  }
  return { rows, fails, total: entries.length };
}

export function parseScoreExchangeText(payload, { fileName = '', students = [], subjects = [] } = {}) {
  const lowerName = String(fileName).toLowerCase();
  if (!subjects.length) throw new Error('当前考试没有可导入的科目');
  let format;
  let entries = [];
  if (lowerName.endsWith('.json')) {
    let parsed;
    try { parsed = JSON.parse(String(payload || '')); } catch { throw new Error('文件不是合法 JSON'); }
    if (parsed?.format !== 'teacher-work-score-exchange' || parsed?.formatVersion !== 1 || !Array.isArray(parsed.rows)) {
      throw new Error('JSON 不是 teacher-work-score-exchange v1 成绩文件');
    }
    format = 'json';
    entries = parsed.rows.map((item, index) => ({
      row: index + 1,
      studentUuid: item.studentUuid,
      studentName: item.studentName,
      schoolNo: item.schoolNo ?? item.school_no,
      subject: item.subject,
      score: item.score,
    }));
  } else if (lowerName.endsWith('.csv')) {
    format = 'csv';
    const csvRows = parseCsv(payload);
    const header = (csvRows[0] || []).map(text);
    const noColumn = header.findIndex((value) => ['学号', 'number', 'no'].includes(value.toLowerCase()));
    const nameColumn = header.findIndex((value) => ['姓名', '名字', '学生', 'name'].includes(value.toLowerCase()));
    if (noColumn < 0 && nameColumn < 0) throw new Error('未找到学号/姓名列（表头请包含“学号”或“姓名”）');
    const subjectColumns = subjects.map((subject) => ({ subject, column: header.indexOf(subject) })).filter((item) => item.column >= 0);
    if (!subjectColumns.length) throw new Error('未找到当前考试的科目列');
    for (let index = 1; index < csvRows.length; index += 1) {
      const values = csvRows[index];
      if (!values.some((value) => text(value))) continue;
      for (const { subject, column } of subjectColumns) {
        if (!text(values[column])) continue;
        entries.push({ row: index + 1, schoolNo: values[noColumn], studentName: values[nameColumn], subject, score: values[column] });
      }
    }
  } else {
    throw new Error('仅支持成绩 CSV 或规范 JSON 文件');
  }
  if (entries.length > 500) throw new Error('单次最多处理 500 条成绩');
  return { format, ...normalizeEntries(entries, { students, subjects }) };
}

export function applyScoreImportRows(currentRows = [], importedRows = []) {
  const nextRows = currentRows.map((row) => ({ ...row, values: { ...(row.values || {}) } }));
  const rowByStudent = new Map(nextRows.map((row) => [row.studentUuid, row]));
  let applied = 0;
  for (const item of importedRows) {
    const row = rowByStudent.get(item.studentUuid);
    if (!row) continue;
    row.values[item.subject] = item.score;
    applied += 1;
  }
  return { rows: nextRows, applied };
}

function csvCell(value) {
  let normalized = String(value ?? '');
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

export function buildScoreCsv({ subjects = [], rows = [] } = {}) {
  const lines = [
    ['学号', '姓名', ...subjects],
    ...rows.map((row) => [
      row.schoolNo ?? row.school_no ?? '',
      row.name || '',
      ...subjects.map((subject) => row.values?.[subject] ?? ''),
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
}

function readFile(filePath) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath, encoding: 'utf8', success: (result) => resolve(result.data), fail: reject,
  }));
}

export function chooseScoreExchangeFile() {
  return new Promise((resolve, reject) => wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['csv', 'json'],
    success: (result) => {
      const file = result.tempFiles?.[0];
      if (!file) return reject(new Error('未选择文件'));
      if (file.size > MAX_SCORE_FILE_BYTES) return reject(new Error('成绩文件不能超过 5 MB'));
      resolve(file);
    },
    fail: reject,
  }));
}

export async function previewScoreExchangeFile(file, options = {}) {
  if (!file?.path) throw new Error('文件路径无效');
  return parseScoreExchangeText(await readFile(file.path), { ...options, fileName: file.name || file.path });
}

export function exportScoreCsvFile({ examName = '成绩表', subjects = [], rows = [] } = {}) {
  if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH || typeof wx.shareFileMessage !== 'function') {
    return Promise.reject(new Error('当前微信版本不支持文件分享，请使用规范 JSON 复制'));
  }
  const safeName = text(examName).replace(/[\\/:*?"<>|]/g, '_') || '成绩表';
  const fileName = `成绩表-${safeName}.csv`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({
    filePath,
    data: buildScoreCsv({ subjects, rows }),
    encoding: 'utf8',
    success: () => wx.shareFileMessage({ filePath, fileName, success: () => resolve(filePath), fail: reject }),
    fail: reject,
  }));
}

export { MAX_SCORE_FILE_BYTES };
