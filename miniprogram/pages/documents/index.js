import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';
const CATEGORIES = ['全部', '教案', '试卷', '课件', '通知', '家长信', '表格模板', '其他'];
Page({
  data: { datasetId: '', classUuid: '', classes: [], records: [], categories: CATEGORIES, category: '全部', keyword: '', editing: false, form: {}, loading: false, saving: false, error: '' },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.loadBase(); },
  async loadBase() { const classes = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }); if (!classes.ok) return this.setData({ error: classes.error }); const cls = classes.records[0] || {}; this.setData({ classes: classes.records, classUuid: cls.uuid }); this.load(); },
  async load() { const result = await callBusinessData({ action: 'query', collection: 'documents', datasetId: this.data.datasetId, classUuid: this.data.classUuid }); let records = result?.records || []; if (this.data.category !== '全部') records = records.filter((item) => item.category === this.data.category || item.tag === this.data.category); if (this.data.keyword) records = records.filter((item) => String(item.name || item.fileName || '').includes(this.data.keyword)); this.setData({ records, error: result?.ok ? '' : (result?.errors?.[0] || '读取文档失败') }); },
  selectClass(event) { const cls = this.data.classes[event.detail.value]; if (!cls) return; this.setData({ classUuid: cls.uuid }); this.load(); },
  selectCategory(event) { this.setData({ category: this.data.categories[event.detail.value] }); this.load(); },
  onKeyword(event) { this.setData({ keyword: event.detail.value }); this.load(); },
  openCreate() { this.setData({ editing: true, form: { name: '', category: '其他', tag: '', remark: '' } }); },
  openEdit(event) { const row = this.data.records[Number(event.currentTarget.dataset.index)]; if (row) this.setData({ editing: true, form: { ...row, name: row.name || row.fileName || '' } }); },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  cancel() { this.setData({ editing: false }); },
  async save() { if (!String(this.data.form.name || '').trim()) return wx.showToast({ title: '请填写文档名称', icon: 'none' }); this.setData({ saving: true }); const input = { collection: 'documents', datasetId: this.data.datasetId, classUuid: this.data.classUuid, record: this.data.form }; const result = this.data.form.uuid ? await callBusinessData({ ...input, action: 'update', uuid: this.data.form.uuid }) : await callBusinessData({ ...input, action: 'create' }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '保存失败', icon: 'none' }); this.setData({ editing: false }); wx.showToast({ title: '已保存元数据', icon: 'success' }); this.load(); },
  async remove(event) { const row = this.data.records[Number(event.currentTarget.dataset.index)]; if (!row) return; const result = await callBusinessData({ action: 'delete', collection: 'documents', datasetId: this.data.datasetId, uuid: row.uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '删除失败', icon: 'none' }); wx.showToast({ title: '已移入回收站', icon: 'success' }); this.load(); },
});
