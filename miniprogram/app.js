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
    identityMode: 'wechat-native',
    identityState: 'checking',
  },

  onLaunch() {
    if (!envId || envId === 'YOUR_CLOUDBASE_ENV_ID') return;
    try {
      wx.cloud.init({
        env: envId,
        traceUser: true,
      });
      // 微信小程序身份由 CloudBase 原生注入；不建立 Web 式 token 或密码登录。
      this.globalData.identityState = 'native-ready';
    } catch (error) {
      this.globalData.cloudInitError = error?.message || 'CloudBase 初始化失败';
      console.error('[cloudbase] 初始化失败，页面仍可继续打开', error);
    }
  },
});
