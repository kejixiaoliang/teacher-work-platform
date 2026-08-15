import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessmentCsv, assessmentJson } from '../web/src/utils/exportAssessment.js';

test('formats assessment CSV with BOM and escaped fields', () => {
  const csv = assessmentCsv([
    { name: '张三', remark: '表现好，继续保持' },
    { name: '李四', remark: '包含"引号"' },
  ], ['name', 'remark']);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /"张三","表现好，继续保持"/);
  assert.match(csv, /"李四","包含""引号"""/);
});

test('formats assessment JSON with export metadata', () => {
  const json = assessmentJson({ classId: 1, month: '2026-08' }, { ranking: [] }, [], []);
  const parsed = JSON.parse(json);
  assert.equal(parsed.schemaVersion, 1);
  assert.deepEqual(parsed.filters, { classId: 1, month: '2026-08' });
  assert.ok(parsed.exportedAt);
});

test('loads ExcelJS only inside the Excel exporter', () => {
  const source = fs.readFileSync('web/src/utils/exportAssessment.js', 'utf8');
  assert.match(source, /import\(['"]exceljs['"]\)/);
  assert.doesNotMatch(source, /^import\s+.*exceljs/m);
});
