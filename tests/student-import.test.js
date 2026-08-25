import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudentHeader, parseStudentWorksheet } from '../web/src/domain/studentImport.js';

function worksheet(rows) {
  return {
    rowCount: rows.length,
    columnCount: Math.max(...rows.map(row => row.length)),
    getRow(number) {
      const values = rows[number - 1] || [];
      return { getCell: column => ({ value: values[column - 1] ?? '', text: values[column - 1] ?? '' }) };
    },
  };
}

test('student import accepts common full-width header variants and shifted header rows', () => {
  const result = parseStudentWorksheet(worksheet([
    ['学生名单（请填写）'],
    ['学号', '姓名（必填）', '性别（男/女）', '身高(cm)', '是否近视（是/否）'],
    ['001', '小明', '男', '150', '否'],
    ['', '', '', '', ''],
    ['002', '小红', '女', '158cm', '是'],
  ]));
  assert.equal(result.headerRow, 2);
  assert.equal(result.warning, '');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1].height_cm, 158);
  assert.equal(result.rows[1].is_myopia, true);
  assert.equal(result.fails.length, 0);
});

test('student import reports missing names and falls back to template columns', () => {
  const result = parseStudentWorksheet(worksheet([
    ['学号', '姓名*'],
    ['001', ''],
    ['002', '小明'],
  ]));
  assert.equal(result.warning, '');
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.fails, [{ row: 2, reason: '姓名为空，请填写姓名列' }]);
});

test('student headers normalize punctuation and spaces', () => {
  assert.equal(normalizeStudentHeader(' 是否住宿（是/否） '), '是否住宿是/否');
  assert.equal(normalizeStudentHeader('姓名*'), '姓名');
});
