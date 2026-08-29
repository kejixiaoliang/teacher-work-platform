import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import classesRouter from './routes/classes.js';
import classCustomizationRouter from './routes/class-customization.js';
import studentsRouter from './routes/students.js';
import seatsRouter from './routes/seats.js';
import documentsRouter from './routes/documents.js';
import dutiesRouter from './routes/duties.js';
import scoresRouter from './routes/scores.js';
import attendanceRouter from './routes/attendance.js';
import recordsRouter from './routes/records.js';
import leavesRouter from './routes/leaves.js';
import contactsRouter from './routes/contacts.js';
import backupRouter from './routes/backup.js';
import overviewRouter from './routes/overview.js';
import assessmentRouter from './routes/assessment.js';
import followUpTasksRouter from './routes/follow-up-tasks.js';
import workbenchRouter from './routes/workbench.js';
import { hasFileAccess } from './security/file-access.js';
import { createAccessRouter } from './routes/access-control.js';
import { DEFAULT_MODULE_POLICIES } from './access-control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ apiToken = '', accessController = null } = {}) {
  const app = express();
  const sessions = new Set();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    const allowed = origin === 'http://tauri.localhost'
      || origin === 'tauri://localhost'
      || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    if (allowed) {
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
      res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type,X-Teacher-Work-Token');
    }
    if (req.method === 'OPTIONS') {
      return allowed ? res.sendStatus(204) : res.sendStatus(403);
    }
    next();
  });
  if (accessController) {
    app.use('/api/access', createAccessRouter({ controller: accessController, sessions }));
    app.use('/api', (req, res, next) => {
      if (!accessController.hasPassword()) return next();
      accessController.touchActivity();
      req.classroomMode = accessController.getMode() === 'classroom';
      const pathModule = req.path.split('/').filter(Boolean)[0];
      const module = pathModule === 'students' && req.path.startsWith('/students/') ? 'students' : pathModule;
      const supportingRead = req.method === 'GET'
        && ((module === 'students' && (req.path === '/students' || req.path === '/students/'))
          || (module === 'classes' && (req.path === '/classes' || req.path === '/classes/')));
      if (supportingRead) return next();
      if (!DEFAULT_MODULE_POLICIES[module] || accessController.isAllowed(module)) return next();
      return res.status(403).json({ ok: false, code: 'MODULE_LOCKED', error: '当前模块需要教师授权' });
    });
  }
  app.use('/api', (req, res, next) => {
    if (!apiToken) return next();
    const headerToken = req.get('x-teacher-work-token');
    if (headerToken === apiToken) return next();
    const filePath = req.path.match(/^\/documents\/(\d+)\/file$/);
    if (req.method === 'GET' && filePath && hasFileAccess(req.query.__token)) {
      req.oneTimeFileAccess = { token: req.query.__token, documentId: Number(filePath[1]) };
      return next();
    }
    return res.status(401).json({ ok: false, error: '未授权的本地请求' });
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/classes', classCustomizationRouter);
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
  app.use('/api/backup', backupRouter);
  app.use('/api/overview', overviewRouter);
  app.use('/api/assessment', assessmentRouter);
  app.use('/api/follow-up-tasks', followUpTasksRouter);
  app.use('/api/workbench', workbenchRouter);
  app.use('/api', (err, req, res, next) => {
    console.error('[api error]', req.method, req.path, err.message);
    const safe = err.code === 'LIMIT_FILE_SIZE' ? '文件超过大小限制（200MB）'
      : err.message && /不支持的文件类型/.test(err.message) ? err.message
      : '服务器处理失败，请稍后重试';
    res.status(err.status || 500).json({ ok: false, error: safe });
  });
  app.use('/api', (req, res) => res.status(404).json({ ok: false, error: '接口不存在' }));

  const distDir = path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
  return app;
}
