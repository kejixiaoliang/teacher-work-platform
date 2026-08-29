import { configureRuntime, getRuntimeConfig, toApiUrl } from './runtimeConfig.js';
import { createUpdater } from '../desktop/updater.js';

export const desktopApi = {
  updater: createUpdater(),
  isTauri() {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  },
  async bootstrap() {
    if (!this.isTauri()) return getRuntimeConfig();
    const { invoke } = await import('@tauri-apps/api/core');
    const runtime = await invoke('desktop_bootstrap');
    configureRuntime({ ...runtime, mode: 'tauri' });
    return getRuntimeConfig();
  },
  async saveFile({ filename, data, filters = [] }) {
    if (!this.isTauri()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('save_file', {
      request: {
        filename,
        data: Array.from(data instanceof Uint8Array ? data : new Uint8Array(data)),
        filters,
      },
    });
  },
  toApiUrl,
};
