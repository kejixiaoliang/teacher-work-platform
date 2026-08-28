export function buildLeaveExchange(records = [], students = [], { datasetId = '', classUuid = '' } = {}) {
  const names = new Map(students.map((student) => [student.uuid, student.name || '未命名学生']));
  return { format: 'teacher-work-leave-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, records: records.map((row) => ({ ...row, studentName: names.get(row.studentUuid) || '未命名学生' })) };
}
export function copyLeaveExchange(payload) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: resolve, fail: reject }));
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

export function decorateLeaveRecords(records = [], students = [], today = localToday()) {
  const names = new Map(students.map((student) => [student.uuid, student.name || '未命名学生']));
  return records.map((row) => ({ ...row, studentName: names.get(row.studentUuid) || '未命名学生', isOverdue: row.status !== '已销假' && Boolean(row.endDate) && row.endDate < today }));
}

export function buildLeaveCsv(records = [], students = []) {
  const studentMap = new Map(students.map((student) => [student.uuid, student]));
  const rows = [['学生姓名', '学号', '类型', '开始日期', '结束日期', '天数', '事由', '状态', '备注'], ...records.map((row) => {
    const student = studentMap.get(row.studentUuid) || {};
    return [student.name || row.studentName || '未命名学生', student.schoolNo || student.school_no || '', row.type, row.startDate, row.endDate, row.days, row.reason, row.status, row.remark];
  })];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function exportLeaveCsvFile(records = [], students = [], { className = '班级' } = {}) {
  if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH || typeof wx.shareFileMessage !== 'function') return Promise.reject(new Error('当前微信版本不支持文件分享'));
  const safeName = String(className || '班级').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `请假台账-${safeName}.csv`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data: buildLeaveCsv(records, students), encoding: 'utf8', success: () => wx.shareFileMessage({ filePath, fileName, success: () => resolve(filePath), fail: reject }), fail: reject }));
}
