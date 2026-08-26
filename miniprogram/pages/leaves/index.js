import { callLeaveData, loadTeacherData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', classUuid: '', loading: false, saving: false, error: '', classes: [], students: [], types: ['事假', '病假'], records: [], editing: false, form: {} },

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
    this.setData({ loading: false, classes: classes.records, students: students.records, classUuid });
    this.loadRecords(classUuid);
  },

  async loadRecords(classUuid = this.data.classUuid) {
    this.setData({ loading: true, error: '' });
    const result = await callLeaveData({ action: 'query', datasetId: this.data.datasetId, classUuid });
    if (!result?.ok) { this.setData({ loading: false, error: result?.errors?.[0] || '读取请假记录失败' }); return; }
    this.setData({ loading: false, records: result.records || [] });
  },

  selectClass(event) { const classUuid = this.data.classes[event.detail.value]?.uuid || ''; this.setData({ classUuid }); this.loadRecords(classUuid); },
  studentName(uuid) { return this.data.students.find((student) => student.uuid === uuid)?.name || '未命名学生'; },
  openCreate() { this.setData({ editing: true, form: { studentUuid: this.data.students.find((student) => student.classUuid === this.data.classUuid)?.uuid || '', type: '事假', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), days: 1, reason: '', status: '已批准', remark: '' } }); },
  onFormInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    const value = field === 'studentUuid'
      ? (this.data.students[index]?.uuid || '')
      : field === 'type'
        ? (this.data.types[index] || '事假')
        : event.detail.value;
    this.setData({ [`form.${field}`]: value });
  },
  cancelEdit() { this.setData({ editing: false }); },

  async save() {
    if (!this.data.form.studentUuid || !this.data.form.startDate) { wx.showToast({ title: '请填写学生和开始日期', icon: 'none' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const result = await callLeaveData({ action: 'create', datasetId: this.data.datasetId, classUuid: this.data.classUuid, leave: this.data.form });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存请假失败');
      this.setData({ saving: false, editing: false });
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
});
