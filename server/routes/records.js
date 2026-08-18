import { Router } from 'express';
import db from '../db.js';
import { badRequest } from '../validation.js';

const router = Router();

function hasStudent(id, res) {
  const s = db.prepare('SELECT id FROM students WHERE id = ?').get(Number(id));
  if (!s) { res.status(404).json({ ok: false, code: 'STUDENT_NOT_FOUND', error: '学生不存在' }); return false; }
  return true;
}

// 学生统一档案时间线：只读聚合现有成长记录、家校沟通和健康快照。
router.get('/:id/timeline', (req, res) => {
  const id = Number(req.params.id);
  if (!hasStudent(id, res)) return;
  const rows = db.prepare(`
    SELECT source_type, source_id, date, title, content, remark
    FROM (
      SELECT 'record' AS source_type, id AS source_id, date,
        type AS title, content, remark
      FROM student_records WHERE student_id = ?
      UNION ALL
      SELECT 'contact' AS source_type, id AS source_id, date,
        method AS title,
        CASE WHEN topic <> '' AND result <> '' THEN topic || '：' || result
             ELSE COALESCE(NULLIF(topic, ''), result) END AS content,
        remark
      FROM contacts WHERE student_id = ?
      UNION ALL
      SELECT 'metrics' AS source_type, id AS source_id, recorded_at AS date,
        '健康快照' AS title,
        '身高 ' || COALESCE(height_cm || 'cm', '—') || '；视力 ' ||
          COALESCE(vision_left || '/' || vision_right, '—') AS content,
        term AS remark
      FROM student_metrics_history WHERE student_id = ?
    )
    ORDER BY date DESC, source_id DESC
  `).all(id, id, id);
  res.json({ ok: true, data: rows });
});

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
  if (!content || !String(content).trim()) return badRequest(res, '记录内容不能为空');
  const info = db.prepare(`
    INSERT INTO student_records (student_id, type, content, date, remark) VALUES (?, ?, ?, ?, ?)
  `).run(Number(req.params.id), type || '表现', String(content).trim(), date || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

router.delete('/:id/records/:rid', (req, res) => {
  const rid = Number(req.params.rid);
  if (!Number.isInteger(rid) || rid < 1) return res.status(400).json({ ok: false, error: '无效的记录 ID' });
  const row = db.prepare('SELECT id FROM student_records WHERE id = ? AND student_id = ?').get(rid, Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, code: 'RECORD_NOT_FOUND', error: '记录不存在' });
  db.prepare('DELETE FROM student_records WHERE id = ? AND student_id = ?').run(rid, Number(req.params.id));
  res.json({ ok: true });
});

router.put('/:id/records/:rid', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const rid = Number(req.params.rid);
  if (!Number.isInteger(rid) || rid < 1) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', error: '无效的记录 ID' });
  const row = db.prepare('SELECT * FROM student_records WHERE id = ? AND student_id = ?').get(rid, Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, code: 'RECORD_NOT_FOUND', error: '记录不存在' });
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
  if (!topic && !result && !method) return badRequest(res, '请至少填写事由或结果');
  const info = db.prepare(`
    INSERT INTO contacts (student_id, date, method, topic, result, remark) VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(req.params.id), date || '', method || '', topic || '', result || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

router.delete('/:id/contacts/:cid', (req, res) => {
  const cid = Number(req.params.cid);
  if (!Number.isInteger(cid) || cid < 1) return res.status(400).json({ ok: false, error: '无效的沟通记录 ID' });
  const row = db.prepare('SELECT id FROM contacts WHERE id = ? AND student_id = ?').get(cid, Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, code: 'CONTACT_NOT_FOUND', error: '沟通记录不存在' });
  db.prepare('DELETE FROM contacts WHERE id = ? AND student_id = ?').run(cid, Number(req.params.id));
  res.json({ ok: true });
});

router.put('/:id/contacts/:cid', (req, res) => {
  if (!hasStudent(req.params.id, res)) return;
  const cid = Number(req.params.cid);
  if (!Number.isInteger(cid) || cid < 1) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', error: '无效的沟通记录 ID' });
  const row = db.prepare('SELECT * FROM contacts WHERE id = ? AND student_id = ?').get(cid, Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, code: 'CONTACT_NOT_FOUND', error: '沟通记录不存在' });
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
