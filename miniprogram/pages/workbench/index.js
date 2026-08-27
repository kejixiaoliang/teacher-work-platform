const { modules } = require('../../config/modules.js');
const groupMeta = { 常用: { kicker: 'COMMON', tone: 'mustard' }, 学习分析: { kicker: 'LEARNING', tone: 'mint' }, 班级事务: { kicker: 'CLASS AFFAIRS', tone: 'sky' } };
const groups = Object.keys(groupMeta).map((title) => ({ title, ...groupMeta[title], items: modules.filter((item) => item.group === title).map((item, index) => ({ ...item, code: String(index + 1).padStart(2, '0') })) }));

Page({
  data: { groups },

  openFeature(event) {
    const id = event.currentTarget.dataset.id;
    const item = modules.find((module) => module.id === id);
    if (!item) return wx.showToast({ title: '模块配置无效', icon: 'none' });
    const datasetId = wx.getStorageSync('activeDatasetId') || '';
    wx.navigateTo({ url: `${item.route}${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
  },
});
