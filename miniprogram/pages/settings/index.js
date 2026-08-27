Page({
  data: {
    sections: [
      { title: '数据', description: '导入、备份和跨端数据安全', tone: 'mustard', items: [{ name: '数据导入', action: 'openImport' }, { name: '数据备份与恢复', action: 'comingSoon' }, { name: '数据同步', action: 'comingSoon' }] },
      { title: '账号与授权', description: '微信身份、电脑端和使用授权', tone: 'mint', items: [{ name: '微信身份与授权', action: 'comingSoon' }, { name: '电脑端绑定', action: 'comingSoon' }, { name: '班级设置', action: 'openClassSettings' }, { name: '兑换码', action: 'openRedeem' }] },
      { title: '帮助', description: '使用说明、版本和联系信息', tone: 'sky', items: [{ name: '使用指南', action: 'comingSoon' }, { name: '版本更新', action: 'comingSoon' }, { name: '联系作者与关于', action: 'comingSoon' }] },
    ],
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
    if (action === 'openClassSettings') {
      wx.navigateTo({ url: '/pages/class-settings/index' });
      return;
    }
    wx.showToast({ title: `${name}即将接入`, icon: 'none' });
  },
});
