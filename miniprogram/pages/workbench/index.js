const groups = [
  {
    title: '班级与学生',
    items: ['班级设置', '学生管理', '座位管理', '班委学委', '课代表选择'],
  },
  {
    title: '日常记录',
    items: ['考勤管理', '请假管理', '表现量化', '跟进事项', '家校沟通', '值日管理'],
  },
  {
    title: '成绩与资料',
    items: ['成绩管理', '数据分析', '文档管理'],
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
    wx.showToast({ title: `${name}即将接入`, icon: 'none' });
  },
});
