import { configureRuntime, getRuntimeConfig, toApiUrl } from './runtimeConfig.js';

export const desktopApi = {
  async bootstrap() {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return getRuntimeConfig();
    const { invoke } = await import('@tauri-apps/api/core');
    const runtime = await invoke('desktop_bootstrap');
    configureRuntime({ ...runtime, mode: 'tauri' });
    return getRuntimeConfig();
  },
  toApiUrl,
};
