import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--report-only')) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'tauri:build:installed'], {
    cwd: root,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const bundleRoot = path.join(root, 'src-tauri', 'target', 'installed', 'release', 'bundle');
console.log(`安装版构建完成，构建资产目录：${bundleRoot}`);
console.log('下一步请使用 generate-update-manifest.mjs 生成 latest.json 和 SHA-256 清单。');
