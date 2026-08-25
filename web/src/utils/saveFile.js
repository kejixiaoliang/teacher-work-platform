import { desktopApi } from '../platform/desktopApi.js';

function defaultFilters(filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? [{ name: `${extension.toUpperCase()} 文件`, extensions: [extension] }] : [];
}

async function bytesOf(content) {
  if (content instanceof Blob) return new Uint8Array(await content.arrayBuffer());
  if (typeof content === 'string') return new TextEncoder().encode(content);
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new Uint8Array(content);
}

export async function saveFileContent(content, filename, { mimeType = 'application/octet-stream', filters } = {}) {
  const bytes = await bytesOf(content);
  const chosenFilters = filters || defaultFilters(filename);
  if (desktopApi.isTauri()) {
    const path = await desktopApi.saveFile({ filename, data: bytes, filters: chosenFilters });
    return { saved: Boolean(path), canceled: !path, path };
  }

  const blob = content instanceof Blob ? content : new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { saved: true, canceled: false, path: null };
}
