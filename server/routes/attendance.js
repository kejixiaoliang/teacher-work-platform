import { Router } from 'express';
import db from '../db.js';
import { badRequest, isDateString, isMonthString, positiveInt } from '../validation.js';

const router = Router();
const STATUSES = ['出勤', '迟到', '请假', '缺勤'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 某日登记（含未登记学生，默认出勤）
router.get('/', (req, res) => {
  const { class_id, date } = req.query;
  const classId = positiveInt(class_id);
  if (!classId || !date) return badRequest(res, '缺少有效班级或日期');
  if (!DATE_RE.test(String(date)) || !isDateString(String(date))) return badRequest(res, '日期格式应为有效的 YYYY-MM-DD');
  const students = db.prepare(`
    SELECT id, name, school_no FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读' ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(classId);
  const records = db.prepare(`
    SELECT student_id, status, remark FROM attendance WHERE class_id = ? AND date = ?
  `).all(classId, String(date));
  const leaveRows = db.prepare(`
    SELECT student_id, type, start_date, end_date, reason
    FROM leaves
    WHERE class_id = ? AND status = '已批准'
      AND start_date <= ? AND COALESCE(NULLIF(end_date, ''), start_date) >= ?
  `).all(classId, String(date), String(date));
  const recMap = new Map(records.map(r => [r.student_id, r]));
  const leaveMap = new Map(leaveRows.map(r => [r.student_id, r]));
  const rows = students.map(s => {
    const r = recMap.get(s.id);
    const leave = leaveMap.get(s.id);
    return {
      studentId: s.id, name: s.name, schoolNo: s.school_no,
      status: r ? r.status : (leave ? '请假' : '出勤'),
      remark: r ? r.remark || '' : '',
      leaveInfo: leave ? { type: leave.type, startDate: leave.start_date, endDate: leave.end_date || leave.start_date, reason: leave.reason } : null,
    };
  });
  const registeredCount = db.prepare('SELECT COUNT(*) AS c FROM attendance WHERE class_id = ? AND date = ?').get(classId, String(date)).c;
  res.json({ ok: true, data: { date, rows, registeredCount } });
});

// 批量保存（upsert）
router.put('/', (req, res) => {
  const { classId, date, rows } = req.body || {};
  const parsedClassId = positiveInt(classId);
  if (!parsedClassId || !date || !Array.isArray(rows)) return badRequest(res, '参数不完整');
  if (!DATE_RE.test(String(date)) || !isDateString(String(date))) return badRequest(res, '日期格式应为有效的 YYYY-MM-DD');
  // 校验学生属于该班且在册（软删除学生不能写入考勤）
  const validIds = new Set(db.prepare('SELECT id FROM students WHERE class_id = ? AND deleted_at IS NULL').all(parsedClassId).map(r => r.id));
  const upsert = db.prepare(`
    INSERT INTO attendance (class_id, student_id, date, status, remark) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(class_id, student_id, date) DO UPDATE SET status = excluded.status, remark = excluded.remark
  `);
  // 方向 1：读取已有记录，保留请假联动的 remark 标记（销假时靠它清理）
  const getRemark = db.prepare('SELECT remark FROM attendance WHERE class_id=? AND student_id=? AND date=?');
  let saved = 0;
  const tx = db.transaction((list) => {
    for (const r of list) {
      if (r.studentId == null || !validIds.has(Number(r.studentId))) continue;
      const status = STATUSES.includes(r.status) ? r.status : '出勤';
      const prev = getRemark.get(parsedClassId, Number(r.studentId), String(date));
      // 前端未填备注时，保留请假联动标记；否则按用户输入覆盖
      const remark = r.remark && String(r.remark).trim()
        ? String(r.remark).trim()
        : (prev?.remark === '请假联动' ? '请假联动' : (r.remark || ''));
      upsert.run(parsedClassId, Number(r.studentId), String(date), status, remark);
      saved++;
    }
  });
  tx(rows);
  res.json({ ok: true, data: { count: saved } });
});

// 按月统计：每人各状态天数
router.get('/stats', (req, res) => {
  const { class_id, month } = req.query;
  const classId = positiveInt(class_id);
  if (!classId || !month) return badRequest(res, '缺少有效班级或月份');
  if (!isMonthString(String(month))) return badRequest(res, '月份格式应为有效的 YYYY-MM');
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
  `).all(classId, prefix);
  res.json({ ok: true, data: rows.map(r => ({ ...r, 出勤: Number(r.出勤), 迟到: Number(r.迟到), 请假: Number(r.请假), 缺勤: Number(r.缺勤), days: Number(r.days) })) });
});

export default router;
