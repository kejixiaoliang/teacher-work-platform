import path from 'node:path';
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
