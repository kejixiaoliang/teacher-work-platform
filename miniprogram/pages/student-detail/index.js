import { loadTeacherData, writeStudentData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', uuid: '', loading: false, error: '', student: null, editing: false, form: {} },

  onLoad(options) {
    const datasetId = options?.datasetId || '';
    const uuid = options?.uuid || '';
    this.setData({ datasetId, uuid });
    if (!datasetId || !uuid) {
      this.setData({ error: '学生详情参数不完整' });
      return;
    }
    this.loadStudent();
  },

  async loadStudent() {
    this.setData({ loading: true, error: '' });
    const result = await loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId, limit: 100 });
    const student = result.ok ? result.records.find((item) => item.uuid === this.data.uuid) : null;
    this.setData({ loading: false, student, form: student ? this.toForm(student) : {}, error: result.ok && !student ? '未找到该学生' : (result.error || '') });
  },

  toForm(student) {
    return {
      name: student.name || '', schoolNo: student.schoolNo || student.school_no || '',
      gender: student.gender || '', phone: student.phone || '',
      parentPhone: student.parentPhone || student.parent_phone || '', remark: student.remark || '',
    };
  },

  startEdit() { this.setData({ editing: true }); },
  cancelEdit() { this.setData({ editing: false, form: this.toForm(this.data.student) }); },
  onFormInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },

  async saveStudent() {
    if (!this.data.form.name.trim()) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const result = await writeStudentData({ action: 'update', datasetId: this.data.datasetId, uuid: this.data.uuid, student: this.data.form });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存学生失败');
      this.setData({ editing: false });
      await this.loadStudent();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) { this.setData({ loading: false, error: error?.message || '保存学生失败' }); }
  },

  deleteStudent() {
    wx.showModal({
      title: '删除学生', content: `确定将“${this.data.student?.name || ''}”移入回收站吗？`,
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ loading: true, error: '' });
        try {
          const response = await writeStudentData({ action: 'delete', datasetId: this.data.datasetId, uuid: this.data.uuid });
          if (!response?.ok) throw new Error(response?.errors?.[0] || '删除学生失败');
          wx.showToast({ title: '已移入回收站', icon: 'success' });
          setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
        } catch (error) { this.setData({ loading: false, error: error?.message || '删除学生失败' }); }
      },
    });
  },
});
