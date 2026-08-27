const crypto = require('node:crypto');

const WRITABLE_FIELDS = new Set([
  'name', 'schoolNo', 'school_no', 'gender', 'birthDate', 'birth_date', 'phone',
  'parentPhone', 'parent_phone', 'isBoarding', 'is_boarding', 'interestDuty',
  'interest_duty', 'healthNote', 'health_note', 'heightCm', 'height_cm',
  'visionLeft', 'vision_left', 'visionRight', 'vision_right', 'isMyopia',
  'is_myopia', 'gradeLevel', 'grade_level', 'seatNote', 'seat_note', 'remark',
]);

function cleanFields(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (WRITABLE_FIELDS.has(key)) output[key] = value;
  }
  if (typeof output.name !== 'string' || !output.name.trim()) {
    return { ok: false, code: 'NAME_REQUIRED', errors: ['学生姓名不能为空'] };
  }
  output.name = output.name.trim();
  return { ok: true, fields: output };
}

function normalizeRequest(event = {}) {
  const datasetId = typeof event.datasetId === 'string' ? event.datasetId.trim() : '';
  const uuid = typeof event.uuid === 'string' ? event.uuid.trim() : '';
  const classUuid = typeof event.classUuid === 'string' ? event.classUuid.trim() : '';
  const action = event.action || 'list';
  if (!datasetId) return { ok: false, code: 'DATASET_REQUIRED', errors: ['datasetId 不能为空'] };
  if (!['list', 'create', 'update', 'delete', 'restore', 'purge', 'import', 'history'].includes(action)) {
    return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该学生操作'] };
  }
  if (['update', 'delete'].includes(action) && !uuid) return { ok: false, code: 'UUID_REQUIRED', errors: ['学生 uuid 不能为空'] };
  if (action === 'list') return { ok: true, action, datasetId, classUuid, trashed: event.trashed === true };
  if (action === 'history') {
    if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
    return { ok: true, action, datasetId, classUuid };
  }
  if (action === 'import') {
    if (!classUuid) return { ok: false, code: 'CLASS_REQUIRED', errors: ['classUuid 不能为空'] };
    if (!Array.isArray(event.students) || !event.students.length) return { ok: false, code: 'STUDENTS_REQUIRED', errors: ['待导入学生不能为空'] };
    const precheckFailures = Array.isArray(event.precheckFailures) ? event.precheckFailures : [];
    if (event.students.length + precheckFailures.length > 200) return { ok: false, code: 'IMPORT_LIMIT_EXCEEDED', errors: ['单次最多处理 200 行学生数据'] };
    const students = [];
    const rejected = precheckFailures.map((failure) => ({
      row: Number.isSafeInteger(failure?.row) && failure.row > 0 ? failure.row : 0,
      name: typeof failure?.name === 'string' ? failure.name.trim().slice(0, 80) : '',
      reason: typeof failure?.reason === 'string' && failure.reason.trim() ? failure.reason.trim().slice(0, 200) : '预检失败',
    }));
    event.students.forEach((student, index) => {
      const row = Number.isSafeInteger(student?._row) && student._row > 0 ? student._row : index + 1;
      const cleaned = cleanFields(student);
      if (!cleaned.ok) {
        rejected.push({ row, name: typeof student?.name === 'string' ? student.name.trim() : '', reason: cleaned.errors[0] });
        return;
      }
      const uuid = typeof student?.uuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(student.uuid.trim()) ? student.uuid.trim() : '';
      students.push({ row, ...(uuid ? { uuid } : {}), fields: cleaned.fields });
    });
    const rawFileName = typeof event.fileName === 'string' ? event.fileName.trim().split(/[\\/]/).pop() : '';
    const fileName = rawFileName ? rawFileName.slice(0, 120) : '学生名单';
    const fileFormat = ['csv', 'json'].includes(event.fileFormat) ? event.fileFormat : 'unknown';
    return { ok: true, action, datasetId, classUuid, fileName, fileFormat, students, rejected };
  }
  if (['restore', 'purge'].includes(action)) {
    const uuids = Array.isArray(event.uuids) ? event.uuids.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [];
    if (!uuids.length) return { ok: false, code: 'UUIDS_REQUIRED', errors: ['未选择学生'] };
    return { ok: true, action, datasetId, uuids: [...new Set(uuids)] };
  }
  if (action !== 'delete') {
    const cleaned = cleanFields(event.student);
    if (!cleaned.ok) return cleaned;
    return { ok: true, action, datasetId, uuid, classUuid, fields: cleaned.fields };
  }
  return { ok: true, action, datasetId, uuid, classUuid };
}

function buildStudentImportBatch({ ownerId, datasetId, classUuid, fileName, fileFormat, now, importBatchId }) {
  return {
    importBatchId,
    ownerId,
    _openid: ownerId,
    datasetId,
    classUuid,
    batchType: 'student-roster',
    sourceFileName: String(fileName || '').trim().slice(0, 120) || '学生名单',
    sourceFormat: ['csv', 'json'].includes(fileFormat) ? fileFormat : 'unknown',
    status: 'pending',
    resultStatus: 'pending',
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    failures: [],
    createdAt: now,
    completedAt: null,
  };
}

async function listStudentImportHistory({ db, ownerId, datasetId, classUuid }) {
  const result = await db.collection('import_batches').where({
    ownerId, datasetId, batchType: 'student-roster', classUuid,
  }).orderBy('createdAt', 'desc').limit(30).get();
  const fields = [
    'importBatchId', 'sourceFileName', 'sourceFormat', 'status', 'resultStatus', 'totalCount',
    'successCount', 'failedCount', 'failures', 'createdAt', 'completedAt',
  ];
  const records = result.data.map((row) => Object.fromEntries(fields
    .filter((field) => row[field] !== undefined)
    .map((field) => [field, row[field]])));
  return { ok: true, action: 'history', records };
}

function studentIdentity(student = {}) {
  const schoolNo = String(student.schoolNo ?? student.school_no ?? '').trim().toLowerCase();
  if (schoolNo) return { key: `school:${schoolNo}`, label: `学号 ${String(student.schoolNo ?? student.school_no).trim()}` };
  const name = String(student.name || '').trim().toLowerCase();
  const birthDate = String(student.birthDate ?? student.birth_date ?? '').trim();
  if (birthDate) return { key: `name-birth:${name}|${birthDate}`, label: `姓名和出生日期 ${student.name} / ${birthDate}` };
  return { key: '', label: '' };
}

async function importStudents({
  db, ownerId, datasetId, classUuid, fileName = '学生名单', fileFormat = 'unknown', students, rejected = [], now,
  uuidFactory = crypto.randomUUID, batchUuidFactory = crypto.randomUUID, recordHistory = true,
}) {
  const scope = { ownerId, datasetId };
  const classResult = await db.collection('classes').where({ ...scope, uuid: classUuid, deletedAt: null }).limit(1).get();
  if (!classResult.data.length) return { ok: false, code: 'CLASS_NOT_FOUND', errors: ['未找到当前数据集中的班级'] };

  let importBatchId = '';
  let batchDocumentId = '';
  if (recordHistory) {
    importBatchId = batchUuidFactory();
    const batch = buildStudentImportBatch({ ownerId, datasetId, classUuid, fileName, fileFormat, now, importBatchId });
    try {
      const created = await db.collection('import_batches').add({ data: batch });
      batchDocumentId = created._id;
    } catch {
      return { ok: false, code: 'IMPORT_HISTORY_CREATE_FAILED', errors: ['无法创建导入批次，未写入学生数据'] };
    }
  }

  const current = await db.collection('students').where({ ...scope, classUuid, deletedAt: null }).limit(500).get();
  const identities = new Set(current.data.map((student) => studentIdentity(student).key).filter(Boolean));
  const uuids = new Set(current.data.map((student) => student.uuid).filter(Boolean));
  const success = [];
  const fail = [...rejected];
  for (const student of students) {
    const itemIdentity = studentIdentity(student.fields);
    if (itemIdentity.key && identities.has(itemIdentity.key)) {
      fail.push({ row: student.row, name: student.fields.name, reason: `${itemIdentity.label} 已存在于当前班级` });
      continue;
    }
    const uuid = student.uuid || uuidFactory();
    if (student.uuid) {
      const duplicateUuid = await db.collection('students').where({ ...scope, uuid: student.uuid }).limit(1).get();
      if (duplicateUuid.data.length) {
        fail.push({ row: student.row, name: student.fields.name, reason: `学生 UUID ${student.uuid} 已存在于当前数据集` });
        continue;
      }
    }
    if (uuids.has(uuid)) {
      fail.push({ row: student.row, name: student.fields.name, reason: `学生 UUID ${uuid} 已存在于当前数据集` });
      continue;
    }
    try {
      await db.collection('students').add({ data: {
        ...student.fields, ...scope, _openid: ownerId, classUuid, uuid,
        createdAt: now, updatedAt: now, deletedAt: null, revision: 1, source: 'miniprogram-import',
      } });
      if (itemIdentity.key) identities.add(itemIdentity.key);
      uuids.add(uuid);
      success.push({ row: student.row, name: student.fields.name, uuid });
    } catch {
      fail.push({ row: student.row, name: student.fields.name, reason: '云端写入失败，请稍后重试' });
    }
  }
  const result = {
    ok: true,
    action: 'import',
    success,
    fail,
    counts: { total: students.length + rejected.length, success: success.length, failed: fail.length },
  };
  if (!recordHistory) return result;

  const batchResult = {
    status: 'completed',
    resultStatus: fail.length ? (success.length ? 'partial' : 'failed') : 'completed',
    totalCount: result.counts.total,
    successCount: result.counts.success,
    failedCount: result.counts.failed,
    failures: fail.slice(0, 50),
    completedAt: now,
  };
  try {
    await db.collection('import_batches').doc(batchDocumentId).update({ data: batchResult });
    return { ...result, importBatchId, historySaved: true };
  } catch {
    return { ...result, importBatchId, historySaved: false, historyWarning: '学生已写入，但导入历史更新失败' };
  }
}

async function main(event) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };

  const request = normalizeRequest(event);
  if (!request.ok) return request;
  const db = cloud.database();
  const now = new Date().toISOString();
  const scope = { ownerId: context.OPENID, datasetId: request.datasetId };

  if (request.action === 'list') {
    const result = await db.collection('students').where({ ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), deletedAt: request.trashed ? db.command.neq(null) : null }).orderBy('schoolNo', 'asc').limit(500).get();
    return { ok: true, action: 'list', trashed: request.trashed, records: result.data };
  }

  if (request.action === 'history') {
    return listStudentImportHistory({ db, ownerId: context.OPENID, datasetId: request.datasetId, classUuid: request.classUuid });
  }

  if (request.action === 'restore' || request.action === 'purge') {
    const rows = await db.collection('students').where({ ...scope, uuid: db.command.in(request.uuids), deletedAt: db.command.neq(null) }).limit(500).get();
    if (request.action === 'restore') {
      const skipped = [];
      let count = 0;
      for (const row of rows.data) {
        if (row.schoolNo) {
          const duplicate = await db.collection('students').where({ ...scope, schoolNo: row.schoolNo, deletedAt: null }).limit(1).get();
          if (duplicate.data.length) { skipped.push({ uuid: row.uuid, name: row.name, reason: `学号 ${row.schoolNo} 已被在册学生占用` }); continue; }
        }
        await db.collection('students').doc(row._id).update({ data: { deletedAt: null, updatedAt: now, revision: (row.revision || 1) + 1 } });
        count += 1;
      }
      return { ok: true, action: 'restore', count, skipped };
    }
    const blocked = [];
    for (const row of rows.data) {
      const history = await db.collection('assessment_records').where({ ...scope, studentUuid: row.uuid }).limit(1).get();
      if (history.data.length) blocked.push(row.name || row.uuid);
    }
    if (blocked.length) return { ok: false, code: 'STUDENT_HAS_ASSESSMENT_HISTORY', errors: [`${blocked.join('、')} 存在表现量化历史，不能彻底删除`] };
    for (const row of rows.data) await db.collection('students').doc(row._id).remove();
    return { ok: true, action: 'purge', count: rows.data.length };
  }

  if (request.action === 'import') {
    return importStudents({
      db, ownerId: context.OPENID, datasetId: request.datasetId, classUuid: request.classUuid,
      fileName: request.fileName, fileFormat: request.fileFormat, students: request.students, rejected: request.rejected, now,
    });
  }

  if (request.action === 'create') {
    const uuid = crypto.randomUUID();
    const result = await db.collection('students').add({ data: {
      ...request.fields, ...scope, ...(request.classUuid ? { classUuid: request.classUuid } : {}), uuid, createdAt: now, updatedAt: now,
      deletedAt: null, revision: 1, source: 'miniprogram',
    } });
    return { ok: true, action: 'create', uuid, cloudId: result._id, revision: 1 };
  }

  const query = db.collection('students').where({ ...scope, uuid: request.uuid, deletedAt: null });
  const current = await query.limit(1).get();
  if (!current.data.length) return { ok: false, code: 'STUDENT_NOT_FOUND', errors: ['未找到可操作的学生'] };
  const row = current.data[0];
  if (request.action === 'delete') {
    const revision = (row.revision || 1) + 1;
    await db.collection('students').doc(row._id).update({ data: { deletedAt: now, updatedAt: now, revision } });
    return { ok: true, action: 'delete', uuid: request.uuid, revision };
  }
  const revision = (row.revision || 1) + 1;
  await db.collection('students').doc(row._id).update({ data: { ...request.fields, updatedAt: now, revision } });
  return { ok: true, action: 'update', uuid: request.uuid, revision };
}

module.exports = {
  WRITABLE_FIELDS, cleanFields, normalizeRequest, buildStudentImportBatch, listStudentImportHistory,
  studentIdentity, importStudents, main,
};
