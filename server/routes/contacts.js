import { Router } from 'express';
import db from '../db.js';
import { badRequest, positiveInt } from '../validation.js';

const router = Router();

/* ================= 家校沟通（班级级台账） ================= */

// 班级维度列表：按学生 JOIN，可按班级/学生/日期范围/关键词过滤
router.get('/', (req, res) => {
  const { class_id, student_id, month, keyword } = req.query;
  const conds = [];
  const params = {};
  if (class_id) { conds.push('c.student_id IN (SELECT id FROM students WHERE class_id = @class_id)'); params.class_id = Number(class_id); }
  if (student_id) { conds.push('c.student_id = @student_id'); params.student_id = Number(student_id); }
  if (month) { conds.push("substr(c.date, 1, 7) = @month"); params.month = month; }
  if (keyword) {
    // 全局搜索：按学生姓名/学号/事由/结果模糊匹配（B7）
    conds.push('(s.name LIKE @kw OR s.school_no LIKE @kw OR c.topic LIKE @kw OR c.result LIKE @kw)');
    params.kw = `%${keyword}%`;
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT c.*, s.name AS student_name, s.school_no, s.gender
    FROM contacts c JOIN students s ON s.id = c.student_id
    ${where} ORDER BY c.date DESC, c.id DESC
  `).all(params);
  res.json({ ok: true, data: rows });
});

// 班级统计：某月沟通次数 + 涉及学生数
router.get('/stats', (req, res) => {
  const { class_id, month } = req.query;
  if (!class_id) return badRequest(res, '缺少班级');
  const conds = ['c.student_id IN (SELECT id FROM students WHERE class_id = @class_id)'];
  const params = { class_id: Number(class_id) };
  if (month) { conds.push("substr(c.date, 1, 7) = @month"); params.month = month; }
  const where = 'WHERE ' + conds.join(' AND ');
  const row = db.prepare(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT c.student_id) AS students,
      SUM(CASE WHEN c.method = '家访' THEN 1 ELSE 0 END) AS visits,
      SUM(CASE WHEN c.method = '电话' THEN 1 ELSE 0 END) AS phones
    FROM contacts c ${where}
  `).get(params);
  res.json({ ok: true, data: { total: row.total || 0, students: row.students || 0, visits: row.visits || 0, phones: row.phones || 0 } });
});

// 新增沟通记录
router.post('/', (req, res) => {
  const { student_id, date, method, topic, result, remark } = req.body || {};
  if (!student_id) return badRequest(res, '请选择学生');
  if (!topic && !result && !method) return badRequest(res, '请至少填写事由或结果');
  const stu = db.prepare('SELECT id FROM students WHERE id = ? AND deleted_at IS NULL').get(Number(student_id));
  if (!stu) return res.status(404).json({ ok: false, code: 'STUDENT_NOT_FOUND', error: '学生不存在' });
  const info = db.prepare(`
    INSERT INTO contacts (student_id, date, method, topic, result, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(student_id), date || '', method || '', topic || '', result || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新沟通记录
router.put('/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', error: '无效的沟通记录 ID' });
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ ok: false, code: 'CONTACT_NOT_FOUND', error: '沟通记录不存在' });
  const b = req.body || {};
  const studentId = b.student_id === undefined ? row.student_id : positiveInt(b.student_id);
  if (!studentId || !db.prepare('SELECT id FROM students WHERE id = ? AND deleted_at IS NULL').get(studentId)) {
    return res.status(400).json({ ok: false, code: 'INVALID_STUDENT', error: '学生不存在或已在回收站' });
  }
  db.prepare('UPDATE contacts SET date=?, method=?, topic=?, result=?, remark=?, student_id=? WHERE id=?').run(
    b.date !== undefined ? b.date : row.date,
    b.method !== undefined ? b.method : row.method,
    b.topic !== undefined ? b.topic : row.topic,
    b.result !== undefined ? b.result : row.result,
    b.remark !== undefined ? b.remark : row.remark,
    studentId,
    id
  );
  res.json({ ok: true });
});

// 删除沟通记录
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的记录 ID' });
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
