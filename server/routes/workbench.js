import { Router } from 'express';
import db from '../db.js';
import { badRequest, positiveInt } from '../validation.js';

const router = Router();

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

router.get('/today', (req, res) => {
  const classId = positiveInt(req.query.class_id);
  if (!classId) return badRequest(res, '缺少有效班级');
  const classRow = db.prepare('SELECT id, name, academic_year, term FROM classes WHERE id = ?').get(classId);
  if (!classRow) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const today = localToday();

  const attendanceRows = db.prepare(`
    SELECT s.id AS student_id, s.name AS student_name,
      CASE
        WHEN a.id IS NOT NULL THEN a.status
        WHEN EXISTS (
          SELECT 1 FROM leaves l
          WHERE l.student_id = s.id AND l.class_id = s.class_id
            AND l.status <> '已销假' AND l.start_date <= ? AND l.end_date >= ?
        ) THEN '请假'
        ELSE '出勤'
      END AS status
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = s.class_id AND a.date = ?
    WHERE s.class_id = ? AND s.deleted_at IS NULL AND s.status = '在读'
    ORDER BY s.school_no, s.id
  `).all(today, today, today, classId);
  const attendance = {
    total: attendanceRows.length,
    出勤: attendanceRows.filter(row => row.status === '出勤').length,
    迟到: attendanceRows.filter(row => row.status === '迟到').length,
    请假: attendanceRows.filter(row => row.status === '请假').length,
    缺勤: attendanceRows.filter(row => row.status === '缺勤').length,
    rows: attendanceRows,
  };

  const leaves = db.prepare(`
    SELECT l.id, l.student_id, s.name AS student_name, l.type, l.start_date, l.end_date, l.reason, l.status
    FROM leaves l JOIN students s ON s.id = l.student_id
    WHERE l.class_id = ? AND l.status <> '已销假' AND l.start_date <= ? AND l.end_date >= ?
      AND s.deleted_at IS NULL
    ORDER BY l.start_date, l.id
  `).all(classId, today, today);

  const duties = db.prepare(`
    SELECT d.id, d.student_id, s.name AS student_name, d.role, d.group_no, d.week_days, d.term
    FROM duties d JOIN students s ON s.id = d.student_id
    WHERE d.class_id = ? AND d.role = '值日生' AND s.deleted_at IS NULL
    ORDER BY d.group_no, d.id
  `).all(classId);

  const exams = db.prepare(`
    SELECT id, name, date, subjects, remark
    FROM exams
    WHERE class_id = ? AND date <> '' AND date >= ?
    ORDER BY date ASC, id ASC LIMIT 5
  `).all(classId, today).map(exam => ({ ...exam, subjects: JSON.parse(exam.subjects || '[]') }));

  const followUps = db.prepare(`
    SELECT t.*, s.name AS student_name
    FROM follow_up_tasks t JOIN students s ON s.id = t.student_id
    WHERE t.class_id = ? AND t.status IN ('pending', 'in_progress') AND s.deleted_at IS NULL
    ORDER BY CASE WHEN t.due_date = '' THEN 1 ELSE 0 END, t.due_date ASC, t.id DESC
  `).all(classId);
  const pendingFollowUps = followUps.filter(task => !task.due_date || task.due_date >= today);
  const overdueFollowUps = followUps.filter(task => task.due_date && task.due_date < today);
  const alerts = overdueFollowUps.map(task => ({
    type: 'followUp', level: 'danger', taskId: task.id, studentId: task.student_id,
    studentName: task.student_name, text: `跟进事项已逾期：${task.title}`,
  }));

  res.json({
    ok: true,
    data: {
      generatedAt: today,
      class: classRow,
      attendance,
      leaves,
      duties,
      exams,
      followUps,
      pendingFollowUps,
      overdueFollowUps,
      alerts,
      counts: {
        attendance: attendance.total,
        leaves: leaves.length,
        duties: duties.length,
        exams: exams.length,
        pendingFollowUps: followUps.length,
        overdueFollowUps: overdueFollowUps.length,
      },
    },
  });
});

export default router;
