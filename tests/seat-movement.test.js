import test from 'node:test';
import assert from 'node:assert/strict';
import { moveSeatOccupants } from '../web/src/domain/seatMovement.js';

function occupied(id, name, extra = {}) {
  return {
    studentId: id, name, gender: id % 2 ? '男' : '女', height_cm: 150 + id,
    vision_left: 4.8, vision_right: 4.9, is_myopia: false, grade_level: '良',
    row: extra.row ?? 0, col: extra.col ?? 0, locked: extra.locked ?? false,
  };
}

function empty(extra = {}) {
  return { studentId: null, name: '', row: extra.row ?? 0, col: extra.col ?? 1, locked: extra.locked ?? false };
}

test('moving to an empty seat preserves physical seat metadata', () => {
  const grid = { '1,1': occupied(1, '甲', { row: 0, col: 0 }), '1,2': empty({ row: 0, col: 1 }) };
  const result = moveSeatOccupants(grid, '1,1', '1,2');
  assert.deepEqual(result, { moved: true, targetWasEmpty: true, reason: '' });
  assert.equal(grid['1,1'].studentId, null);
  assert.equal(grid['1,2'].studentId, 1);
  assert.equal(grid['1,2'].name, '甲');
  assert.deepEqual([grid['1,1'].row, grid['1,1'].col], [0, 0]);
  assert.deepEqual([grid['1,2'].row, grid['1,2'].col], [0, 1]);
});

test('moving onto an occupied seat exchanges occupants', () => {
  const grid = { '1,1': occupied(1, '甲'), '1,2': occupied(2, '乙', { col: 1 }) };
  const result = moveSeatOccupants(grid, '1,1', '1,2');
  assert.deepEqual(result, { moved: true, targetWasEmpty: false, reason: '' });
  assert.deepEqual([grid['1,1'].studentId, grid['1,1'].name], [2, '乙']);
  assert.deepEqual([grid['1,2'].studentId, grid['1,2'].name], [1, '甲']);
});

test('locked seats reject outgoing and incoming movement', () => {
  const lockedSource = { '1,1': occupied(1, '甲', { locked: true }), '1,2': empty() };
  assert.deepEqual(moveSeatOccupants(lockedSource, '1,1', '1,2'), { moved: false, targetWasEmpty: true, reason: 'source-locked' });
  assert.equal(lockedSource['1,1'].studentId, 1);

  const lockedTarget = { '1,1': occupied(1, '甲'), '1,2': empty({ locked: true }) };
  assert.deepEqual(moveSeatOccupants(lockedTarget, '1,1', '1,2'), { moved: false, targetWasEmpty: true, reason: 'target-locked' });
  assert.equal(lockedTarget['1,1'].studentId, 1);
});

test('invalid and no-op moves leave the grid unchanged', () => {
  const grid = { '1,1': occupied(1, '甲'), '1,2': empty() };
  assert.equal(moveSeatOccupants(grid, 'missing', '1,2').reason, 'source-missing');
  assert.equal(moveSeatOccupants(grid, '1,1', 'missing').reason, 'target-missing');
  assert.equal(moveSeatOccupants(grid, '1,2', '1,1').reason, 'source-empty');
  assert.equal(moveSeatOccupants(grid, '1,1', '1,1').reason, 'same-seat');
  assert.equal(grid['1,1'].studentId, 1);
});
