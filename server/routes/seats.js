import { Router } from 'express';
import db from '../db.js';
import { autoArrange } from '../seating.js';

const router = Router();

function getClass(id) {
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(id));
}

// 当前布局（含学生信息，空座保留）
router.get('/', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  const rows = db.prepare(`
    SELECT t.row, t.col, t.locked, t.student_id,
      s.name, s.gender, s.height_cm, s.vision_left, s.vision_right, s.is_myopia, s.grade_level
    FROM seats t LEFT JOIN students s ON s.id = t.student_id
    WHERE t.class_id = ? ORDER BY t.row, t.col
  `).all(Number(class_id));
  res.json({ ok: true, data: rows });
});

// 保存布局：全量替换 seats，并写入一条历史快照
router.put('/', (req, res) => {
  const { classId, seats, remark } = req.body || {};
  if (!classId) return res.json({ ok: false, error: '缺少班级' });
  const cls = getClass(classId);
  if (!cls) return res.json({ ok: false, error: '班级不存在' });
  if (!Array.isArray(seats)) return res.json({ ok: false, error: '布局数据格式错误' });

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
  // 同一学生只保留一个位置
  const seen = new Set();
  const dedup = [];
  for (const s of clean) {
    if (s.student_id != null && seen.has(s.student_id)) continue;
    if (s.student_id != null) seen.add(s.student_id);
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
    db.prepare(`
      INSERT INTO seat_layouts (class_id, rule_snapshot, seats_snapshot, remark)
      VALUES (?, ?, ?, ?)
    `).run(classId, JSON.stringify({ manual: true }), JSON.stringify(snapshot),
      remark || `保存布局（${new Date().toLocaleString('zh-CN')}）`);
  });
  tx();
  res.json({ ok: true, data: { count: dedup.length } });
});

// 自动排座（返回建议布局，不落库；前端确认后 PUT 保存）
router.post('/auto', (req, res) => {
  const { classId, options } = req.body || {};
  if (!classId) return res.json({ ok: false, error: '缺少班级' });
  const cls = getClass(classId);
  if (!cls) return res.json({ ok: false, error: '班级不存在' });

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

// 平移轮换（返回建议布局，不落库；锁定座位不动）
router.post('/shift', (req, res) => {
  const { classId, dr = 0, dc = 0 } = req.body || {};
  if (!classId) return res.json({ ok: false, error: '缺少班级' });
  const cls = getClass(classId);
  if (!cls) return res.json({ ok: false, error: '班级不存在' });
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

  // 先放锁定座位
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const s of seats) if (s.locked) grid[s.row][s.col] = s;

  const warnings = [];
  const out = [];
  const placed = new Set();
  for (const s of seats) {
    if (s.locked) {
      grid[s.row][s.col] = s;
      placed.add(`${s.row},${s.col}`);
      continue;
    }
    const nr = (((s.row + dr) % rows) + rows) % rows;
    const nc = (((s.col + dc) % cols) + cols) % cols;
    if (grid[nr][nc] != null) {
      // 目标被锁定学生占用 → 就近放置
      const p = findNearestFree(grid, nr, nc, rows, cols);
      if (p) {
        warnings.push(`${s.student_id != null ? '该学生' : '空位'} 目标位置被锁定座位占用，就近调整`);
        grid[p.r][p.c] = s;
      }
    } else {
      grid[nr][nc] = s;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) {
        const s = grid[r][c];
        const info = s.student_id != null ? infoMap.get(s.student_id) || {} : {};
        out.push({
          studentId: s.student_id,
          row: r, col: c,
          locked: !!s.locked,
          name: info.name, gender: info.gender, height_cm: info.height_cm,
          vision_left: info.vision_left, vision_right: info.vision_right,
          is_myopia: info.is_myopia, grade_level: info.grade_level,
        });
      }
    }
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
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
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
  if (!row) return res.json({ ok: false, error: '记录不存在' });
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
  db.prepare('DELETE FROM seat_layouts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
