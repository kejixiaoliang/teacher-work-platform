import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 列表（JOIN 学生姓名）
router.get('/', (req, res) => {
  const { class_id, role } = req.query;
  const conds = [];
  const params = {};
  if (class_id) { conds.push('d.class_id = @class_id'); params.class_id = Number(class_id); }
  if (role) { conds.push('d.role = @role'); params.role = role; }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT d.*, s.name AS student_name, s.gender, s.status, s.deleted_at AS student_deleted
    FROM duties d JOIN students s ON s.id = d.student_id
    ${where} ORDER BY d.group_no, d.id
  `).all(params);
  res.json({ ok: true, data: rows });
});

// 添加一条（班干部角色检查唯一）
router.post('/', (req, res) => {
  const { class_id, student_id, role, group_no, week_days, remark } = req.body || {};
  if (!class_id || !student_id || !role) return res.json({ ok: false, error: '班级/学生/角色不能为空' });
  const stu = db.prepare('SELECT id, name FROM students WHERE id = ? AND deleted_at IS NULL').get(Number(student_id));
  if (!stu) return res.json({ ok: false, error: '学生不存在' });
  if (role !== '值日生') {
    const dup = db.prepare('SELECT student_id FROM duties WHERE class_id = ? AND role = ?').get(Number(class_id), role);
    if (dup) {
      const holder = db.prepare('SELECT name FROM students WHERE id = ?').get(dup.student_id);
      return res.json({ ok: false, error: `「${role}」已由 ${holder?.name || '其他学生'} 担任，请先调整` });
    }
  }
  const info = db.prepare(`
    INSERT INTO duties (class_id, student_id, role, group_no, week_days, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(class_id), Number(student_id), role, group_no != null ? Number(group_no) : null, week_days || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 批量添加（如：往值日组加人）
router.post('/batch', (req, res) => {
  const { class_id, role, group_no, student_ids, week_days, remark } = req.body || {};
  if (!class_id || !Array.isArray(student_ids) || !student_ids.length || !role) {
    return res.json({ ok: false, error: '参数不完整' });
  }
  const ins = db.prepare(`
    INSERT INTO duties (class_id, student_id, role, group_no, week_days, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((ids) => {
    for (const sid of ids) ins.run(Number(class_id), Number(sid), role, group_no != null ? Number(group_no) : null, week_days || '', remark || '');
  });
  tx(student_ids);
  res.json({ ok: true, data: { count: student_ids.length } });
});

// 更新
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM duties WHERE id = ?').get(id);
  if (!row) return res.json({ ok: false, error: '记录不存在' });
  const b = req.body || {};
  db.prepare(`UPDATE duties SET role=?, group_no=?, week_days=?, remark=?, student_id=? WHERE id=?`).run(
    b.role || row.role,
    b.group_no !== undefined ? (b.group_no != null ? Number(b.group_no) : null) : row.group_no,
    b.week_days !== undefined ? b.week_days : row.week_days,
    b.remark !== undefined ? b.remark : row.remark,
    b.student_id !== undefined ? Number(b.student_id) : row.student_id,
    id
  );
  res.json({ ok: true });
});

// 删除
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM duties WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
