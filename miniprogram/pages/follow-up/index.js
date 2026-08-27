import { callFollowUpData, loadTeacherData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', classUuid: '', studentUuid: '', loading: false, saving: false, error: '', classes: [], students: [], statuses: ['pending', 'in_progress', 'completed', 'cancelled'], records: [], editing: false, form: {} },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId, studentUuid: options?.studentUuid || '' });
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
    const result = await callFollowUpData({ action: 'query', datasetId: this.data.datasetId, classUuid, studentUuid: this.data.studentUuid });
    if (!result?.ok) { this.setData({ loading: false, error: result?.errors?.[0] || '读取跟进事项失败' }); return; }
    this.setData({ loading: false, records: result.records || [] });
  },
  selectClass(event) { const classUuid = this.data.classes[event.detail.value]?.uuid || ''; this.setData({ classUuid }); this.loadRecords(classUuid); },
  studentName(uuid) { return this.data.students.find((student) => student.uuid === uuid)?.name || '未命名学生'; },
  openCreate() { this.setData({ editing: true, form: { studentUuid: this.data.studentUuid || this.data.students.find((student) => student.classUuid === this.data.classUuid)?.uuid || '', title: '', content: '', dueDate: '', status: 'pending', result: '' } }); },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    const value = field === 'studentUuid' ? (this.data.students[index]?.uuid || '') : this.data.statuses[index] || 'pending';
    this.setData({ [`form.${field}`]: value });
  },
  cancelEdit() { this.setData({ editing: false }); },
  async save() {
    if (!this.data.form.studentUuid || !this.data.form.title) { wx.showToast({ title: '请填写学生和标题', icon: 'none' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const result = await callFollowUpData({ action: 'create', datasetId: this.data.datasetId, classUuid: this.data.classUuid, task: this.data.form });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存跟进事项失败');
      this.setData({ saving: false, editing: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.loadRecords();
    } catch (error) { this.setData({ saving: false, error: error?.message || '保存跟进事项失败' }); }
  },
  async complete(event) {
    const record = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid);
    if (!record) return;
    const result = await callFollowUpData({ action: 'update', datasetId: this.data.datasetId, classUuid: record.classUuid, uuid: record.uuid, task: { ...record, status: 'completed' } });
    if (!result?.ok) { wx.showToast({ title: result?.errors?.[0] || '操作失败', icon: 'none' }); return; }
    wx.showToast({ title: '已完成', icon: 'success' });
    this.loadRecords();
  },
});
