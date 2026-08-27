export function buildDutyExchange(groups = [], { datasetId = '', classUuid = '' } = {}) {
  return { format: 'teacher-work-duty-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, groups: groups.map((group) => ({ no: group.no, groupDays: group.groupDays || '', members: group.members.map((row) => ({ uuid: row.uuid || '', studentUuid: row.studentUuid, role: row.role || '值日生' })) })) };
}
export function copyDutyExchange(payload) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: resolve, fail: reject }));
}
