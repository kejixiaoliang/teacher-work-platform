import { callIdentityStatus } from '../../services/teacher-data.js';

Page({
  data: { loading: false, error: '', status: null, checkedAt: '' },
  onShow() { this.loadStatus(); },
  async loadStatus() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await callIdentityStatus({ action: 'status' });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '读取微信身份状态失败');
      this.setData({ loading: false, status: result, checkedAt: new Date().toLocaleString('zh-CN') });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '读取微信身份状态失败' });
    }
  },
});
