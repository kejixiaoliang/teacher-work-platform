import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancePointerDrag,
  createPointerDragState,
} from '../web/src/domain/pointerDrag.js';

test('移动距离未超过阈值时仍视为普通点击', () => {
  const down = advancePointerDrag(createPointerDragState(), {
    type: 'down', pointerId: 1, sourceKey: '1-1', x: 10, y: 10,
  });
  const move = advancePointerDrag(down.state, {
    type: 'move', pointerId: 1, targetKey: '1-2', x: 14, y: 13,
  });

  assert.equal(move.state.dragging, false);
  assert.equal(move.state.targetKey, null);
});

test('移动距离超过阈值后进入拖拽并记录目标座位', () => {
  const down = advancePointerDrag(createPointerDragState(), {
    type: 'down', pointerId: 2, sourceKey: '1-1', x: 0, y: 0,
  });
  const move = advancePointerDrag(down.state, {
    type: 'move', pointerId: 2, targetKey: '2-2', x: 7, y: 0,
  });

  assert.equal(move.state.dragging, true);
  assert.equal(move.state.targetKey, '2-2');
});

test('忽略不属于当前拖拽的指针事件', () => {
  const down = advancePointerDrag(createPointerDragState(), {
    type: 'down', pointerId: 3, sourceKey: '1-1', x: 0, y: 0,
  });
  const move = advancePointerDrag(down.state, {
    type: 'move', pointerId: 99, targetKey: '2-2', x: 20, y: 0,
  });

  assert.deepEqual(move.state, down.state);
});

test('取消事件会清空拖拽状态', () => {
  const down = advancePointerDrag(createPointerDragState(), {
    type: 'down', pointerId: 4, sourceKey: '1-1', x: 0, y: 0,
  });
  const cancelled = advancePointerDrag(down.state, {
    type: 'cancel', pointerId: 4,
  });

  assert.deepEqual(cancelled.state, createPointerDragState());
  assert.equal(cancelled.drop, null);
});

test('拖拽松手时返回移动意图并抑制紧随其后的点击', () => {
  const down = advancePointerDrag(createPointerDragState(), {
    type: 'down', pointerId: 5, sourceKey: '1-1', x: 0, y: 0,
  });
  const move = advancePointerDrag(down.state, {
    type: 'move', pointerId: 5, targetKey: '2-2', x: 10, y: 0,
  });
  const up = advancePointerDrag(move.state, {
    type: 'up', pointerId: 5,
  });

  assert.deepEqual(up.drop, { sourceKey: '1-1', targetKey: '2-2' });
  assert.equal(up.suppressClick, true);
  assert.deepEqual(up.state, createPointerDragState());
});
