const groups = [
  {
    title: '常用',
    kicker: 'COMMON',
    tone: 'mustard',
    items: ['学生管理', '座位管理'].map((name, index) => ({ name, code: ['01', '02'][index] })),
  },
  {
    title: '学习分析',
    kicker: 'LEARNING',
    tone: 'mint',
    items: ['数据分析', '成绩管理', '考勤管理', '表现量化'].map((name, index) => ({ name, code: ['01', '02', '03', '04'][index] })),
  },
  {
    title: '班级事务',
    kicker: 'CLASS AFFAIRS',
    tone: 'sky',
    items: ['文档管理', '值日管理', '班委学委', '课代表选择', '请假管理', '家校沟通'].map((name, index) => ({ name, code: ['01', '02', '03', '04', '05', '06'][index] })),
  },
];

Page({
  data: { groups },

  openFeature(event) {
    const name = event.currentTarget.dataset.name;
    if (name === '学生管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/students/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '考勤管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/attendance/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '请假管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/leaves/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '跟进事项') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/follow-up/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '成绩管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/scores/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '座位管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/seats/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '值日管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/duties/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '家校沟通') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/contacts/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '文档管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/documents/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '表现量化') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/assessment/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '数据分析') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/analysis/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '班委学委') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/leaders/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    if (name === '课代表选择') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/subject-leaders/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    const featureNames = new Set(['成绩管理', '座位管理', '值日管理', '家校沟通', '文档管理', '数据分析']);
    if (featureNames.has(name)) {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/business/index?feature=${encodeURIComponent(name)}${datasetId ? `&datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    wx.showToast({ title: `${name}暂未配置页面`, icon: 'none' });
  },
});
