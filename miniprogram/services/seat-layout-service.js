function numberValue(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function studentId(student = {}) {
  return String(student.uuid ?? student.id ?? student.studentUuid ?? student.student_id ?? '');
}

function noteOf(student = {}) {
  return String(student.seatNote ?? student.seat_note ?? '').trim();
}

function gradeOf(student = {}) {
  return String(student.gradeLevel ?? student.grade_level ?? '').trim();
}

function isMyopic(student = {}) {
  if (student.isMyopia === true || student.is_myopia === true) return true;
  const left = numberValue(student.visionLeft ?? student.vision_left, 5);
  const right = numberValue(student.visionRight ?? student.vision_right, 5);
  return Math.min(left || 5, right || 5) < 5;
}

function needs(student = {}) {
  const note = noteOf(student);
  return {
    front: /第一排|前排|靠前|前面/.test(note),
    back: /最后一排|后排|靠后|后面/.test(note),
    center: /中间|居中/.test(note),
    aisle: /过道/.test(note),
    window: /靠窗|窗边/.test(note),
  };
}

export function hasAisleBefore(col, cols, aisleMode) {
  const oneBased = Number(col) + 1;
  if (Number(aisleMode) === 1) return oneBased === Math.ceil(Number(cols) / 2);
  if (Number(aisleMode) === 2) return oneBased === Math.ceil(Number(cols) / 3) || oneBased === Math.ceil(Number(cols) * 2 / 3);
  return false;
}

function isAisleSeat(col, cols, aisleMode) {
  return hasAisleBefore(col, cols, aisleMode) || hasAisleBefore(col + 1, cols, aisleMode);
}

function areNeighbors(a, b, cols, aisleMode) {
  return a.row === b.row && Math.abs(a.col - b.col) === 1 && !hasAisleBefore(Math.max(a.col, b.col), cols, aisleMode);
}

export function resizeGrid(grid = [], rows, cols) {
  const safeRows = Math.max(1, Math.min(20, Number(rows) || 1));
  const safeCols = Math.max(1, Math.min(20, Number(cols) || 1));
  const existing = new Map();
  const removed = [];
  for (const seat of Array.isArray(grid) ? grid : []) {
    const row = Number(seat.row); const col = Number(seat.col);
    const normalized = { row, col, studentUuid: String(seat.studentUuid || ''), locked: seat.locked === true };
    if (row >= 0 && row < safeRows && col >= 0 && col < safeCols) existing.set(`${row}:${col}`, normalized);
    else if (normalized.studentUuid || normalized.locked) removed.push(normalized);
  }
  const next = [];
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) next.push(existing.get(`${row}:${col}`) || { row, col, studentUuid: '', locked: false });
  }
  return { grid: next, removed };
}

function requirementCost(student, seat, rows, cols, aisleMode, nearVision) {
  const requirement = needs(student);
  const center = (cols - 1) / 2;
  let cost = seat.row * 2 + Math.abs(seat.col - center);
  if (requirement.front) cost += seat.row * 1000;
  if (requirement.back) cost += Math.abs(rows - 1 - seat.row) * 1000;
  if (requirement.center || (nearVision && isMyopic(student))) cost += Math.abs(seat.col - center) * 100;
  if (requirement.window) cost += [0, cols - 1].includes(seat.col) ? 0 : 1000;
  if (requirement.aisle) cost += isAisleSeat(seat.col, cols, aisleMode) ? 0 : 1000;
  return cost;
}

function requirementConflicts(student, seat, rows, cols, aisleMode, nearVision) {
  const requirement = needs(student);
  const center = (cols - 1) / 2;
  const messages = [];
  if (requirement.front && seat.row !== 0) messages.push('未安排在第一排');
  if (requirement.back && seat.row !== rows - 1) messages.push('未安排在最后一排');
  if (requirement.center && Math.abs(seat.col - center) > 0.5) messages.push('未安排在中间列');
  if (requirement.window && ![0, cols - 1].includes(seat.col)) messages.push('未安排在窗边');
  if (requirement.aisle && !isAisleSeat(seat.col, cols, aisleMode)) messages.push('未安排在过道旁');
  if (nearVision && isMyopic(student) && Math.abs(seat.col - center) > Math.max(1, cols / 4)) messages.push('近视学生未安排在中间区域');
  return messages;
}

export function arrangeStudents({ students = [], grid = [], rows = 6, cols = 8, aisleMode = 1, options = {} } = {}) {
  const safeRows = Math.max(1, Math.min(20, Number(rows) || 6));
  const safeCols = Math.max(1, Math.min(20, Number(cols) || 8));
  const nearVision = options.nearVision !== false;
  const mixedGender = options.gender === true || options.mixedGender === true;
  const peerHelp = options.peerHelp === true;
  const studentMap = new Map(students.map((student) => [studentId(student), student]).filter(([id]) => id));
  const resized = resizeGrid(grid, safeRows, safeCols).grid;
  const placed = new Set();
  const next = resized.map((seat) => {
    const id = String(seat.studentUuid || '');
    if (seat.locked && id && studentMap.has(id) && !placed.has(id)) { placed.add(id); return { ...seat, studentUuid: id }; }
    return { ...seat, studentUuid: '', locked: seat.locked === true };
  });
  const free = () => next.filter((seat) => !seat.locked && !seat.studentUuid);
  const place = (student, seat) => { seat.studentUuid = studentId(student); placed.add(studentId(student)); };
  const remaining = students.filter((student) => studentId(student) && !placed.has(studentId(student)));

  if (peerHelp) {
    const weak = remaining.filter((student) => gradeOf(student) === '待提高');
    const high = remaining.filter((student) => ['优', '良'].includes(gradeOf(student)));
    const used = new Set();
    for (let index = 0; index < Math.min(weak.length, high.length); index += 1) {
      const a = weak[index]; const b = high[index];
      const pairs = [];
      for (const first of free()) for (const second of free()) {
        if (first === second || !areNeighbors(first, second, safeCols, aisleMode)) continue;
        let cost = requirementCost(a, first, safeRows, safeCols, aisleMode, nearVision) + requirementCost(b, second, safeRows, safeCols, aisleMode, nearVision);
        const genderA = String(a.gender || ''); const genderB = String(b.gender || '');
        if (mixedGender && genderA && genderB && genderA === genderB) cost += 100;
        pairs.push({ first, second, cost });
      }
      pairs.sort((x, y) => x.cost - y.cost || x.first.row - y.first.row || x.first.col - y.first.col);
      if (pairs[0]) { place(a, pairs[0].first); place(b, pairs[0].second); used.add(studentId(a)); used.add(studentId(b)); }
    }
    for (const id of used) placed.add(id);
  }

  const ordered = remaining.filter((student) => !placed.has(studentId(student))).sort((a, b) => {
    const priority = (student) => needs(student).front ? 0 : (nearVision && isMyopic(student) ? 1 : (needs(student).back ? 3 : 2));
    return priority(a) - priority(b) || numberValue(a.heightCm ?? a.height_cm, 999) - numberValue(b.heightCm ?? b.height_cm, 999) || studentId(a).localeCompare(studentId(b));
  });
  for (const student of ordered) {
    const candidates = free().map((seat) => ({ seat, cost: requirementCost(student, seat, safeRows, safeCols, aisleMode, nearVision) }));
    candidates.sort((a, b) => a.cost - b.cost || a.seat.row - b.seat.row || a.seat.col - b.seat.col);
    if (candidates[0]) place(student, candidates[0].seat);
  }

  const conflicts = [];
  const seatByStudent = new Map(next.filter((seat) => seat.studentUuid).map((seat) => [seat.studentUuid, seat]));
  for (const [id, seat] of seatByStudent) {
    const student = studentMap.get(id);
    for (const message of requirementConflicts(student, seat, safeRows, safeCols, aisleMode, nearVision)) conflicts.push({ type: 'requirement', studentUuid: id, message: `${student.name || '该学生'}：${message}` });
    const neighbors = next.filter((other) => other.studentUuid && areNeighbors(seat, other, safeCols, aisleMode));
    if (peerHelp && gradeOf(student) === '待提高' && !neighbors.some((other) => ['优', '良'].includes(gradeOf(studentMap.get(other.studentUuid))))) conflicts.push({ type: 'peer', studentUuid: id, message: `${student.name || '该学生'}旁边没有优/良同学互助` });
    if (mixedGender && String(student.gender || '') && neighbors.length && !neighbors.some((other) => String(studentMap.get(other.studentUuid)?.gender || '') && studentMap.get(other.studentUuid).gender !== student.gender)) conflicts.push({ type: 'gender', studentUuid: id, message: `${student.name || '该学生'}旁边没有异性同学` });
  }
  const unplaced = students.filter((student) => studentId(student) && !seatByStudent.has(studentId(student))).map((student) => student.name || studentId(student));
  return { grid: next, conflicts, unplaced };
}
