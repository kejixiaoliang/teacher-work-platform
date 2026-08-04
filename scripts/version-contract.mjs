import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

export function validateVersionContract(rootDir) {
  const packageVersion = JSON.parse(readText(rootDir, 'package.json')).version;
  const tauriVersion = JSON.parse(readText(rootDir, 'src-tauri/tauri.conf.json')).version;
  const cargoText = readText(rootDir, 'src-tauri/Cargo.toml');
  const cargoVersion = cargoText.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const changelogText = readText(rootDir, 'web/src/views/Changelog.vue');

  if (tauriVersion !== packageVersion) {
    throw new Error(`src-tauri/tauri.conf.json 版本 ${tauriVersion} 与产品版本 ${packageVersion} 不一致`);
  }
  if (cargoVersion !== packageVersion) {
    throw new Error(`src-tauri/Cargo.toml 版本 ${cargoVersion || '缺失'} 与产品版本 ${packageVersion} 不一致`);
  }
  const escaped = packageVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`version\\s*:\\s*['"]${escaped}['"]`).test(changelogText)) {
    throw new Error(`web/src/views/Changelog.vue 缺少产品版本 ${packageVersion} 的更新记录`);
  }
  return { version: packageVersion };
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = validateVersionContract(root);
  console.log(`产品版本检查通过：${result.version}`);
}
