const groups = [
  {
    title: '班级与学生',
    kicker: 'FOUNDATION',
    tone: 'mustard',
    items: ['班级设置', '学生管理', '座位管理', '班委学委', '课代表选择'].map((name, index) => ({ name, code: ['01', '02', '03', '04', '05'][index] })),
  },
  {
    title: '日常记录',
    kicker: 'DAILY ROUTINE',
    tone: 'mint',
    items: ['考勤管理', '请假管理', '表现量化', '跟进事项', '家校沟通', '值日管理'].map((name, index) => ({ name, code: ['01', '02', '03', '04', '05', '06'][index] })),
  },
  {
    title: '成绩与资料',
    kicker: 'REVIEW & ARCHIVE',
    tone: 'sky',
    items: ['成绩管理', '数据分析', '文档管理'].map((name, index) => ({ name, code: ['01', '02', '03'][index] })),
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
    if (name === '值日管理') {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/duties/index${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    const featureNames = new Set(['成绩管理', '座位管理', '值日管理', '家校沟通', '文档管理', '数据分析']);
    if (featureNames.has(name)) {
      const datasetId = wx.getStorageSync('activeDatasetId') || '';
      wx.navigateTo({ url: `/pages/business/index?feature=${encodeURIComponent(name)}${datasetId ? `&datasetId=${encodeURIComponent(datasetId)}` : ''}` });
      return;
    }
    wx.showToast({ title: `${name}即将接入`, icon: 'none' });
  },
});
