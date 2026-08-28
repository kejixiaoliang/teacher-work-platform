const PROJECT_URL = 'https://github.com/kejixiaoliang/teacher-work-platform';

Page({
  data: {
    product: '教师工作台',
    version: '0.8.0',
    desktopVersion: '0.7.0',
    maker: '科技小亮',
    projectUrl: PROJECT_URL,
    privacyItems: [
      '小程序通过微信身份识别当前教师；服务端使用 OPENID 建立数据隔离，不采信客户端传入的 ownerId。',
      '班级、学生、成绩、考勤、表现、请假和家校沟通等业务数据保存在 CloudBase，并按教师、数据集和班级作用域访问。',
      '导入、导出和分享文件可能包含学生隐私与成绩信息，请只保存或发送到可信位置。',
      '当前文档模块只同步元数据，附件内容不会自动上传 CloudBase Storage；页面会明确标注附件能力状态。',
      '业务删除默认采用软删除。云端部署、数据恢复和其他高风险操作必须经过明确确认。',
    ],
  },

  copyProjectUrl() {
    wx.setClipboardData({ data: PROJECT_URL, success: () => wx.showToast({ title: '项目地址已复制', icon: 'success' }) });
  },
});
