import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { getDataPaths } from '../config/paths.js';
import { badRequest, positiveInt, text } from '../validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filesDir = getDataPaths().filesDir;
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

const router = Router();
const MAX_STORAGE_BYTES = Number(process.env.TEACHER_WORK_FILES_LIMIT_MB || 2048) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  // 文件扩展名白名单（常见办公/媒体格式）
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.ppt', '.pptx', '.txt', '.md', '.csv', '.zip', '.rar', '.7z', '.mp3', '.mp4', '.wav', '.mov'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`不支持的文件类型 ${ext || '(无扩展名)'}`));
  },
});

function unlinkUploaded(file) {
  if (!file?.path) return;
  try { fs.unlinkSync(file.path); } catch { /* 文件可能已被清理 */ }
}

function hasSignature(ext, filePath) {
  const head = fs.readFileSync(filePath).subarray(0, 16);
  const ascii = head.toString('ascii');
  if (['.jpg', '.jpeg'].includes(ext)) return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (ext === '.png') return head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.gif') return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a');
  if (ext === '.pdf') return ascii.startsWith('%PDF-');
  if (['.zip', '.docx', '.xlsx', '.pptx'].includes(ext)) return head.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]));
  if (ext === '.7z') return head.subarray(0, 6).equals(Buffer.from([55, 122, 188, 175, 39, 28]));
  if (ext === '.rar') return ascii.startsWith('Rar!');
  if (ext === '.wav') return ascii.startsWith('RIFF') && head.subarray(8, 12).toString('ascii') === 'WAVE';
  if (ext === '.mp4' || ext === '.mov') return head.subarray(4, 8).toString('ascii') === 'ftyp';
  if (ext === '.mp3') return ascii.startsWith('ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
  return true;
}

function currentStorageBytes() {
  return fs.readdirSync(filesDir, { withFileTypes: true }).reduce((total, entry) => {
    if (!entry.isFile()) return total;
    try { return total + fs.statSync(path.join(filesDir, entry.name)).size; } catch { return total; }
  }, 0);
}

function categoryOf(ext) {
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) return '图片';
  if (['.pdf'].includes(ext)) return 'PDF';
  if (['.doc', '.docx'].includes(ext)) return '文档';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return '表格';
  if (['.ppt', '.pptx'].includes(ext)) return '演示';
  if (['.txt', '.md'].includes(ext)) return '文本';
  return '其他';
}

/** multer/busboy 把 UTF-8 文件名按 latin1 解码，这里还原 */
function decodeName(n) {
  if (/[\u0080-\u00FF]/.test(n || '')) {
    try {
      const d = Buffer.from(n, 'latin1').toString('utf8');
      if (/[\u4e00-\u9fff]/.test(d) && !d.includes('\uFFFD')) return d;
    } catch { /* 还原失败保留原名 */ }
  }
  return n;
}

function pickDoc(row) {
  if (!row) return null;
  return { ...row, size: Number(row.size) };
}

// 上传（multipart：file + class_id + tag）
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false, error: '未收到文件' });
  const { class_id, tag, name } = req.body || {};
  const original = decodeName(name || req.file.originalname);
  const ext = path.extname(original).toLowerCase();
  const classId = positiveInt(class_id);
  const safeName = text(original, { max: 255 });
  try {
    if (!classId || !safeName) {
      unlinkUploaded(req.file);
      return badRequest(res, '班级或文件名无效');
    }
    if (!hasSignature(ext, req.file.path)) {
      unlinkUploaded(req.file);
      return badRequest(res, '文件内容与扩展名不匹配', 'INVALID_FILE_CONTENT');
    }
    if (currentStorageBytes() + req.file.size > MAX_STORAGE_BYTES) {
      unlinkUploaded(req.file);
      return res.status(413).json({ ok: false, code: 'FILE_STORAGE_LIMIT', error: '文件存储空间已达到上限' });
    }
    // 校验班级存在，避免写入孤立文件/脏数据
    if (!db.prepare('SELECT id FROM classes WHERE id = ?').get(classId)) {
      unlinkUploaded(req.file);
      return res.json({ ok: false, error: '班级不存在或未指定' });
    }
    const info = db.prepare(`
      INSERT INTO documents (class_id, original_name, stored_name, category, size, mime, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      classId,
      safeName,
      req.file.filename,
      categoryOf(ext),
      req.file.size,
      req.file.mimetype || 'application/octet-stream',
      tag || ''
    );
    res.json({ ok: true, data: { id: info.lastInsertRowid, name: original } });
  } catch (e) {
    // 写入失败：清理已落盘文件，避免孤儿文件
    try { fs.unlinkSync(path.join(filesDir, req.file.filename)); } catch { /* 忽略 */ }
    res.json({ ok: false, error: '保存失败：' + e.message });
  }
});

// 列表
router.get('/', (req, res) => {
  const { class_id, category, tag, keyword, trashed } = req.query;
  const conds = [];
  const params = {};
  conds.push(trashed === '1' ? 'd.deleted_at IS NOT NULL' : 'd.deleted_at IS NULL');
  if (class_id) { conds.push('d.class_id = @class_id'); params.class_id = Number(class_id); }
  if (category) { conds.push('d.category = @category'); params.category = category; }
  if (tag) { conds.push("',' || d.tag || ',' LIKE @tag"); params.tag = `%,${tag},%`; }
  if (keyword) { conds.push('d.original_name LIKE @kw'); params.kw = `%${keyword}%`; }
  const rows = db.prepare(`
    SELECT d.*, c.name AS class_name FROM documents d
    LEFT JOIN classes c ON c.id = d.class_id
    WHERE ${conds.join(' AND ')}
    ORDER BY d.deleted_at IS NOT NULL, d.uploaded_at DESC
  `).all(params);
  res.json({ ok: true, data: rows.map(pickDoc) });
});

// 重命名/改标签
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!row) return res.json({ ok: false, error: '文件不存在' });
  const b = req.body || {};
  db.prepare(`UPDATE documents SET original_name=?, tag=?, deleted_at=? WHERE id=?`).run(
    b.name !== undefined ? b.name : row.original_name,
    b.tag !== undefined ? b.tag : row.tag,
    b.deleted_at !== undefined ? b.deleted_at : row.deleted_at,
    id
  );
  res.json({ ok: true });
});

// 软删除
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: '无效的文件 ID' });
  db.prepare(`UPDATE documents SET deleted_at=datetime('now','localtime') WHERE id=?`).run(id);
  res.json({ ok: true });
});

// 恢复
router.post('/restore', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.json({ ok: false, error: '未选择文件' });
  const tx = db.transaction(() => {
    for (const id of ids) db.prepare(`UPDATE documents SET deleted_at=NULL WHERE id=?`).run(Number(id));
  });
  tx();
  res.json({ ok: true, data: { count: ids.length } });
});

// 彻底删除（含物理文件）
router.post('/purge', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.json({ ok: false, error: '未选择文件' });
  const tx = db.transaction(() => {
    for (const id of ids) {
      const row = db.prepare('SELECT stored_name FROM documents WHERE id = ?').get(Number(id));
      if (row) {
        try { fs.unlinkSync(path.join(filesDir, row.stored_name)); } catch { /* 文件可能已不存在 */ }
        db.prepare('DELETE FROM documents WHERE id = ?').run(Number(id));
      }
    }
  });
  tx();
  res.json({ ok: true, data: { count: ids.length } });
});

// 文件流（?dl=1 下载；否则预览：图片/PDF/文本 inline）
router.get('/:id/file', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(req.params.id));
  if (!row || row.deleted_at) return res.status(404).json({ ok: false, error: '文件不存在' });
  const filePath = path.join(filesDir, row.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: '物理文件缺失' });
  const dl = req.query.dl === '1';
  // 安全：不信任客户端伪造的 mime；按扩展名映射 Content-Type，并禁用 MIME 嗅探
  const SAFE_MIME = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.bmp': 'image/bmp', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
    '.csv': 'text/plain; charset=utf-8',
  };
  const ext = path.extname(row.stored_name || '').toLowerCase();
  const mime = SAFE_MIME[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const encoded = encodeURIComponent(row.original_name).replace(/['()]/g, escape);
  // 可执行风险类型一律强制下载，不 inline 渲染（防存储型 XSS）
  const inlineSafe = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'].includes(ext);
  res.setHeader('Content-Disposition',
    `${dl || !inlineSafe ? 'attachment' : 'inline'}; filename*=UTF-8''${encoded}`);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ ok: false, error: '文件读取失败' });
    else res.destroy();
  });
  stream.pipe(res);
});

export default router;
