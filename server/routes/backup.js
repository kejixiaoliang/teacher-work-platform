import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { getDataDir } from '../config/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = getDataDir();

const router = Router();

// 业务表导出/导入顺序（遵循外键依赖：父表在前，子表在后）
const TABLES = [
  'classes',
  'students',
  'student_metrics_history',
  'assessment_categories',
  'assessment_items',
  'seats',
  'seat_layouts',
  'documents',
  'duties',
  'exams',
  'exam_scores',
  'attendance',
  'student_records',
  'contacts',
  'leaves',
  'assessment_records',
  'assessment_record_revisions',
];
const MAX_TOTAL_ROWS = 200_000;
const MAX_ROWS_PER_TABLE = 100_000;

// 每张表需要带 id 导出，保证恢复时外键关系完整
function dumpTable(name) {
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  return { table: name, rows };
}

function invalidBackup(res, error) {
  return res.status(400).json({ ok: false, code: 'INVALID_BACKUP', error });
}

function validatePayload(payload) {
  if (!payload || payload.app !== 'teacher-work' || payload.version !== 1 || !Array.isArray(payload.tables)) {
    return '备份版本或文件格式不正确';
  }
  if (payload.tables.length !== TABLES.length) return '备份数据表数量不正确';
  const seen = new Set();
  let totalRows = 0;
  for (const table of payload.tables) {
    if (!table || typeof table !== 'object' || !TABLES.includes(table.table) || seen.has(table.table)) {
      return '备份包含未知或重复的数据表';
    }
    seen.add(table.table);
    if (!Array.isArray(table.rows) || table.rows.length > MAX_ROWS_PER_TABLE) {
      return `数据表 ${table.table} 的记录数量超出限制`;
    }
    totalRows += table.rows.length;
    if (totalRows > MAX_TOTAL_ROWS) return '备份记录总数超出限制';
    const columns = new Set(db.prepare(`PRAGMA table_info(${table.table})`).all().map(column => column.name));
    for (const row of table.rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || !Object.prototype.hasOwnProperty.call(row, 'id')) {
        return `数据表 ${table.table} 存在无效记录`;
      }
      for (const [key, value] of Object.entries(row)) {
        if (!columns.has(key) || (value !== null && typeof value === 'object')) {
          return `数据表 ${table.table} 存在无效字段`;
        }
      }
    }
  }
  const missing = TABLES.filter(table => !seen.has(table));
  return missing.length ? `备份缺少数据表：${missing.join('、')}` : null;
}

// 全量导出（含全部 13 张业务表，用于应用内备份）
router.get('/export', (req, res) => {
  try {
    const payload = {
      app: 'teacher-work',
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: TABLES.map(dumpTable),
    };
    res.json({ ok: true, data: payload });
  } catch (e) {
    console.error('[backup/export]', e.message);
    res.status(500).json({ ok: false, error: '导出失败：' + e.message });
  }
});

// 全量导入（恢复）：事务内先清空全部业务表再按依赖顺序插入。
// 清空子表 → 父表，插入父表 → 子表；外键保持 ON，靠顺序本身满足依赖。
router.post('/import', async (req, res) => {
  const payload = req.body || {};
  const validationError = validatePayload(payload);
  if (validationError) return invalidBackup(res, validationError);
  const tableMap = new Map(payload.tables.map(t => [t.table, t]));

  try {
    // 恢复前先把当前库完整快照（含 WAL 内容）到 data/backups/，防止恢复失败或误操作无法回头
    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapFile = path.join(backupDir, `pre-restore-${stamp}-${crypto.randomBytes(4).toString('hex')}.db`);
    try {
      await db.backup(snapFile); // better-sqlite3 在线备份：自动包含 WAL 中的未 checkpoint 数据
    } catch (e) {
      try { fs.rmSync(snapFile, { force: true }); } catch { /* 清理失败不覆盖原始错误 */ }
      console.error('[backup/import] 快照失败，已阻止恢复：', e.message);
      return res.status(503).json({ ok: false, code: 'BACKUP_SNAPSHOT_FAILED', error: '恢复前快照失败，未修改当前数据' });
    }
    console.log('[backup/import] 恢复前快照 →', snapFile);

    const tx = db.transaction(() => {
      // 清空：先子表后父表（按 TABLES 逆序）
      for (let i = TABLES.length - 1; i >= 0; i--) {
        db.exec(`DELETE FROM ${TABLES[i]}`);
      }
      // 重建 sqlite_sequence，让自增 id 从导入数据继续
      db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map(t => `'${t}'`).join(',')})`);

      // 插入：父表 → 子表
      for (const t of TABLES) {
        const { rows } = tableMap.get(t);
        if (!rows.length) continue;
        const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
        const keys = cols.filter(k => Object.prototype.hasOwnProperty.call(rows[0], k));
        if (!keys.length) continue;
        const placeholders = keys.map(k => `@${k}`).join(', ');
        const ins = db.prepare(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders})`);
        for (const r of rows) {
          const obj = {};
          for (const k of keys) obj[k] = r[k] === undefined ? null : r[k];
          ins.run(obj);
        }
      }
      const violations = db.pragma('foreign_key_check');
      if (violations.length) throw new Error('恢复后的数据未通过外键完整性检查');
    });
    tx();

    res.json({ ok: true, data: { tables: TABLES.length, classes: tableMap.get('classes').rows.length } });
  } catch (e) {
    console.error('[backup/import]', e.message);
    res.status(500).json({ ok: false, error: '恢复失败：' + e.message });
  }
});

// 删除班级前自动备份该班全部数据（兜底，防止误删后无法找回）
router.get('/export-class/:id', (req, res) => {
  const classId = Number(req.params.id);
  if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ ok: false, error: '无效的班级 ID' });
  try {
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!cls) return res.status(404).json({ ok: false, error: '班级不存在' });
    const studentIds = db.prepare('SELECT id FROM students WHERE class_id = ?').all(classId).map(r => r.id);
    const examIds = db.prepare('SELECT id FROM exams WHERE class_id = ?').all(classId).map(r => r.id);
    const whereS = studentIds.length ? `student_id IN (${studentIds.join(',')})` : '1=0';
    const whereE = examIds.length ? `exam_id IN (${examIds.join(',')})` : '1=0';
    const payload = {
      app: 'teacher-work', version: 1, exportedAt: new Date().toISOString(), classId,
      tables: [
        { table: 'classes', rows: [cls] },
        { table: 'students', rows: db.prepare(`SELECT * FROM students WHERE class_id = ?`).all(classId) },
        { table: 'seats', rows: db.prepare(`SELECT * FROM seats WHERE class_id = ?`).all(classId) },
        { table: 'seat_layouts', rows: db.prepare(`SELECT * FROM seat_layouts WHERE class_id = ?`).all(classId) },
        { table: 'documents', rows: db.prepare(`SELECT * FROM documents WHERE class_id = ?`).all(classId) },
        { table: 'duties', rows: db.prepare(`SELECT * FROM duties WHERE class_id = ?`).all(classId) },
        { table: 'exams', rows: db.prepare(`SELECT * FROM exams WHERE class_id = ?`).all(classId) },
        { table: 'exam_scores', rows: db.prepare(`SELECT * FROM exam_scores WHERE ${whereE}`).all() },
        { table: 'attendance', rows: db.prepare(`SELECT * FROM attendance WHERE class_id = ?`).all(classId) },
        { table: 'student_records', rows: db.prepare(`SELECT * FROM student_records WHERE ${whereS}`).all() },
        { table: 'contacts', rows: db.prepare(`SELECT * FROM contacts WHERE ${whereS}`).all() },
        { table: 'leaves', rows: db.prepare(`SELECT * FROM leaves WHERE class_id = ?`).all(classId) },
        { table: 'student_metrics_history', rows: db.prepare(`SELECT * FROM student_metrics_history WHERE ${whereS}`).all() },
        { table: 'assessment_categories', rows: db.prepare('SELECT * FROM assessment_categories').all() },
        { table: 'assessment_items', rows: db.prepare('SELECT * FROM assessment_items').all() },
        { table: 'assessment_records', rows: db.prepare(`SELECT * FROM assessment_records WHERE class_id = ?`).all(classId) },
        { table: 'assessment_record_revisions', rows: db.prepare(`
          SELECT r.* FROM assessment_record_revisions r
          WHERE r.record_id IN (SELECT id FROM assessment_records WHERE class_id = ?)
        `).all(classId) },
      ],
    };
    res.json({ ok: true, data: payload });
  } catch (e) {
    console.error('[backup/export-class]', e.message);
    res.status(500).json({ ok: false, error: '备份失败：' + e.message });
  }
});

export default router;
