import { getRuntimeConfig } from '../platform/runtimeConfig.js';

const nativeUpdate = Symbol('nativeUpdate');

function isTauriEnvironment() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function profileOf(runtime) {
  return runtime?.runtimeProfile || runtime?.runtime_profile || '';
}

function safeError(code, message) {
  return { status: 'error', code, message };
}

function normalizeProgress(event, downloaded, contentLength) {
  if (event?.event === 'Started') {
    return {
      status: 'started',
      contentLength: event.data?.contentLength ?? contentLength ?? null,
    };
  }
  if (event?.event === 'Progress') {
    return {
      status: 'progress',
      downloaded: downloaded + (event.data?.chunkLength || 0),
      contentLength: event.data?.contentLength ?? contentLength ?? null,
    };
  }
  if (event?.event === 'Finished') return { status: 'finished' };
  return null;
}

async function nativeCheck(options) {
  const { check } = await import('@tauri-apps/plugin-updater');
  return check(options);
}

export function createUpdater({
  isTauri = isTauriEnvironment,
  getRuntime = getRuntimeConfig,
  check = nativeCheck,
} = {}) {
  return {
    async checkForUpdate(options) {
      if (!isTauri()) return { status: 'unsupported', reason: 'browser' };
      if (profileOf(getRuntime()) !== 'installed') {
        return { status: 'unsupported', reason: 'portable' };
      }

      try {
        const update = await check(options);
        if (!update) return { status: 'up-to-date' };

        const result = {
          status: 'available',
          version: update.version,
          notes: update.body ?? update.notes ?? '',
          date: update.date ?? update.pubDate ?? null,
        };
        Object.defineProperty(result, nativeUpdate, { value: update });
        return result;
      } catch {
        return safeError('check-failed', '暂时无法检查更新，请稍后重试。');
      }
    },

    async installUpdate(result, { onProgress, onRestart } = {}) {
      if (!result || result.status !== 'available' || !result[nativeUpdate]) {
        return safeError('invalid-update', '更新信息已失效，请重新检查更新。');
      }

      try {
        let downloaded = 0;
        let contentLength = null;
        await result[nativeUpdate].downloadAndInstall(event => {
          const normalized = normalizeProgress(event, downloaded, contentLength);
          if (!normalized) return;
          if (normalized.status === 'started') contentLength = normalized.contentLength;
          if (normalized.status === 'progress') downloaded = normalized.downloaded;
          onProgress?.(normalized);
        });
        onRestart?.();
        return { status: 'installed' };
      } catch {
        return safeError('install-failed', '更新安装失败，请稍后重试。');
      }
    },
  };
}
