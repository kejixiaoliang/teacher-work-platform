import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');

const router = Router();

// 座位行列限制：正整数且 ≤60，防止超大值触发排座算法 OOM（H3）
function parseSeatDim(v, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < 1 || n > 60) return fallback;
  return n;
}

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
  const rows = parseSeatDim(seat_rows, 6);
  const cols = parseSeatDim(seat_cols, 8);
  const info = db.prepare(`
    INSERT INTO classes (name, academic_year, term, seat_rows, seat_cols, aisle_mode, head_teacher, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(String(name).trim(), academic_year || '', term || '上', rows, cols, Number(aisle_mode) ? 1 : 0, head_teacher || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新班级
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的班级 ID' });
  const exists = db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  if (!exists) return res.json({ ok: false, error: '班级不存在' });
  const b = req.body || {};
  const rows = parseSeatDim(b.seat_rows, exists.seat_rows ?? 6);
  const cols = parseSeatDim(b.seat_cols, exists.seat_cols ?? 8);
  // aisle_mode：请求未携带时保持原值（Number(undefined)=NaN 会被写入 NULL，P1-2）
  const aisle = b.aisle_mode === undefined ? (exists.aisle_mode ?? 1) : (Number(b.aisle_mode) ? 1 : 0);
  db.prepare(`
    UPDATE classes SET name=?, academic_year=?, term=?, seat_rows=?, seat_cols=?, aisle_mode=?, head_teacher=?, remark=?,
      updated_at=datetime('now','localtime') WHERE id=?
  `).run(String(b.name ?? exists.name).trim() || exists.name, b.academic_year ?? exists.academic_year ?? '', b.term ?? exists.term ?? '上', rows, cols, aisle, b.head_teacher ?? exists.head_teacher ?? '', b.remark ?? exists.remark ?? '', id);
  res.json({ ok: true });
});

// 删除班级（级联删除学生/座位/历史布局；同时清理该班上传的物理文件）
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的班级 ID' });
  const files = db.prepare('SELECT stored_name FROM documents WHERE class_id = ?').all(id);
  const tx = db.transaction(() => {
    for (const f of files) {
      try { fs.unlinkSync(path.join(dataDir, 'files', f.stored_name)); } catch { /* 文件可能已不存在 */ }
    }
    db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  });
  tx();
  res.json({ ok: true });
});

export default router;
