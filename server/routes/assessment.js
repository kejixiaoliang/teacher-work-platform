import crypto from 'node:crypto';
import { Router } from 'express';
import db from '../db.js';
import { badRequest, finiteNumber, isDateString, positiveInt, text } from '../validation.js';

const router = Router();
const SCORE_MIN = -100;
const SCORE_MAX = 100;

function itemRow(id) {
  return db.prepare(`
    SELECT i.*, c.name AS category_name
    FROM assessment_items i
    JOIN assessment_categories c ON c.id = i.category_id
    WHERE i.id = ?
  `).get(id);
}

function recordSnapshot(row) {
  return {
    id: row.id, batchId: row.batch_id, classId: row.class_id, studentId: row.student_id,
    itemId: row.item_id, categoryNameSnapshot: row.category_name_snapshot,
    itemNameSnapshot: row.item_name_snapshot, scoreSnapshot: row.score_snapshot,
    behaviorDate: row.behavior_date, academicYearSnapshot: row.academic_year_snapshot,
    termSnapshot: row.term_snapshot, remark: row.remark, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function publicRecord(row) {
  if (!row) return null;
  return {
    ...row,
    allowDailyRepeat: row.allow_daily_repeat == null ? undefined : Boolean(row.allow_daily_repeat),
    score: row.score_snapshot, studentId: row.student_id, itemId: row.item_id,
    classId: row.class_id, batchId: row.batch_id,
    categoryName: row.category_name_snapshot, itemName: row.item_name_snapshot,
    behaviorDate: row.behavior_date, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function parseScore(value) {
  const score = finiteNumber(value, { min: SCORE_MIN, max: SCORE_MAX });
  return Number.isSafeInteger(score) ? score : null;
}

function parseActive(value, fallback = true) {
  if (value === undefined) return fallback ? 1 : 0;
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function requireName(value, label) {
  const name = text(value, { max: 100 });
  return name ? name : { error: `${label}不能为空或过长` };
}

function updateCategory(id, body) {
  const row = db.prepare('SELECT * FROM assessment_categories WHERE id = ?').get(id);
  if (!row) return { missing: true };
  const name = body.name === undefined ? row.name : requireName(body.name, '分类名称');
  if (name?.error) return { error: name.error };
  const sortOrder = body.sortOrder === undefined ? row.sort_order : Number(body.sortOrder);
  if (!Number.isSafeInteger(sortOrder)) return { error: '排序值无效' };
  try {
    db.prepare(`UPDATE assessment_categories SET name=?, sort_order=?, is_active=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(name, sortOrder, parseActive(body.isActive, Boolean(row.is_active)), id);
  } catch (error) {
    if (String(error.code).includes('CONSTRAINT')) return { conflict: true };
    throw error;
  }
  return { row: db.prepare('SELECT * FROM assessment_categories WHERE id = ?').get(id) };
}

function itemInput(body, existing = null) {
  const name = body.name === undefined ? existing?.name : requireName(body.name, '行为名称');
  if (name?.error) return { error: name.error };
  const categoryId = positiveInt(body.categoryId ?? body.category_id ?? existing?.category_id);
  if (!categoryId) return { error: '分类无效' };
  const score = body.score === undefined ? existing?.score : parseScore(body.score);
  if (score === null || score === undefined) return { error: '分值必须是 -100 至 100 的整数' };
  const sortOrder = body.sortOrder === undefined ? (existing?.sort_order ?? 0) : Number(body.sortOrder);
  if (!Number.isSafeInteger(sortOrder)) return { error: '排序值无效' };
  return {
    name, categoryId, score,
    allowDailyRepeat: body.allowDailyRepeat === undefined
      ? (body.allow_daily_repeat === undefined ? (existing?.allow_daily_repeat ?? 0) : parseActive(body.allow_daily_repeat))
      : parseActive(body.allowDailyRepeat),
    description: body.description === undefined ? (existing?.description ?? '') : (text(body.description, { max: 500 }) ?? ''),
    sortOrder,
    isActive: body.isActive === undefined ? (existing?.is_active ?? 1) : parseActive(body.isActive),
  };
}

router.get('/categories', (req, res) => {
  const includeInactive = req.query.include_inactive === '1';
  const categories = db.prepare(`SELECT * FROM assessment_categories ${includeInactive ? '' : 'WHERE is_active=1'} ORDER BY sort_order, id`).all();
  const items = db.prepare(`
    SELECT i.*, c.name AS category_name FROM assessment_items i
    JOIN assessment_categories c ON c.id=i.category_id
    ${includeInactive ? '' : 'WHERE i.is_active=1 AND c.is_active=1'}
    ORDER BY i.sort_order, i.id
  `).all();
  const itemMap = new Map(categories.map(category => [category.id, []]));
  items.forEach(item => itemMap.get(item.category_id)?.push({
    ...item, categoryId: item.category_id, allowDailyRepeat: Boolean(item.allow_daily_repeat), isActive: Boolean(item.is_active),
  }));
  res.json({ ok: true, data: categories.map(category => ({
    ...category, isActive: Boolean(category.is_active), items: itemMap.get(category.id) || [],
  })) });
});

router.post('/categories', (req, res) => {
  const name = requireName(req.body?.name, '分类名称');
  if (name?.error) return badRequest(res, name.error);
  const sortOrder = req.body?.sortOrder === undefined ? 0 : Number(req.body.sortOrder);
  if (!Number.isSafeInteger(sortOrder)) return badRequest(res, '排序值无效');
  try {
    const info = db.prepare('INSERT INTO assessment_categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder);
    res.json({ ok: true, data: db.prepare('SELECT * FROM assessment_categories WHERE id=?').get(info.lastInsertRowid) });
  } catch (error) {
    if (String(error.code).includes('CONSTRAINT')) return res.status(409).json({ ok: false, code: 'CATEGORY_CONFLICT', error: '分类名称已存在' });
    throw error;
  }
});

router.put('/categories/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的分类 ID');
  const result = updateCategory(id, req.body || {});
  if (result.missing) return res.status(404).json({ ok: false, code: 'CATEGORY_NOT_FOUND', error: '分类不存在' });
  if (result.error) return badRequest(res, result.error);
  if (result.conflict) return res.status(409).json({ ok: false, code: 'CATEGORY_CONFLICT', error: '分类名称已存在' });
  res.json({ ok: true, data: result.row });
});

router.delete('/categories/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的分类 ID');
  const category = db.prepare('SELECT id FROM assessment_categories WHERE id=?').get(id);
  if (!category) return res.status(404).json({ ok: false, code: 'CATEGORY_NOT_FOUND', error: '分类不存在' });
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM assessment_items WHERE category_id=?').get(id).count;
  if (itemCount) return res.status(409).json({ ok: false, code: 'CATEGORY_HAS_ITEMS', error: '请先删除该分类下的行为项目' });
  db.prepare('DELETE FROM assessment_categories WHERE id=?').run(id);
  res.json({ ok: true });
});

router.post('/items', (req, res) => {
  const input = itemInput(req.body || {});
  if (input.error) return badRequest(res, input.error);
  if (!db.prepare('SELECT id FROM assessment_categories WHERE id=?').get(input.categoryId)) return res.status(404).json({ ok: false, code: 'CATEGORY_NOT_FOUND', error: '分类不存在' });
  try {
    const info = db.prepare(`INSERT INTO assessment_items (category_id,name,score,allow_daily_repeat,description,sort_order,is_active) VALUES (?,?,?,?,?,?,?)`)
      .run(input.categoryId, input.name, input.score, input.allowDailyRepeat, input.description, input.sortOrder, input.isActive);
    res.json({ ok: true, data: itemRow(info.lastInsertRowid) });
  } catch (error) {
    if (String(error.code).includes('CONSTRAINT')) return res.status(409).json({ ok: false, code: 'ITEM_CONFLICT', error: '同一分类下行为名称已存在' });
    throw error;
  }
});

router.put('/items/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的行为项目 ID');
  const existing = db.prepare('SELECT * FROM assessment_items WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ ok: false, code: 'ITEM_NOT_FOUND', error: '行为项目不存在' });
  const input = itemInput(req.body || {}, existing);
  if (input.error) return badRequest(res, input.error);
  if (!db.prepare('SELECT id FROM assessment_categories WHERE id=?').get(input.categoryId)) return res.status(404).json({ ok: false, code: 'CATEGORY_NOT_FOUND', error: '分类不存在' });
  try {
    db.prepare(`UPDATE assessment_items SET category_id=?,name=?,score=?,allow_daily_repeat=?,description=?,sort_order=?,is_active=?,updated_at=datetime('now','localtime') WHERE id=?`)
      .run(input.categoryId, input.name, input.score, input.allowDailyRepeat, input.description, input.sortOrder, input.isActive, id);
    res.json({ ok: true, data: itemRow(id) });
  } catch (error) {
    if (String(error.code).includes('CONSTRAINT')) return res.status(409).json({ ok: false, code: 'ITEM_CONFLICT', error: '同一分类下行为名称已存在' });
    throw error;
  }
});

router.delete('/items/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的行为项目 ID');
  const item = db.prepare('SELECT id FROM assessment_items WHERE id=?').get(id);
  if (!item) return res.status(404).json({ ok: false, code: 'ITEM_NOT_FOUND', error: '行为项目不存在' });
  const recordCount = db.prepare('SELECT COUNT(*) AS count FROM assessment_records WHERE item_id=?').get(id).count;
  if (recordCount) return res.status(409).json({ ok: false, code: 'ITEM_HAS_RECORDS', error: '该项目已有记分记录，只能停用，不能删除' });
  db.prepare('DELETE FROM assessment_items WHERE id=?').run(id);
  res.json({ ok: true });
});

router.post('/items/:id/disable', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的行为项目 ID');
  const result = db.prepare("UPDATE assessment_items SET is_active=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
  if (!result.changes) return res.status(404).json({ ok: false, code: 'ITEM_NOT_FOUND', error: '行为项目不存在' });
  res.json({ ok: true });
});

router.get('/records', (req, res) => {
  const conditions = [];
  const params = [];
  const classId = positiveInt(req.query.class_id);
  if (classId) { conditions.push('r.class_id=?'); params.push(classId); }
  if (req.query.student_id) { const id = positiveInt(req.query.student_id); if (!id) return badRequest(res, '学生 ID 无效'); conditions.push('r.student_id=?'); params.push(id); }
  if (req.query.month) { if (!/^\d{4}-\d{2}$/.test(req.query.month)) return badRequest(res, '月份应为 YYYY-MM'); conditions.push('substr(r.behavior_date,1,7)=?'); params.push(req.query.month); }
  if (req.query.from) { if (!isDateString(req.query.from)) return badRequest(res, '起始日期无效'); conditions.push('r.behavior_date>=?'); params.push(req.query.from); }
  if (req.query.to) { if (!isDateString(req.query.to)) return badRequest(res, '结束日期无效'); conditions.push('r.behavior_date<=?'); params.push(req.query.to); }
  if (req.query.category_id) { const id = positiveInt(req.query.category_id); if (!id) return badRequest(res, '分类 ID 无效'); conditions.push('i.category_id=?'); params.push(id); }
  if (req.query.item_id) { const id = positiveInt(req.query.item_id); if (!id) return badRequest(res, '行为项目 ID 无效'); conditions.push('r.item_id=?'); params.push(id); }
  if (req.query.include_voided !== '1') conditions.push("r.status='active'");
  const rows = db.prepare(`
    SELECT r.*, s.name AS student_name, s.school_no, i.allow_daily_repeat
    FROM assessment_records r JOIN students s ON s.id=r.student_id
    LEFT JOIN assessment_items i ON i.id=r.item_id
    ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
    ORDER BY r.behavior_date DESC, r.id DESC
  `).all(...params);
  res.json({ ok: true, data: rows.map(publicRecord) });
});

function classOr404(classId, res) {
  const row = db.prepare('SELECT id, academic_year, term FROM classes WHERE id=?').get(classId);
  if (!row) {
    res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
    return null;
  }
  return row;
}

function rankingForRange(classId, from, to) {
  const students = db.prepare(`
    SELECT id AS student_id, name, school_no
    FROM students WHERE class_id=? AND deleted_at IS NULL
    ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(classId);
  const rows = db.prepare(`
    SELECT r.student_id,
      COUNT(*) AS record_count,
      COALESCE(SUM(CASE WHEN r.score_snapshot > 0 THEN r.score_snapshot ELSE 0 END), 0) AS positive,
      COALESCE(SUM(CASE WHEN r.score_snapshot < 0 THEN r.score_snapshot ELSE 0 END), 0) AS negative,
      COALESCE(SUM(r.score_snapshot), 0) AS net
    FROM assessment_records r
    WHERE r.class_id=? AND r.status='active' AND r.behavior_date>=? AND r.behavior_date<?
    GROUP BY r.student_id
  `).all(classId, from, to);
  const byStudent = new Map(rows.map(row => [row.student_id, row]));
  return students.map(student => {
    const row = byStudent.get(student.student_id);
    return {
      studentId: student.student_id,
      name: student.name,
      schoolNo: student.school_no,
      positive: Number(row?.positive || 0),
      negative: Number(row?.negative || 0),
      net: Number(row?.net || 0),
      recordCount: Number(row?.record_count || 0),
    };
  }).sort((a, b) => b.net - a.net || b.positive - a.positive || a.name.localeCompare(b.name, 'zh-CN'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function categorySummary(classId, from, to) {
  return db.prepare(`
    SELECT r.category_name_snapshot AS category_name,
      COUNT(*) AS record_count,
      COALESCE(SUM(CASE WHEN r.score_snapshot > 0 THEN r.score_snapshot ELSE 0 END), 0) AS positive,
      COALESCE(SUM(CASE WHEN r.score_snapshot < 0 THEN r.score_snapshot ELSE 0 END), 0) AS negative,
      COALESCE(SUM(r.score_snapshot), 0) AS net,
      COUNT(DISTINCT r.student_id) AS student_count
    FROM assessment_records r
    WHERE r.class_id=? AND r.status='active' AND r.behavior_date>=? AND r.behavior_date<?
    GROUP BY r.category_name_snapshot ORDER BY net DESC, category_name
  `).all(classId, from, to).map(row => ({
    categoryName: row.category_name,
    recordCount: Number(row.record_count),
    positive: Number(row.positive),
    negative: Number(row.negative),
    net: Number(row.net),
    studentCount: Number(row.student_count),
  }));
}

function termRanking(classId, academicYear, term) {
  const students = db.prepare('SELECT id AS student_id, name, school_no FROM students WHERE class_id=? AND deleted_at IS NULL ORDER BY CAST(school_no AS INTEGER), school_no, id').all(classId);
  const rows = db.prepare(`
    SELECT r.student_id, COUNT(*) AS record_count,
      COALESCE(SUM(CASE WHEN r.score_snapshot > 0 THEN r.score_snapshot ELSE 0 END), 0) AS positive,
      COALESCE(SUM(CASE WHEN r.score_snapshot < 0 THEN r.score_snapshot ELSE 0 END), 0) AS negative,
      COALESCE(SUM(r.score_snapshot), 0) AS net
    FROM assessment_records r
    WHERE r.class_id=? AND r.academic_year_snapshot=? AND r.term_snapshot=? AND r.status='active'
    GROUP BY r.student_id
  `).all(classId, academicYear, term);
  const byStudent = new Map(rows.map(row => [row.student_id, row]));
  return students.map(student => {
    const row = byStudent.get(student.student_id);
    return { studentId: student.student_id, name: student.name, schoolNo: student.school_no, positive: Number(row?.positive || 0), negative: Number(row?.negative || 0), net: Number(row?.net || 0), recordCount: Number(row?.record_count || 0) };
  }).sort((a, b) => b.net - a.net || b.positive - a.positive || a.name.localeCompare(b.name, 'zh-CN'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function termCategories(classId, academicYear, term) {
  return db.prepare(`
    SELECT r.category_name_snapshot AS category_name, COUNT(*) AS record_count,
      COALESCE(SUM(CASE WHEN r.score_snapshot > 0 THEN r.score_snapshot ELSE 0 END), 0) AS positive,
      COALESCE(SUM(CASE WHEN r.score_snapshot < 0 THEN r.score_snapshot ELSE 0 END), 0) AS negative,
      COALESCE(SUM(r.score_snapshot), 0) AS net, COUNT(DISTINCT r.student_id) AS student_count
    FROM assessment_records r
    WHERE r.class_id=? AND r.academic_year_snapshot=? AND r.term_snapshot=? AND r.status='active'
    GROUP BY r.category_name_snapshot ORDER BY net DESC, category_name
  `).all(classId, academicYear, term).map(row => ({ categoryName: row.category_name, recordCount: Number(row.record_count), positive: Number(row.positive), negative: Number(row.negative), net: Number(row.net), studentCount: Number(row.student_count) }));
}

function rangeData(classId, from, to, filters) {
  return {
    ranking: rankingForRange(classId, from, to),
    categories: categorySummary(classId, from, to),
    filters: { classId, ...filters },
  };
}

router.get('/stats/daily', (req, res) => {
  const classId = positiveInt(req.query.class_id);
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!classId || !isDateString(date)) return badRequest(res, '班级或日期无效');
  if (!classOr404(classId, res)) return;
  const records = db.prepare(`
    SELECT r.*, s.name AS student_name, s.school_no, i.allow_daily_repeat
    FROM assessment_records r JOIN students s ON s.id=r.student_id
    LEFT JOIN assessment_items i ON i.id=r.item_id
    WHERE r.class_id=? AND r.behavior_date=? AND r.status='active'
    ORDER BY r.id DESC
  `).all(classId, date).map(publicRecord);
  res.json({ ok: true, data: { ...rangeData(classId, date, date < '9999-12-31' ? `${date.slice(0, 8)}${String(Number(date.slice(8)) + 1).padStart(2, '0')}` : '9999-12-31', { date }), records } });
});

router.get('/stats/monthly', (req, res) => {
  const classId = positiveInt(req.query.class_id);
  const month = req.query.month;
  if (!classId || !/^\d{4}-\d{2}$/.test(month || '')) return badRequest(res, '班级或月份无效');
  if (!classOr404(classId, res)) return;
  const [year, monthNumber] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  res.json({ ok: true, data: rangeData(classId, from, to, { month }) });
});

router.get('/stats/term', (req, res) => {
  const classId = positiveInt(req.query.class_id);
  if (!classId) return badRequest(res, '班级无效');
  const cls = classOr404(classId, res);
  if (!cls) return;
  const academicYear = req.query.academic_year || cls.academic_year;
  const term = req.query.term || cls.term;
  if (!academicYear || !term) return badRequest(res, '学年和学期不能为空');
  const records = db.prepare(`SELECT MIN(behavior_date) AS first_date, MAX(behavior_date) AS last_date FROM assessment_records WHERE class_id=? AND academic_year_snapshot=? AND term_snapshot=? AND status='active'`).get(classId, academicYear, term);
  res.json({ ok: true, data: { ranking: termRanking(classId, academicYear, term), categories: termCategories(classId, academicYear, term), filters: { classId, academicYear, term, firstRecordDate: records?.first_date || null, lastRecordDate: records?.last_date || null } } });
});

router.get('/stats/student/:id', (req, res) => {
  const studentId = positiveInt(req.params.id);
  const classId = positiveInt(req.query.class_id);
  if (!studentId || !classId) return badRequest(res, '学生或班级无效');
  const student = db.prepare('SELECT id, name, school_no FROM students WHERE id=? AND class_id=?').get(studentId, classId);
  if (!student) return res.status(404).json({ ok: false, code: 'STUDENT_NOT_FOUND', error: '学生不属于当前班级' });
  const conditions = ['r.student_id=?', 'r.class_id=?', "r.status='active'"];
  const params = [studentId, classId];
  if (req.query.from) { if (!isDateString(req.query.from)) return badRequest(res, '起始日期无效'); conditions.push('r.behavior_date>=?'); params.push(req.query.from); }
  if (req.query.to) { if (!isDateString(req.query.to)) return badRequest(res, '结束日期无效'); conditions.push('r.behavior_date<=?'); params.push(req.query.to); }
  const records = db.prepare(`SELECT r.*, s.name AS student_name, s.school_no, i.allow_daily_repeat FROM assessment_records r JOIN students s ON s.id=r.student_id LEFT JOIN assessment_items i ON i.id=r.item_id WHERE ${conditions.join(' AND ')} ORDER BY r.behavior_date DESC, r.id DESC`).all(...params).map(publicRecord);
  res.json({ ok: true, data: { student, records, summary: { positive: records.filter(row => row.score_snapshot > 0).reduce((sum, row) => sum + row.score_snapshot, 0), negative: records.filter(row => row.score_snapshot < 0).reduce((sum, row) => sum + row.score_snapshot, 0), net: records.reduce((sum, row) => sum + row.score_snapshot, 0), recordCount: records.length } } });
});

router.post('/records/batch', (req, res) => {
  const body = req.body || {};
  const classId = positiveInt(body.classId ?? body.class_id);
  const itemId = positiveInt(body.itemId ?? body.item_id);
  const behaviorDate = String(body.date ?? body.behaviorDate ?? body.behavior_date ?? '');
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds : body.student_ids;
  if (!classId || !itemId || !isDateString(behaviorDate) || !Array.isArray(studentIds) || !studentIds.length) return badRequest(res, '班级、行为项目、日期和学生不能为空');
  if (!db.prepare('SELECT id FROM classes WHERE id=?').get(classId)) return res.status(404).json({ ok: false, code: 'CLASS_NOT_FOUND', error: '班级不存在' });
  const item = itemRow(itemId);
  if (!item) return res.status(404).json({ ok: false, code: 'ITEM_NOT_FOUND', error: '行为项目不存在' });
  if (!item.is_active) return res.status(409).json({ ok: false, code: 'ITEM_DISABLED', error: '行为项目已停用' });
  const validIds = new Set(db.prepare('SELECT id FROM students WHERE class_id=? AND deleted_at IS NULL').all(classId).map(row => row.id));
  const names = new Map(db.prepare('SELECT id,name FROM students').all().map(row => [row.id, row.name]));
  const classRow = db.prepare('SELECT academic_year, term FROM classes WHERE id=?').get(classId);
  const skipped = [];
  const batchId = crypto.randomUUID();
  const insert = db.prepare(`INSERT INTO assessment_records (batch_id,class_id,student_id,item_id,category_name_snapshot,item_name_snapshot,score_snapshot,behavior_date,academic_year_snapshot,term_snapshot,remark) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const inserted = new Set();
  let count = 0;
  const remark = text(body.remark, { max: 500 }) || '';
  const tx = db.transaction(() => {
    for (const rawStudentId of studentIds) {
      const studentId = positiveInt(rawStudentId);
      if (!studentId || !validIds.has(studentId)) { skipped.push({ studentId: studentId || rawStudentId, name: names.get(studentId) || '', reasonCode: 'STUDENT_INVALID', reason: '学生不属于当前班级或已删除' }); continue; }
      if (inserted.has(studentId)) { skipped.push({ studentId, name: names.get(studentId), reasonCode: 'DUPLICATE_INPUT', reason: '本次操作重复选择学生' }); continue; }
      inserted.add(studentId);
      if (!item.allow_daily_repeat && db.prepare("SELECT id FROM assessment_records WHERE class_id=? AND student_id=? AND item_id=? AND behavior_date=? AND status='active'").get(classId, studentId, itemId, behaviorDate)) {
        skipped.push({ studentId, name: names.get(studentId), reasonCode: 'DAILY_DUPLICATE', reason: '该学生当天已经记录过此行为' }); continue;
      }
      insert.run(batchId, classId, studentId, itemId, item.category_name, item.name, item.score, behaviorDate, classRow.academic_year || '', classRow.term || '', remark);
      count++;
    }
  });
  tx();
  res.json({ ok: true, data: { count, batchId, skipped } });
});

function findRecord(id) {
  return db.prepare(`
    SELECT r.*, s.name AS student_name, s.school_no, i.allow_daily_repeat
    FROM assessment_records r JOIN students s ON s.id=r.student_id
    LEFT JOIN assessment_items i ON i.id=r.item_id WHERE r.id=?
  `).get(id);
}

function revisionInsert(recordId, action, before, after, changedFields, reason) {
  db.prepare(`INSERT INTO assessment_record_revisions (record_id,action,before_json,after_json,changed_fields_json,reason) VALUES (?,?,?,?,?,?)`)
    .run(recordId, action, JSON.stringify(before), JSON.stringify(after), JSON.stringify(changedFields), reason || '');
}

router.put('/records/:id', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的记分记录 ID');
  const current = findRecord(id);
  if (!current) return res.status(404).json({ ok: false, code: 'RECORD_NOT_FOUND', error: '记分记录不存在' });
  const body = req.body || {};
  const nextStudentId = body.studentId === undefined ? current.student_id : positiveInt(body.studentId);
  const nextItemId = body.itemId === undefined ? current.item_id : positiveInt(body.itemId);
  const nextDate = body.behaviorDate === undefined ? current.behavior_date : String(body.behaviorDate);
  const nextRemark = body.remark === undefined ? current.remark : (text(body.remark, { max: 500 }) ?? '');
  if (!nextStudentId || !nextItemId || !isDateString(nextDate)) return badRequest(res, '学生、行为项目或日期无效');
  if (!db.prepare('SELECT id FROM students WHERE id=? AND class_id=? AND deleted_at IS NULL').get(nextStudentId, current.class_id)) return badRequest(res, '学生不属于当前班级或已删除');
  const item = itemRow(nextItemId);
  if (!item) return res.status(404).json({ ok: false, code: 'ITEM_NOT_FOUND', error: '行为项目不存在' });
  const changed = [];
  if (nextStudentId !== current.student_id) changed.push('studentId');
  if (nextItemId !== current.item_id) changed.push('itemId');
  if (nextDate !== current.behavior_date) changed.push('behaviorDate');
  if (nextRemark !== current.remark) changed.push('remark');
  if (!changed.length) return res.json({ ok: true, data: publicRecord(current) });
  if (changed.some(field => ['studentId', 'itemId', 'behaviorDate'].includes(field)) && !text(body.reason, { max: 300 })) return badRequest(res, '修改学生、行为项目或日期时必须填写修正原因', 'REVISION_REASON_REQUIRED');
  if (current.status === 'active' && !item.allow_daily_repeat && db.prepare("SELECT id FROM assessment_records WHERE id<>? AND class_id=? AND student_id=? AND item_id=? AND behavior_date=? AND status='active'").get(id, current.class_id, nextStudentId, nextItemId, nextDate)) return res.status(409).json({ ok: false, code: 'DAILY_DUPLICATE', error: '修改后会与同日已有记录重复' });
  const before = recordSnapshot(current);
  const after = { ...before, studentId: nextStudentId, itemId: nextItemId, categoryNameSnapshot: item.category_name, itemNameSnapshot: item.name, scoreSnapshot: item.score, behaviorDate: nextDate, remark: nextRemark };
  const tx = db.transaction(() => {
    db.prepare(`UPDATE assessment_records SET student_id=?,item_id=?,category_name_snapshot=?,item_name_snapshot=?,score_snapshot=?,behavior_date=?,remark=?,updated_at=datetime('now','localtime') WHERE id=?`)
      .run(nextStudentId, nextItemId, item.category_name, item.name, item.score, nextDate, nextRemark, id);
    revisionInsert(id, 'edit', before, after, changed, body.reason || '');
  });
  tx();
  res.json({ ok: true, data: publicRecord(findRecord(id)) });
});

function setRecordStatus(req, res, expected, nextStatus, action) {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的记分记录 ID');
  const current = findRecord(id);
  if (!current) return res.status(404).json({ ok: false, code: 'RECORD_NOT_FOUND', error: '记分记录不存在' });
  if (current.status !== expected) return res.status(409).json({ ok: false, code: 'RECORD_STATE_CONFLICT', error: '记录状态不允许此操作' });
  const reason = text(req.body?.reason, { max: 300 });
  if (!reason) return badRequest(res, '请填写修正原因', 'REVISION_REASON_REQUIRED');
  const before = recordSnapshot(current);
  const after = { ...before, status: nextStatus };
  const tx = db.transaction(() => {
    db.prepare('UPDATE assessment_records SET status=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(nextStatus, id);
    revisionInsert(id, action, before, after, ['status'], reason);
  });
  tx();
  res.json({ ok: true, data: publicRecord(findRecord(id)) });
}

router.post('/records/:id/void', (req, res) => setRecordStatus(req, res, 'active', 'voided', 'void'));
router.post('/records/:id/restore', (req, res) => setRecordStatus(req, res, 'voided', 'active', 'restore'));

router.get('/records/:id/revisions', (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return badRequest(res, '无效的记分记录 ID');
  if (!db.prepare('SELECT id FROM assessment_records WHERE id=?').get(id)) return res.status(404).json({ ok: false, code: 'RECORD_NOT_FOUND', error: '记分记录不存在' });
  const rows = db.prepare('SELECT * FROM assessment_record_revisions WHERE record_id=? ORDER BY id').all(id);
  res.json({ ok: true, data: rows.map(row => ({
    id: row.id, recordId: row.record_id, action: row.action,
    before: JSON.parse(row.before_json), after: JSON.parse(row.after_json),
    changedFields: JSON.parse(row.changed_fields_json), reason: row.reason, createdAt: row.created_at,
  })) });
});

router.post('/batches/:batchId/void', (req, res) => {
  const batchId = text(req.params.batchId, { max: 100 });
  const reason = text(req.body?.reason, { max: 300 });
  if (!batchId || !reason) return badRequest(res, '批次或修正原因无效');
  const rows = db.prepare("SELECT * FROM assessment_records WHERE batch_id=? AND status='active'").all(batchId);
  if (!rows.length) return res.status(404).json({ ok: false, code: 'BATCH_NOT_FOUND', error: '没有可撤销的批次记录' });
  const tx = db.transaction(() => rows.forEach(row => {
    const before = recordSnapshot(row);
    db.prepare("UPDATE assessment_records SET status='voided',updated_at=datetime('now','localtime') WHERE id=?").run(row.id);
    revisionInsert(row.id, 'void', before, { ...before, status: 'voided' }, ['status'], reason);
  }));
  tx();
  res.json({ ok: true, data: { count: rows.length, batchId } });
});

export default router;
