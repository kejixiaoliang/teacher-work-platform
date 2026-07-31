import { Router } from 'express';
import db from '../db.js';

const router = Router();

/* ================= 请假管理 ================= */

// 列表（可按班级/学生/月份/类型/状态过滤，JOIN 学生姓名）
router.get('/', (req, res) => {
  const { class_id, student_id, month, type, status } = req.query;
  const conds = [];
  const params = {};
  if (class_id) { conds.push('l.class_id = @class_id'); params.class_id = Number(class_id); }
  if (student_id) { conds.push('l.student_id = @student_id'); params.student_id = Number(student_id); }
  if (month) { conds.push("substr(l.start_date, 1, 7) = @month"); params.month = month; }
  if (type) { conds.push('l.type = @type'); params.type = type; }
  if (status) { conds.push('l.status = @status'); params.status = status; }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT l.*, s.name AS student_name, s.school_no, s.gender
    FROM leaves l JOIN students s ON s.id = l.student_id
    ${where} ORDER BY l.start_date DESC, l.id DESC
  `).all(params);
  res.json({ ok: true, data: rows });
});

// 新增请假
router.post('/', (req, res) => {
  const { class_id, student_id, type, start_date, end_date, days, reason, status, remark } = req.body || {};
  if (!class_id || !student_id) return res.json({ ok: false, error: '班级/学生不能为空' });
  if (!start_date) return res.json({ ok: false, error: '请选择开始日期' });
  const stu = db.prepare('SELECT id FROM students WHERE id = ? AND deleted_at IS NULL').get(Number(student_id));
  if (!stu) return res.json({ ok: false, error: '学生不存在' });
  // 归属校验：学生必须属于该班级，避免跨班脏数据
  const owner = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').get(Number(student_id), Number(class_id));
  if (!owner) return res.json({ ok: false, error: '学生不属于当前班级' });
  const d = days != null ? Number(days) : 1;
  if (!Number.isFinite(d) || d <= 0 || d > 365) return res.json({ ok: false, error: '天数无效' });
  if (end_date && end_date < start_date) return res.json({ ok: false, error: '结束日期不能早于开始日期' });
  const info = db.prepare(`
    INSERT INTO leaves (class_id, student_id, type, start_date, end_date, days, reason, status, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(class_id), Number(student_id), type || '事假',
    start_date, end_date || start_date,
    d,
    reason || '', status || '已批准', remark || ''
  );
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新请假（改日期/销假等）
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
  if (!row) return res.json({ ok: false, error: '请假记录不存在' });
  const b = req.body || {};
  const newStudentId = b.student_id !== undefined ? Number(b.student_id) : row.student_id;
  const newClassId = b.class_id !== undefined ? Number(b.class_id) : row.class_id;
  // 归属校验：学生必须属于记录所属班级
  const owner = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').get(newStudentId, newClassId);
  if (!owner) return res.json({ ok: false, error: '学生不属于该班级' });
  const days = b.days !== undefined ? Number(b.days) : row.days;
  if (!Number.isFinite(days) || days <= 0 || days > 365) return res.json({ ok: false, error: '天数无效' });
  const sDate = b.start_date !== undefined ? b.start_date : row.start_date;
  const eDate = b.end_date !== undefined ? b.end_date : row.end_date;
  if (eDate && sDate && eDate < sDate) return res.json({ ok: false, error: '结束日期不能早于开始日期' });
  db.prepare(`
    UPDATE leaves SET type=?, start_date=?, end_date=?, days=?, reason=?, status=?, remark=?, student_id=?, class_id=? WHERE id=?
  `).run(
    b.type !== undefined ? b.type : row.type,
    sDate,
    eDate,
    days,
    b.reason !== undefined ? b.reason : row.reason,
    b.status !== undefined ? b.status : row.status,
    b.remark !== undefined ? b.remark : row.remark,
    newStudentId,
    newClassId,
    id
  );
  res.json({ ok: true });
});

// 删除请假
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的请假 ID' });
  db.prepare('DELETE FROM leaves WHERE id = ?').run(id);
  res.json({ ok: true });
});

// 今日请假统计（未销假且在有效期内的）
router.get('/today', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const rows = db.prepare(`
    SELECT l.*, s.name AS student_name, s.school_no, s.gender
    FROM leaves l JOIN students s ON s.id = l.student_id
    WHERE l.class_id = ? AND l.status = '已批准'
      AND l.start_date <= ? AND l.end_date >= ?
    ORDER BY l.start_date
  `).all(Number(class_id), dateStr, dateStr);
  res.json({ ok: true, data: rows });
});

export default router;
