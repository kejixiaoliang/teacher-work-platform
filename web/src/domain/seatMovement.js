const OCCUPANT_FIELDS = [
  'studentId', 'name', 'gender', 'height_cm', 'vision_left', 'vision_right',
  'is_myopia', 'grade_level',
];

export function moveSeatOccupants(grid, sourceKey, targetKey) {
  const source = grid[sourceKey];
  const target = grid[targetKey];
  const targetWasEmpty = !target?.studentId;
  if (!source) return { moved: false, targetWasEmpty, reason: 'source-missing' };
  if (!target) return { moved: false, targetWasEmpty, reason: 'target-missing' };
  if (sourceKey === targetKey) return { moved: false, targetWasEmpty, reason: 'same-seat' };
  if (!source.studentId) return { moved: false, targetWasEmpty, reason: 'source-empty' };
  if (source.locked) return { moved: false, targetWasEmpty, reason: 'source-locked' };
  if (target.locked) return { moved: false, targetWasEmpty, reason: 'target-locked' };

  for (const field of OCCUPANT_FIELDS) {
    [source[field], target[field]] = [target[field], source[field]];
  }
  return { moved: true, targetWasEmpty, reason: '' };
}
