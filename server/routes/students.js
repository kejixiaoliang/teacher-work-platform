import { Router } from 'express';
import db from '../db.js';

const router = Router();

const FIELDS = ['school_no','name','gender','birth_date','phone','parent_phone','is_boarding',
  'interest_duty','health_note','height_cm','vision_left','vision_right','is_myopia',
  'grade_level','seat_note','status','remark'];

function pickStudent(row) {
  if (!row) return null;
  const o = { ...row };
  o.is_boarding = !!o.is_boarding;
  o.is_myopia = !!o.is_myopia;
  return o;
}

// 列表（默认当前班+在读+未删除；trashed=1 查回收站）
router.get('/', (req, res) => {
  const { class_id, keyword, gender, status, myopia, boarding, trashed } = req.query;
  const conds = [];
  const params = {};
  if (trashed === '1') {
    conds.push('s.deleted_at IS NOT NULL');
  } else {
    conds.push('s.deleted_at IS NULL');
  }
  if (class_id) { conds.push('s.class_id = @class_id'); params.class_id = Number(class_id); }
  if (gender) { conds.push('s.gender = @gender'); params.gender = gender; }
  if (status) { conds.push('s.status = @status'); params.status = status; }
  if (myopia === '1') conds.push('s.is_myopia = 1');
  if (myopia === '0') conds.push('s.is_myopia = 0');
  if (boarding === '1') conds.push('s.is_boarding = 1');
  if (boarding === '0') conds.push('s.is_boarding = 0');
  if (keyword) {
    conds.push('(s.name LIKE @kw OR s.school_no LIKE @kw)');
    params.kw = `%${keyword}%`;
  }
  const rows = db.prepare(`
    SELECT s.*, c.name AS class_name
    FROM students s LEFT JOIN classes c ON c.id = s.class_id
    WHERE ${conds.join(' AND ')}
    ORDER BY s.deleted_at IS NOT NULL, s.status='在读' DESC, CAST(s.school_no AS INTEGER), s.school_no, s.id
  `).all(params);
  res.json({ ok: true, data: rows.map(pickStudent) });
});

// 新增
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.json({ ok: false, error: '姓名不能为空' });
  if (b.school_no) {
    const dup = db.prepare('SELECT id FROM students WHERE school_no = ? AND deleted_at IS NULL').get(String(b.school_no).trim());
    if (dup) return res.json({ ok: false, error: `学号 ${b.school_no} 已被使用` });
  }
  const keys = [...FIELDS];
  const placeholders = keys.map(k => '@' + k).join(', ');
  const info = db.prepare(`INSERT INTO students (${keys.join(', ')}, class_id) VALUES (${placeholders}, @class_id)`).run({
    ...FIELDS.reduce((o, k) => ({ ...o, [k]: b[k] ?? null }), {}),
    class_id: b.class_id ? Number(b.class_id) : null,
    school_no: b.school_no ? String(b.school_no).trim() : null,
    name: String(b.name).trim(),
    gender: b.gender || '男',
    status: b.status || '在读',
    is_boarding: b.is_boarding ? 1 : 0,
    is_myopia: b.is_myopia ? 1 : 0,
  });
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 更新
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!row) return res.json({ ok: false, error: '学生不存在' });
  const b = req.body || {};
  if (b.name === undefined || (b.name && !String(b.name).trim())) return res.json({ ok: false, error: '姓名不能为空' });
  if (b.school_no && String(b.school_no).trim() !== row.school_no) {
    const dup = db.prepare('SELECT id FROM students WHERE school_no = ? AND deleted_at IS NULL AND id <> ?')
      .get(String(b.school_no).trim(), id);
    if (dup) return res.json({ ok: false, error: `学号 ${b.school_no} 已被使用` });
  }
  const sets = FIELDS.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE students SET ${sets}, updated_at=datetime('now','localtime') WHERE id=@id`).run({
    ...FIELDS.reduce((o, k) => ({ ...o, [k]: b[k] === undefined ? row[k] : (b[k] == null ? null : b[k]) }), {}),
    name: b.name === undefined ? row.name : (b.name == null ? row.name : String(b.name).trim()),
    school_no: b.school_no === undefined ? row.school_no : (b.school_no == null ? null : String(b.school_no).trim()),
    gender: b.gender === undefined || b.gender == null ? row.gender : b.gender,
    status: b.status === undefined || b.status == null ? row.status : b.status,
    is_boarding: b.is_boarding !== undefined ? (b.is_boarding ? 1 : 0) : row.is_boarding,
    is_myopia: b.is_myopia !== undefined ? (b.is_myopia ? 1 : 0) : row.is_myopia,
    id,
  });
  res.json({ ok: true });
});

// 软删除（进回收站，同时清空其座位，避免"幽灵座位"）
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的学生 ID' });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE students SET deleted_at=datetime('now','localtime') WHERE id=?`).run(id);
    db.prepare(`DELETE FROM seats WHERE student_id=?`).run(id);
  });
  tx();
  res.json({ ok: true });
});

// 恢复
router.post('/restore', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.json({ ok: false, error: '未选择学生' });
  const skipped = [];
  let restored = 0;
  const tx = db.transaction(() => {
    for (const rawId of ids) {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id < 1) continue;
      // 恢复前查重：若存在同 school_no 的在册学生（唯一索引会冲突），跳过该生（P1-4）
      const row = db.prepare('SELECT id, school_no, name FROM students WHERE id = ? AND deleted_at IS NOT NULL').get(id);
      if (!row) continue;
      if (row.school_no) {
        const dup = db.prepare('SELECT id FROM students WHERE school_no = ? AND deleted_at IS NULL').get(row.school_no);
        if (dup) { skipped.push({ id: row.id, name: row.name, reason: `学号 ${row.school_no} 已被在册学生占用` }); continue; }
      }
      db.prepare(`UPDATE students SET deleted_at=NULL WHERE id=?`).run(id);
      restored++;
    }
  });
  tx();
  res.json({ ok: true, data: { count: restored, skipped } });
});

// 彻底删除
router.post('/purge', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.json({ ok: false, error: '未选择学生' });
  const tx = db.transaction(() => {
    for (const id of ids) {
      db.prepare(`DELETE FROM students WHERE id=?`).run(Number(id));
    }
  });
  tx();
  res.json({ ok: true, data: { count: ids.length } });
});

// 批量导入（Excel 解析后前端传 JSON；返回成功/失败明细）
router.post('/import', (req, res) => {
  const { class_id, students } = req.body || {};
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  if (!Array.isArray(students) || students.length === 0) return res.json({ ok: false, error: '没有可导入的数据' });
  const ins = db.prepare(`
    INSERT INTO students (class_id, school_no, name, gender, birth_date, phone, parent_phone,
      is_boarding, height_cm, vision_left, vision_right, is_myopia, grade_level, seat_note, status, remark)
    VALUES (@class_id, @school_no, @name, @gender, @birth_date, @phone, @parent_phone,
      @is_boarding, @height_cm, @vision_left, @vision_right, @is_myopia, @grade_level, @seat_note, '在读', @remark)
  `);
  const byNo = db.prepare('SELECT id FROM students WHERE school_no = @no AND deleted_at IS NULL');
  const okRows = [];
  const failRows = [];
  const tx = db.transaction((list) => {
    for (const s of list) {
      if (!s.name || !String(s.name).trim()) { failRows.push({ row: s._row, reason: '姓名为空' }); continue; }
      if (s.school_no) {
        const dup = byNo.get({ no: String(s.school_no).trim() });
        if (dup) { failRows.push({ row: s._row, name: s.name, reason: `学号 ${s.school_no} 重复` }); continue; }
      }
      try {
        const info = ins.run({
          class_id: Number(class_id),
          school_no: s.school_no ? String(s.school_no).trim() : null,
          name: String(s.name).trim(),
          gender: s.gender || '男',
          birth_date: s.birth_date || null,
          phone: s.phone || null,
          parent_phone: s.parent_phone || null,
          is_boarding: s.is_boarding ? 1 : 0,
          height_cm: s.height_cm != null && s.height_cm !== '' ? Number(s.height_cm) : null,
          vision_left: s.vision_left != null && s.vision_left !== '' ? Number(s.vision_left) : null,
          vision_right: s.vision_right != null && s.vision_right !== '' ? Number(s.vision_right) : null,
          is_myopia: s.is_myopia ? 1 : 0,
          grade_level: s.grade_level || null,
          seat_note: s.seat_note || null,
          remark: s.remark || null,
        });
        okRows.push({ id: info.lastInsertRowid, name: String(s.name).trim() });
      } catch (e) {
        failRows.push({ row: s._row, name: s.name, reason: e.message });
      }
    }
  });
  tx(students);
  res.json({ ok: true, data: { success: okRows, fail: failRows } });
});

// 学期存档：全班当前指标快照入历史
router.post('/archive', (req, res) => {
  const { class_id, term } = req.body || {};
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  const t = term || `${new Date().getFullYear()}学年度`;
  const list = db.prepare(`
    SELECT id, height_cm, vision_left, vision_right, grade_level, is_myopia
    FROM students WHERE class_id = ? AND deleted_at IS NULL AND status = '在读'
  `).all(Number(class_id));
  const ins = db.prepare(`
    INSERT INTO student_metrics_history (student_id, term, height_cm, vision_left, vision_right, grade_level, is_myopia)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let count = 0;
  const tx = db.transaction(() => {
    for (const s of list) {
      if (s.height_cm == null && s.vision_left == null && s.vision_right == null && !s.grade_level) continue;
      ins.run(s.id, t, s.height_cm, s.vision_left, s.vision_right, s.grade_level, s.is_myopia ? 1 : 0);
      count++;
    }
  });
  tx();
  res.json({ ok: true, data: { count, term: t } });
});

// 某学生历史指标
router.get('/:id/metrics', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM student_metrics_history WHERE student_id = ? ORDER BY recorded_at DESC
  `).all(Number(req.params.id));
  res.json({ ok: true, data: rows });
});

// 班级级历史指标聚合（B4：Analytics 学期对比用）。
// 按学期统计平均身高/平均视力/近视率，数据来自「学期存档」快照。
router.get('/class-metrics', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  const rows = db.prepare(`
    SELECT m.term,
      ROUND(AVG(m.height_cm), 1) AS avg_height,
      ROUND(AVG(MIN(m.vision_left, m.vision_right)), 2) AS avg_vision,
      ROUND(100.0 * SUM(m.is_myopia) / COUNT(*), 1) AS myopia_rate,
      COUNT(*) AS count
    FROM student_metrics_history m
    JOIN students s ON s.id = m.student_id
    WHERE s.class_id = ? AND s.deleted_at IS NULL AND m.height_cm IS NOT NULL
    GROUP BY m.term ORDER BY m.term
  `).all(Number(class_id));
  res.json({ ok: true, data: rows });
});

export default router;
