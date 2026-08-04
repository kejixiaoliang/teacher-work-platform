import test from 'node:test';
import assert from 'node:assert/strict';
import { studentClassGuard } from '../web/src/domain/studentClassGuard.js';

test('student entry policy blocks missing classes and explains draft preservation', () => {
  const missing = studentClassGuard(null);
  assert.equal(missing.canCreate, false);
  assert.equal(missing.canImport, false);
  assert.equal(missing.entryMessage, '请先创建班级，再录入或导入学生');
  assert.match(missing.saveMessage, /已填写内容会为你保留/);

  for (const invalid of [undefined, '', 0, -1, Number.NaN]) {
    assert.equal(studentClassGuard(invalid).canCreate, false);
  }
});

test('student entry policy allows a positive class id', () => {
  const valid = studentClassGuard(12);
  assert.equal(valid.canCreate, true);
  assert.equal(valid.canImport, true);
  assert.equal(valid.entryMessage, '');
  assert.equal(valid.saveMessage, '');
});
