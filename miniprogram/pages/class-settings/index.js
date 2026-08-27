import { callClassData } from '../../services/teacher-data.js';

const blank = () => ({ name: '', academicYear: '', term: '上', seatRows: 6, seatCols: 8, aisleMode: 1, headTeacher: '', remark: '' });
Page({
  data: { datasetId: '', records: [], form: blank(), editingUuid: '', loading: false, saving: false, error: '' },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.load(); },
  async load() { this.setData({ loading: true, error: '' }); const result = await callClassData({ action: 'query', datasetId: this.data.datasetId }); this.setData({ loading: false, records: result?.records || [], error: result?.ok ? '' : (result?.errors?.[0] || '读取班级失败') }); },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onNumber(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: Number(event.detail.value) }); },
  onTermChange(event) { this.setData({ 'form.term': ['上', '下'][Number(event.detail.value)] || '上' }); },
  openCreate() { this.setData({ editingUuid: '', form: blank() }); },
  edit(event) { const row = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid); if (row) this.setData({ editingUuid: row.uuid, form: { ...blank(), ...row } }); },
  cancel() { this.setData({ editingUuid: '', form: blank() }); },
  async save() { if (!this.data.form.name.trim()) return wx.showToast({ title: '请填写班级名称', icon: 'none' }); this.setData({ saving: true }); const result = await callClassData({ action: this.data.editingUuid ? 'update' : 'create', datasetId: this.data.datasetId, uuid: this.data.editingUuid || undefined, class: this.data.form }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '保存失败', icon: 'none' }); this.cancel(); wx.showToast({ title: '已保存', icon: 'success' }); this.load(); },
  remove(event) { const uuid = event.currentTarget.dataset.uuid; wx.showModal({ title: '删除班级', content: '删除后将不再显示该班级，相关业务数据不会自动恢复。确认继续吗？', confirmColor: '#d64541', success: (modal) => { if (modal.confirm) this.doRemove(uuid); } }); },
  async doRemove(uuid) { const result = await callClassData({ action: 'delete', datasetId: this.data.datasetId, uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '删除失败', icon: 'none' }); wx.showToast({ title: '班级已删除', icon: 'success' }); this.load(); },
});
