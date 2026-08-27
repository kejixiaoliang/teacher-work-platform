const crypto = require('node:crypto');
const COLLECTIONS = new Set(['seats', 'seat_layouts', 'duties', 'scores', 'exams', 'contacts', 'documents', 'assessment_records', 'assessment_categories', 'assessment_items', 'assessment_revisions']);
const ACTIONS = new Set(['query', 'summary', 'create', 'update', 'delete', 'bulkSave', 'analysis', 'trend', 'autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders', 'contactStats', 'history', 'batchAssessment', 'void', 'restore', 'layoutSave', 'layoutHistory']);
const TEXT_FIELDS = ['name', 'title', 'content', 'remark', 'method', 'topic', 'result', 'role', 'subject', 'date', 'fileName', 'storedName', 'categoryName', 'itemName', 'description', 'reason', 'action'];

function normalize(event = {}) {
  const collection = String(event.collection || '').trim();
  const action = String(event.action || '').trim();
  const datasetId = String(event.datasetId || '').trim();
  const uuid = String(event.uuid || '').trim();
  if (!COLLECTIONS.has(collection)) return { ok: false, code: 'COLLECTION_NOT_ALLOWED', errors: ['业务集合不在白名单中'] };
  if (!ACTIONS.has(action)) return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['业务操作不支持'] };
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['query', 'summary', 'create', 'bulkSave', 'analysis', 'trend', 'autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders', 'contactStats', 'history', 'batchAssessment', 'layoutSave', 'layoutHistory'].includes(action) && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['业务记录 uuid 不能为空'] };
  if (action === 'create' && (!event.record || typeof event.record !== 'object' || Array.isArray(event.record))) return { ok: false, code: 'RECORD_INVALID', errors: ['业务记录无效'] };
  if (action === 'bulkSave' && !String(event.classUuid || '').trim()) return { ok: false, code: 'CLASS_REQUIRED', errors: ['成绩保存必须指定班级'] };
  return { ok: true, collection, action, datasetId, uuid, recordUuid: String(event.recordUuid || '').trim(), classUuid: String(event.classUuid || '').trim(), examUuid: String(event.examUuid || '').trim(), studentUuid: String(event.studentUuid || '').trim(), itemUuid: String(event.itemUuid || '').trim(), month: String(event.month || '').trim(), includeVoided: event.includeVoided === true, groupNo: Number(event.groupNo), groupDays: String(event.groupDays || '').trim(), groupCount: Number(event.groupCount), rows: Array.isArray(event.rows) ? event.rows : [], record: event.record || {}, layout: event.layout || null };
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
    if (request.collection !== 'seat_layouts' || !request.classUuid || !request.layout || !Array.isArray(request.layout.grid)) return { ok: false, code: 'LAYOUT_INVALID', errors: ['布局快照参数无效'] };
    const now = new Date().toISOString();
    const result = await db.collection('seat_layouts').add({ data: { ...scope, classUuid: request.classUuid, rows: Number(request.layout.rows) || 0, cols: Number(request.layout.cols) || 0, grid: request.layout.grid.slice(0, 500), savedAt: now, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, uuid: crypto.randomUUID(), source: 'miniprogram' } });
    return { ok: true, action: 'layoutSave', cloudId: result._id };
  }
  if (request.action === 'history') {
    if (request.collection !== 'assessment_revisions' || !request.recordUuid) return { ok: false, code: 'HISTORY_QUERY_INVALID', errors: ['修正历史查询参数无效'] };
    const result = await db.collection('assessment_revisions').where({ ...scope, recordUuid: request.recordUuid }).limit(100).get();
    return { ok: true, records: result.data };
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
      await db.collection('assessment_records').add({ data: { ...scope, classUuid: request.classUuid, studentUuid, itemUuid: request.itemUuid, date: rowDate, categoryName: categoryResult.data[0].name || '', itemName: item.name || String(input.itemName || '').trim(), score, allowDailyRepeat, remark: String(input.remark || '').trim().slice(0, 500), uuid: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, status: 'active', revision: 1, source: 'miniprogram' } }); count += 1;
    }
    return { ok: true, action: 'batchAssessment', count, total: request.rows.slice(0, 500).length, skipped };
  }
  if (request.action === 'contactStats') {
    if (request.collection !== 'contacts') return { ok: false, code: 'CONTACT_ACTION_INVALID', errors: ['家校沟通统计只能用于 contacts 集合'] };
    const result = await db.collection('contacts').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: null }).limit(500).get();
    const rows = request.month ? result.data.filter((row) => String(row.date || '').startsWith(request.month)) : result.data;
    return { ok: true, total: rows.length, students: new Set(rows.map((row) => row.studentUuid).filter(Boolean)).size, visits: rows.filter((row) => row.method === '家访').length, phones: rows.filter((row) => row.method === '电话').length };
  }
  if (['autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders'].includes(request.action) && request.collection !== 'duties') return { ok: false, code: 'DUTY_ACTION_INVALID', errors: ['值日操作只能用于 duties 集合'] };
  if (['autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders'].includes(request.action) && !request.classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['请先选择班级'] };
  if (request.action === 'groupDays') {
    if (!Number.isInteger(request.groupNo) || request.groupNo < 1 || request.groupNo > 20 || (request.groupDays && !/^[1-7](,[1-7])*$/.test(request.groupDays))) return { ok: false, code: 'DUTY_DAYS_INVALID', errors: ['组号或星期格式无效'] };
    const rows = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, role: '值日生', groupNo: request.groupNo, deletedAt: null }).limit(100).get();
    if (!rows.data.length) return { ok: false, code: 'DUTY_GROUP_NOT_FOUND', errors: ['值日组不存在'] };
    for (const row of rows.data) await db.collection('duties').doc(row._id).update({ data: { groupDays: request.groupDays, updatedAt: new Date().toISOString(), revision: (row.revision || 1) + 1 } });
    return { ok: true, action: 'groupDays', count: rows.data.length };
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
    const roles = request.action === 'presetLeaders' ? ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'] : ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];
    const existing = await db.collection('duties').where({ ...scope, classUuid: request.classUuid, deletedAt: null }).limit(500).get();
    const existingRoles = new Set(existing.data.map((row) => row.role));
    const held = new Set(existing.data.filter((row) => row.role !== '值日生').map((row) => row.studentUuid));
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
    const byStudent = new Map(); const bySubject = new Map();
    for (const row of result.data) { byStudent.set(row.studentUuid, (byStudent.get(row.studentUuid) || 0) + Number(row.score || 0)); const list = bySubject.get(row.subject) || []; list.push(Number(row.score || 0)); bySubject.set(row.subject, list); }
    const subjects = [...bySubject].map(([subject, values]) => ({ subject, avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100, max: Math.max(...values), pass: Math.round(values.filter((value) => value >= 60).length / values.length * 100) }));
    const ranking = [...byStudent].sort((a, b) => b[1] - a[1]).map(([studentUuid, total], index) => ({ studentUuid, total, rank: index + 1 }));
    return { ok: true, subjects, ranking };
  }
  if (request.action === 'trend') {
    const result = await db.collection('scores').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), studentUuid: request.studentUuid, deletedAt: null }).limit(500).get();
    return { ok: true, points: result.data };
  }
  if (request.action === 'summary') {
    const collections = [...COLLECTIONS];
    const counts = {};
    for (const collection of collections) {
      const classScoped = ['students', 'seats', 'duties', 'scores', 'exams', 'contacts', 'documents', 'assessment_records'].includes(collection) && request.classUuid ? { classUuid: request.classUuid } : {};
      counts[collection] = (await db.collection(collection).where({ ...scope, ...classScoped, ...(collection === 'assessment_records' && request.includeVoided ? {} : { deletedAt: null }) }).count()).total;
    }
    return { ok: true, counts };
  }
  const collection = db.collection(request.collection);
  if (request.action === 'query') {
    const result = await collection.where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), ...(request.studentUuid ? { studentUuid: request.studentUuid } : {}), ...(request.collection === 'assessment_records' && request.includeVoided ? {} : { deletedAt: null }) }).limit(100).get();
    return { ok: true, records: result.data };
  }
  const now = new Date().toISOString();
  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await collection.add({ data: { ...sanitize(request.record), ...scope, uuid, createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram' } });
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

module.exports = { COLLECTIONS, ACTIONS, normalize, sanitize, main };
