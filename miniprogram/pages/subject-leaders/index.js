import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';

const ROLES = ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];

Page({
  data: { datasetId: '', classUuid: '', students: [], records: [], roleIndex: 0, studentIndex: 0, remark: '', editingUuid: '', loading: false, saving: false, error: '', roles: ROLES },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.loadBase(); },
  async loadBase() { this.setData({ loading: true, error: '' }); const [classes, students] = await Promise.all([loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }), loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId })]); const cls = classes.records?.[0]; if (!classes.ok || !students.ok || !cls) return this.setData({ loading: false, error: classes.error || students.error || '请先创建班级' }); this.setData({ loading: false, classUuid: cls.uuid, students: students.records.filter((item) => item.classUuid === cls.uuid && item.status !== '离校') }); this.loadRecords(); },
  async loadRecords() { const result = await callBusinessData({ action: 'query', collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid }); this.setData({ records: (result?.records || []).filter((item) => item.role && item.role.endsWith('课代表')), error: result?.ok ? '' : (result?.errors?.[0] || '读取课代表数据失败') }); },
  studentName(uuid) { return this.data.students.find((item) => item.uuid === uuid)?.name || '未命名学生'; },
  onRoleChange(event) { this.setData({ roleIndex: Number(event.detail.value) }); },
  onStudentChange(event) { this.setData({ studentIndex: Number(event.detail.value) }); },
  onRemarkInput(event) { this.setData({ remark: event.detail.value }); },
  openCreate() { this.setData({ editingUuid: '', roleIndex: 0, studentIndex: 0, remark: '' }); },
  edit(event) { const row = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid); if (!row) return; this.setData({ editingUuid: row.uuid, roleIndex: Math.max(0, ROLES.indexOf(row.role)), studentIndex: Math.max(0, this.data.students.findIndex((item) => item.uuid === row.studentUuid)), remark: row.remark || '' }); },
  cancelEdit() { this.setData({ editingUuid: '' }); },
  async preset() { await this.runDutyAction('presetSubjectLeaders'); },
  async save() { const student = this.data.students[this.data.studentIndex]; if (!student) return wx.showToast({ title: '请选择学生', icon: 'none' }); this.setData({ saving: true }); const result = await callBusinessData({ action: this.data.editingUuid ? 'update' : 'create', collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid: this.data.editingUuid || undefined, record: { role: ROLES[this.data.roleIndex], studentUuid: student.uuid, gender: student.gender || '', remark: this.data.remark } }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '保存失败', icon: 'none' }); this.cancelEdit(); wx.showToast({ title: '已保存', icon: 'success' }); this.loadRecords(); },
  async remove(event) { const result = await callBusinessData({ action: 'delete', collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid: event.currentTarget.dataset.uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '解除失败', icon: 'none' }); this.loadRecords(); },
  async runDutyAction(action) { this.setData({ saving: true }); const result = await callBusinessData({ action, collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '操作失败', icon: 'none' }); wx.showToast({ title: `已补齐 ${result.added?.length || 0} 项`, icon: 'success' }); this.loadRecords(); },
});
