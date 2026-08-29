import { Router } from 'express';
import db from '../db.js';
import { positiveInt } from '../validation.js';

const router = Router();
const LABEL_KEYS = new Set([
  'student.schoolNo', 'student.parentPhone', 'student.boarding', 'student.interestDuty',
  'duty.group', 'duty.roster',
]);

function classId(value) {
  const id = positiveInt(value);
  return id && db.prepare('SELECT id FROM classes WHERE id = ?').get(id) ? id : 0;
}

function parseSubjects(value) {
  if (!Array.isArray(value)) return null;
  const subjects = [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))];
  return subjects.length ? subjects : null;
}

router.get('/:id/customization', (req, res) => {
  const id = classId(req.params.id);
  if (!id) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const rows = db.prepare('SELECT label_key, label_value FROM class_display_labels WHERE class_id = ? ORDER BY label_key').all(id);
  res.json({ ok: true, data: { labels: Object.fromEntries(rows.map(row => [row.label_key, row.label_value])) } });
});

router.put('/:id/customization', (req, res) => {
  const id = classId(req.params.id);
  if (!id) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const labels = req.body?.labels;
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    return res.status(400).json({ ok: false, code: 'INVALID_LABELS', error: '词条配置格式不正确' });
  }
  const entries = Object.entries(labels);
  if (entries.some(([key, value]) => !LABEL_KEYS.has(key) || !String(value).trim() || String(value).length > 40)) {
    return res.status(400).json({ ok: false, code: 'INVALID_LABELS', error: '包含不支持或无效的词条' });
  }
  const tx = db.transaction(() => {
    const upsert = db.prepare(`INSERT INTO class_display_labels (class_id, label_key, label_value, updated_at)
      VALUES (?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(class_id, label_key) DO UPDATE SET label_value=excluded.label_value, updated_at=excluded.updated_at`);
    for (const [key, value] of entries) upsert.run(id, key, String(value).trim());
  });
  tx();
  res.json({ ok: true, data: { labels: Object.fromEntries(entries.map(([key, value]) => [key, String(value).trim()])) } });
});

router.get('/:id/subject-templates', (req, res) => {
  const id = classId(req.params.id);
  if (!id) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const rows = db.prepare('SELECT id, name, subjects_json FROM subject_templates WHERE class_id = ? ORDER BY name').all(id);
  res.json({ ok: true, data: rows.map(row => ({ id: row.id, name: row.name, subjects: JSON.parse(row.subjects_json || '[]') })) });
});

router.put('/:id/subject-templates/:templateId?', (req, res) => {
  const id = classId(req.params.id);
  if (!id) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const name = String(req.body?.name || '').trim();
  const subjects = parseSubjects(req.body?.subjects);
  if (!name || name.length > 60 || !subjects) return res.status(400).json({ ok: false, code: 'INVALID_TEMPLATE', error: '模板名称或科目不能为空' });
  const existing = req.params.templateId ? db.prepare('SELECT id FROM subject_templates WHERE id = ? AND class_id = ?').get(Number(req.params.templateId), id) : null;
  if (req.params.templateId && !existing) return res.status(404).json({ ok: false, code: 'TEMPLATE_NOT_FOUND', error: '科目模板不存在' });
  try {
    const result = existing
      ? db.prepare(`UPDATE subject_templates SET name=?, subjects_json=?, updated_at=datetime('now','localtime') WHERE id=? AND class_id=?`).run(name, JSON.stringify(subjects), existing.id, id)
      : db.prepare(`INSERT INTO subject_templates (class_id, name, subjects_json) VALUES (?, ?, ?)`).run(id, name, JSON.stringify(subjects));
    const templateId = existing ? existing.id : Number(result.lastInsertRowid);
    res.json({ ok: true, data: { id: templateId, name, subjects } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ ok: false, code: 'TEMPLATE_EXISTS', error: '同名科目模板已存在' });
    throw error;
  }
});

router.delete('/:id/subject-templates/:templateId', (req, res) => {
  const id = classId(req.params.id);
  const templateId = positiveInt(req.params.templateId);
  if (!id) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  if (!templateId || !db.prepare('DELETE FROM subject_templates WHERE id = ? AND class_id = ?').run(templateId, id).changes) {
    return res.status(404).json({ ok: false, code: 'TEMPLATE_NOT_FOUND', error: '科目模板不存在' });
  }
  res.json({ ok: true });
});

export { LABEL_KEYS };
export default router;
