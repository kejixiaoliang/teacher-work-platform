import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = 'windows-x86_64';
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function assertVersion(version) {
  if (typeof version !== 'string' || !SEMVER_PATTERN.test(version.trim())) {
    throw new Error(`版本必须是合法 SemVer：${version ?? ''}`);
  }
  return version.trim();
}

function assertEndpointRoot(endpointRoot) {
  let parsed;
  try {
    parsed = new URL(endpointRoot);
  } catch {
    throw new Error(`endpoint-root 必须是绝对 HTTP URL：${endpointRoot ?? ''}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`endpoint-root 必须是绝对 HTTP URL：${endpointRoot}`);
  }
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed;
}

async function readRequiredAsset(file, label) {
  if (typeof file !== 'string' || !file.trim()) {
    throw new Error(`${label}文件不存在或为空：${file ?? ''}`);
  }
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    throw new Error(`${label}文件不存在或为空：${file}`);
  }
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${label}文件不存在或为空：${file}`);
  }
  return fs.readFile(file);
}

function assetUrl(endpointRoot, file) {
  const root = assertEndpointRoot(endpointRoot);
  const filename = encodeURIComponent(path.basename(file));
  return new URL(filename, root).href;
}

function isoDate(value) {
  if (value === undefined) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`pub-date 必须是合法 ISO 日期：${value}`);
  return date.toISOString();
}

export async function buildManifest({
  version,
  installer,
  signature,
  endpointRoot,
  notes,
  pubDate,
}) {
  const normalizedVersion = assertVersion(version);
  if (typeof notes !== 'string' || !notes.trim()) throw new Error('release notes 不能为空');
  const signatureBuffer = await readRequiredAsset(signature, '签名');
  await readRequiredAsset(installer, '安装包');
  const signatureText = signatureBuffer.toString('utf8').trim();
  if (!signatureText) throw new Error(`签名文件不存在或为空：${signature}`);

  return {
    version: normalizedVersion,
    notes: notes.trim(),
    pub_date: isoDate(pubDate),
    platforms: {
      [PLATFORM]: {
        signature: signatureText,
        url: assetUrl(endpointRoot, installer),
      },
    },
  };
}

async function hashAsset(file, label) {
  const data = await readRequiredAsset(file, label);
  return {
    name: path.basename(file),
    size: data.byteLength,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  };
}

export async function buildChecksums({ version, installer, signature }) {
  const normalizedVersion = assertVersion(version);
  return {
    version: normalizedVersion,
    files: {
      installer: await hashAsset(installer, '安装包'),
      signature: await hashAsset(signature, '签名'),
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`无法识别参数：${token}`);
    const key = token.slice(2).replaceAll('-', '_');
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`参数缺少值：${token}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['version', 'installer', 'signature', 'endpoint_root', 'output', 'checksums_output'];
  for (const key of required) {
    if (!args[key]) throw new Error(`缺少参数：--${key.replaceAll('_', '-')}`);
  }
  const manifest = await buildManifest({
    version: args.version,
    installer: args.installer,
    signature: args.signature,
    endpointRoot: args.endpoint_root,
    notes: args.notes ?? `Teacher Work ${args.version}`,
    pubDate: args.pub_date,
  });
  const checksums = await buildChecksums({
    version: args.version,
    installer: args.installer,
    signature: args.signature,
  });
  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.mkdir(path.dirname(args.checksums_output), { recursive: true });
  await fs.writeFile(args.output, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(args.checksums_output, `${JSON.stringify(checksums, null, 2)}\n`);
  console.log(`更新清单已生成：${args.output}`);
  console.log(`SHA-256 清单已生成：${args.checksums_output}`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
