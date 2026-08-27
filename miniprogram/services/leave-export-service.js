export function buildLeaveExchange(records = [], students = [], { datasetId = '', classUuid = '' } = {}) {
  const names = new Map(students.map((student) => [student.uuid, student.name || '未命名学生']));
  return { format: 'teacher-work-leave-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, records: records.map((row) => ({ ...row, studentName: names.get(row.studentUuid) || '未命名学生' })) };
}
export function copyLeaveExchange(payload) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: resolve, fail: reject }));
}
