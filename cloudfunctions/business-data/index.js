const crypto = require('node:crypto');
const COLLECTIONS = new Set(['seats', 'seat_layouts', 'duties', 'scores', 'exams', 'contacts', 'documents', 'assessment_records', 'assessment_categories', 'assessment_items', 'assessment_revisions']);
const ACTIONS = new Set(['query', 'summary', 'create', 'update', 'delete', 'bulkSave', 'analysis', 'trend', 'autoGroup', 'groupDays', 'renameDutyGroup', 'deleteDutyGroup', 'presetLeaders', 'presetSubjectLeaders', 'contactStats', 'history', 'batchAssessment', 'assessmentStats', 'void', 'restore', 'layoutSave', 'layoutHistory']);
const TEXT_FIELDS = ['name', 'title', 'content', 'remark', 'method', 'topic', 'result', 'role', 'subject', 'date', 'fileName', 'storedName', 'categoryName', 'itemName', 'description', 'reason', 'action'];
const LEADER_ROLES = ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'];
const SUBJECT_LEADER_ROLES = ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];
const CONTACT_METHODS = ['家访', '电话', '微信', '到校面谈', '其他'];

function validDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function normalize(event = {}) {
  const collection = String(event.collection || '').trim();
  const action = String(event.action || '').trim();
  const datasetId = String(event.datasetId || '').trim();
  const uuid = String(event.uuid || '').trim();
  if (!COLLECTIONS.has(collection)) return { ok: false, code: 'COLLECTION_NOT_ALLOWED', errors: ['业务集合不在白名单中'] };
  if (!ACTIONS.has(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['业务操作不支持'] };
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'summary', 'create', 'bulkSave', 'analysis', 'trend', 'autoGroup', 'groupDays', 'renameDutyGroup', 'deleteDutyGroup', 'presetLeaders', 'presetSubjectLeaders', 'contactStats', 'history', 'batchAssessment', 'assessmentStats', 'layoutSave', 'layoutHistory'].includes(action) && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['业务记录 uuid 不能为空'] };
  if (action === 'create' && (!event.record || typeof event.record !== 'object' || Array.isArray(event.record))) return { ok: false, code: 'RECORD_INVALID', errors: ['业务记录无效'] };
  if (action === 'create' && collection === 'seats' && !String(event.classUuid || '').trim()) return { ok: false, code: 'CLASS_REQUIRED', errors: ['座位保存必须指定班级'] };
  if (action === 'bulkSave' && !String(event.classUuid || '').trim()) return { ok: false, code: 'CLASS_REQUIRED', errors: ['成绩保存必须指定班级'] };
  if (action === 'summary' && !String(event.classUuid || '').trim()) return { ok: false, code: 'CLASS_REQUIRED', errors: ['数据分析必须指定班级'] };
  if (action === 'assessmentStats' && !String(event.classUuid || '').trim()) return { ok: false, code: 'CLASS_REQUIRED', errors: ['表现统计必须指定班级'] };
  return { ok: true, collection, action, datasetId, uuid, recordUuid: String(event.recordUuid || '').trim(), classUuid: String(event.classUuid || '').trim(), examUuid: String(event.examUuid || '').trim(), studentUuid: String(event.studentUuid || '').trim(), itemUuid: String(event.itemUuid || '').trim(), month: String(event.month || '').trim(), period: String(event.period || 'monthly').trim(), academicYear: String(event.academicYear || '').trim(), term: String(event.term || '').trim(), includeVoided: event.includeVoided === true, groupNo: Number(event.groupNo), targetGroupNo: Number(event.targetGroupNo), groupDays: String(event.groupDays || '').trim(), groupCount: Number(event.groupCount), rows: Array.isArray(event.rows) ? event.rows : [], record: event.record || {}, layout: event.layout || null };
}

function numeric(value) {
  if (value === '' || value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function rounded(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function getAllRecords(query, { pageSize = 500, max = 5000 } = {}) {
  const data = [];
  const safePageSize = Math.max(1, Math.min(1000, Number(pageSize) || 500));
  const safeMax = Math.max(1, Math.min(10000, Number(max) || 5000));
  while (data.length < safeMax) {
    const requested = Math.min(safePageSize, safeMax - data.length);
    const result = await query.skip(data.length).limit(requested).get();
    const page = Array.isArray(result.data) ? result.data : [];
    data.push(...page);
    if (page.length < requested) return { data, truncated: false };
  }
  const probe = await query.skip(data.length).limit(1).get();
  return { data, truncated: Array.isArray(probe.data) && probe.data.length > 0 };
}

function buildAnalyticsSummary({ students = [], scores = [], assessmentRecords = [] } = {}) {
  const activeStudents = students.filter((student) => !student.status || student.status === '在读');
  const studentUuids = new Set(activeStudents.map((student) => student.uuid).filter(Boolean));
  const heightLabels = Array.from({ length: 8 }, (_, index) => `${120 + index * 10}-${129 + index * 10}`);
  const heightMap = new Map(heightLabels.map((label) => [label, 0]));
  let otherHeight = 0;
  const heights = [];
  for (const student of activeStudents) {
    const height = numeric(student.height_cm ?? student.heightCm);
    if (height == null || height <= 0) continue;
    heights.push(height);
    const bucket = Math.floor((height - 120) / 10);
    if (bucket >= 0 && bucket < heightLabels.length) heightMap.set(heightLabels[bucket], heightMap.get(heightLabels[bucket]) + 1);
    else otherHeight += 1;
  }
  const myopiaCount = activeStudents.filter((student) => Boolean(student.is_myopia ?? student.isMyopia)).length;
  const visionValues = activeStudents.map((student) => {
    const left = numeric(student.vision_left ?? student.visionLeft);
    const right = numeric(student.vision_right ?? student.visionRight);
    return Math.min(left && left > 0 ? left : 5, right && right > 0 ? right : 5);
  });
  const gradeMap = new Map(['优', '良', '中', '待提高', '未录入'].map((label) => [label, 0]));
  for (const student of activeStudents) {
    const grade = String(student.grade_level ?? student.gradeLevel ?? '');
    gradeMap.set(gradeMap.has(grade) && grade ? grade : '未录入', gradeMap.get(gradeMap.has(grade) && grade ? grade : '未录入') + 1);
  }
  const maleCount = activeStudents.filter((student) => student.gender === '男').length;
  const boardingCount = activeStudents.filter((student) => Boolean(student.is_boarding ?? student.isBoarding)).length;
  const validScores = scores.filter((row) => studentUuids.has(row.studentUuid) && numeric(row.score) != null);
  const scoreSubjectMap = new Map();
  for (const row of validScores) {
    const subject = String(row.subject || '').trim() || '未命名科目';
    const values = scoreSubjectMap.get(subject) || [];
    values.push(Number(row.score));
    scoreSubjectMap.set(subject, values);
  }
  const validAssessments = assessmentRecords.filter((row) => studentUuids.has(row.studentUuid) && numeric(row.score) != null);
  const performanceScores = validAssessments.map((row) => Number(row.score));
  const scoreValues = validScores.map((row) => Number(row.score));
  return {
    overview: {
      studentCount: activeStudents.length,
      myopiaCount,
      myopiaRate: activeStudents.length ? Math.round(myopiaCount / activeStudents.length * 100) : 0,
      avgHeight: heights.length ? Math.round(heights.reduce((sum, value) => sum + value, 0) / heights.length) : null,
      avgVision: visionValues.length ? rounded(visionValues.reduce((sum, value) => sum + value, 0) / visionValues.length, 1) : null,
      boardingCount,
      scoreCount: validScores.length,
      scoreAverage: scoreValues.length ? rounded(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length, 2) : null,
      performanceCount: validAssessments.length,
      performanceTotal: performanceScores.reduce((sum, value) => sum + value, 0),
    },
    height: [...heightMap].map(([label, value]) => ({ label, value })).concat(otherHeight ? [{ label: '其他', value: otherHeight }] : []),
    vision: [{ label: '近视', value: myopiaCount }, { label: '未近视', value: activeStudents.length - myopiaCount }],
    grades: [...gradeMap].map(([label, value]) => ({ label, value })),
    gender: [{ label: '男生', value: maleCount }, { label: '女生', value: activeStudents.length - maleCount }],
    boarding: [{ label: '住宿', value: boardingCount }, { label: '走读', value: activeStudents.length - boardingCount }],
    scoreSubjects: [...scoreSubjectMap].map(([subject, values]) => ({ subject, count: values.length, avg: rounded(values.reduce((sum, value) => sum + value, 0) / values.length, 2), max: Math.max(...values) })),
    performance: {
      positiveCount: performanceScores.filter((value) => value > 0).length,
      negativeCount: performanceScores.filter((value) => value < 0).length,
      zeroCount: performanceScores.filter((value) => value === 0).length,
    },
  };
}

function sanitize(record) {
  const result = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (['ownerId', 'datasetId', '_id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt', 'revision'].includes(key)) continue;
    if (TEXT_FIELDS.includes(key)) result[key] = String(value || '').trim().slice(0, 2000);
    else if (['row', 'col', 'score', 'studentId', 'examId', 'groupNo'].includes(key) && Number.isFinite(Number(value))) result[key] = Number(value);
    else if (typeof value === 'boolean' || value === null || typeof value === 'string' || Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function normalizeLayoutSnapshot(layout = {}) {
  if (!layout || !Array.isArray(layout.grid)) return null;
  const rows = Number(layout.rows); const cols = Number(layout.cols);
  const aisleMode = Number(layout.aisleMode ?? 1);
  if (!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(cols) || cols < 1 || cols > 20 || ![0, 1, 2].includes(aisleMode)) return null;
  const grid = layout.grid.slice(0, Math.min(500, rows * cols)).map((seat) => ({
    row: Number(seat?.row), col: Number(seat?.col), studentUuid: String(seat?.studentUuid || '').slice(0, 120), locked: seat?.locked === true,
  })).filter((seat) => Number.isInteger(seat.row) && seat.row >= 0 && seat.row < rows && Number.isInteger(seat.col) && seat.col >= 0 && seat.col < cols);
  return {
    rows, cols, aisleMode,
    podiumLabel: String(layout.podiumLabel || '讲台').trim().slice(0, 40) || '讲台',
    remark: String(layout.remark || '').trim().slice(0, 500),
    autoOpts: {
      nearVision: layout.autoOpts?.nearVision !== false,
      gender: layout.autoOpts?.gender === true,
      peerHelp: layout.autoOpts?.peerHelp === true,
    },
    grid,
  };
}

function buildAssessmentStats({ students = [], records = [], period = 'monthly', month = '', academicYear = '', term = '' } = {}) {
  const activeStudents = students.filter((student) => student.status !== '离校');
  const activeStudentUuids = new Set(activeStudents.map((student) => student.uuid));
  const names = new Map(activeStudents.map((student) => [student.uuid, student.name || '未命名学生']));
  const scoped = records.filter((record) => {
    if (record.status === 'voided' || record.deletedAt || !activeStudentUuids.has(record.studentUuid)) return false;
    const date = String(record.date ?? record.behaviorDate ?? record.behavior_date ?? '');
    if (period === 'monthly') return /^\d{4}-\d{2}$/.test(month) && date.startsWith(month);
    const rowYear = String(record.academicYearSnapshot ?? record.academic_year_snapshot ?? '');
    const rowTerm = String(record.termSnapshot ?? record.term_snapshot ?? '');
    return rowYear === academicYear && rowTerm === term;
  });
  const byStudent = new Map(activeStudents.map((student) => [student.uuid, { studentUuid: student.uuid, name: student.name || '未命名学生', schoolNo: student.schoolNo ?? student.school_no ?? '', positive: 0, negative: 0, net: 0, recordCount: 0 }]));
  const byCategory = new Map();
  const details = [];
  for (const record of scoped) {
    const score = Number(record.score ?? record.scoreSnapshot ?? record.score_snapshot ?? 0);
    const summary = byStudent.get(record.studentUuid);
    if (!summary || !Number.isFinite(score)) continue;
    summary.recordCount += 1; summary.net += score;
    if (score > 0) summary.positive += score; else if (score < 0) summary.negative += score;
    const categoryName = String(record.categoryName ?? record.category_name_snapshot ?? '未分类') || '未分类';
    if (!byCategory.has(categoryName)) byCategory.set(categoryName, { categoryName, recordCount: 0, positive: 0, negative: 0, net: 0, students: new Set() });
    const category = byCategory.get(categoryName); category.recordCount += 1; category.net += score; category.students.add(record.studentUuid);
    if (score > 0) category.positive += score; else if (score < 0) category.negative += score;
    details.push({ uuid: record.uuid, date: record.date ?? record.behaviorDate ?? '', studentUuid: record.studentUuid, studentName: names.get(record.studentUuid) || '未命名学生', categoryName, itemName: record.itemName ?? record.item_name_snapshot ?? '', score, status: record.status || 'active', remark: record.remark || '' });
  }
  const ranking = [...byStudent.values()].sort((a, b) => b.net - a.net || b.positive - a.positive || a.name.localeCompare(b.name, 'zh-CN')).map((row, index) => ({ ...row, rank: index + 1 }));
  const categories = [...byCategory.values()].map(({ students: set, ...row }) => ({ ...row, studentCount: set.size })).sort((a, b) => b.net - a.net || a.categoryName.localeCompare(b.categoryName, 'zh-CN'));
  details.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.uuid).localeCompare(String(a.uuid)));
  return { ranking, categories, records: details, filters: { period, month: period === 'monthly' ? month : '', academicYear: period === 'term' ? academicYear : '', term: period === 'term' ? term : '' }, totals: { positive: scoped.filter((row) => Number(row.score ?? row.scoreSnapshot ?? row.score_snapshot ?? 0) > 0).reduce((sum, row) => sum + Number(row.score ?? row.scoreSnapshot ?? row.score_snapshot), 0), negative: scoped.filter((row) => Number(row.score ?? row.scoreSnapshot ?? row.score_snapshot ?? 0) < 0).reduce((sum, row) => sum + Number(row.score ?? row.scoreSnapshot ?? row.score_snapshot), 0), net: scoped.reduce((sum, row) => sum + Number(row.score ?? row.scoreSnapshot ?? row.score_snapshot ?? 0), 0), recordCount: scoped.length } };
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const request = normalize(event);
  if (!request.ok) return request;
  const db = cloud.database();
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId };
  if (request.action === 'layoutHistory') {
    if (request.collection !== 'seat_layouts' || !request.classUuid) return { ok: false, code: 'LAYOUT_QUERY_INVALID', errors: ['历史布局查询参数无效'] };
    const result = await db.collection('seat_layouts').where({ ...scope, classUuid: request.classUuid, deletedAt: null }).orderBy('savedAt', 'desc').limit(20).get();
    return { ok: true, records: result.data };
  }
  if (request.action === 'layoutSave') {
    const layout = normalizeLayoutSnapshot(request.layout);
    if (request.collection !== 'seat_layouts' || !request.classUuid || !layout) return { ok: false, code: 'LAYOUT_INVALID', errors: ['布局快照参数无效'] };
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
    const now = new Date().toISOString();
    const result = await db.collection('seat_layouts').add({ data: { ...scope, classUuid: request.classUuid, ...layout, savedAt: now, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, uuid: crypto.randomUUID(), source: 'miniprogram' } });
    return { ok: true, action: 'layoutSave', cloudId: result._id };
  }
  if (request.action === 'history') {
    if (request.collection !== 'assessment_revisions' || !request.recordUuid) return { ok: false, code: 'HISTORY_QUERY_INVALID', errors: ['修正历史查询参数无效'] };
    const result = await db.collection('assessment_revisions').where({ ...scope, recordUuid: request.recordUuid }).limit(100).get();
    return { ok: true, records: result.data };
  }
  if (request.action === 'assessmentStats') {
    if (request.collection !== 'assessment_records' || !['monthly', 'term'].includes(request.period)) return { ok: false, code: 'ASSESSMENT_STATS_INVALID', errors: ['表现统计参数无效'] };
    if (request.period === 'monthly' && !/^\d{4}-\d{2}$/.test(request.month)) return { ok: false, code: 'MONTH_INVALID', errors: ['月份应为 YYYY-MM'] };
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
    const cls = classResult.data[0]; const academicYear = request.academicYear || cls.academicYear || cls.academic_year || ''; const term = request.term || cls.term || '';
    if (request.period === 'term' && (!academicYear || !term)) return { ok: false, code: 'TERM_INVALID', errors: ['学年和学期不能为空'] };
    const [studentsResult, recordsResult] = await Promise.all([getAllRecords(db.collection('students').where({ ...scope, classUuid: request.classUuid, deletedAt: null }), { max: 1000 }), getAllRecords(db.collection('assessment_records').where({ ...scope, classUuid: request.classUuid, deletedAt: null }), { max: 5000 })]);
    const stats = buildAssessmentStats({ students: studentsResult.data, records: recordsResult.data, period: request.period, month: request.month, academicYear, term });
    return { ok: true, ...stats, truncated: studentsResult.truncated || recordsResult.truncated };
  }
  if (request.action === 'batchAssessment') {
    if (request.collection !== 'assessment_records' || !request.classUuid || !request.itemUuid || !request.rows.length) return { ok: false, code: 'ASSESSMENT_BATCH_INVALID', errors: ['批量记分参数无效'] };
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
    const itemResult = await db.collection('assessment_items').where({ ...scope, uuid: request.itemUuid, deletedAt: null }).limit(1).get();
    if (!itemResult.data.length) return { ok: false, code: 'ITEM_NOT_FOUND', errors: ['行为项目不存在'] };
    const item = itemResult.data[0];
    if (item.isActive === false) return { ok: false, code: 'ITEM_DISABLED', errors: ['行为项目已停用'] };
    const categoryResult = await db.collection('assessment_categories').where({ ...scope, uuid: item.categoryUuid, deletedAt: null }).limit(1).get();
    if (!categoryResult.data.length) return { ok: false, code: 'CATEGORY_NOT_FOUND', errors: ['行为项目所属分类不存在'] };
    if (categoryResult.data[0].isActive === false) return { ok: false, code: 'CATEGORY_DISABLED', errors: ['行为项目所属分类已停用'] };
    const date = String(request.rows[0].date || new Date().toISOString().slice(0, 10));
    const existingResult = await db.collection('assessment_records').where({ ...scope, classUuid: request.classUuid, date, status: 'active', deletedAt: null }).limit(500).get();
    const existing = new Set(existingResult.data.map((row) => `${row.studentUuid}:${row.itemUuid || row.itemName}`));
    const students = await db.collection('students').where({ ...scope, classUuid: request.classUuid, deletedAt: null }).limit(500).get();
    const validStudents = new Set(students.data.filter((student) => student.status !== '离校').map((student) => student.uuid));
    const names = new Map(students.data.map((student) => [student.uuid, student.name || '未命名学生']));
    const skipped = []; const accepted = new Set(); let count = 0; const now = new Date().toISOString();
    const allowDailyRepeat = item.allowDailyRepeat === true;
    for (const input of request.rows.slice(0, 500)) {
      const studentUuid = String(input.studentUuid || '').trim();
      const score = Number(item.score ?? input.score);
      const rowDate = String(input.date || date);
      const key = `${studentUuid}:${request.itemUuid}`;
      if (!studentUuid || !validStudents.has(studentUuid)) { skipped.push({ studentUuid, name: names.get(studentUuid) || '', reasonCode: 'STUDENT_INVALID', reason: '学生不属于当前班级或已离校' }); continue; }
      if (accepted.has(studentUuid)) { skipped.push({ studentUuid, name: names.get(studentUuid), reasonCode: 'DUPLICATE_INPUT', reason: '本次操作重复选择学生' }); continue; }
      if (!Number.isFinite(score) || score < -100 || score > 100) { skipped.push({ studentUuid, name: names.get(studentUuid), reasonCode: 'SCORE_INVALID', reason: '规则分值无效' }); continue; }
      accepted.add(studentUuid);
      if (!allowDailyRepeat && (existing.has(key) || existing.has(`${studentUuid}:${item.name}`))) { skipped.push({ studentUuid, name: names.get(studentUuid), reasonCode: 'DAILY_DUPLICATE', reason: '该学生当天已经记录过此行为' }); continue; }
      await db.collection('assessment_records').add({ data: { ...scope, classUuid: request.classUuid, studentUuid, itemUuid: request.itemUuid, date: rowDate, academicYearSnapshot: classResult.data[0].academicYear || classResult.data[0].academic_year || '', termSnapshot: classResult.data[0].term || '', categoryName: categoryResult.data[0].name || '', itemName: item.name || String(input.itemName || '').trim(), score, allowDailyRepeat, remark: String(input.remark || '').trim().slice(0, 500), uuid: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, status: 'active', revision: 1, source: 'miniprogram' } }); count += 1;
    }
    return { ok: true, action: 'batchAssessment', count, total: request.rows.slice(0, 500).length, skipped };
  }
  if (request.action === 'contactStats') {
    if (request.collection !== 'contacts') return { ok: false, code: 'CONTACT_ACTION_INVALID', errors: ['家校沟通统计只能用于 contacts 集合'] };
    const result = await db.collection('contacts').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: null }).limit(500).get();
    const rows = request.month ? result.data.filter((row) => String(row.date || '').startsWith(request.month)) : result.data;
    return { ok: true, total: rows.length, students: new Set(rows.map((row) => row.studentUuid).filter(Boolean)).size, visits: rows.filter((row) => row.method === '家访').length, phones: rows.filter((row) => row.method === '电话').length };
  }
  if (['autoGroup', 'groupDays', 'renameDutyGroup', 'deleteDutyGroup', 'presetLeaders', 'presetSubjectLeaders'].includes(request.action) && request.collection !== 'duties') return { ok: false, code: 'DUTY_ACTION_INVALID', errors: ['值日操作只能用于 duties 集合'] };
  if (['autoGroup', 'groupDays', 'renameDutyGroup', 'deleteDutyGroup', 'presetLeaders', 'presetSubjectLeaders'].includes(request.action) && !request.classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['请先选择班级'] };
  if (request.action === 'groupDays') {
    if (!Number.isInteger(request.groupNo) || request.groupNo < 1 || request.groupNo > 20 || (request.groupDays && !/^[1-7](,[1-7])*$/.test(request.groupDays))) return { ok: false, code: 'DUTY_DAYS_INVALID', errors: ['组号或星期格式无效'] };
    const rows = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role: '值日生', groupNo: request.groupNo, deletedAt: null }).limit(100).get();
    if (!rows.data.length) return { ok: false, code: 'DUTY_GROUP_NOT_FOUND', errors: ['值日组不存在'] };
    for (const row of rows.data) await db.collection('duties').doc(row._id).update({ data: { groupDays: request.groupDays, updatedAt: new Date().toISOString(), revision: (row.revision || 1) + 1 } });
    return { ok: true, action: 'groupDays', count: rows.data.length };
  }
  if (request.action === 'renameDutyGroup' || request.action === 'deleteDutyGroup') {
    if (!Number.isInteger(request.groupNo) || request.groupNo < 1 || request.groupNo > 20) return { ok: false, code: 'DUTY_GROUP_INVALID', errors: ['值日组号应为 1 至 20'] };
    const rows = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role: '值日生', groupNo: request.groupNo, deletedAt: null }).limit(500).get();
    if (!rows.data.length) return { ok: false, code: 'DUTY_GROUP_NOT_FOUND', errors: ['值日组不存在'] };
    const now = new Date().toISOString();
    if (request.action === 'deleteDutyGroup') { for (const row of rows.data) await db.collection('duties').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision: (row.revision || 1) + 1 } }); return { ok: true, action: 'deleteDutyGroup', count: rows.data.length }; }
    if (!Number.isInteger(request.targetGroupNo) || request.targetGroupNo < 1 || request.targetGroupNo > 20) return { ok: false, code: 'DUTY_GROUP_INVALID', errors: ['新组号应为 1 至 20'] };
    const target = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role: '值日生', groupNo: request.targetGroupNo, deletedAt: null }).limit(1).get();
    if (target.data.length) return { ok: false, code: 'DUTY_GROUP_CONFLICT', errors: ['新组号已经存在'] };
    for (const row of rows.data) await db.collection('duties').doc(row._id).update({ data: { groupNo: request.targetGroupNo, updatedAt: now, revision: (row.revision || 1) + 1 } });
    return { ok: true, action: 'renameDutyGroup', count: rows.data.length };
  }
  if (request.action === 'autoGroup') {
    const n = Math.max(1, Math.min(15, Number.isInteger(request.groupCount) ? request.groupCount : 4));
    const students = await db.collection('students').where({ ...scope, classUuid: request.classUuid, status: '在读', deletedAt: null }).orderBy('schoolNo', 'asc').limit(500).get();
    if (students.data.length < n) return { ok: false, code: 'DUTY_GROUP_CONFLICT', errors: [`只有 ${students.data.length} 名在读学生，不能分成 ${n} 组`] };
    const old = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role: '值日生', deletedAt: null }).limit(500).get();
    const now = new Date().toISOString();
    for (const row of old.data) await db.collection('duties').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision: (row.revision || 1) + 1 } });
    const groups = Array.from({ length: n }, (_, index) => ({ no: index + 1, members: [] }));
    for (let index = 0; index < students.data.length; index += 1) { const student = students.data[index]; const no = (index % n) + 1; groups[no - 1].members.push(student.name || '未命名学生'); await db.collection('duties').add({ data: { ...scope, classUuid: request.classUuid, studentUuid: student.uuid, role: '值日生', groupNo: no, groupDays: '', remark: '', uuid: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } }); }
    return { ok: true, action: 'autoGroup', count: students.data.length, groupCount: n, groups };
  }
  if (request.action === 'presetLeaders' || request.action === 'presetSubjectLeaders') {
    const roles = request.action === 'presetLeaders' ? LEADER_ROLES : SUBJECT_LEADER_ROLES;
    const existing = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, deletedAt: null }).limit(500).get();
    const existingRoles = new Set(existing.data.map((row) => row.role));
    const held = new Set(existing.data.filter((row) => LEADER_ROLES.includes(row.role)).map((row) => row.studentUuid));
    const students = await db.collection('students').where({ ...scope, classUuid: request.classUuid, status: '在读', deletedAt: null }).orderBy('schoolNo', 'asc').limit(500).get();
    const added = []; let cursor = 0; const now = new Date().toISOString();
    for (const role of roles) { if (existingRoles.has(role)) continue; let student = null; for (; cursor < students.data.length; cursor += 1) { const candidate = students.data[cursor]; if (request.action === 'presetSubjectLeaders' || !held.has(candidate.uuid)) { student = candidate; cursor += 1; break; } } if (!student) break; await db.collection('duties').add({ data: { ...scope, classUuid: request.classUuid, studentUuid: student.uuid, role, groupNo: null, groupDays: '', remark: '', uuid: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } }); held.add(student.uuid); added.push({ role, name: student.name || '未命名学生' }); }
    return { ok: true, action: request.action, added };
  }
  if (request.action === 'bulkSave') {
    if (request.collection !== 'scores' || !request.classUuid || !request.examUuid || !request.rows.length) return { ok: false, code: 'SCORE_BATCH_INVALID', errors: ['成绩批次无效'] };
    const examResult = await db.collection('exams').where({ ...scope, uuid: request.examUuid, classUuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!examResult.data.length) return { ok: false, code: 'EXAM_NOT_FOUND', errors: ['考试不存在或不属于当前班级'] };
    const students = await db.collection('students').where({ ...scope, classUuid: request.classUuid, deletedAt: null }).limit(500).get();
    const validStudents = new Set(students.data.filter((student) => student.status !== '离校').map((student) => student.uuid));
    let count = 0;
    for (const input of request.rows.slice(0, 500)) {
      const studentUuid = String(input.studentUuid || '').trim();
      const subject = String(input.subject || '').trim();
      const score = Number(input.score);
      if (!validStudents.has(studentUuid) || !subject || !Number.isFinite(score) || score < 0 || score > 150) continue;
      const current = await db.collection('scores').where({ ...scope, examUuid: request.examUuid, studentUuid, subject, deletedAt: null }).limit(1).get();
      const data = { ...scope, classUuid: request.classUuid, examUuid: request.examUuid, studentUuid, subject, score, updatedAt: new Date().toISOString(), deletedAt: null };
      if (current.data.length) await db.collection('scores').doc(current.data[0]._id).update({ data: { ...data, revision: (current.data[0].revision || 1) + 1 } });
      else await db.collection('scores').add({ data: { ...data, uuid: crypto.randomUUID(), createdAt: new Date().toISOString(), revision: 1, source: 'miniprogram' } });
      count += 1;
    }
    return { ok: true, action: 'bulkSave', count };
  }
  if (request.action === 'analysis') {
    if (request.collection !== 'scores' || !request.examUuid) return { ok: false, code: 'SCORE_ANALYSIS_INVALID', errors: ['成绩分析参数无效'] };
    const result = await db.collection('scores').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), examUuid: request.examUuid, deletedAt: null }).limit(500).get();
    const studentResult = await db.collection('students').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: null }).limit(500).get();
    const names = new Map(studentResult.data.map((student) => [student.uuid, student.name || '未命名学生']));
    const byStudent = new Map(); const bySubject = new Map();
    for (const row of result.data) { byStudent.set(row.studentUuid, (byStudent.get(row.studentUuid) || 0) + Number(row.score || 0)); const list = bySubject.get(row.subject) || []; list.push(Number(row.score || 0)); bySubject.set(row.subject, list); }
    const subjects = [...bySubject].map(([subject, values]) => ({ subject, avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100, max: Math.max(...values), pass: Math.round(values.filter((value) => value >= 60).length / values.length * 100) }));
    const ranking = [...byStudent].sort((a, b) => b[1] - a[1]).map(([studentUuid, total], index) => ({ studentUuid, name: names.get(studentUuid) || '未命名学生', total, rank: index + 1 }));
    return { ok: true, subjects, ranking };
  }
  if (request.action === 'trend') {
    const result = await db.collection('scores').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), studentUuid: request.studentUuid, deletedAt: null }).limit(500).get();
    return { ok: true, points: result.data };
  }
  if (request.action === 'summary') {
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
    const [studentsResult, scoresResult, assessmentResult] = await Promise.all([
      getAllRecords(db.collection('students').where({ ...scope, classUuid: request.classUuid, deletedAt: null }), { max: 1000 }),
      getAllRecords(db.collection('scores').where({ ...scope, classUuid: request.classUuid, deletedAt: null }), { max: 5000 }),
      getAllRecords(db.collection('assessment_records').where({ ...scope, classUuid: request.classUuid, status: 'active', deletedAt: null }), { max: 5000 }),
    ]);
    const collections = [...COLLECTIONS];
    const counts = { classes: 1, students: studentsResult.data.length };
    for (const collection of collections) {
      if (collection === 'scores') { counts.scores = scoresResult.data.length; continue; }
      if (collection === 'assessment_records') { counts.assessment_records = assessmentResult.data.length; continue; }
      const classScoped = ['students', 'seats', 'duties', 'scores', 'exams', 'contacts', 'documents', 'assessment_records'].includes(collection) && request.classUuid ? { classUuid: request.classUuid } : {};
      counts[collection] = (await db.collection(collection).where({ ...scope, ...classScoped, ...(collection === 'assessment_records' && request.includeVoided ? {} : { deletedAt: null }) }).count()).total;
    }
    const metrics = buildAnalyticsSummary({ students: studentsResult.data, scores: scoresResult.data, assessmentRecords: assessmentResult.data });
    metrics.limits = { students: studentsResult.truncated, scores: scoresResult.truncated, assessmentRecords: assessmentResult.truncated };
    return { ok: true, counts, metrics };
  }
  const collection = db.collection(request.collection);
  if (request.action === 'query') {
    const result = await collection.where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), ...(request.studentUuid ? { studentUuid: request.studentUuid } : {}), ...(request.collection === 'assessment_records' && request.includeVoided ? {} : { deletedAt: null }) }).limit(100).get();
    return { ok: true, records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create' && request.collection === 'seats') {
    const classResult = await db.collection('classes').where({ ...scope, uuid: request.classUuid, deletedAt: null }).limit(1).get();
    if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['班级不存在或不属于当前数据集'] };
    const cls = classResult.data[0]; const row = Number(request.record.row); const col = Number(request.record.col);
    const rows = Number(cls.seatRows ?? cls.seat_rows ?? 6); const cols = Number(cls.seatCols ?? cls.seat_cols ?? 8);
    if (!Number.isInteger(row) || row < 0 || row >= rows || !Number.isInteger(col) || col < 0 || col >= cols) return { ok: false, code: 'SEAT_POSITION_INVALID', errors: ['座位位置超出当前班级布局'] };
    const studentUuid = String(request.record.studentUuid || '').trim();
    if (studentUuid) {
      const studentResult = await db.collection('students').where({ ...scope, classUuid: request.classUuid, uuid: studentUuid, deletedAt: null }).limit(1).get();
      if (!studentResult.data.length || studentResult.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    }
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, classUuid: request.classUuid, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  if (request.action === 'create' && request.collection === 'duties') {
    if (!request.classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['职务保存必须指定班级'] };
    const studentUuid = String(request.record.studentUuid || '').trim(); const role = String(request.record.role || '').trim(); const groupNo = Number(request.record.groupNo);
    if (!studentUuid || !role || role.length > 80) return { ok: false, code: 'DUTY_INVALID', errors: ['学生和职务不能为空'] };
    if (role !== '值日生' && !LEADER_ROLES.includes(role) && !SUBJECT_LEADER_ROLES.includes(role)) return { ok: false, code: 'DUTY_ROLE_INVALID', errors: ['职务或科目不在允许范围内'] };
    const studentResult = await db.collection('students').where({ ...scope, classUuid: request.classUuid, uuid: studentUuid, deletedAt: null }).limit(1).get();
    if (!studentResult.data.length || studentResult.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    if (role === '值日生') {
      if (!Number.isInteger(groupNo) || groupNo < 1 || groupNo > 20) return { ok: false, code: 'DUTY_GROUP_INVALID', errors: ['值日组号应为 1 至 20'] };
      const duplicate = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, studentUuid, role: '值日生', deletedAt: null }).limit(1).get();
      if (duplicate.data.length) return { ok: false, code: 'DUTY_CONFLICT', errors: [`${studentResult.data[0].name || '该学生'} 已在其他值日组`] };
    } else {
      const duplicate = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role, deletedAt: null }).limit(1).get();
      if (duplicate.data.length) return { ok: false, code: 'DUTY_CONFLICT', errors: [`「${role}」已由其他学生担任`] };
      if (LEADER_ROLES.includes(role)) {
        const heldRoles = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, studentUuid, deletedAt: null }).limit(100).get();
        if (heldRoles.data.some((row) => LEADER_ROLES.includes(row.role))) return { ok: false, code: 'DUTY_CONFLICT', errors: [`${studentResult.data[0].name || '该学生'} 已担任其他班委职务`] };
      }
    }
    const uuid = crypto.randomUUID(); const now = new Date().toISOString();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, classUuid: request.classUuid, studentUuid, role, groupNo: role === '值日生' ? groupNo : null, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  if (request.action === 'create' && request.collection === 'contacts') {
    if (!request.classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['沟通记录必须指定班级'] };
    const studentUuid = String(request.record.studentUuid || '').trim(); const method = String(request.record.method || '').trim(); const date = String(request.record.date || '').trim(); const topic = String(request.record.topic || '').trim(); const contactResult = String(request.record.result || '').trim();
    if (!studentUuid || !CONTACT_METHODS.includes(method) || !validDateKey(date) || (!topic && !contactResult)) return { ok: false, code: 'CONTACT_INVALID', errors: ['请选择学生和有效方式、日期，并填写事由或结果'] };
    const student = await db.collection('students').where({ ...scope, classUuid: request.classUuid, uuid: studentUuid, deletedAt: null }).limit(1).get();
    if (!student.data.length || student.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, classUuid: request.classUuid, studentUuid, method, date, topic, result: contactResult, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }
  if ((request.action === 'void' || request.action === 'restore') && request.collection === 'assessment_records') {
    const found = await collection.where({ ...scope, uuid: request.uuid }).limit(1).get();
    if (!found.data.length) return { ok: false, code: 'RECORD_NOT_FOUND', errors: ['表现记录不存在'] };
    const row = found.data[0]; const expectedStatus = request.action === 'void' ? 'active' : 'voided'; const nextStatus = request.action === 'void' ? 'voided' : 'active'; const reason = String(request.record.reason || '').trim();
    if (row.status !== expectedStatus) return { ok: false, code: 'RECORD_STATE_CONFLICT', errors: ['记录状态不允许此操作'] };
    if (!reason) return { ok: false, code: 'REVISION_REASON_REQUIRED', errors: ['请填写修正原因'] };
    const now = new Date().toISOString();
    await db.collection('assessment_revisions').add({ data: { ...scope, recordUuid: request.uuid, action: request.action, before: row, after: { ...row, status: nextStatus, deletedAt: request.action === 'void' ? now : null }, reason, createdAt: now, uuid: crypto.randomUUID() } });
    await collection.doc(row._id).update({ data: { status: nextStatus, deletedAt: request.action === 'void' ? now : null, updatedAt: now, revision: (row.revision || 1) + 1 } });
    return { ok: true, action: request.action, uuid: request.uuid };
  }
  if (request.action === 'update' && request.collection === 'duties') {
    const foundDuty = await collection.where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
    if (!foundDuty.data.length) return { ok: false, code: 'RECORD_NOT_FOUND', errors: ['职务记录不存在'] };
    const current = foundDuty.data[0]; const studentUuid = String(request.record.studentUuid ?? current.studentUuid ?? '').trim(); const role = String(request.record.role ?? current.role ?? '').trim(); const groupNo = Number(request.record.groupNo ?? current.groupNo);
    if (role !== '值日生' && !LEADER_ROLES.includes(role) && !SUBJECT_LEADER_ROLES.includes(role)) return { ok: false, code: 'DUTY_ROLE_INVALID', errors: ['职务或科目不在允许范围内'] };
    const studentResult = await db.collection('students').where({ ...scope, classUuid: current.classUuid, uuid: studentUuid, deletedAt: null }).limit(1).get();
    if (!studentResult.data.length || studentResult.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    if (role === '值日生' && (!Number.isInteger(groupNo) || groupNo < 1 || groupNo > 20)) return { ok: false, code: 'DUTY_GROUP_INVALID', errors: ['值日组号应为 1 至 20'] };
    const duplicateQuery = role === '值日生' ? { ...scope, classUuid: current.classUuid, studentUuid, role, deletedAt: null } : { ...scope, classUuid: current.classUuid, role, deletedAt: null };
    const duplicates = await db.collection('duties').where(duplicateQuery).limit(100).get();
    if (duplicates.data.some((row) => row.uuid !== request.uuid)) return { ok: false, code: 'DUTY_CONFLICT', errors: [role === '值日生' ? '该学生已在其他值日组' : `「${role}」已由其他学生担任`] };
    if (LEADER_ROLES.includes(role)) {
      const heldRoles = await db.collection('duties').where({ ...scope, classUuid: current.classUuid, studentUuid, deletedAt: null }).limit(100).get();
      if (heldRoles.data.some((row) => row.uuid !== request.uuid && LEADER_ROLES.includes(row.role))) return { ok: false, code: 'DUTY_CONFLICT', errors: [`${studentResult.data[0].name || '该学生'} 已担任其他班委职务`] };
    }
    const revision = (current.revision || 1) + 1;
    await collection.doc(current._id).update({ data: { ...sanitize(request.record), studentUuid, role, groupNo: role === '值日生' ? groupNo : null, updatedAt: new Date().toISOString(), revision } });
    return { ok: true, action: 'update', uuid: request.uuid, revision };
  }
  if (request.action === 'update' && request.collection === 'contacts') {
    const foundContact = await collection.where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
    if (!foundContact.data.length) return { ok: false, code: 'RECORD_NOT_FOUND', errors: ['沟通记录不存在'] };
    const current = foundContact.data[0]; const studentUuid = String(request.record.studentUuid ?? current.studentUuid ?? '').trim(); const method = String(request.record.method ?? current.method ?? '').trim(); const date = String(request.record.date ?? current.date ?? '').trim(); const topic = String(request.record.topic ?? current.topic ?? '').trim(); const contactResult = String(request.record.result ?? current.result ?? '').trim();
    if (!studentUuid || !CONTACT_METHODS.includes(method) || !validDateKey(date) || (!topic && !contactResult)) return { ok: false, code: 'CONTACT_INVALID', errors: ['请选择学生和有效方式、日期，并填写事由或结果'] };
    const student = await db.collection('students').where({ ...scope, classUuid: current.classUuid, uuid: studentUuid, deletedAt: null }).limit(1).get();
    if (!student.data.length || student.data[0].status === '离校') return { ok: false, code: 'STUDENT_NOT_IN_CLASS', errors: ['学生不属于当前班级或已离校'] };
    const revision = (current.revision || 1) + 1;
    await collection.doc(current._id).update({ data: { ...sanitize(request.record), studentUuid, method, date, topic, result: contactResult, classUuid: current.classUuid, updatedAt: now, revision } });
    return { ok: true, action: 'update', uuid: request.uuid, revision };
  }
  const found = await collection.where({ ...scope, uuid: request.uuid, deletedAt: null }).limit(1).get();
  if (!found.data.length) return { ok: false, code: 'RECORD_NOT_FOUND', errors: ['业务记录不存在'] };
  const row = found.data[0];
  const revision = (row.revision || 1) + 1;
  if (request.action === 'delete') {
    await collection.doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  if (request.collection === 'assessment_records') await db.collection('assessment_revisions').add({ data: { ...scope, recordUuid: request.uuid, action: 'edit', before: row, after: { ...row, ...sanitize(request.record) }, reason: String(request.record.reason || '').trim(), createdAt: now, uuid: crypto.randomUUID() } });
  await collection.doc(row._id).update({ data: { ...sanitize(request.record), updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = { COLLECTIONS, ACTIONS, LEADER_ROLES, SUBJECT_LEADER_ROLES, CONTACT_METHODS, validDateKey, normalize, sanitize, normalizeLayoutSnapshot, getAllRecords, buildAnalyticsSummary, buildAssessmentStats, main };
