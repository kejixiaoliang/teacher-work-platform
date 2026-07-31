import { Router } from 'express';
import db from '../db.js';

const router = Router();

/* ================= 考试 CRUD ================= */

// 考试列表
router.get('/exams', (req, res) => {
  const { class_id } = req.query;
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(DISTINCT student_id) FROM exam_scores s WHERE s.exam_id = e.id) AS scored_count
    FROM exams e
    WHERE e.class_id = ?
    ORDER BY e.id DESC
  `).all(Number(class_id));
  res.json({ ok: true, data: rows.map(r => ({ ...r, subjects: safeJson(r.subjects, []) })) });
});

// 新建考试（同班同名幂等：已存在则返回已有考试）
router.post('/exams', (req, res) => {
  const { class_id, name, date, subjects, remark } = req.body || {};
  if (!class_id || !name || !String(name).trim()) return res.json({ ok: false, error: '考试名称不能为空' });
  const existed = db.prepare('SELECT id FROM exams WHERE class_id = ? AND name = ?').get(Number(class_id), String(name).trim());
  if (existed) return res.json({ ok: true, data: { id: existed.id, existed: true } });
  const info = db.prepare(`
    INSERT INTO exams (class_id, name, date, subjects, remark)
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(class_id), String(name).trim(), date || '', JSON.stringify(Array.isArray(subjects) ? subjects : []), remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新考试
router.put('/exams/:id', (req, res) => {
  const id = Number(req.params.id);
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
  db.prepare('DELETE FROM exams WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ================= 成绩读写 ================= */

// 某考试全部成绩（平铺行）
router.get('/', (req, res) => {
  const { exam_id } = req.query;
  if (!exam_id) return res.json({ ok: false, error: '缺少考试' });
  const rows = db.prepare(`
    SELECT s.id, s.student_id, s.subject, s.score
    FROM exam_scores s WHERE s.exam_id = ? ORDER BY s.student_id, s.subject
  `).all(Number(exam_id));
  res.json({ ok: true, data: rows });
});

// 批量保存（upsert）
router.put('/', (req, res) => {
  const { examId, rows } = req.body || {};
  if (!examId || !Array.isArray(rows)) return res.json({ ok: false, error: '参数不完整' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(Number(examId));
  if (!exam) return res.json({ ok: false, error: '考试不存在' });
  // 校验学生属于该班（防跨班脏数据）
  const validIds = new Set(db.prepare('SELECT id FROM students WHERE class_id = ?').all(exam.class_id).map(r => r.id));
  const upsert = db.prepare(`
    INSERT INTO exam_scores (exam_id, student_id, subject, score) VALUES (?, ?, ?, ?)
    ON CONFLICT(exam_id, student_id, subject) DO UPDATE SET score = excluded.score
  `);
  let saved = 0;
  const tx = db.transaction((list) => {
    for (const r of list) {
      if (r.studentId == null || !r.subject) continue;
      if (!validIds.has(Number(r.studentId))) continue;
      const v = r.score === null || r.score === '' || r.score === undefined ? null : Number(r.score);
      if (v != null && !Number.isFinite(v)) continue; // 非法分数跳过
      upsert.run(Number(examId), Number(r.studentId), String(r.subject), v);
      saved++;
    }
  });
  tx(rows);
  res.json({ ok: true, data: { count: saved } });
});

/* ================= 统计分析 ================= */

// 某考试统计：各科指标 + 总分排名 + 分数段
router.get('/analysis', (req, res) => {
  const { exam_id } = req.query;
  if (!exam_id) return res.json({ ok: false, error: '缺少考试' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(Number(exam_id));
  if (!exam) return res.json({ ok: false, error: '考试不存在' });
  const subjects = safeJson(exam.subjects, []);
  const rows = db.prepare(`
    SELECT s.student_id, s.subject, s.score, st.name, st.school_no
    FROM exam_scores s JOIN students st ON st.id = s.student_id
    WHERE s.exam_id = ? AND s.score IS NOT NULL
  `).all(Number(exam_id));

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
  if (!class_id || !student_id) return res.json({ ok: false, error: '缺少参数' });
  const rows = db.prepare(`
    SELECT e.id AS exam_id, e.name, e.date,
      (SELECT SUM(score) FROM exam_scores s WHERE s.exam_id = e.id AND s.student_id = ?) AS total,
      (SELECT COUNT(*) FROM exam_scores s WHERE s.exam_id = e.id AND s.student_id = ? AND s.score IS NOT NULL) AS cnt
    FROM exams e
    WHERE e.class_id = ?
    ORDER BY e.date, e.id
  `).all(Number(student_id), Number(student_id), Number(class_id));
  res.json({ ok: true, data: rows.filter(r => r.cnt > 0) });
});

function safeJson(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

export default router;
