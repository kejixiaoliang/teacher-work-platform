/**
 * 自动排座算法
 * 优先级：硬约束(特殊需求/锁定) > 身高 > 视力 > 男女/互助(软约束，冲突打标)
 * 输入 students: [{id,name,gender,height_cm,vision_left,vision_right,is_myopia,grade_level,seat_note,locked,lockedRow,lockedCol}]
 * 输出 { seats: [{studentId,row,col,locked}], conflicts: [], unplaced: [] }
 */
export function autoArrange({ students, rows, cols, options = {} }) {
  const { myopiaCenter = true, mixedGender = false, peerHelp = true } = options;

  const byId = new Map(students.map(s => [s.id, s]));
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const seatOf = new Map(); // studentId -> {row,col}

  // 第0步a：锁定学生原地保留
  for (const s of students) {
    if (!s.locked) continue;
    const r = s.lockedRow, c = s.lockedCol;
    if (r == null || c == null || r < 0 || r >= rows || c < 0 || c >= cols) continue;
    grid[r][c] = s.id;
    seatOf.set(s.id, { row: r, col: c });
  }

  // 蛇形位置（行交替方向）
  const positions = [];
  for (let r = 0; r < rows; r++) {
    const colsArr = Array.from({ length: cols }, (_, c) => c);
    if (r % 2 === 1) colsArr.reverse();
    for (const c of colsArr) positions.push({ row: r, col: c });
  }

  // 列按离中心距离排序（中间优先）
  const center = (cols - 1) / 2;
  const colPriority = Array.from({ length: cols }, (_, c) => c)
    .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
  const midList = [];
  for (let r = 0; r < rows; r++) for (const c of colPriority) midList.push({ row: r, col: c });

  const nextFree = (list) => {
    for (const p of list) if (grid[p.row][p.col] == null) return p;
    return null;
  };

  // 第0步b：硬约束——「必须前排」的学生优先占第一排中间列
  const frontRow = students.filter(s =>
    !s.locked && s.seat_note && /前排|第一排|前面/.test(s.seat_note) && !seatOf.has(s.id));
  const row0Pos = colPriority.map(c => ({ row: 0, col: c }));
  for (const s of frontRow) {
    const pos = nextFree(row0Pos);
    if (pos) { grid[pos.row][pos.col] = s.id; seatOf.set(s.id, pos); }
  }

  // 第1步：主排序 身高升序 → 较差眼视力升序
  const visionWorse = s => Math.min(s.vision_left ?? 5.0, s.vision_right ?? 5.0);
  const rest = students
    .filter(s => !s.locked && !seatOf.has(s.id))
    .sort((a, b) => {
      const ha = a.height_cm ?? 999, hb = b.height_cm ?? 999;
      if (ha !== hb) return ha - hb;
      return visionWorse(a) - visionWorse(b);
    });

  // 第2步：按行分配 + 行内居中（对称布局），近视优先中间列
  const place = (s, r, c) => { grid[r][c] = s.id; seatOf.set(s.id, { row: r, col: c }); };

  // 2.1 把学生按行分堆（从前往后，每行最多 cols 人）
  const rowAssign = [];
  let ri = 0;
  for (let r = 0; r < rows && ri < rest.length; r++) {
    const n = Math.min(cols, rest.length - ri);
    rowAssign.push(rest.slice(ri, ri + n));
    ri += n;
  }

  // 2.2 逐行放置：不满的行居中，近视优先坐中间列
  const leftover = [];
  rowAssign.forEach((rowStu, r) => {
    const n = rowStu.length;
    const start = Math.floor((cols - n) / 2);            // 居中起点
    // 目标列：居中区间；区间内被占用的列，用该行其他空闲列补位
    const chosen = [];
    for (let c = start; c < start + n; c++) if (grid[r][c] == null) chosen.push(c);
    for (let c = 0; c < cols && chosen.length < n; c++) {
      if (grid[r][c] == null && !chosen.includes(c)) chosen.push(c);
    }
    // 列按离行中心距离排序（中间优先）
    const rowCenter = start + (n - 1) / 2;
    chosen.sort((a, b) => Math.abs(a - rowCenter) - Math.abs(b - rowCenter) || a - b);
    // 近视学生拿中间列，其余拿两侧列
    const myopes = myopiaCenter ? rowStu.filter(s => s.is_myopia) : [];
    const others = myopiaCenter ? rowStu.filter(s => !s.is_myopia) : rowStu;
    const myopeCount = Math.min(myopes.length, chosen.length);
    const myopeCols = chosen.slice(0, myopeCount);
    const otherCols = chosen.slice(myopeCount);
    myopes.forEach((s, i) => (i < myopeCols.length ? place(s, r, myopeCols[i]) : leftover.push(s)));
    others.forEach((s, i) => (i < otherCols.length ? place(s, r, otherCols[i]) : leftover.push(s)));
  });

  // 2.3 兜底：仍未入座的学生放任意空位
  for (const s of leftover) {
    const pos = nextFree(positions);
    if (pos) { place(s, pos.row, pos.col); }
  }

  // 第3步：软约束检查（同桌）
  const gradeVal = g => ({ '优': 3, '良': 2, '中': 1, '待提高': 0 })[g] ?? 0;
  const conflicts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const idA = grid[r][c], idB = grid[r][c + 1];
      if (idA == null || idB == null) continue;
      const a = byId.get(idA), b = byId.get(idB);
      if (!mixedGender && a.gender !== b.gender) {
        conflicts.push({
          row: r, col: c, type: 'gender',
          message: `${a.name} 与 ${b.name} 异性同桌（未开启男女搭配），可在手动模式调整`,
        });
      }
      if (peerHelp) {
        if (gradeVal(a.grade_level) === 0 && gradeVal(b.grade_level) < 2) {
          conflicts.push({ row: r, col: c, type: 'peer', message: `${a.name}（待提高）旁边无优/良同学互助` });
        } else if (gradeVal(b.grade_level) === 0 && gradeVal(a.grade_level) < 2) {
          conflicts.push({ row: r, col: c + 1, type: 'peer', message: `${b.name}（待提高）旁边无优/良同学互助` });
        }
      }
    }
  }

  // 输出（带学生信息，前端直接显示）
  const seats = [];
  const placed = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = grid[r][c];
      if (id == null) continue;
      const s = byId.get(id);
      placed.add(id);
      seats.push({
        studentId: id, row: r, col: c, locked: !!s.locked,
        name: s.name, gender: s.gender, height_cm: s.height_cm,
        vision_left: s.vision_left, vision_right: s.vision_right,
        is_myopia: s.is_myopia, grade_level: s.grade_level,
      });
    }
  }
  const unplaced = students.filter(s => !placed.has(s.id)).map(s => s.name);

  return { seats, conflicts, unplaced };
}
