Page({
  data: {
    sections: [
      { title: '数据', items: [{ name: '数据导入', action: 'openImport' }, { name: '数据备份与恢复', action: 'comingSoon' }, { name: '数据同步', action: 'comingSoon' }] },
      { title: '账号与授权', items: [{ name: '微信身份与授权', action: 'comingSoon' }, { name: '电脑端绑定', action: 'comingSoon' }, { name: '兑换码', action: 'openRedeem' }] },
      { title: '帮助', items: [{ name: '使用指南', action: 'comingSoon' }, { name: '版本更新', action: 'comingSoon' }, { name: '联系作者与关于', action: 'comingSoon' }] },
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
    wx.showToast({ title: `${name}即将接入`, icon: 'none' });
  },
});
