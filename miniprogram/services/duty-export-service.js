export function buildDutyExchange(groups = [], { datasetId = '', classUuid = '' } = {}) {
  return { format: 'teacher-work-duty-exchange', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, classUuid, groups: groups.map((group) => ({ no: group.no, groupDays: group.groupDays || '', members: group.members.map((row) => ({ uuid: row.uuid || '', studentUuid: row.studentUuid, role: row.role || '值日生' })) })) };
}
export function copyDutyExchange(payload) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: resolve, fail: reject }));
}

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
function csvCell(value) { let text = String(value ?? ''); if (/^[=+\-@]/.test(text)) text = `'${text}`; return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function memberName(row) { const name = String(row.studentName || row.name || row.student_name || row.studentUuid || ''); return /^[=+\-@]/.test(name) ? `'${name}` : name; }
export function buildDutyRoster(groups = [], weeks = groups.length) { const sorted = [...groups].sort((a, b) => Number(a.no) - Number(b.no)); if (!sorted.length) return []; return Array.from({ length: Math.max(1, Math.min(52, Number(weeks) || sorted.length)) }, (_, index) => { const group = sorted[index % sorted.length]; return { week: index + 1, groupNo: group.no, groupDays: String(group.groupDays || '').split(',').map((value) => WEEK_NAMES[Number(value) - 1]).filter(Boolean).join('、'), members: group.members.map(memberName).join('、') }; }); }
export function buildDutyCsv(groups = [], weeks = groups.length) { const rows = [['周次', '值日组', '固定星期', '值日学生'], ...buildDutyRoster(groups, weeks).map((row) => [row.week, `第 ${row.groupNo} 组`, row.groupDays, row.members])]; return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`; }
export function exportDutyCsvFile(groups = [], { className = '班级', weeks = groups.length } = {}) { if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH || typeof wx.shareFileMessage !== 'function') return Promise.reject(new Error('当前微信版本不支持文件分享')); const fileName = `值日表-${String(className).replace(/[\\/:*?"<>|]/g, '_')}.csv`; const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`; return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data: buildDutyCsv(groups, weeks), encoding: 'utf8', success: () => wx.shareFileMessage({ filePath, fileName, success: () => resolve(filePath), fail: reject }), fail: reject })); }
