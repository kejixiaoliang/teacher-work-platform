let config = { apiBaseUrl: '', apiToken: '', mode: 'web' };

export function configureRuntime(next) {
  config = { ...config, ...next };
}

export function getRuntimeConfig() { return { ...config }; }

export function toApiUrl(apiPath, queryToken = false) {
  const url = `${config.apiBaseUrl}${apiPath}`;
  if (!queryToken || !config.apiToken) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${new URLSearchParams({ __token: config.apiToken }).toString()}`;
}
