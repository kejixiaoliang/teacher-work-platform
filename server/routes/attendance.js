import { Router } from 'express';
import db from '../db.js';

const router = Router();
const STATUSES = ['出勤', '迟到', '请假', '缺勤'];

// 某日登记（含未登记学生，默认出勤）
router.get('/', (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.json({ ok: false, error: '缺少班级或日期' });
  const students = db.prepare(`
    SELECT id, name, school_no FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读' ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(Number(class_id));
  const records = db.prepare(`
    SELECT student_id, status, remark FROM attendance WHERE class_id = ? AND date = ?
  `).all(Number(class_id), String(date));
  const recMap = new Map(records.map(r => [r.student_id, r]));
  const rows = students.map(s => {
    const r = recMap.get(s.id);
    return { studentId: s.id, name: s.name, schoolNo: s.school_no, status: r ? r.status : '出勤', remark: r ? r.remark || '' : '' };
  });
  const registeredCount = db.prepare('SELECT COUNT(*) AS c FROM attendance WHERE class_id = ? AND date = ?').get(Number(class_id), String(date)).c;
  res.json({ ok: true, data: { date, rows, registeredCount } });
});

// 批量保存（upsert）
router.put('/', (req, res) => {
  const { classId, date, rows } = req.body || {};
  if (!classId || !date || !Array.isArray(rows)) return res.json({ ok: false, error: '参数不完整' });
  // 校验学生属于该班
  const validIds = new Set(db.prepare('SELECT id FROM students WHERE class_id = ?').all(Number(classId)).map(r => r.id));
  const upsert = db.prepare(`
    INSERT INTO attendance (class_id, student_id, date, status, remark) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(class_id, student_id, date) DO UPDATE SET status = excluded.status, remark = excluded.remark
  `);
  let saved = 0;
  const tx = db.transaction((list) => {
    for (const r of list) {
      if (r.studentId == null || !validIds.has(Number(r.studentId))) continue;
      const status = STATUSES.includes(r.status) ? r.status : '出勤';
      upsert.run(Number(classId), Number(r.studentId), String(date), status, r.remark || '');
      saved++;
    }
  });
  tx(rows);
  res.json({ ok: true, data: { count: saved } });
});

// 按月统计：每人各状态天数
router.get('/stats', (req, res) => {
  const { class_id, month } = req.query;
  if (!class_id || !month) return res.json({ ok: false, error: '缺少班级或月份' });
  const prefix = String(month) + '%';
  const rows = db.prepare(`
    SELECT a.student_id, st.name, st.school_no,
      SUM(CASE WHEN a.status = '出勤' THEN 1 ELSE 0 END) AS 出勤,
      SUM(CASE WHEN a.status = '迟到' THEN 1 ELSE 0 END) AS 迟到,
      SUM(CASE WHEN a.status = '请假' THEN 1 ELSE 0 END) AS 请假,
      SUM(CASE WHEN a.status = '缺勤' THEN 1 ELSE 0 END) AS 缺勤,
      COUNT(*) AS days
    FROM attendance a JOIN students st ON st.id = a.student_id
    WHERE a.class_id = ? AND a.date LIKE ?
    GROUP BY a.student_id
    ORDER BY 缺勤 DESC, 迟到 DESC
  `).all(Number(class_id), prefix);
  res.json({ ok: true, data: rows.map(r => ({ ...r, 出勤: Number(r.出勤), 迟到: Number(r.迟到), 请假: Number(r.请假), 缺勤: Number(r.缺勤), days: Number(r.days) })) });
});

export default router;
