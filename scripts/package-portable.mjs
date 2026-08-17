import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const product = '教师工作台';
const releaseName = `${product}-v${pkg.version}-windows-x64-portable`;
const releaseRoot = path.join(root, 'release');
const staging = path.join(releaseRoot, releaseName);
const productDir = path.join(staging, product);
const cargoTarget = process.env.CARGO_TARGET_DIR || path.join(root, 'src-tauri', 'target');
const sourceExe = path.join(cargoTarget, 'release', 'teacher-work.exe');

if (!fs.existsSync(sourceExe)) throw new Error(`Release EXE 不存在: ${sourceExe}`);
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.join(productDir, 'resources', 'runtime'), { recursive: true });
fs.mkdirSync(path.join(productDir, 'resources', 'app'), { recursive: true });
for (const dir of ['data', 'backup', 'logs']) fs.mkdirSync(path.join(productDir, dir));

fs.copyFileSync(sourceExe, path.join(productDir, `${product}.exe`));
fs.copyFileSync(process.execPath, path.join(productDir, 'resources', 'runtime', 'node.exe'));
fs.cpSync(path.join(root, 'server'), path.join(productDir, 'resources', 'app', 'server'), { recursive: true });

const runtimePackage = {
  name: 'teacher-work-runtime', private: true, type: 'module',
  dependencies: {
    'better-sqlite3': pkg.dependencies['better-sqlite3'],
    archiver: pkg.dependencies.archiver,
    express: pkg.dependencies.express,
    multer: pkg.dependencies.multer,
    unzipper: pkg.dependencies.unzipper,
  },
};
fs.writeFileSync(path.join(productDir, 'resources', 'app', 'package.json'), JSON.stringify(runtimePackage, null, 2));
execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm install --omit=dev --no-audit --no-fund'], {
  cwd: path.join(productDir, 'resources', 'app'), stdio: 'inherit',
});

const readme = `教师工作台 v${pkg.version}\r\n\r\n` +
  `1. 必须先完整解压 ZIP，再双击“教师工作台.exe”。\r\n` +
  `2. 不要单独移动 EXE；resources 和 data 必须与 EXE 保持相对位置。\r\n` +
  `3. 数据保存在同级 data 目录。升级时请保留 data、backup 和 logs。\r\n` +
  `4. 请解压到桌面、文档或数据盘等可写目录，不要放入 Program Files。\r\n` +
  `5. 未签名版本可能触发 Windows SmartScreen；请从可信来源获取并核对 SHA-256。\r\n` +
  `6. 应用依赖 Microsoft Edge WebView2 Runtime，Windows 10/11 通常已自带。\r\n`;
fs.writeFileSync(path.join(productDir, 'README.txt'), readme, 'utf8');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const manifest = [];
for (const file of fs.readdirSync(productDir, { recursive: true })) {
  const absolute = path.join(productDir, file);
  if (fs.statSync(absolute).isFile()) manifest.push({ path: file.replaceAll('\\', '/'), size: fs.statSync(absolute).size, sha256: sha256(absolute) });
}
fs.writeFileSync(path.join(productDir, 'manifest.json'), JSON.stringify({ product, version: pkg.version, files: manifest }, null, 2));

const zip = path.join(releaseRoot, `${releaseName}.zip`);
fs.rmSync(zip, { force: true });
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -LiteralPath '${productDir.replaceAll("'", "''")}' -DestinationPath '${zip.replaceAll("'", "''")}' -Force`], { stdio: 'inherit' });
console.log(JSON.stringify({ productDir, zip, sha256: sha256(zip) }, null, 2));
