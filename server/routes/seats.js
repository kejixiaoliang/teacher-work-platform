import { Router } from 'express';
import db from '../db.js';
import { autoArrange } from '../seating.js';
import { badRequest, positiveInt } from '../validation.js';

const router = Router();

function getClass(id) {
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(id));
}

// 当前布局（含学生信息，空座保留）
router.get('/', (req, res) => {
  const { class_id } = req.query;
  const parsedClassId = positiveInt(class_id);
  if (!parsedClassId) return badRequest(res, '缺少有效班级');
  const rows = db.prepare(`
    SELECT t.row, t.col, t.locked, t.student_id AS studentId,
      s.name, s.gender, s.height_cm, s.vision_left, s.vision_right, s.is_myopia, s.grade_level
    FROM seats t LEFT JOIN students s ON s.id = t.student_id
    WHERE t.class_id = ? ORDER BY t.row, t.col
  `).all(parsedClassId);
  res.json({ ok: true, data: rows });
});

// 保存布局：全量替换 seats，并写入一条历史快照
router.put('/', (req, res) => {
  const { classId, seats, remark } = req.body || {};
  const parsedClassId = positiveInt(classId);
  if (!parsedClassId) return badRequest(res, '缺少有效班级');
  const cls = getClass(parsedClassId);
  if (!cls) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  if (!Array.isArray(seats)) return badRequest(res, '布局数据格式错误');

  // 校验学生是否属于该班且存在
  const validIds = new Set(db.prepare(`
    SELECT id FROM students WHERE class_id = ? AND deleted_at IS NULL
  `).all(classId).map(r => r.id));
  const clean = [];
  for (const s of seats) {
    const row = Math.max(0, Math.min(cls.seat_rows - 1, parseInt(s.row) || 0));
    const col = Math.max(0, Math.min(cls.seat_cols - 1, parseInt(s.col) || 0));
    if (s.studentId != null && s.studentId !== '' && !validIds.has(Number(s.studentId))) continue;
    clean.push({
      student_id: s.studentId != null && s.studentId !== '' ? Number(s.studentId) : null,
      row, col, locked: s.locked ? 1 : 0,
    });
  }
  // 同一学生只保留一个位置；同一坐标只保留一个学生（避免 UNIQUE 冲突 500）
  const seen = new Set();
  const seenPos = new Set();
  const dedup = [];
  for (const s of clean) {
    if (s.student_id != null && seen.has(s.student_id)) continue;
    const posKey = `${s.row},${s.col}`;
    if (seenPos.has(posKey)) continue;
    if (s.student_id != null) seen.add(s.student_id);
    seenPos.add(posKey);
    dedup.push(s);
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM seats WHERE class_id = ?').run(classId);
    const ins = db.prepare(`
      INSERT INTO seats (class_id, student_id, row, col, locked) VALUES (?, ?, ?, ?, ?)
    `);
    for (const s of dedup) ins.run(classId, s.student_id, s.row, s.col, s.locked);
    // 历史快照
    const snapshot = dedup.map(s => ({
      studentId: s.student_id, row: s.row, col: s.col, locked: !!s.locked,
    }));
    // C 组：rule_snapshot 真实记录排座规则（手动/自动/轮换），不再是写死的 {manual:true}
    const rule = req.body?.rule || { manual: true };
    db.prepare(`
      INSERT INTO seat_layouts (class_id, rule_snapshot, seats_snapshot, remark)
      VALUES (?, ?, ?, ?)
    `).run(classId, JSON.stringify(rule), JSON.stringify(snapshot),
      remark || (rule.auto ? `自动排座（${rule.auto}）` : rule.shift ? `平移轮换（行${rule.shift[0]} 列${rule.shift[1]}）` : `保存布局（${new Date().toLocaleString('zh-CN')}）`));
    // 快照限流：每班只保留最近 50 条历史，防止无限膨胀
    db.prepare(`
      DELETE FROM seat_layouts WHERE id IN (
        SELECT id FROM seat_layouts WHERE class_id = ?
        ORDER BY id DESC LIMIT -1 OFFSET 50
      )
    `).run(classId);
  });
  tx();
  res.json({ ok: true, data: { count: dedup.length } });
});

// 自动排座（返回建议布局，不落库；前端确认后 PUT 保存）
router.post('/auto', (req, res) => {
  const { classId, options } = req.body || {};
  if (!classId) return badRequest(res, '缺少班级');
  const cls = getClass(classId);
  if (!cls) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });

  const students = db.prepare(`
    SELECT s.id, s.name, s.gender, s.height_cm, s.vision_left, s.vision_right,
      s.is_myopia, s.grade_level, s.seat_note,
      t.locked, t.row AS lockedRow, t.col AS lockedCol
    FROM students s
    LEFT JOIN seats t ON t.student_id = s.id AND t.class_id = s.class_id
    WHERE s.class_id = ? AND s.deleted_at IS NULL AND s.status = '在读'
    ORDER BY s.id
  `).all(Number(classId));

  const result = autoArrange({
    students,
    rows: cls.seat_rows,
    cols: cls.seat_cols,
    options: options || {},
  });
  res.json({ ok: true, data: result });
});

// 平移轮换（返回建议布局，不落库；锁定座位不动；满座时保留原位不丢人）
router.post('/shift', (req, res) => {
  const { classId, dr = 0, dc = 0 } = req.body || {};
  if (!classId) return badRequest(res, '缺少班级');
  // dr/dc 数值化并取整，防止字符串拼接/NaN 破坏模运算（M5）
  const drN = Number.isInteger(Number(dr)) ? Number(dr) : 0;
  const dcN = Number.isInteger(Number(dc)) ? Number(dc) : 0;
  const cls = getClass(classId);
  if (!cls) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const rows = cls.seat_rows, cols = cls.seat_cols;

  const seats = db.prepare(`
    SELECT t.row, t.col, t.locked, t.student_id
    FROM seats t WHERE t.class_id = ? ORDER BY t.row, t.col
  `).all(Number(classId));

  // 学生信息映射（预览要显示名字）
  const ids = seats.filter(s => s.student_id != null).map(s => s.student_id);
  const infoMap = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const stRows = db.prepare(`
      SELECT id, name, gender, height_cm, vision_left, vision_right, is_myopia, grade_level
      FROM students WHERE id IN (${placeholders})
    `).all(...ids);
    for (const st of stRows) infoMap.set(st.id, st);
  }

  // 锁定座位先占位（不动）
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const out = [];
  const warnings = [];
  const lockedSeats = seats.filter(s => s.locked);
  const moveSeats = seats.filter(s => !s.locked && s.student_id != null);
  for (const s of lockedSeats) grid[s.row][s.col] = s;

  // 非锁定学生按模运算平移（互不冲突，仅可能撞上锁定座位）
  for (const s of moveSeats) {
    const nr = (((s.row + drN) % rows) + rows) % rows;
    const nc = (((s.col + dcN) % cols) + cols) % cols;
    const info = infoMap.get(s.student_id) || {};
    if (grid[nr][nc] == null) {
      grid[nr][nc] = s;
      out.push({ studentId: s.student_id, row: nr, col: nc, locked: false,
        name: info.name, gender: info.gender, height_cm: info.height_cm,
        vision_left: info.vision_left, vision_right: info.vision_right,
        is_myopia: info.is_myopia, grade_level: info.grade_level });
    } else {
      // 目标被锁定座位占用：就近找空位
      const p = findNearestFree(grid, nr, nc, rows, cols);
      if (p) {
        grid[p.r][p.c] = s;
        out.push({ studentId: s.student_id, row: p.r, col: p.c, locked: false,
          name: info.name, gender: info.gender, height_cm: info.height_cm,
          vision_left: info.vision_left, vision_right: info.vision_right,
          is_myopia: info.is_myopia, grade_level: info.grade_level });
        warnings.push(`${info.name || '该学生'} 目标位置被锁定座位占用，就近调整`);
      } else {
        // 无空位：保留原位（不丢人）
        grid[s.row][s.col] = s;
        out.push({ studentId: s.student_id, row: s.row, col: s.col, locked: false,
          name: info.name, gender: info.gender, height_cm: info.height_cm,
          vision_left: info.vision_left, vision_right: info.vision_right,
          is_myopia: info.is_myopia, grade_level: info.grade_level });
        warnings.push(`${info.name || '该学生'} 无可用空位，保持原位`);
      }
    }
  }
  // 锁定座位输出
  for (const s of lockedSeats) {
    const info = infoMap.get(s.student_id) || {};
    out.push({ studentId: s.student_id, row: s.row, col: s.col, locked: true,
      name: info.name, gender: info.gender, height_cm: info.height_cm,
      vision_left: info.vision_left, vision_right: info.vision_right,
      is_myopia: info.is_myopia, grade_level: info.grade_level });
  }
  res.json({ ok: true, data: { seats: out, warnings } });
});

function findNearestFree(grid, r, c, rows, cols) {
  for (let d = 1; d <= Math.max(rows, cols); d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == null) {
          return { r: nr, c: nc };
        }
      }
    }
  }
  return null;
}

// 历史布局列表
router.get('/layouts', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return badRequest(res, '缺少班级');
  const rows = db.prepare(`
    SELECT id, rule_snapshot, remark, created_at, seats_snapshot
    FROM seat_layouts WHERE class_id = ? ORDER BY id DESC
  `).all(Number(class_id));
  const data = rows.map(r => {
    let n = 0;
    try { n = JSON.parse(r.seats_snapshot).filter(s => s.studentId != null).length; } catch { /* 忽略 */ }
    return { id: r.id, rule_snapshot: r.rule_snapshot, remark: r.remark, created_at: r.created_at, student_count: n };
  });
  res.json({ ok: true, data });
});

// 历史布局详情（快照 + 学生名）
router.get('/layouts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM seat_layouts WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, code: 'SEAT_LAYOUT_NOT_FOUND', error: '记录不存在' });
  let seats = [];
  try { seats = JSON.parse(row.seats_snapshot); } catch { /* 忽略 */ }
  const ids = seats.map(s => s.studentId).filter(v => v != null);
  const names = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    for (const s of db.prepare(`SELECT id, name FROM students WHERE id IN (${placeholders})`).all(...ids)) {
      names.set(s.id, s.name);
    }
  }
  res.json({ ok: true, data: { id: row.id, remark: row.remark, createdAt: row.created_at, seats, names: Object.fromEntries(names) } });
});

// 删除历史布局记录
router.delete('/layouts/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的布局 ID' });
  db.prepare('DELETE FROM seat_layouts WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
