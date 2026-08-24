import { Router } from 'express';
import db from '../db.js';
import { badRequest, isDateString, positiveInt, text } from '../validation.js';

const router = Router();
const STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled']);

function taskRow(id) {
  return db.prepare(`
    SELECT t.*, s.name AS student_name, c.name AS class_name
    FROM follow_up_tasks t
    JOIN students s ON s.id = t.student_id
    JOIN classes c ON c.id = t.class_id
    WHERE t.id = ?
  `).get(id);
}

function resolveStudent(classId, studentId) {
  return db.prepare(`
    SELECT id FROM students
    WHERE id = ? AND class_id = ? AND deleted_at IS NULL
  `).get(studentId, classId);
}

function validateTaskInput(body, { requireTitle = true } = {}) {
  const title = text(body?.title, { max: 120 });
  const content = text(body?.content, { max: 2000 });
  const dueDate = body?.due_date || '';
  if ((requireTitle && !title) || title === null || content === null) return '标题或内容无效';
  if (dueDate && !isDateString(dueDate)) return '截止日期无效';
  return { title, content: content || '', dueDate };
}

router.get('/', (req, res) => {
  const classId = req.query.class_id ? positiveInt(req.query.class_id) : null;
  const studentId = req.query.student_id ? positiveInt(req.query.student_id) : null;
  const status = req.query.status || '';
  const dueBefore = req.query.due_before || '';
  if (req.query.class_id && !classId) return badRequest(res, '缺少有效班级');
  if (req.query.student_id && !studentId) return badRequest(res, '缺少有效学生');
  if (status && !STATUSES.has(status)) return badRequest(res, '跟进事项状态无效');
  if (dueBefore && !isDateString(dueBefore)) return badRequest(res, '截止日期无效');
  const conditions = [];
  const params = {};
  if (classId) { conditions.push('t.class_id = @classId'); params.classId = classId; }
  if (studentId) { conditions.push('t.student_id = @studentId'); params.studentId = studentId; }
  if (status) { conditions.push('t.status = @status'); params.status = status; }
  if (dueBefore) { conditions.push("t.due_date <> '' AND t.due_date <= @dueBefore"); params.dueBefore = dueBefore; }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT t.*, s.name AS student_name, c.name AS class_name
    FROM follow_up_tasks t
    JOIN students s ON s.id = t.student_id
    JOIN classes c ON c.id = t.class_id
    ${where}
    ORDER BY CASE WHEN t.status IN ('pending', 'in_progress') THEN 0 ELSE 1 END,
      CASE WHEN t.due_date = '' THEN 1 ELSE 0 END, t.due_date ASC, t.id DESC
  `).all(params);
  res.json({ ok: true, data: rows });
});

router.post('/', (req, res) => {
  const classId = positiveInt(req.body?.class_id);
  const studentId = positiveInt(req.body?.student_id);
  if (!classId || !studentId) return badRequest(res, '班级和学生不能为空');
  if (!db.prepare('SELECT id FROM classes WHERE id = ?').get(classId)) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  if (!resolveStudent(classId, studentId)) return badRequest(res, '学生不属于该班级或已删除');
  const input = validateTaskInput(req.body);
  if (typeof input === 'string') return badRequest(res, input);
  const sourceType = text(req.body?.source_type, { max: 40 });
  const sourceId = req.body?.source_id == null || req.body.source_id === '' ? null : positiveInt(req.body.source_id);
  if (sourceType === null || (req.body?.source_id != null && req.body.source_id !== '' && !sourceId)) return badRequest(res, '来源信息无效');
  const info = db.prepare(`
    INSERT INTO follow_up_tasks (class_id, student_id, title, content, due_date, source_type, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(classId, studentId, input.title, input.content, input.dueDate, sourceType || '', sourceId);
  res.json({ ok: true, data: taskRow(info.lastInsertRowid) });
});

router.put('/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的跟进事项 ID');
  const row = taskRow(id);
  if (!row) return res.status(404).json({ ok: false, code: 'FOLLOW_UP_TASK_NOT_FOUND', error: '跟进事项不存在' });
  const title = req.body?.title === undefined ? row.title : text(req.body.title, { max: 120 });
  const content = req.body?.content === undefined ? row.content : text(req.body.content, { max: 2000 });
  const dueDate = req.body?.due_date === undefined ? row.due_date : (req.body.due_date || '');
  const status = req.body?.status === undefined ? row.status : req.body.status;
  const result = req.body?.result === undefined ? row.result : text(req.body.result, { max: 2000 });
  if (!title || title === null || content === null || result === null) return badRequest(res, '跟进事项内容无效');
  if (!STATUSES.has(status)) return badRequest(res, '跟进事项状态无效');
  if (dueDate && !isDateString(dueDate)) return badRequest(res, '截止日期无效');
  const completedAt = status === 'completed' ? (row.completed_at || new Date().toISOString()) : null;
  db.prepare(`
    UPDATE follow_up_tasks
    SET title = ?, content = ?, due_date = ?, status = ?, result = ?, completed_at = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(title, content, dueDate, status, result || '', completedAt, id);
  res.json({ ok: true, data: taskRow(id) });
});

router.delete('/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的跟进事项 ID');
  if (!taskRow(id)) return res.status(404).json({ ok: false, code: 'FOLLOW_UP_TASK_NOT_FOUND', error: '跟进事项不存在' });
  db.prepare("UPDATE follow_up_tasks SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  res.json({ ok: true, data: taskRow(id) });
});

export default router;
