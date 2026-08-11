import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ExcelJS is loaded on demand instead of in the initial bundle', () => {
  for (const file of ['web/src/views/Scores.vue', 'web/src/views/Students.vue', 'web/src/utils/exportExcel.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /^import ExcelJS from ['"]exceljs['"];?$/m, file);
    assert.match(source, /import\(['"]exceljs['"]\)/, file);
  }
});
