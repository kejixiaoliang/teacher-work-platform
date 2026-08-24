import { spawn } from 'node:child_process';
import db, { seedIfEmpty, getAppSetting, setAppSetting } from './db.js';
import { createApp } from './app.js';
import { createAccessController, DEFAULT_MODULE_POLICIES } from './access-control.js';

export async function startServer({ host = '127.0.0.1', port = 3210, apiToken = '', openBrowser = false } = {}) {
  seedIfEmpty();
  const storedPassword = getAppSetting('access.password', '');
  const storedPolicies = getAppSetting('access.policies', '');
  const storedMode = getAppSetting('access.mode', 'teacher');
  const storedRecoveryKeyHash = getAppSetting('access.recovery-key-hash', '');
  const storedRecoveryKeyUsedAt = getAppSetting('access.recovery-key-used-at', '');
  const accessController = createAccessController({
    config: {
      passwordRecord: storedPassword ? JSON.parse(storedPassword) : null,
      policies: storedPolicies ? { ...DEFAULT_MODULE_POLICIES, ...JSON.parse(storedPolicies) } : DEFAULT_MODULE_POLICIES,
      mode: storedMode,
      recoveryKeyHash: storedRecoveryKeyHash || null,
      recoveryKeyUsedAt: storedRecoveryKeyUsedAt || null,
    },
    onConfigChange: ({ passwordRecord, policies, mode, recoveryKeyHash, recoveryKeyUsedAt }) => {
      setAppSetting('access.password', JSON.stringify(passwordRecord || {}));
      setAppSetting('access.policies', JSON.stringify(policies));
      setAppSetting('access.mode', mode || 'teacher');
      setAppSetting('access.recovery-key-hash', recoveryKeyHash || '');
      setAppSetting('access.recovery-key-used-at', recoveryKeyUsedAt || '');
    },
  });
  const app = createApp({ apiToken, accessController });
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
