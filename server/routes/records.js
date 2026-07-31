import { Router } from 'express';
import db from '../db.js';

const router = Router();

function hasStudent(id, res) {
  const s = db.prepare('SELECT id FROM students WHERE id = ?').get(Number(id));
  if (!s) { res.json({ ok: false, error: '学生不存在' }); return false; }
  return true;
}

/* ============ 成长档案 ============ */
router.get('/:id/records', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const rows = db.prepare(`
    SELECT * FROM student_records WHERE student_id = ? ORDER BY date DESC, id DESC
  `).all(Number(req.params.id));
  res.json({ ok: true, data: rows });
});

router.post('/:id/records', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const { type, content, date, remark } = req.body || {};
  if (!content || !String(content).trim()) return res.json({ ok: false, error: '记录内容不能为空' });
  const info = db.prepare(`
    INSERT INTO student_records (student_id, type, content, date, remark) VALUES (?, ?, ?, ?, ?)
  `).run(Number(req.params.id), type || '表现', String(content).trim(), date || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

router.delete('/:id/records/:rid', (req, res) => {
  db.prepare('DELETE FROM student_records WHERE id = ? AND student_id = ?').run(Number(req.params.rid), Number(req.params.id));
  res.json({ ok: true });
});

router.put('/:id/records/:rid', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const row = db.prepare('SELECT * FROM student_records WHERE id = ? AND student_id = ?').get(Number(req.params.rid), Number(req.params.id));
  if (!row) return res.json({ ok: false, error: '记录不存在' });
  const { type, content, date, remark } = req.body || {};
  db.prepare('UPDATE student_records SET type=?, content=?, date=?, remark=? WHERE id=?').run(
    type !== undefined ? type : row.type,
    content !== undefined ? String(content).trim() : row.content,
    date !== undefined ? date : row.date,
    remark !== undefined ? remark : row.remark,
    row.id
  );
  res.json({ ok: true });
});

/* ============ 家校沟通 ============ */
router.get('/:id/contacts', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const rows = db.prepare(`
    SELECT * FROM contacts WHERE student_id = ? ORDER BY date DESC, id DESC
  `).all(Number(req.params.id));
  res.json({ ok: true, data: rows });
});

router.post('/:id/contacts', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const { date, method, topic, result, remark } = req.body || {};
  if (!topic && !result && !method) return res.json({ ok: false, error: '请至少填写事由或结果' });
  const info = db.prepare(`
    INSERT INTO contacts (student_id, date, method, topic, result, remark) VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(req.params.id), date || '', method || '', topic || '', result || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

router.delete('/:id/contacts/:cid', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ? AND student_id = ?').run(Number(req.params.cid), Number(req.params.id));
  res.json({ ok: true });
});

router.put('/:id/contacts/:cid', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const row = db.prepare('SELECT * FROM contacts WHERE id = ? AND student_id = ?').get(Number(req.params.cid), Number(req.params.id));
  if (!row) return res.json({ ok: false, error: '沟通记录不存在' });
  const { date, method, topic, result, remark } = req.body || {};
  db.prepare('UPDATE contacts SET date=?, method=?, topic=?, result=?, remark=? WHERE id=?').run(
    date !== undefined ? date : row.date,
    method !== undefined ? method : row.method,
    topic !== undefined ? topic : row.topic,
    result !== undefined ? result : row.result,
    remark !== undefined ? remark : row.remark,
    row.id
  );
  res.json({ ok: true });
});

export default router;
