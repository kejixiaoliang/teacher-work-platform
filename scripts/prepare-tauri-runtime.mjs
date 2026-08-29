import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function prepareTauriRuntime({ root, targetDir, packageVersion }) {
  const runtimeDir = path.join(targetDir, 'runtime');
  const appDir = path.join(runtimeDir, 'app');
  const nodeDir = path.join(runtimeDir, 'runtime');
  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(nodeDir, { recursive: true });

  fs.copyFileSync(process.execPath, path.join(nodeDir, 'node.exe'));
  fs.cpSync(path.join(root, 'server'), path.join(appDir, 'server'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
    name: 'teacher-work-runtime',
    private: true,
    type: 'module',
    version: packageVersion,
    dependencies: {
      'better-sqlite3': '^12.2.0',
      archiver: '^7.0.1',
      express: '^4.21.2',
      multer: '^2.2.0',
      unzipper: '^0.12.5',
    },
  }, null, 2));

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npmCommand, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: appDir,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
  return runtimeDir;
}
