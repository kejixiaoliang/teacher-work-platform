import { callBusinessData, callFollowUpData, callStudentProfile, loadTeacherData, writeStudentData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', uuid: '', classUuid: '', loading: false, saving: false, error: '', student: null, editing: false, form: {}, metrics: [], records: [], followUpTasks: [], contacts: [], profileType: '', profileEditing: false, profileForm: {} },

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
    if (!student) return this.setData({ loading: false, student: null, error: result.ok ? '未找到该学生' : result.error });
    const classUuid = student.classUuid || '';
    const [metrics, records, followUpTasks, contacts] = await Promise.all([
      callStudentProfile({ action: 'query', collection: 'student_metrics_history', datasetId: this.data.datasetId, classUuid, studentUuid: student.uuid }),
      callStudentProfile({ action: 'query', collection: 'student_records', datasetId: this.data.datasetId, classUuid, studentUuid: student.uuid }),
      callFollowUpData({ action: 'query', datasetId: this.data.datasetId, classUuid, studentUuid: student.uuid }),
      callBusinessData({ action: 'query', collection: 'contacts', datasetId: this.data.datasetId, classUuid, studentUuid: student.uuid }),
    ]);
    this.setData({ loading: false, student, classUuid, form: this.toForm(student), metrics: metrics?.records || [], records: records?.records || [], followUpTasks: followUpTasks?.records || [], contacts: contacts?.records || [], error: result.error || '' });
  },

  toForm(student) {
    return {
      name: student.name || '', schoolNo: student.schoolNo || student.school_no || '', birthDate: student.birthDate || student.birth_date || '',
      gender: student.gender || '', phone: student.phone || '',
      parentPhone: student.parentPhone || student.parent_phone || '', isBoarding: Boolean(student.isBoarding ?? student.is_boarding),
      status: student.status || '在读', followUpStatus: student.followUpStatus || student.follow_up_status || '正常',
      heightCm: student.heightCm ?? student.height_cm ?? '', visionLeft: student.visionLeft ?? student.vision_left ?? '', visionRight: student.visionRight ?? student.vision_right ?? '',
      isMyopia: Boolean(student.isMyopia ?? student.is_myopia), gradeLevel: student.gradeLevel || student.grade_level || '',
      seatNote: student.seatNote || student.seat_note || '', healthNote: student.healthNote || student.health_note || '', interestDuty: student.interestDuty || student.interest_duty || '', remark: student.remark || '',
    };
  },

  startEdit() { this.setData({ editing: true }); },
  cancelEdit() { this.setData({ editing: false, form: this.toForm(this.data.student) }); },
  onFormInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },

  openProfile(event) { this.setData({ profileType: event.currentTarget.dataset.type, profileEditing: true, profileForm: event.currentTarget.dataset.type === 'metric' ? { height_cm: '', vision_left: '', vision_right: '', is_myopia: false, source: '手动测量', date: new Date().toISOString().slice(0, 10) } : { type: '表现', content: '', date: new Date().toISOString().slice(0, 10), remark: '' } }); },
  cancelProfile() { this.setData({ profileEditing: false, profileType: '', profileForm: {} }); },
  onProfileInput(event) { this.setData({ [`profileForm.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onMyopiaChange(event) { this.setData({ 'profileForm.is_myopia': event.detail.value }); },
  async saveProfile() { const type = this.data.profileType; const form = this.data.profileForm; const collection = type === 'metric' ? 'student_metrics_history' : 'student_records'; if (type === 'record' && !String(form.content || '').trim()) return wx.showToast({ title: '请填写成长记录内容', icon: 'none' }); this.setData({ saving: true }); const result = await callStudentProfile({ action: 'create', collection, datasetId: this.data.datasetId, classUuid: this.data.classUuid, studentUuid: this.data.uuid, record: form }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '保存档案记录失败', icon: 'none' }); this.cancelProfile(); await this.loadStudent(); wx.showToast({ title: '档案记录已保存', icon: 'success' }); },
  async removeProfile(event) { const type = event.currentTarget.dataset.type; const collection = type === 'metric' ? 'student_metrics_history' : 'student_records'; const uuid = event.currentTarget.dataset.uuid; const confirmed = await new Promise((resolve) => wx.showModal({ title: '删除档案记录', content: '删除后将移入回收状态，确认继续吗？', success: (result) => resolve(result.confirm) })); if (!confirmed) return; const result = await callStudentProfile({ action: 'delete', collection, datasetId: this.data.datasetId, classUuid: this.data.classUuid, studentUuid: this.data.uuid, uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '删除失败', icon: 'none' }); await this.loadStudent(); wx.showToast({ title: '已删除', icon: 'success' }); },
  openFollowUps() { wx.navigateTo({ url: `/pages/follow-up/index?datasetId=${encodeURIComponent(this.data.datasetId)}&classUuid=${encodeURIComponent(this.data.classUuid)}&studentUuid=${encodeURIComponent(this.data.uuid)}` }); },
  openContacts() { wx.navigateTo({ url: `/pages/contacts/index?datasetId=${encodeURIComponent(this.data.datasetId)}&classUuid=${encodeURIComponent(this.data.classUuid)}&studentUuid=${encodeURIComponent(this.data.uuid)}` }); },

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
