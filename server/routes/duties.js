import { Router } from 'express';
import db from '../db.js';
import { badRequest } from '../validation.js';

const router = Router();
const PRESET_ROLES = ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'];

// 列表（JOIN 学生姓名）
router.get('/', (req, res) => {
  const { class_id, role } = req.query;
  const conds = [];
  const params = {};
  if (class_id) { conds.push('d.class_id = @class_id'); params.class_id = Number(class_id); }
  if (role) { conds.push('d.role = @role'); params.role = role; }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT d.*, s.name AS student_name, s.gender, s.status, s.deleted_at AS student_deleted
    FROM duties d JOIN students s ON s.id = d.student_id
    ${where} ORDER BY d.group_no, d.id
  `).all(params);
  res.json({ ok: true, data: rows });
});

/** 值日生全局查重：返回该生已所在组号（无则 null） */
function dutyGroupOf(classId, studentId) {
  const r = db.prepare(`
    SELECT group_no FROM duties WHERE class_id = ? AND student_id = ? AND role = '值日生'
  `).get(Number(classId), Number(studentId));
  return r ? r.group_no : null;
}

// 添加一条（班干部角色唯一；值日生一人一组全局查重）
router.post('/', (req, res) => {
  const { class_id, student_id, role, group_no, week_days, remark } = req.body || {};
  if (!class_id || !student_id || !role) return badRequest(res, '班级/学生/角色不能为空');
  const stu = db.prepare('SELECT id, name FROM students WHERE id = ? AND deleted_at IS NULL').get(Number(student_id));
  if (!stu) return res.status(404).json({ ok: false, code: 'STUDENT_NOT_FOUND', error: '学生不存在' });
  // 归属校验：学生必须属于该班级，避免跨班分配职务
  const owner = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').get(Number(student_id), Number(class_id));
  if (!owner) return badRequest(res, '学生不属于当前班级', 'STUDENT_CLASS_MISMATCH');
  if (role !== '值日生') {
    const dup = db.prepare('SELECT student_id FROM duties WHERE class_id = ? AND role = ?').get(Number(class_id), role);
    if (dup) {
      const holder = db.prepare('SELECT name FROM students WHERE id = ?').get(dup.student_id);
      return res.status(409).json({ ok: false, code: 'DUTY_CONFLICT', error: `「${role}」已由 ${holder?.name || '其他学生'} 担任，请先调整` });
    }
  } else {
    // 值日生：一个学生只能在一个组
    const g = dutyGroupOf(class_id, student_id);
    if (g != null) {
      return res.status(409).json({ ok: false, code: 'DUTY_CONFLICT', error: `${stu.name} 已在第 ${g} 组，同一学生不能重复值日` });
    }
  }
  const info = db.prepare(`
    INSERT INTO duties (class_id, student_id, role, group_no, week_days, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(class_id), Number(student_id), role, group_no != null ? Number(group_no) : null, week_days || '', remark || '');
  res.json({ ok: true, data: { id: info.lastInsertRowid } });
});

// 批量添加（值日生全局查重：已在任何组的学生跳过并报告）
router.post('/batch', (req, res) => {
  const { class_id, role, group_no, student_ids, week_days, remark } = req.body || {};
  if (!class_id || !Array.isArray(student_ids) || !student_ids.length || !role) {
    return badRequest(res, '参数不完整');
  }
  const isDuty = role === '值日生';
  // 本班在读学生白名单（归属校验，防跨班/已删除学生写入）
  const validIds = new Set(db.prepare(`
    SELECT id FROM students WHERE class_id = ? AND deleted_at IS NULL
  `).all(Number(class_id)).map(r => r.id));
  // 已入任何值日组的学生
  const inAnyGroup = new Set(db.prepare(`
    SELECT student_id FROM duties WHERE class_id = ? AND role = '值日生'
  `).all(Number(class_id)).map(r => r.student_id));
  const nameOf = new Map(db.prepare('SELECT id, name FROM students').all().map(s => [s.id, s.name]));

  const ins = db.prepare(`
    INSERT INTO duties (class_id, student_id, role, group_no, week_days, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const added = [];
  const skipped = [];
  const seen = new Set();
  const tx = db.transaction((ids) => {
    for (const sid of ids) {
      const id = Number(sid);
      if (seen.has(id)) continue;
      seen.add(id);
      if (!validIds.has(id)) {
        skipped.push({ name: nameOf.get(id) || '', reason: '不属于当前班级' });
        continue;
      }
      if (isDuty && inAnyGroup.has(id)) {
        skipped.push({ name: nameOf.get(id) || '', reason: '已在其他值日组' });
        continue;
      }
      ins.run(Number(class_id), id, role, group_no != null ? Number(group_no) : null, week_days || '', remark || '');
      if (isDuty) inAnyGroup.add(id);
      added.push(id);
    }
  });
  tx(student_ids);
  res.json({ ok: true, data: { count: added.length, skipped } });
});

// 一键自动分组：把全班在读学生按名单顺序均分为 N 个值日组（每人一组，组间不重复）
router.post('/auto-group', (req, res) => {
  const { class_id, groupCount } = req.body || {};
  if (!class_id) return badRequest(res, '缺少班级');
  const n = Math.max(1, Math.min(15, parseInt(groupCount) || 4));
  const students = db.prepare(`
    SELECT id, name FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读'
    ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(Number(class_id));
  if (!students.length) return res.status(409).json({ ok: false, code: 'NO_ACTIVE_STUDENTS', error: '班级没有在读学生' });
  if (students.length < n) return res.status(409).json({ ok: false, code: 'DUTY_GROUP_CONFLICT', error: `只有 ${students.length} 人，不能分成 ${n} 组` });

  const del = db.prepare(`DELETE FROM duties WHERE class_id = ? AND role = '值日生'`);
  const ins = db.prepare(`
    INSERT INTO duties (class_id, student_id, role, group_no) VALUES (?, ?, '值日生', ?)
  `);
  const tx = db.transaction(() => {
    del.run(Number(class_id));
    students.forEach((s, i) => {
      ins.run(Number(class_id), s.id, (i % n) + 1);
    });
  });
  tx();
  const perGroup = Math.ceil(students.length / n);
  res.json({
    ok: true,
    data: { count: students.length, groupCount: n, perGroup,
      groups: Array.from({ length: n }, (_, gi) => ({
        no: gi + 1,
        members: students.filter((_, i) => i % n === gi).map(s => s.name),
      })) },
  });
});

// 按组设置值日星期（C 组：补上 week_days 死字段能力）
// 周次×星期排班：每组可指定固定值日星期（如周一/周三），week_days 存 "1,3"
router.put('/group-days', (req, res) => {
  const { class_id, group_no, week_days } = req.body || {};
  if (!class_id || group_no == null) return badRequest(res, '缺少班级或组号');
  if (week_days != null && !/^[1-7](,[1-7])*$/.test(String(week_days))) {
    return badRequest(res, '星期格式应为 1-7 逗号分隔（1=周一 … 7=周日）');
  }
  const info = db.prepare(`
    UPDATE duties SET week_days = ? WHERE class_id = ? AND role = '值日生' AND group_no = ?
  `).run(week_days || '', Number(class_id), Number(group_no));
  if (info.changes === 0) {
    return res.status(404).json({ ok: false, code: 'DUTY_GROUP_NOT_FOUND', error: `第 ${group_no} 组不存在或没有成员` });
  }
  res.json({ ok: true, data: { count: info.changes } });
});

// 一键预设班委：补齐常见职务空缺（每人最多一个职务）
router.post('/preset-leaders', (req, res) => {  const { class_id } = req.body || {};
  if (!class_id) return badRequest(res, '缺少班级');
  const existingRoles = new Set(db.prepare(`
    SELECT role FROM duties WHERE class_id = ? AND role <> '值日生'
  `).all(Number(class_id)).map(r => r.role));
  const heldStudents = new Set(db.prepare(`
    SELECT student_id FROM duties WHERE class_id = ? AND role <> '值日生'
  `).all(Number(class_id)).map(r => r.student_id));
  const candidates = db.prepare(`
    SELECT id, name FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读'
    ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(Number(class_id));

  const ins = db.prepare(`
    INSERT INTO duties (class_id, student_id, role) VALUES (?, ?, ?)
  `);
  const added = [];
  let skipped = 0;
  const tx = db.transaction(() => {
    let ci = 0;
    for (const role of PRESET_ROLES) {
      if (existingRoles.has(role)) { skipped++; continue; }
      // 找下一个未任职的学生
      let stu = null;
      while (ci < candidates.length) {
        const c = candidates[ci++];
        if (!heldStudents.has(c.id)) { stu = c; break; }
      }
      if (!stu) break; // 学生不够了
      ins.run(Number(class_id), stu.id, role);
      heldStudents.add(stu.id);
      existingRoles.add(role);
      added.push({ role, name: stu.name });
    }
  });
  tx();
  res.json({ ok: true, data: { added, skipped, totalRoles: PRESET_ROLES.length } });
});

// 一键预设课代表：为各科补齐课代表（同一人可兼任班委/多科，但每科仅一人）
const SUBJECT_LEADER_ROLES = ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];

router.post('/preset-subject-leaders', (req, res) => {
  const { class_id } = req.body || {};
  if (!class_id) return badRequest(res, '缺少班级');
  const existingRoles = new Set(db.prepare(`
    SELECT role FROM duties WHERE class_id = ? AND role LIKE '%课代表'
  `).all(Number(class_id)).map(r => r.role));
  const candidates = db.prepare(`
    SELECT id, name FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读'
    ORDER BY CAST(school_no AS INTEGER), school_no, id
  `).all(Number(class_id));
  if (!candidates.length) return res.status(409).json({ ok: false, code: 'NO_ACTIVE_STUDENTS', error: '班级没有在读学生' });

  const ins = db.prepare(`
    INSERT INTO duties (class_id, student_id, role) VALUES (?, ?, ?)
  `);
  const added = [];
  let skipped = 0;
  const tx = db.transaction(() => {
    let ci = 0;
    for (const role of SUBJECT_LEADER_ROLES) {
      if (existingRoles.has(role)) { skipped++; continue; }
      // 每个科目从名单顺序取一位（可身兼数科，所以不排除已任职者）
      const stu = candidates[ci++ % candidates.length];
      ins.run(Number(class_id), stu.id, role);
      existingRoles.add(role);
      added.push({ role, name: stu.name });
    }
  });
  tx();
  res.json({ ok: true, data: { added, skipped, totalRoles: SUBJECT_LEADER_ROLES.length } });
});

// 更新（同样做班干部职务唯一 + 值日生一人一组校验，排除自身）
router.put('/:id', (req, res) => {  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', error: '无效的值日 ID' });
  const row = db.prepare('SELECT * FROM duties WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ ok: false, code: 'DUTY_NOT_FOUND', error: '值日记录不存在' });
  const b = req.body || {};
  const role = b.role || row.role;
  const studentId = b.student_id !== undefined ? Number(b.student_id) : row.student_id;
  // 归属校验：学生必须属于记录所属班级
  const owner = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').get(studentId, row.class_id);
  if (!owner) return badRequest(res, '学生不属于该班级', 'STUDENT_CLASS_MISMATCH');
  if (role !== '值日生') {
    const dup = db.prepare('SELECT student_id FROM duties WHERE class_id = ? AND role = ? AND id <> ?')
      .get(row.class_id, role, id);
    if (dup) {
      const holder = db.prepare('SELECT name FROM students WHERE id = ?').get(dup.student_id);
      return res.status(409).json({ ok: false, code: 'DUTY_CONFLICT', error: `「${role}」已由 ${holder?.name || '其他学生'} 担任` });
    }
  } else {
    const g = db.prepare(`
      SELECT group_no FROM duties WHERE class_id = ? AND student_id = ? AND role = '值日生' AND id <> ?
    `).get(row.class_id, studentId, id);
    if (g != null) {
      const nm = db.prepare('SELECT name FROM students WHERE id = ?').get(studentId);
      return res.status(409).json({ ok: false, code: 'DUTY_CONFLICT', error: `${nm?.name || '该学生'} 已在第 ${g.group_no} 组，同一学生不能重复值日` });
    }
  }
  db.prepare(`UPDATE duties SET role=?, group_no=?, week_days=?, remark=?, student_id=? WHERE id=?`).run(
    role,
    b.group_no !== undefined ? (b.group_no != null ? Number(b.group_no) : null) : row.group_no,
    b.week_days !== undefined ? b.week_days : row.week_days,
    b.remark !== undefined ? b.remark : row.remark,
    studentId,
    id
  );
  res.json({ ok: true });
});

// 删除
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的值日 ID' });
  const row = db.prepare('SELECT id FROM duties WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ ok: false, code: 'DUTY_NOT_FOUND', error: '值日记录不存在' });
  db.prepare('DELETE FROM duties WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
