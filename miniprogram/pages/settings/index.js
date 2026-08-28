import { callIdentityStatus } from '../../services/teacher-data.js';

Page({
  data: {
    identityState: 'checking',
    identityLabel: '正在检查微信身份',
    identityHint: '小程序会使用当前微信身份隔离数据',
    sections: [
      { title: '数据与安全', description: '班级、导入、备份和跨端数据安全', tone: 'mustard', items: [{ name: '班级设置', action: 'openClassSettings' }, { name: '数据导入', action: 'openImport' }, { name: '数据备份与恢复', action: 'openBackup' }, { name: '数据同步', action: 'openSync' }] },
      { title: '身份与授权', description: '微信身份、电脑端和使用授权', tone: 'mint', items: [{ name: '微信身份与授权', action: 'openIdentity' }, { name: '电脑端绑定', action: 'comingSoon' }, { name: '兑换码', action: 'openRedeem' }] },
      { title: '帮助与关于', description: '使用说明、版本和联系信息', tone: 'sky', items: [{ name: '使用指南', action: 'openGuide' }, { name: '版本更新', action: 'openChangelog' }, { name: '联系作者与关于', action: 'openAbout' }] },
    ],
  },

  onShow() {
    this.loadIdentitySummary();
  },

  async loadIdentitySummary() {
    this.setData({ identityState: 'checking', identityLabel: '正在检查微信身份' });
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app?.globalData) app.globalData.identityState = 'checking';
    try {
      const result = await callIdentityStatus({ action: 'status' });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '微信身份暂不可用');
      if (app?.globalData) app.globalData.identityState = 'ready';
      this.setData({
        identityState: 'ready',
        identityLabel: '微信身份已就绪',
        identityHint: '数据会按当前微信身份隔离，点击查看授权边界',
      });
    } catch (error) {
      if (app?.globalData) app.globalData.identityState = 'unavailable';
      this.setData({
        identityState: 'unavailable',
        identityLabel: '需要重新检查微信身份',
        identityHint: error?.message || '请点击进入身份页重新检查',
      });
    }
  },

  handleItemTap(event) {
    const { action, name } = event.currentTarget.dataset;
    if (action === 'openImport') {
      wx.navigateTo({ url: '/pages/import/index' });
      return;
    }
    if (action === 'openRedeem') {
      wx.navigateTo({ url: '/pages/redeem/index' });
      return;
    }
    if (action === 'openIdentity') {
      wx.navigateTo({ url: '/pages/identity/index' });
      return;
    }
    if (action === 'openClassSettings') {
      wx.navigateTo({ url: '/pages/class-settings/index' });
      return;
    }
    if (action === 'openGuide') {
      wx.navigateTo({ url: '/pages/guide/index' });
      return;
    }
    if (action === 'openChangelog') {
      wx.navigateTo({ url: '/pages/changelog/index' });
      return;
    }
    if (action === 'openAbout') {
      wx.navigateTo({ url: '/pages/about/index' });
      return;
    }
    if (action === 'openSync') {
      wx.navigateTo({ url: '/pages/sync/index' });
      return;
    }
    if (action === 'openBackup') {
      wx.navigateTo({ url: '/pages/backup/index' });
      return;
    }
    wx.showToast({ title: `${name}：待接入`, icon: 'none' });
  },
});
