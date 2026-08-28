import { callLeaveData, loadTeacherData } from '../../services/teacher-data.js';
import { buildLeaveExchange, copyLeaveExchange, decorateLeaveRecords, exportLeaveCsvFile } from '../../services/leave-export-service.js';

Page({
  data: { datasetId: '', classUuid: '', classIndex: 0, loading: false, saving: false, error: '', classes: [], allStudents: [], students: [], filterStudents: [], types: ['事假', '病假'], filterTypes: ['全部类型', '事假', '病假'], statusOptions: ['待审批', '已批准', '已销假'], statuses: ['全部状态', '待审批', '已批准', '已销假'], records: [], visibleRecords: [], month: '', studentFilter: '', typeFilter: '', statusFilter: '', editing: false, editingUuid: '', formStudentName: '', form: {} },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId });
    if (!datasetId) { this.setData({ error: '请先在设置中导入或选择数据集' }); return; }
    this.loadClasses();
  },

  async loadClasses() {
    this.setData({ loading: true, error: '' });
    const [classes, students] = await Promise.all([
      loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }),
      loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId, limit: 100 }),
    ]);
    if (!classes.ok || !students.ok) { this.setData({ loading: false, error: classes.error || students.error }); return; }
    const classUuid = this.data.classUuid || classes.records[0]?.uuid || '';
    const classIndex = Math.max(0, classes.records.findIndex((item) => item.uuid === classUuid));
    const classStudents = students.records.filter((student) => student.classUuid === classUuid && student.status !== '离校');
    this.setData({ loading: false, classes: classes.records, classIndex, allStudents: students.records, students: classStudents, filterStudents: [{ uuid: '', name: '全部学生' }, ...classStudents], classUuid });
    this.loadRecords(classUuid);
  },

  async loadRecords(classUuid = this.data.classUuid) {
    this.setData({ loading: true, error: '' });
    const result = await callLeaveData({ action: 'query', datasetId: this.data.datasetId, classUuid });
    if (classUuid !== this.data.classUuid) return;
    if (!result?.ok) { this.setData({ loading: false, error: result?.errors?.[0] || '读取请假记录失败' }); return; }
    this.setData({ loading: false, records: decorateLeaveRecords(result.records || [], this.data.students) }); this.applyFilters();
  },

  selectClass(event) { const classIndex = Number(event.detail.value); const classUuid = this.data.classes[classIndex]?.uuid || ''; const students = this.data.allStudents.filter((student) => student.classUuid === classUuid && student.status !== '离校'); this.setData({ classIndex, classUuid, students, filterStudents: [{ uuid: '', name: '全部学生' }, ...students], studentFilter: '', records: [], visibleRecords: [], editing: false, editingUuid: '' }); this.loadRecords(classUuid); },
  openCreate() { const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; const student = this.data.students[0]; this.setData({ editing: true, editingUuid: '', formStudentName: student?.name || '', form: { studentUuid: student?.uuid || '', type: '事假', startDate: today, endDate: today, days: 1, reason: '', status: '已批准', remark: '' } }); },
  edit(event) { const row = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid); if (!row) return; this.setData({ editing: true, editingUuid: row.uuid, formStudentName: row.studentName, form: { studentUuid: row.studentUuid, type: row.type, startDate: row.startDate, endDate: row.endDate, days: row.days, reason: row.reason || '', status: row.status, remark: row.remark || '' } }); },
  onFormInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    const value = field === 'studentUuid'
      ? (this.data.students[index]?.uuid || '')
      : field === 'type'
        ? (this.data.types[index] || '事假')
        : field === 'status'
          ? (this.data.statusOptions[index] || '已批准')
        : event.detail.value;
    this.setData({ [`form.${field}`]: value, ...(field === 'studentUuid' ? { formStudentName: this.data.students[index]?.name || '' } : {}) });
  },
  cancelEdit() { this.setData({ editing: false, editingUuid: '' }); },
  onFilterInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }, () => this.applyFilters()); },
  onFilterPicker(event) { const field = event.currentTarget.dataset.field; const index = Number(event.detail.value); const value = field === 'studentFilter' ? (this.data.filterStudents[index]?.uuid || '') : field === 'typeFilter' ? (this.data.filterTypes[index] === '全部类型' ? '' : this.data.filterTypes[index] || '') : (this.data.statuses[index] === '全部状态' ? '' : this.data.statuses[index] || ''); this.setData({ [field]: value }, () => this.applyFilters()); },
  applyFilters() { const { records, month, studentFilter, typeFilter, statusFilter } = this.data; this.setData({ visibleRecords: records.filter((row) => (!month || String(row.startDate || '').startsWith(month)) && (!studentFilter || row.studentUuid === studentFilter) && (!typeFilter || row.type === typeFilter) && (!statusFilter || row.status === statusFilter)) }); },
  copyExport() { copyLeaveExchange(buildLeaveExchange(this.data.visibleRecords, this.data.students, { datasetId: this.data.datasetId, classUuid: this.data.classUuid })).then(() => wx.showToast({ title: '请假 JSON 已复制', icon: 'success' })).catch(() => wx.showToast({ title: '复制导出失败', icon: 'none' })); },
  async exportCsv() { const cls = this.data.classes[this.data.classIndex] || {}; try { await exportLeaveCsvFile(this.data.visibleRecords, this.data.students, { className: cls.name || '班级' }); } catch (error) { wx.showToast({ title: error?.message || '导出失败', icon: 'none' }); } },

  async save() {
    if (!this.data.form.studentUuid || !this.data.form.startDate) { wx.showToast({ title: '请填写学生和开始日期', icon: 'none' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const editingUuid = this.data.editingUuid; const action = editingUuid ? 'update' : 'create';
      const start = new Date(`${this.data.form.startDate}T00:00:00.000Z`); const end = new Date(`${this.data.form.endDate}T00:00:00.000Z`);
      const days = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) ? Math.floor((end - start) / 86400000) + 1 : 0;
      if (days < 1 || days > 365) throw new Error('请假日期无效或跨度超过 365 天');
      const result = await callLeaveData({ action, datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid: editingUuid || undefined, leave: { ...this.data.form, days } });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存请假失败');
      this.setData({ saving: false, editing: false, editingUuid: '' });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.loadRecords();
    } catch (error) { this.setData({ saving: false, error: error?.message || '保存请假失败' }); }
  },

  async markReturned(event) {
    const record = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid);
    if (!record) return;
    const result = await callLeaveData({ action: 'update', datasetId: this.data.datasetId, classUuid: record.classUuid, uuid: record.uuid, leave: { ...record, status: '已销假' } });
    if (!result?.ok) { wx.showToast({ title: result?.errors?.[0] || '操作失败', icon: 'none' }); return; }
    wx.showToast({ title: '已销假', icon: 'success' });
    this.loadRecords();
  },
  remove(event) { const record = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid); if (!record) return; wx.showModal({ title: '删除请假记录', content: '将同时清理仍为“请假”的联动考勤，手工修改过的考勤会保留。', confirmColor: '#d64541', success: async (modal) => { if (!modal.confirm) return; const result = await callLeaveData({ action: 'delete', datasetId: this.data.datasetId, classUuid: record.classUuid, uuid: record.uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '删除失败', icon: 'none' }); wx.showToast({ title: '已删除', icon: 'success' }); this.loadRecords(); } }); },
});
