import { callCloudFunction } from './cloudbase.js';

function normalizeStudent(student = {}) {
  return {
    uuid: student.uuid || '', school_no: student.schoolNo ?? student.school_no ?? '', name: student.name || '', gender: student.gender || '',
    birth_date: student.birthDate ?? student.birth_date ?? null, phone: student.phone || '', parent_phone: student.parentPhone ?? student.parent_phone ?? '',
    is_boarding: Boolean(student.isBoarding ?? student.is_boarding), height_cm: student.heightCm ?? student.height_cm ?? null,
    vision_left: student.visionLeft ?? student.vision_left ?? null, vision_right: student.visionRight ?? student.vision_right ?? null,
    is_myopia: Boolean(student.isMyopia ?? student.is_myopia), grade_level: student.gradeLevel ?? student.grade_level ?? '',
    seat_note: student.seatNote ?? student.seat_note ?? '', interest_duty: student.interestDuty ?? student.interest_duty ?? '',
    health_note: student.healthNote ?? student.health_note ?? '',
    status: student.status || '在读', follow_up_status: student.followUpStatus ?? student.follow_up_status ?? '正常', remark: student.remark || '',
  };
}

export function buildStudentRoster(students = [], { datasetId = '' } = {}) {
  return { format: 'teacher-work-student-roster', formatVersion: 1, exportedAt: new Date().toISOString(), datasetId, students: students.map(normalizeStudent) };
}

export function copyStudentRoster(students, options = {}) {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return Promise.reject(new Error('当前环境不支持复制导出'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(buildStudentRoster(students, options), null, 2), success: resolve, fail: reject }));
}

function writeBase64(filePath, data) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data, encoding: 'base64', success: () => resolve(filePath), fail: reject }));
}

export async function exportStudentRosterXlsxFile(students = []) {
  if (typeof wx === 'undefined' || !wx.env?.USER_DATA_PATH) throw new Error('当前微信版本不支持 Excel 文件导出');
  const response = await callCloudFunction('excel-exchange', { action: 'exportStudents', rows: students.map(normalizeStudent) });
  const result = response?.result || response;
  if (!result?.ok || !result.fileBase64) throw new Error(result?.errors?.[0] || '导出学生 Excel 失败');
  const fileName = `学生名单-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  await writeBase64(filePath, result.fileBase64);
  if (typeof wx.shareFileMessage !== 'function') return filePath;
  return new Promise((resolve, reject) => wx.shareFileMessage({ filePath, fileName, success: () => resolve(filePath), fail: reject }));
}

export { normalizeStudent };
