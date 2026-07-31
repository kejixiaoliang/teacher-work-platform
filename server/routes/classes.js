import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 班级列表（含统计）
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.deleted_at IS NULL) AS student_count,
      (SELECT COUNT(*) FROM seats t WHERE t.class_id = c.id AND t.student_id IS NOT NULL) AS seated_count
    FROM classes c ORDER BY c.id DESC
  `).all();
  res.json({ ok: true, data: rows });
});

// 新建班级
router.post('/', (req, res) => {
  const { name, academic_year, term, seat_rows, seat_cols, aisle_mode, head_teacher, remark } = req.body || {};
  if (!name || !String(name).trim()) return res.json({ ok: false, error: '班级名称不能为空' });
  const rows = Math.max(1, parseInt(seat_rows) || 6);
  const cols = Math.max(1, parseInt(seat_cols) || 8);
  const info = db.prepare(`
    INSERT INTO classes (name, academic_year, term, seat_rows, seat_cols, aisle_mode, head_teacher, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(String(name).trim(), academic_year || '', term || '上', rows, cols, Number(aisle_mode) || 0, head_teacher || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新班级
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM classes WHERE id = ?').get(id);
  if (!exists) return res.json({ ok: false, error: '班级不存在' });
  const b = req.body || {};
  const rows = Math.max(1, parseInt(b.seat_rows) || 6);
  const cols = Math.max(1, parseInt(b.seat_cols) || 8);
  db.prepare(`
    UPDATE classes SET name=?, academic_year=?, term=?, seat_rows=?, seat_cols=?, aisle_mode=?, head_teacher=?, remark=?,
      updated_at=datetime('now','localtime') WHERE id=?
  `).run(b.name || exists.name, b.academic_year ?? '', b.term ?? '上', rows, cols, Number(b.aisle_mode) ?? exists.aisle_mode ?? 1, b.head_teacher ?? '', b.remark ?? '', id);
  res.json({ ok: true });
});

// 删除班级（级联删除学生/座位/历史布局）
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
