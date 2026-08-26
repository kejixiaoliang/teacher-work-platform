import { callRedeemCode } from '../../services/teacher-data.js';

Page({
  data: { code: '', loading: false, error: '', grants: [] },
  onInput(event) { this.setData({ code: event.detail.value, error: '' }); },
  async loadStatus() { const result = await callRedeemCode({ action: 'status' }); if (result?.ok) this.setData({ grants: result.grants || [] }); },
  onShow() { this.loadStatus(); },
  async redeem() {
    if (!this.data.code.trim()) { this.setData({ error: '请输入兑换码' }); return; }
    this.setData({ loading: true, error: '' });
    try { const result = await callRedeemCode({ action: 'redeem', code: this.data.code }); if (!result?.ok) throw new Error(result?.errors?.[0] || '兑换失败'); this.setData({ loading: false, code: '' }); wx.showToast({ title: '兑换成功', icon: 'success' }); this.loadStatus(); }
    catch (error) { this.setData({ loading: false, error: error?.message || '兑换失败' }); }
  },
});
