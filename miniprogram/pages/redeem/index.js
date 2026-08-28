import { callRedeemCode } from '../../services/teacher-data.js';

Page({
  data: { code: '', loading: false, statusLoading: false, error: '', statusError: '', grants: [], history: [], summary: { active: 0, expired: 0, revoked: 0 }, lastUpdated: '' },
  onInput(event) { this.setData({ code: event.detail.value, error: '' }); },
  async loadStatus() { this.setData({ statusLoading: true, statusError: '' }); try { const result = await callRedeemCode({ action: 'status' }); if (!result?.ok) throw new Error(result?.errors?.[0] || '读取授权状态失败'); this.setData({ statusLoading: false, grants: result.grants || [], history: result.history || result.grants || [], summary: result.summary || this.data.summary, lastUpdated: new Date().toLocaleString('zh-CN') }); } catch (error) { this.setData({ statusLoading: false, statusError: error?.message || '读取授权状态失败' }); } },
  onShow() { this.loadStatus(); },
  async redeem() {
    if (!this.data.code.trim()) { this.setData({ error: '请输入兑换码' }); return; }
    this.setData({ loading: true, error: '' });
    try { const result = await callRedeemCode({ action: 'redeem', code: this.data.code }); if (!result?.ok) { const messages = { CODE_USED: '兑换码已经兑换，请勿重复提交', CODE_EXPIRED: '兑换码已过期', CODE_NOT_FOUND: '兑换码不存在或已撤销', AUTH_REQUIRED: '请先完成微信身份授权' }; throw new Error(messages[result.code] || result?.errors?.[0] || '兑换失败'); } this.setData({ loading: false, code: '', error: '' }); wx.showToast({ title: '兑换成功', icon: 'success' }); this.loadStatus(); }
    catch (error) { this.setData({ loading: false, error: error?.message || '兑换失败' }); }
  },
});
