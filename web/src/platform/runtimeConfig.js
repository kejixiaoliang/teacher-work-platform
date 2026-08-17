let config = { apiBaseUrl: '', apiToken: '', mode: 'web' };

export function configureRuntime(next) {
  config = { ...config, ...next };
}

export function getRuntimeConfig() { return { ...config }; }

export function toApiUrl(apiPath) {
  return `${config.apiBaseUrl}${apiPath}`;
}
