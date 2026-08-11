import { Router } from 'express';
import db from '../db.js';
import { badRequest, isDateString, positiveInt, text } from '../validation.js';

const router = Router();

/* ================= 考试 CRUD ================= */

// 考试列表
router.get('/exams', (req, res) => {
  const { class_id } = req.query;
  const classId = positiveInt(class_id);
  if (!classId) return badRequest(res, '缺少有效班级');
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(DISTINCT student_id) FROM exam_scores s WHERE s.exam_id = e.id) AS scored_count
    FROM exams e
    WHERE e.class_id = ?
    ORDER BY e.id DESC
  `).all(classId);
  res.json({ ok: true, data: rows.map(r => ({ ...r, subjects: safeJson(r.subjects, []) })) });
});

// 新建考试（同班同名幂等：已存在则返回已有考试）
router.post('/exams', (req, res) => {
  const { class_id, name, date, subjects, remark } = req.body || {};
  const classId = positiveInt(class_id);
  const examName = text(name, { max: 100 });
  if (!classId || !examName) return badRequest(res, '考试名称或班级无效');
  if (date && !isDateString(String(date))) return badRequest(res, '考试日期应为有效的 YYYY-MM-DD');
  if (!db.prepare('SELECT id FROM classes WHERE id = ?').get(classId)) {
    return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  }
  const existed = db.prepare('SELECT id FROM exams WHERE class_id = ? AND name = ?').get(classId, examName);
  if (existed) return res.json({ ok: true, data: { id: existed.id, existed: true } });
  const info = db.prepare(`
    INSERT INTO exams (class_id, name, date, subjects, remark)
    VALUES (?, ?, ?, ?, ?)
  `).run(classId, examName, date || '', JSON.stringify(Array.isArray(subjects) ? subjects : []), remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新考试
router.put('/exams/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!positiveInt(req.params.id)) return badRequest(res, '无效的考试 ID');
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!row) return res.json({ ok: false, error: '考试不存在' });
  const b = req.body || {};
  db.prepare(`UPDATE exams SET name=?, date=?, subjects=?, remark=? WHERE id=?`).run(
    b.name ? String(b.name).trim() : row.name,
    b.date !== undefined ? b.date : row.date,
    b.subjects !== undefined ? JSON.stringify(b.subjects) : row.subjects,
    b.remark !== undefined ? b.remark : row.remark,
    id
  );
  res.json({ ok: true });
});

// 删除考试（级联删成绩）
router.delete('/exams/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的考试 ID' });
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ================= 成绩读写 ================= */

// 某考试全部成绩（平铺行）
router.get('/', (req, res) => {
  const { exam_id } = req.query;
  const examId = positiveInt(exam_id);
  if (!examId) return badRequest(res, '缺少有效考试');
  const rows = db.prepare(`
    SELECT s.id, s.student_id, s.subject, s.score
    FROM exam_scores s WHERE s.exam_id = ? ORDER BY s.student_id, s.subject
  `).all(examId);
  res.json({ ok: true, data: rows });
});

// 批量保存（upsert）
router.put('/', (req, res) => {
  const { examId, rows } = req.body || {};
  const parsedExamId = positiveInt(examId);
  if (!parsedExamId || !Array.isArray(rows)) return badRequest(res, '参数不完整');
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(parsedExamId);
  if (!exam) return res.json({ ok: false, error: '考试不存在' });
  // 校验学生属于该班且在册（软删除学生不能写入成绩）
  const validIds = new Set(db.prepare('SELECT id FROM students WHERE class_id = ? AND deleted_at IS NULL').all(exam.class_id).map(r => r.id));
  const upsert = db.prepare(`
    INSERT INTO exam_scores (exam_id, student_id, subject, score) VALUES (?, ?, ?, ?)
    ON CONFLICT(exam_id, student_id, subject) DO UPDATE SET score = excluded.score
  `);
  let saved = 0;
  const skipped = [];
  const tx = db.transaction((list) => {
    for (const r of list) {
      const studentId = positiveInt(r.studentId);
      const subject = r.subject == null ? '' : String(r.subject).trim();
      if (!studentId || !validIds.has(studentId)) {
        skipped.push({ studentId: studentId || r.studentId, subject, reason: '学生不属于该班级或已删除' });
        continue;
      }
      if (!subject || subject.length > 30) {
        skipped.push({ studentId, subject, reason: '科目名称无效' });
        continue;
      }
      const v = r.score === null || r.score === '' || r.score === undefined ? null : Number(r.score);
      if (v != null && (!Number.isFinite(v) || v < 0 || v > 200)) {
        skipped.push({ studentId, subject, reason: '分数无效或超出范围' });
        continue;
      }
      upsert.run(parsedExamId, studentId, subject, v);
      saved++;
    }
  });
  tx(rows);
  res.json({ ok: true, data: { count: saved, skipped } });
});

/* ================= 统计分析 ================= */

// 某考试统计：各科指标 + 总分排名 + 分数段
router.get('/analysis', (req, res) => {
  const { exam_id } = req.query;
  const examId = positiveInt(exam_id);
  if (!examId) return badRequest(res, '缺少有效考试');
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.json({ ok: false, error: '考试不存在' });
  const subjects = safeJson(exam.subjects, []);
  const rows = db.prepare(`
    SELECT s.student_id, s.subject, s.score, st.name, st.school_no
    FROM exam_scores s JOIN students st ON st.id = s.student_id
    WHERE s.exam_id = ? AND s.score IS NOT NULL
  `).all(examId);

  // 按科目统计
  const bySubject = {};
  for (const r of rows) {
    if (!bySubject[r.subject]) bySubject[r.subject] = [];
    bySubject[r.subject].push(r.score);
  }
  const subjectStats = Object.entries(bySubject).map(([subject, arr]) => {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      subject,
      count: arr.length,
      avg: Math.round(avg * 10) / 10,
      max: Math.max(...arr),
      min: Math.min(...arr),
      excellent: Math.round(arr.filter(v => v >= 90).length / arr.length * 1000) / 10,
      pass: Math.round(arr.filter(v => v >= 60).length / arr.length * 1000) / 10,
    };
  });

  // 总分排名（只统计有成绩的学生）
  const studentMap = new Map();
  for (const r of rows) {
    if (!studentMap.has(r.student_id)) {
      studentMap.set(r.student_id, { studentId: r.student_id, name: r.name, schoolNo: r.school_no, scores: {}, total: 0, count: 0 });
    }
    const s = studentMap.get(r.student_id);
    s.scores[r.subject] = r.score;
    s.total += r.score;
    s.count++;
  }
  const ranking = [...studentMap.values()]
    .filter(s => s.count > 0)
    .sort((a, b) => b.total - a.total)
    .map((s, i) => ({ ...s, rank: i + 1, total: Math.round(s.total * 10) / 10 }));

  res.json({ ok: true, data: { subjects, subjectStats, ranking } });
});

// 某学生历次考试总分趋势
router.get('/trend', (req, res) => {
  const { class_id, student_id } = req.query;
  const classId = positiveInt(class_id);
  const studentId = positiveInt(student_id);
  if (!classId || !studentId) return badRequest(res, '缺少有效参数');
  const rows = db.prepare(`
    SELECT e.id AS exam_id, e.name, e.date,
      (SELECT SUM(score) FROM exam_scores s WHERE s.exam_id = e.id AND s.student_id = ?) AS total,
      (SELECT COUNT(*) FROM exam_scores s WHERE s.exam_id = e.id AND s.student_id = ? AND s.score IS NOT NULL) AS cnt
    FROM exams e
    WHERE e.class_id = ?
    ORDER BY e.date, e.id
  `).all(studentId, studentId, classId);
  res.json({ ok: true, data: rows.filter(r => r.cnt > 0) });
});

function safeJson(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

export default router;
