import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const excel = require(path.join(root, 'cloudfunctions/excel-exchange/index.js'));

test('Excel exchange normalizes headers and preserves all student fields', async () => {
  const base64 = await excel.buildStudentWorkbook([{ school_no: '001', name: '张三', gender: '男', parent_phone: '13800138000', health_note: '花粉过敏', uuid: '123e4567-e89b-12d3-a456-426614174000' }]);
  const rows = await excel.parseWorkbook(base64, 'students');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '张三');
  assert.equal(rows[0].parent_phone, '13800138000');
  assert.equal(rows[0].health_note, '花粉过敏');
  assert.equal(rows[0].uuid, '123e4567-e89b-12d3-a456-426614174000');
});

test('Excel exchange parses score matrix and protects formula-looking text on export', async () => {
  const base64 = await excel.buildScoreWorkbook({ subjects: ['语文', '数学'], rows: [{ schoolNo: '001', name: '=危险', values: { 语文: 98, 数学: 87 } }] });
  const rows = await excel.parseWorkbook(base64, 'scores');
  assert.deepEqual(rows.map(({ schoolNo, studentName, subject, score }) => ({ schoolNo, studentName, subject, score })), [
    { schoolNo: '001', studentName: "'=危险", subject: '语文', score: 98 },
    { schoolNo: '001', studentName: "'=危险", subject: '数学', score: 87 },
  ]);
});

test('Excel exchange validates action before requiring file content', () => {
  assert.deepEqual(excel.normalizeRequest({ action: 'unknown' }), { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['Excel 操作不支持'] });
  assert.deepEqual(excel.normalizeRequest({ action: 'parseStudents' }), { ok: true, action: 'parseStudents' });
});

test('mobile student and score flows expose xlsx import/export hooks', () => {
  const studentImport = fs.readFileSync(path.join(root, 'miniprogram/services/student-import-service.js'), 'utf8');
  const studentExport = fs.readFileSync(path.join(root, 'miniprogram/services/student-export-service.js'), 'utf8');
  const scoreFile = fs.readFileSync(path.join(root, 'miniprogram/services/score-file-service.js'), 'utf8');
  const studentsPage = fs.readFileSync(path.join(root, 'miniprogram/pages/students/index.js'), 'utf8');
  const scoresPage = fs.readFileSync(path.join(root, 'miniprogram/pages/scores/index.js'), 'utf8');
  assert.match(studentImport, /parseStudents/);
  assert.match(studentImport, /xlsx/);
  assert.match(studentExport, /exportStudentRosterXlsxFile/);
  assert.match(scoreFile, /parseScores/);
  assert.match(scoreFile, /exportScoreXlsxFile/);
  assert.match(studentsPage, /exportStudentsXlsx/);
  assert.match(scoresPage, /exportScoreXlsxFile/);
});
