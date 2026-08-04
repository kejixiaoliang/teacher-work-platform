import { spawn } from 'node:child_process';
import db, { seedIfEmpty } from './db.js';
import { createApp } from './app.js';

export async function startServer({ host = '127.0.0.1', port = 3210, apiToken = '', openBrowser = false } = {}) {
  seedIfEmpty();
  const app = createApp({ apiToken });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, host, () => resolve(instance));
    instance.once('error', reject);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const baseUrl = `http://${host}:${actualPort}`;
  if (openBrowser && process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', baseUrl], { detached: true, stdio: 'ignore' }).unref();
  }
  return {
    host, port: actualPort, baseUrl,
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())),
  };
}

export function closeDatabase() {
  if (db.open) db.close();
}
