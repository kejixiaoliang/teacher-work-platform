function getAppEnvId() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return app?.globalData?.envId || '';
}

export function isCloudBaseConfigured() {
  const envId = getAppEnvId();
  return Boolean(envId && envId !== 'YOUR_CLOUDBASE_ENV_ID' && typeof wx !== 'undefined' && wx.cloud);
}

export function callCloudFunction(name, data = {}) {
  if (!isCloudBaseConfigured()) return Promise.reject(new Error('CloudBase 环境尚未配置'));
  if (typeof name !== 'string' || !name.trim()) return Promise.reject(new TypeError('云函数名称不能为空'));
  return wx.cloud.callFunction({ name, data });
}

export function getCollection(name) {
  if (!isCloudBaseConfigured()) throw new Error('CloudBase 环境尚未配置');
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('集合名称不能为空');
  return wx.cloud.database().collection(name);
}
