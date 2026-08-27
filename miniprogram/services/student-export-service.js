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

export { normalizeStudent };
