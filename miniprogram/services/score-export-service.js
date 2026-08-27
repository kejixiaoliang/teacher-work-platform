export function buildScoreExchange({ exam = {}, rows = [], datasetId = '', classUuid = '' } = {}) {
  return { format: 'teacher-work-score-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, exam: { uuid: exam.uuid || '', name: exam.name || '', date: exam.date || '', subjects: exam.subjects || [] }, rows: rows.flatMap((row) => Object.entries(row.values || {}).filter(([, score]) => score !== '').map(([subject, score]) => ({ studentUuid: row.studentUuid, studentName: row.name, subject, score: Number(score) }))) };
}
export function copyScoreExchange(payload) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: resolve, fail: reject }));
}
