function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAssessmentCsv(records = []) {
  const lines = [['日期', '学生', '分类', '行为项目', '分值', '状态', '备注'], ...records.map((row) => [row.date, row.studentName, row.categoryName, row.itemName, row.score, row.status, row.remark])];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
}

export function buildAssessmentExchange({ datasetId = '', classUuid = '', period = 'monthly', month = '', academicYear = '', term = '', stats = {} } = {}) {
  return { format: 'teacher-work-assessment-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, period, month, academicYear, term, stats };
}

function shareTextFile(fileName, data) {
  if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH || typeof wx.shareFileMessage !== 'function') return Promise.reject(new Error('当前微信版本不支持文件分享'));
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data, encoding: 'utf8', success: () => wx.shareFileMessage({ filePath, fileName, success: () => resolve(filePath), fail: reject }), fail: reject }));
}

export function exportAssessment({ format = 'csv', className = '班级', stats = {}, ...scope } = {}) {
  const safeName = String(className || '班级').replace(/[\\/:*?"<>|]/g, '_');
  if (format === 'json') return shareTextFile(`表现量化-${safeName}.json`, JSON.stringify(buildAssessmentExchange({ ...scope, stats }), null, 2));
  return shareTextFile(`表现量化-${safeName}.csv`, buildAssessmentCsv(stats.records || []));
}
