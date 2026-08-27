import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentImportRequest,
  mergeStudentImportResult,
  normalizeStudentImportHistory,
  parseStudentRosterText,
  precheckStudentRows,
} from '../miniprogram/services/student-import-service.js';

test('student roster CSV maps the desktop headers and reports invalid rows', () => {
  const result = parseStudentRosterText([
    '学号,姓名（必填）,性别（男/女）,出生日期,联系电话,家长电话,是否住宿（是/否）,兴趣特长/职务,健康状况/过敏史,身高(cm),左眼视力,右眼视力,是否近视（是/否）,成绩等级（优/良/中/待提高）,特殊座位需求,备注',
    '001,张三,男,2012-01-02,13800000000,13900000000,是,篮球,无,158cm,4.8,4.9,否,良,靠前,班长',
    ',,,,,,,,,,,,,,,',
    '002,,女,,,,否,,,,,,是,,,',
  ].join('\n'), { fileName: '学生名单.csv' });

  assert.equal(result.format, 'csv');
  assert.equal(result.total, 2);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    _row: 2,
    school_no: '001',
    name: '张三',
    gender: '男',
    birth_date: '2012-01-02',
    phone: '13800000000',
    parent_phone: '13900000000',
    is_boarding: true,
    interest_duty: '篮球',
    health_note: '无',
    height_cm: 158,
    vision_left: 4.8,
    vision_right: 4.9,
    is_myopia: false,
    grade_level: '良',
    seat_note: '靠前',
    remark: '班长',
  });
  assert.deepEqual(result.fails, [{ row: 4, reason: '姓名为空，请填写姓名列' }]);
});

test('student roster JSON accepts the mobile exchange envelope and keeps stable client fields', () => {
  const stableUuid = 'b71dbe10-393f-4d2d-96bc-e35144136020';
  const result = parseStudentRosterText(JSON.stringify({
    format: 'teacher-work-student-roster',
    formatVersion: 1,
    datasetId: 'source-dataset',
    students: [{ uuid: stableUuid, school_no: '003', name: '李四', is_boarding: true }],
  }), { fileName: '学生名单.json' });

  assert.equal(result.format, 'json');
  assert.equal(result.rows[0].school_no, '003');
  assert.equal(result.rows[0].name, '李四');
  assert.equal(result.rows[0].is_boarding, true);
  assert.equal(result.rows[0].uuid, stableUuid);
  assert.equal('datasetId' in result.rows[0], false);
});

test('student roster precheck rejects duplicates inside the file and current class', () => {
  const result = precheckStudentRows([
    { _row: 2, school_no: '001', name: '张三' },
    { _row: 3, school_no: '001', name: '张三副本' },
    { _row: 4, school_no: '009', name: '王五' },
  ], [{ schoolNo: '009', name: '已有学生' }]);

  assert.deepEqual(result.rows, [{ _row: 2, school_no: '001', name: '张三' }]);
  assert.deepEqual(result.fails, [
    { row: 3, name: '张三副本', reason: '学号 001 在文件中重复' },
    { row: 4, name: '王五', reason: '学号 009 已存在于当前班级' },
  ]);
});

test('student import request keeps dataset and class scope and excludes preview metadata', () => {
  const request = buildStudentImportRequest({
    datasetId: ' dataset-1 ',
    classUuid: ' class-1 ',
    fileName: ' 七年级一班.csv ',
    fileFormat: 'csv',
    rows: [{ _row: 2, school_no: '001', name: '张三' }],
    precheckFailures: [{ row: 3, name: '', reason: '姓名为空，请填写姓名列' }],
    precheckFailures: [{ row: 3, name: '', reason: '姓名为空，请填写姓名列' }],
  });
  assert.deepEqual(request, {
    action: 'import',
    datasetId: 'dataset-1',
    classUuid: 'class-1',
    fileName: '七年级一班.csv',
    fileFormat: 'csv',
    students: [{ _row: 2, school_no: '001', name: '张三' }],
    precheckFailures: [{ row: 3, name: '', reason: '姓名为空，请填写姓名列' }],
    precheckFailures: [{ row: 3, name: '', reason: '姓名为空，请填写姓名列' }],
  });
  assert.throws(() => buildStudentImportRequest({ datasetId: 'ds', classUuid: '', rows: [{}] }), /班级/);
});

test('student import result merges local precheck failures with server failures', () => {
  const result = mergeStudentImportResult({
    total: 3,
    localFails: [{ row: 4, name: '', reason: '姓名为空，请填写姓名列' }],
    response: {
      ok: true,
      success: [{ row: 2, name: '张三', uuid: 'u1' }],
      fail: [{ row: 3, name: '李四', reason: '学号 002 已存在于当前班级' }],
    },
  });
  assert.deepEqual(result, {
    ok: true,
    success: [{ row: 2, name: '张三', uuid: 'u1' }],
    fail: [
      { row: 4, name: '', reason: '姓名为空，请填写姓名列' },
      { row: 3, name: '李四', reason: '学号 002 已存在于当前班级' },
    ],
    counts: { total: 3, success: 1, failed: 2 },
  });
});

test('student import history normalizes counts, timestamps and failure details for the page', () => {
  const result = normalizeStudentImportHistory({
    ok: true,
    records: [{
      importBatchId: 'batch-1', sourceFileName: '名单.csv', sourceFormat: 'csv', resultStatus: 'partial',
      totalCount: 3, successCount: 2, failedCount: 1,
      failures: [{ row: 4, name: '李四', reason: '学号重复' }], createdAt: '2026-08-28T01:23:45.000Z',
      ownerId: 'must-not-reach-view', _openid: 'must-not-reach-view',
    }],
  });
  assert.deepEqual(result, {
    ok: true,
    error: '',
    records: [{
      importBatchId: 'batch-1', fileName: '名单.csv', fileFormat: 'csv', resultStatus: 'partial',
      totalCount: 3, successCount: 2, failedCount: 1,
      failures: [{ row: 4, name: '李四', reason: '学号重复' }], createdAtText: '2026-08-28 09:23',
    }],
  });
  assert.deepEqual(normalizeStudentImportHistory({ ok: false, errors: ['无权限'] }), { ok: false, error: '无权限', records: [] });
});
