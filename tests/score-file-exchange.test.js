import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyScoreImportRows,
  buildScoreCsv,
  parseScoreExchangeText,
} from '../miniprogram/services/score-file-service.js';

const students = [
  { uuid: 'student-1', name: '张三', schoolNo: '001' },
  { uuid: 'student-2', name: '李四', school_no: '002' },
];

test('score CSV matches desktop 学号/姓名 headers and dynamic exam subjects', () => {
  const result = parseScoreExchangeText([
    '学号,姓名,语文,数学,历史',
    '001,张三,95,88,70',
    '002,李四,优秀,90,75',
    '009,王五,80,81,82',
  ].join('\n'), { fileName: '期中成绩.csv', students, subjects: ['语文', '数学'] });

  assert.equal(result.format, 'csv');
  assert.equal(result.total, 6);
  assert.deepEqual(result.rows, [
    { row: 2, studentUuid: 'student-1', studentName: '张三', subject: '语文', score: 95 },
    { row: 2, studentUuid: 'student-1', studentName: '张三', subject: '数学', score: 88 },
    { row: 3, studentUuid: 'student-2', studentName: '李四', subject: '数学', score: 90 },
  ]);
  assert.deepEqual(result.fails, [
    { row: 3, name: '李四', subject: '语文', reason: '成绩“优秀”不是有效数字' },
    { row: 4, name: '009', subject: '语文', reason: '未匹配到当前班级学生' },
    { row: 4, name: '009', subject: '数学', reason: '未匹配到当前班级学生' },
  ]);
});

test('score JSON accepts the existing exchange envelope and rejects duplicate cells', () => {
  const result = parseScoreExchangeText(JSON.stringify({
    format: 'teacher-work-score-exchange',
    formatVersion: 1,
    rows: [
      { studentUuid: 'student-1', studentName: '张三', subject: '语文', score: 91 },
      { studentUuid: 'student-1', studentName: '张三', subject: '语文', score: 92 },
      { studentName: '李四', subject: '数学', score: 89 },
      { studentName: '李四', subject: '物理', score: 77 },
    ],
  }), { fileName: '成绩.json', students, subjects: ['语文', '数学'] });

  assert.equal(result.format, 'json');
  assert.equal(result.total, 4);
  assert.deepEqual(result.rows, [
    { row: 1, studentUuid: 'student-1', studentName: '张三', subject: '语文', score: 91 },
    { row: 3, studentUuid: 'student-2', studentName: '李四', subject: '数学', score: 89 },
  ]);
  assert.match(result.fails[0].reason, /重复/);
  assert.match(result.fails[1].reason, /不属于当前考试/);
});

test('score import preview applies only validated cells to the current entry matrix', () => {
  const result = applyScoreImportRows([
    { studentUuid: 'student-1', name: '张三', values: { 语文: '', 数学: 70 } },
    { studentUuid: 'student-2', name: '李四', values: { 语文: 80, 数学: '' } },
  ], [
    { studentUuid: 'student-1', subject: '语文', score: 95 },
    { studentUuid: 'student-2', subject: '数学', score: 89 },
  ]);

  assert.equal(result.applied, 2);
  assert.deepEqual(result.rows[0].values, { 语文: 95, 数学: 70 });
  assert.deepEqual(result.rows[1].values, { 语文: 80, 数学: 89 });
});

test('score CSV export is spreadsheet compatible and prevents formula injection', () => {
  const csv = buildScoreCsv({
    subjects: ['语文', '数学'],
    rows: [
      { studentUuid: 'student-1', name: '=张三', schoolNo: '001', values: { 语文: 95, 数学: '' } },
      { studentUuid: 'student-2', name: '李,四', schoolNo: '002', values: { 语文: 88, 数学: 90 } },
    ],
  });

  assert.match(csv, /^\uFEFF学号,姓名,语文,数学\r\n/);
  assert.match(csv, /001,'=张三,95,/);
  assert.match(csv, /002,"李,四",88,90/);
});


test('score file precheck mirrors the server score range instead of silently dropping values', () => {
  const result = parseScoreExchangeText('学号,姓名,语文\n001,张三,151\n002,李四,-1', {
    fileName: '越界成绩.csv', students, subjects: ['语文'],
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.fails.length, 2);
  assert.match(result.fails[0].reason, /0 到 150/);
  assert.match(result.fails[1].reason, /0 到 150/);
});

test('score JSON rejects empty score values and batches beyond the cloud limit', () => {
  const empty = parseScoreExchangeText(JSON.stringify({
    format: 'teacher-work-score-exchange', formatVersion: 1,
    rows: [{ studentUuid: 'student-1', subject: '语文', score: null }],
  }), { fileName: '空成绩.json', students, subjects: ['语文'] });
  assert.equal(empty.rows.length, 0);
  assert.match(empty.fails[0].reason, /成绩为空/);

  const tooMany = {
    format: 'teacher-work-score-exchange', formatVersion: 1,
    rows: Array.from({ length: 501 }, (_, index) => ({ studentUuid: 'student-1', subject: `科目${index}`, score: 80 })),
  };
  assert.throws(
    () => parseScoreExchangeText(JSON.stringify(tooMany), { fileName: '过大.json', students, subjects: tooMany.rows.map((item) => item.subject) }),
    /最多处理 500 条/,
  );
});
