import { startServer, closeDatabase } from './runtime.js';
import { DATABASE_VERSION } from './db.js';

const port = Number(process.env.PORT || 3210);
const host = process.env.HOST || '127.0.0.1';
const apiToken = process.env.TEACHER_WORK_API_TOKEN || '';
const running = await startServer({ host, port, apiToken, openBrowser: process.env.NO_OPEN !== '1' });

if (process.env.TEACHER_WORK_SIDECAR === '1') {
  console.log(`TEACHER_WORK_READY ${JSON.stringify({ port: running.port, databaseVersion: DATABASE_VERSION })}`);
} else {
  console.log(`教师工作台已启动：${running.baseUrl}`);
}

async function shutdown() {
  await running.close().catch(() => {});
  closeDatabase();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
