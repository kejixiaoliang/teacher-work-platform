import test from 'node:test';
import assert from 'node:assert/strict';

test('student function supports scoped list and recycle actions', async () => {
  const { normalizeRequest } = await import('../cloudfunctions/student-data/index.js');
  assert.deepEqual(normalizeRequest({ datasetId: 'ds', action: 'list' }), { ok: true, action: 'list', datasetId: 'ds', classUuid: '', trashed: false });
  assert.equal(normalizeRequest({ datasetId: 'ds', action: 'restore' }).code, 'UUIDS_REQUIRED');
  assert.deepEqual(normalizeRequest({ datasetId: 'ds', action: 'purge', uuids: ['s1', 's1'] }), { ok: true, action: 'purge', datasetId: 'ds', uuids: ['s1'] });
});

test('student list page exposes recycle and delete actions', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile('miniprogram/pages/students/index.js', 'utf8');
  const wxml = await fs.readFile('miniprogram/pages/students/index.wxml', 'utf8');
  assert.match(source, /listStudentData/);
  assert.match(source, /action: 'restore'/);
  assert.match(source, /action: 'purge'/);
  assert.match(wxml, /回收站/);
  assert.match(wxml, /deleteStudent/);
  assert.match(source, /copyStudentRoster/);
  assert.match(source, /classUuid: this.data.classUuid/);
  assert.match(wxml, /复制名单 JSON/);
});

test('student roster export keeps stable identifiers and client field names', async () => {
  const { buildStudentRoster } = await import('../miniprogram/services/student-export-service.js');
  const result = buildStudentRoster([{ uuid: 's1', schoolNo: '001', name: '学生甲', isBoarding: true }], { datasetId: 'ds' });
  assert.equal(result.format, 'teacher-work-student-roster');
  assert.deepEqual(result.students[0], { uuid: 's1', school_no: '001', name: '学生甲', gender: '', birth_date: null, phone: '', parent_phone: '', is_boarding: true, height_cm: null, vision_left: null, vision_right: null, is_myopia: false, grade_level: '', seat_note: '', interest_duty: '', status: '在读', follow_up_status: '正常', remark: '' });
});
