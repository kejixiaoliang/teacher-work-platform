import express from 'express';
import path from 'path';
import fs from 'fs';
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

// API 统一错误处理（multer 拒绝文件类型等 → 返回 JSON）
app.use('/api', (err, req, res, next) => {
  res.status(err.status || 500).json({ ok: false, error: err.message || '服务器错误' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 生产模式：托管构建后的前端
const distDir = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
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
