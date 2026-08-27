let envId = '';
try {
  ({ envId } = require('./config/env.js'));
} catch {
  ({ envId } = require('./config/env.example.js'));
}

App({
  globalData: {
    envId,
    cloudInitError: '',
  },

  onLaunch() {
    if (!envId || envId === 'YOUR_CLOUDBASE_ENV_ID') return;
    try {
      wx.cloud.init({
        env: envId,
        traceUser: true,
      });
    } catch (error) {
      this.globalData.cloudInitError = error?.message || 'CloudBase 初始化失败';
      console.error('[cloudbase] 初始化失败，页面仍可继续打开', error);
    }
  },
});
