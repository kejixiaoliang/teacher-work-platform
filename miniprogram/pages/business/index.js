import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';

const CONFIG = {
  成绩管理: { collection: 'scores', title: '成绩管理', fields: ['studentUuid', 'subject', 'score', 'remark'] },
  座位管理: { collection: 'seats', title: '座位管理', fields: ['studentUuid', 'row', 'col', 'remark'] },
  值日管理: { collection: 'duties', title: '值日管理', fields: ['studentUuid', 'role', 'groupNo', 'remark'] },
  家校沟通: { collection: 'contacts', title: '家校沟通', fields: ['studentUuid', 'date', 'method', 'topic', 'result', 'remark'] },
  文档管理: { collection: 'documents', title: '文档管理', fields: ['name', 'remark'] },
};

Page({
  data: { datasetId: '', classUuid: '', feature: '', config: {}, classes: [], students: [], records: [], summaryRows: [], loading: false, saving: false, editing: false, error: '', form: {} },
  onLoad(options) { const feature = options?.feature || '数据分析'; const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ feature, datasetId, config: CONFIG[feature] || {} }); if (!datasetId) { this.setData({ error: '请先导入或选择数据集' }); return; } this.loadClasses(); },
  async loadClasses() { this.setData({ loading: true, error: '' }); const result = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }); if (!result.ok) { this.setData({ loading: false, error: result.error }); return; } const classUuid = result.records[0]?.uuid || ''; this.setData({ loading: false, classes: result.records, classUuid }); this.loadData(classUuid); },
  async loadData(classUuid = this.data.classUuid) { this.setData({ loading: true, error: '' }); if (this.data.feature === '数据分析') { const result = await callBusinessData({ action: 'summary', collection: 'scores', datasetId: this.data.datasetId, classUuid }); const counts = result?.counts || {}; this.setData({ loading: false, summaryRows: Object.entries(counts), error: result?.ok ? '' : (result?.errors?.[0] || '读取分析失败') }); return; } const result = await callBusinessData({ action: 'query', collection: this.data.config.collection, datasetId: this.data.datasetId, classUuid }); this.setData({ loading: false, records: result?.records || [], error: result?.ok ? '' : (result?.errors?.[0] || '读取业务记录失败') }); },
  selectClass(event) { const classUuid = this.data.classes[event.detail.value]?.uuid || ''; this.setData({ classUuid }); this.loadData(classUuid); },
  openCreate() { this.setData({ editing: true, form: { date: new Date().toISOString().slice(0, 10) } }); },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  cancelEdit() { this.setData({ editing: false }); },
  async save() { this.setData({ saving: true, error: '' }); try { const result = await callBusinessData({ action: 'create', collection: this.data.config.collection, datasetId: this.data.datasetId, classUuid: this.data.classUuid, record: this.data.form }); if (!result?.ok) throw new Error(result?.errors?.[0] || '保存失败'); this.setData({ saving: false, editing: false }); wx.showToast({ title: '已保存', icon: 'success' }); this.loadData(); } catch (error) { this.setData({ saving: false, error: error?.message || '保存失败' }); } },
  async remove(event) { const uuid = event.currentTarget.dataset.uuid; const result = await callBusinessData({ action: 'delete', collection: this.data.config.collection, datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid }); if (!result?.ok) { wx.showToast({ title: result?.errors?.[0] || '删除失败', icon: 'none' }); return; } this.loadData(); },
});
