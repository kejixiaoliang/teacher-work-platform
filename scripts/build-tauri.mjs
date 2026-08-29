import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = process.argv[2];

if (!['installed', 'portable'].includes(profile)) {
  throw new Error('用法：node scripts/build-tauri.mjs <installed|portable>');
}

const targetDir = path.join(root, 'src-tauri', 'target', profile);
const config = path.join('src-tauri', 'tauri.' + profile + '.conf.json');
const args = ['tauri', 'build', '--config', config];

if (profile === 'installed') {
  const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
  const endpoint = process.env.TEACHER_WORK_UPDATE_ENDPOINT?.trim();
  if (!publicKey || !endpoint) {
    throw new Error(
      '安装版构建需要 TAURI_UPDATER_PUBLIC_KEY 和 TEACHER_WORK_UPDATE_ENDPOINT；生产密钥与地址不写入仓库。',
    );
  }
  const updaterConfig = path.join(targetDir, 'tauri.updater.conf.json');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(updaterConfig, JSON.stringify({
    plugins: { updater: { pubkey: publicKey, endpoints: [endpoint] } },
  }, null, 2));
  args.push('--config', updaterConfig);
  args.push('--features', 'installed', '--bundles', 'nsis');
} else {
  args.push('--no-bundle');
}

const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npmCommand, args, {
  cwd: root,
  env: { ...process.env, CARGO_TARGET_DIR: targetDir },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
