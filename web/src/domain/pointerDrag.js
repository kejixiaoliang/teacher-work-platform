const DEFAULT_THRESHOLD = 6;

export function createPointerDragState() {
  return {
    pointerId: null,
    sourceKey: null,
    targetKey: null,
    startX: 0,
    startY: 0,
    dragging: false,
  };
}

function result(state, drop = null, suppressClick = false) {
  return { state, drop, suppressClick };
}

export function advancePointerDrag(state, event, threshold = DEFAULT_THRESHOLD) {
  if (event.type === 'down') {
    return result({
      pointerId: event.pointerId,
      sourceKey: event.sourceKey,
      targetKey: null,
      startX: event.x,
      startY: event.y,
      dragging: false,
    });
  }

  if (state.pointerId === null || event.pointerId !== state.pointerId) {
    return result(state);
  }

  if (event.type === 'cancel') {
    return result(createPointerDragState());
  }

  if (event.type === 'move') {
    const distance = Math.hypot(event.x - state.startX, event.y - state.startY);
    const dragging = state.dragging || distance >= threshold;
    return result({
      ...state,
      dragging,
      targetKey: dragging ? (event.targetKey ?? null) : null,
    });
  }

  if (event.type === 'up') {
    const drop = state.dragging && state.targetKey
      ? { sourceKey: state.sourceKey, targetKey: state.targetKey }
      : null;
    return result(createPointerDragState(), drop, state.dragging);
  }

  return result(state);
}
