import { Router } from 'express';
import db from '../db.js';
import { positiveInt } from '../validation.js';
import { STUDENT_FIELD_CATALOG, STUDENT_FIELD_BY_KEY } from '../config/student-field-catalog.js';

const router = Router();

function validClass(value) {
  const id = positiveInt(value);
  return id && db.prepare('SELECT id FROM classes WHERE id=?').get(id) ? id : 0;
}

function ensureDefinitions(classId) {
  const insert = db.prepare(`INSERT OR IGNORE INTO student_field_definitions
    (class_id, field_key, label, data_type, field_kind, enabled, archived, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?)`);
  const tx = db.transaction(() => STUDENT_FIELD_CATALOG.forEach((field, index) => insert.run(classId, field.key, field.label, field.dataType, field.kind, index)));
  tx();
}

router.get('/', (req, res) => {
  const classId = validClass(req.query.class_id);
  if (!classId) return res.status(400).json({ ok: false, code: 'INVALID_CLASS', error: '班级无效' });
  ensureDefinitions(classId);
  const rows = db.prepare(`SELECT id, field_key AS fieldKey, label, data_type AS dataType, field_kind AS fieldKind,
      enabled, archived, sort_order AS sortOrder FROM student_field_definitions WHERE class_id=? AND archived=0 ORDER BY sort_order, id`).all(classId);
  res.json({ ok: true, data: rows.map(row => ({ ...row, enabled: !!row.enabled, preset: !!STUDENT_FIELD_BY_KEY[row.fieldKey] })) });
});

router.put('/order', (req, res) => {
  const classId = validClass(req.query.class_id || req.body?.class_id);
  const keys = req.body?.fieldKeys;
  if (!classId) return res.status(400).json({ ok: false, code: 'INVALID_CLASS', error: '班级无效' });
  if (!Array.isArray(keys) || keys.some(key => !STUDENT_FIELD_BY_KEY[key]) || new Set(keys).size !== keys.length) {
    return res.status(400).json({ ok: false, code: 'INVALID_ORDER', error: '字段顺序无效' });
  }
  ensureDefinitions(classId);
  const update = db.prepare(`UPDATE student_field_definitions SET sort_order=?, updated_at=datetime('now','localtime') WHERE class_id=? AND field_key=?`);
  db.transaction(() => keys.forEach((key, index) => update.run(index, classId, key)))();
  res.json({ ok: true });
});

router.put('/:fieldKey', (req, res) => {
  const classId = validClass(req.query.class_id || req.body?.class_id);
  const field = STUDENT_FIELD_BY_KEY[req.params.fieldKey];
  if (!classId) return res.status(400).json({ ok: false, code: 'INVALID_CLASS', error: '班级无效' });
  if (!field) return res.status(404).json({ ok: false, code: 'FIELD_NOT_FOUND', error: '字段不在预设目录中' });
  ensureDefinitions(classId);
  const current = db.prepare('SELECT * FROM student_field_definitions WHERE class_id=? AND field_key=?').get(classId, field.key);
  const label = req.body?.label === undefined ? current.label : String(req.body.label).trim();
  const enabled = req.body?.enabled === undefined ? current.enabled : (req.body.enabled ? 1 : 0);
  if (!label || label.length > 40) return res.status(400).json({ ok: false, code: 'INVALID_FIELD', error: '字段显示名称无效' });
  db.prepare(`UPDATE student_field_definitions SET label=?, enabled=?, updated_at=datetime('now','localtime') WHERE id=?`).run(label, enabled, current.id);
  res.json({ ok: true, data: { fieldKey: field.key, label, enabled: !!enabled } });
});

export default router;
