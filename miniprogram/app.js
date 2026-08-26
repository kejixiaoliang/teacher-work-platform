const { envId } = require('./config/env.example.js');

App({
  globalData: {
    envId,
  },

  onLaunch() {
    if (!envId || envId === 'YOUR_CLOUDBASE_ENV_ID') return;
    wx.cloud.init({
      env: envId,
      traceUser: true,
    });
  },
});
