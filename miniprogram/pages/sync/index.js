import { getSyncStatus } from '../../services/sync-service.js';

Page({
  data: { datasetId: '', loading: false, error: '', status: null, checkedAt: '' },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (datasetId) this.checkStatus(); else this.setData({ error: '请先在设置中导入或选择数据集' }); },
  async checkStatus() { this.setData({ loading: true, error: '' }); try { const status = await getSyncStatus(this.data.datasetId); if (!status?.ok) throw new Error(status?.errors?.[0] || '读取同步状态失败'); this.setData({ loading: false, status, checkedAt: new Date().toLocaleString('zh-CN') }); } catch (error) { this.setData({ loading: false, error: error?.message || '读取同步状态失败' }); } },
});
