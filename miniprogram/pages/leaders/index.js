import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';

const ROLES = ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'];

Page({
  data: { datasetId: '', classUuid: '', classIndex: 0, classes: [], allStudents: [], students: [], records: [], roleIndex: 0, studentIndex: 0, remark: '', editingUuid: '', editorOpen: false, loading: false, saving: false, error: '', roles: ROLES },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.loadBase(); },
  async loadBase() {
    this.setData({ loading: true, error: '' });
    const [classes, students] = await Promise.all([loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }), loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId })]);
    const cls = classes.records?.[0];
    if (!classes.ok || !students.ok || !cls) return this.setData({ loading: false, error: classes.error || students.error || '请先创建班级' });
    this.setData({ loading: false, classes: classes.records, classIndex: 0, classUuid: cls.uuid, allStudents: students.records, students: students.records.filter((item) => item.classUuid === cls.uuid && item.status !== '离校') });
    this.loadRecords();
  },
  selectClass(event) { const classIndex = Number(event.detail.value); const cls = this.data.classes[classIndex]; if (!cls) return; this.setData({ classIndex, classUuid: cls.uuid, students: this.data.allStudents.filter((item) => item.classUuid === cls.uuid && item.status !== '离校'), records: [], editingUuid: '', editorOpen: false, studentIndex: 0 }); this.loadRecords(); },
  async loadRecords() { const classUuid = this.data.classUuid; const result = await callBusinessData({ action: 'query', collection: 'duties', datasetId: this.data.datasetId, classUuid }); if (classUuid !== this.data.classUuid) return; const names = new Map(this.data.students.map((item) => [item.uuid, item.name || '未命名学生'])); const records = (result?.records || []).filter((item) => ROLES.includes(item.role)).map((item) => ({ ...item, studentName: names.get(item.studentUuid) || '未命名学生' })); this.setData({ records, error: result?.ok ? '' : (result?.errors?.[0] || '读取班委数据失败') }); },
  onRoleChange(event) { this.setData({ roleIndex: Number(event.detail.value) }); },
  onStudentChange(event) { this.setData({ studentIndex: Number(event.detail.value) }); },
  onRemarkInput(event) { this.setData({ remark: event.detail.value }); },
  openCreate() { this.setData({ editingUuid: '', editorOpen: true, roleIndex: 0, studentIndex: 0, remark: '' }); },
  edit(event) { const row = this.data.records.find((item) => item.uuid === event.currentTarget.dataset.uuid); if (!row) return; this.setData({ editingUuid: row.uuid, editorOpen: true, roleIndex: Math.max(0, ROLES.indexOf(row.role)), studentIndex: Math.max(0, this.data.students.findIndex((item) => item.uuid === row.studentUuid)), remark: row.remark || '' }); },
  cancelEdit() { this.setData({ editingUuid: '', editorOpen: false }); },
  async preset() { await this.runDutyAction('presetLeaders'); },
  async save() {
    const student = this.data.students[this.data.studentIndex]; const role = ROLES[this.data.roleIndex]; const editingUuid = this.data.editingUuid;
    if (!student) return wx.showToast({ title: '请选择学生', icon: 'none' });
    const roleConflict = this.data.records.find((item) => item.uuid !== editingUuid && item.role === role);
    if (roleConflict) return wx.showToast({ title: `职务冲突：${roleConflict.studentName} 已任${role}`, icon: 'none' });
    const studentConflict = this.data.records.find((item) => item.uuid !== editingUuid && item.studentUuid === student.uuid);
    if (studentConflict) return wx.showToast({ title: '人员冲突：每名学生只能担任一个班委职务', icon: 'none' });
    this.setData({ saving: true });
    const result = await callBusinessData({ action: editingUuid ? 'update' : 'create', collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid: editingUuid || undefined, record: { role, studentUuid: student.uuid, gender: student.gender || '', remark: this.data.remark } });
    this.setData({ saving: false });
    if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '保存失败', icon: 'none' });
    this.cancelEdit(); wx.showToast({ title: '已保存', icon: 'success' }); this.loadRecords();
  },
  async remove(event) { const result = await callBusinessData({ action: 'delete', collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid, uuid: event.currentTarget.dataset.uuid }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '解除失败', icon: 'none' }); this.loadRecords(); },
  async runDutyAction(action) { this.setData({ saving: true }); const result = await callBusinessData({ action, collection: 'duties', datasetId: this.data.datasetId, classUuid: this.data.classUuid }); this.setData({ saving: false }); if (!result?.ok) return wx.showToast({ title: result?.errors?.[0] || '操作失败', icon: 'none' }); wx.showToast({ title: `已补齐 ${result.added?.length || 0} 项`, icon: 'success' }); this.loadRecords(); },
});
