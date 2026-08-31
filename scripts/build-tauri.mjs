import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTauriRuntime } from './prepare-tauri-runtime.mjs';
import { resolveSigningPrivateKey } from './tauri-signing.mjs';

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
  const signingPrivateKey = resolveSigningPrivateKey();
  if (!publicKey || !endpoint) {
    throw new Error(
      '安装版构建需要 TAURI_UPDATER_PUBLIC_KEY 和 TEACHER_WORK_UPDATE_ENDPOINT；生产密钥与地址不写入仓库。',
    );
  }
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error('安装版更新地址必须是有效的 HTTPS URL。');
  }
  if (endpointUrl.protocol !== 'https:') {
    throw new Error('安装版更新地址必须使用 HTTPS，不能使用 HTTP。');
  }
  if (!signingPrivateKey) {
    throw new Error(
      '安装版构建需要 TAURI_SIGNING_PRIVATE_KEY 或 TAURI_SIGNING_PRIVATE_KEY_PATH；私钥不写入仓库。',
    );
  }
  const updaterConfig = path.join(targetDir, 'tauri.updater.conf.json');
  fs.mkdirSync(targetDir, { recursive: true });
  const runtimeDir = prepareTauriRuntime({ root, targetDir, packageVersion: '0.9.0' });
  fs.writeFileSync(updaterConfig, JSON.stringify({
    bundle: {
      resources: {
        [path.join(runtimeDir, '/')]: 'resources/',
      },
    },
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
  env: {
    ...process.env,
    ...(profile === 'installed' ? { TAURI_SIGNING_PRIVATE_KEY: resolveSigningPrivateKey() } : {}),
    CARGO_TARGET_DIR: targetDir,
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
