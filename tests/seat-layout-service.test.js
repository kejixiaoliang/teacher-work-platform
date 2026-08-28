import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeStudents, hasAisleBefore, resizeGrid } from '../miniprogram/services/seat-layout-service.js';

test('aisle markers match desktop middle and double aisle modes', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, col) => hasAisleBefore(col, 8, 1)), [false, false, false, true, false, false, false, false]);
  assert.deepEqual(Array.from({ length: 9 }, (_, col) => hasAisleBefore(col, 9, 2)), [false, false, true, false, false, true, false, false, false]);
  assert.equal(hasAisleBefore(3, 8, 0), false);
});

test('grid resizing preserves in-bounds seats and reports occupied removals', () => {
  const result = resizeGrid([
    { row: 0, col: 0, studentUuid: 's1', locked: true },
    { row: 2, col: 2, studentUuid: 's2', locked: false },
  ], 2, 2);
  assert.equal(result.grid.length, 4);
  assert.deepEqual(result.grid[0], { row: 0, col: 0, studentUuid: 's1', locked: true });
  assert.deepEqual(result.removed, [{ row: 2, col: 2, studentUuid: 's2', locked: false }]);
});

test('auto arrangement honors locked, front, back, window and aisle requirements', () => {
  const result = arrangeStudents({
    rows: 3, cols: 6, aisleMode: 1,
    grid: [{ row: 1, col: 0, studentUuid: 'locked', locked: true }],
    students: [
      { uuid: 'locked', name: '锁定生' },
      { uuid: 'front', name: '前排生', is_myopia: true, seat_note: '第一排中间' },
      { uuid: 'back', name: '后排生', seat_note: '靠后' },
      { uuid: 'window', name: '窗边生', seat_note: '靠窗' },
      { uuid: 'aisle', name: '过道生', seat_note: '靠过道' },
    ],
    options: { nearVision: true, gender: false, peerHelp: false },
  });
  const byStudent = new Map(result.grid.filter((seat) => seat.studentUuid).map((seat) => [seat.studentUuid, seat]));
  assert.deepEqual(byStudent.get('locked'), { row: 1, col: 0, studentUuid: 'locked', locked: true });
  assert.equal(byStudent.get('front').row, 0);
  assert.equal(byStudent.get('back').row, 2);
  assert.ok([0, 5].includes(byStudent.get('window').col));
  assert.ok([1, 2].includes(byStudent.get('aisle').col));
  assert.deepEqual(result.conflicts.filter((item) => item.type === 'requirement'), []);
});

test('peer help pairs a student needing improvement with a high performer', () => {
  const result = arrangeStudents({
    rows: 1, cols: 4, aisleMode: 0, grid: [],
    students: [
      { uuid: 'weak', name: '待提高生', grade_level: '待提高' },
      { uuid: 'high', name: '优秀生', grade_level: '优' },
      { uuid: 'mid', name: '中等生', grade_level: '中' },
    ],
    options: { nearVision: false, gender: false, peerHelp: true },
  });
  const seats = new Map(result.grid.filter((seat) => seat.studentUuid).map((seat) => [seat.studentUuid, seat]));
  assert.equal(Math.abs(seats.get('weak').col - seats.get('high').col), 1);
  assert.equal(result.conflicts.some((item) => item.type === 'peer'), false);
});
