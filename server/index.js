import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import db, { seedIfEmpty } from './db.js';
import classesRouter from './routes/classes.js';
import studentsRouter from './routes/students.js';
import seatsRouter from './routes/seats.js';
import documentsRouter from './routes/documents.js';
import dutiesRouter from './routes/duties.js';
import scoresRouter from './routes/scores.js';
import attendanceRouter from './routes/attendance.js';
import recordsRouter from './routes/records.js';
import leavesRouter from './routes/leaves.js';
import contactsRouter from './routes/contacts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3210;

seedIfEmpty();

const app = express();
app.use(express.json({ limit: '50mb' }));

app.use('/api/classes', classesRouter);
app.use('/api/students', studentsRouter);
app.use('/api/seats', seatsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/duties', dutiesRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/students', recordsRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/contacts', contactsRouter);

// API 统一错误处理（multer 拒绝文件类型等 → 返回 JSON，不泄露内部实现细节）
app.use('/api', (err, req, res, next) => {
  console.error('[api error]', req.method, req.path, err.message);
  // multer 文件过大/类型拒绝的错误信息可安全展示
  const safe = err.code === 'LIMIT_FILE_SIZE' ? '文件超过大小限制（200MB）'
    : err.message && /不支持的文件类型/.test(err.message) ? err.message
    : '服务器处理失败，请稍后重试';
  res.status(err.status || 500).json({ ok: false, error: safe });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 生产模式：托管构建后的前端（静态资源 gzip 压缩）
const distDir = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use((req, res, next) => {
    // 仅对静态资源启用 gzip（text/js/css/json/svg/html），且客户端支持时
    if (req.path.startsWith('/api') || !req.headers['accept-encoding']?.includes('gzip')) return next();
    // 根路径/无扩展名 → 视作 index.html
    const rawPath = req.path === '/' ? '/index.html' : req.path;
    const ext = path.extname(rawPath).toLowerCase();
    if (!['.js', '.css', '.html', '.json', '.svg', '.txt'].includes(ext)) return next();
    const gzFile = path.join(distDir, rawPath + '.gz');
    if (!fs.existsSync(gzFile)) return next();
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Type', {
      '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain',
    }[ext] || 'application/octet-stream');
    res.setHeader('Vary', 'Accept-Encoding');
    res.sendFile(gzFile);
  });
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n✅ 教师工作台已启动：http://localhost:${PORT}`);
  console.log('   关闭本窗口即停止服务；数据保存在 data/ 文件夹。\n');
  // 自动打开浏览器（Windows，可用环境变量 NO_OPEN=1 关闭）
  if (process.env.NO_OPEN !== '1' && process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', `http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref();
  }
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
