import { listStudentData, loadTeacherData, writeStudentData } from '../../services/teacher-data.js';
import { copyStudentRoster } from '../../services/student-export-service.js';
import {
  buildStudentImportRequest,
  chooseStudentRosterFile,
  mergeStudentImportResult,
  previewStudentRosterFile,
} from '../../services/student-import-service.js';

Page({
  data: {
    datasetId: '', classUuid: '', currentClassName: '', classes: [],
    loading: false,
    error: '',
    keyword: '',
    filters: { gender: '', status: '', myopia: '', boarding: '', followUpStatus: '' },
    filterOptions: {
      gender: ['全部性别', '男', '女'],
      status: ['全部状态', '在读', '转出', '休学'],
      myopia: ['全部近视', '是', '否'],
      boarding: ['全部住宿', '是', '否'],
      followUpStatus: ['全部跟进', '正常', '需关注', '跟进中', '已处理'],
    },
    students: [],
    visibleStudents: [],
    trashed: false,
    selectedUuids: [],
    importFileName: '',
    importPreview: null,
    importResult: null,
    editing: false,
    form: { name: '', schoolNo: '', gender: '', phone: '', parentPhone: '', birthDate: '', status: '在读', followUpStatus: '正常', isMyopia: false, isBoarding: false, heightCm: '', visionLeft: '', visionRight: '', gradeLevel: '', seatNote: '', healthNote: '', interestDuty: '', remark: '' },
  },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId });
    if (!datasetId) {
      this.setData({ error: '请先在设置中导入或选择数据集' });
      return;
    }
    this.loadClasses();
  },

  async loadClasses() {
    const result = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId });
    if (!result.ok) { this.setData({ error: result.error }); return; }
    const classUuid = this.data.classUuid || result.records[0]?.uuid || '';
    this.setData({ classes: result.records, classUuid, currentClassName: result.records.find((item) => item.uuid === classUuid)?.name || '未命名班级' }, () => this.loadStudents());
  },

  async loadStudents() {
    this.setData({ loading: true, error: '' });
    const result = await listStudentData({ datasetId: this.data.datasetId, classUuid: this.data.classUuid, trashed: this.data.trashed });
    if (!result.ok) {
      this.setData({ loading: false, error: result.error });
      return;
    }
    this.setData({ loading: false, selectedUuids: [], students: result.records, visibleStudents: this.filterStudents(result.records, this.data.keyword, this.data.filters) });
  },

  filterStudents(students, keyword, filters = this.data.filters) {
    const normalized = String(keyword || '').trim().toLowerCase();
    return students.filter((student) => {
      const matchesKeyword = !normalized || [student.name, student.schoolNo, student.school_no]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
      const gender = student.gender || '';
      const status = student.status || '在读';
      const myopia = Boolean(student.isMyopia ?? student.is_myopia);
      const boarding = Boolean(student.isBoarding ?? student.is_boarding);
      const followUpStatus = student.followUpStatus || student.follow_up_status || '正常';
      return matchesKeyword
        && (!filters.gender || gender === filters.gender)
        && (!filters.status || status === filters.status)
        && (!filters.myopia || (filters.myopia === 'yes' ? myopia : !myopia))
        && (!filters.boarding || (filters.boarding === 'yes' ? boarding : !boarding))
        && (!filters.followUpStatus || followUpStatus === filters.followUpStatus);
    });
  },

  onKeywordInput(event) {
    const keyword = event.detail.value || '';
    this.setData({ keyword, visibleStudents: this.filterStudents(this.data.students, keyword, this.data.filters) });
  },

  onFilterChange(event) {
    const field = event.currentTarget.dataset.field;
    const options = {
      gender: ['', '男', '女'],
      status: ['', '在读', '转出', '休学'],
      myopia: ['', 'yes', 'no'],
      boarding: ['', 'yes', 'no'],
      followUpStatus: ['', '正常', '需关注', '跟进中', '已处理'],
    };
    const value = options[field]?.[Number(event.detail.value)] || '';
    const filters = { ...this.data.filters, [field]: value };
    this.setData({ filters, visibleStudents: this.filterStudents(this.data.students, this.data.keyword, filters) });
  },

  clearFilters() {
    const filters = { gender: '', status: '', myopia: '', boarding: '', followUpStatus: '' };
    this.setData({ filters, visibleStudents: this.filterStudents(this.data.students, this.data.keyword, filters) });
  },

  onClassChange(event) {
    const cls = this.data.classes[Number(event.detail.value)];
    if (!cls) return;
    this.setData({ classUuid: cls.uuid, currentClassName: cls.name || '未命名班级' }, () => this.loadStudents());
  },

  toggleTrash() { this.setData({ trashed: !this.data.trashed, editing: false }, () => this.loadStudents()); },

  onSelectionChange(event) { this.setData({ selectedUuids: event.detail.value || [] }); },

  async deleteStudent(event) {
    const uuid = event.currentTarget.dataset.uuid || '';
    const student = this.data.students.find((item) => item.uuid === uuid);
    const confirmed = await new Promise((resolve) => wx.showModal({ title: '移入回收站', content: `确定移入「${student?.name || '该学生'}」？`, success: (result) => resolve(result.confirm) }));
    if (confirmed) await this.runStudentAction({ action: 'delete', uuid });
  },

  async restoreSelected() { await this.runStudentAction({ action: 'restore', uuids: this.data.selectedUuids }); },
  async purgeSelected() {
    const confirmed = await new Promise((resolve) => wx.showModal({ title: '彻底删除', content: '彻底删除后无法恢复，确定继续？', success: (result) => resolve(result.confirm) }));
    if (confirmed) await this.runStudentAction({ action: 'purge', uuids: this.data.selectedUuids });
  },
  async runStudentAction(action) {
    const uuids = action.uuids || [];
    if (['restore', 'purge'].includes(action.action) && !uuids.length) { wx.showToast({ title: '请先选择学生', icon: 'none' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const result = await writeStudentData({ ...action, datasetId: this.data.datasetId });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '操作失败');
      wx.showToast({ title: action.action === 'delete' ? '已移入回收站' : '操作完成', icon: 'success' });
      await this.loadStudents();
    } catch (error) { this.setData({ loading: false, error: error?.message || '操作失败' }); }
  },

  async exportStudents() {
    this.setData({ loading: true, error: '' });
    try {
      await copyStudentRoster(this.data.visibleStudents, { datasetId: this.data.datasetId });
      this.setData({ loading: false });
      wx.showToast({ title: '名单已复制', icon: 'success' });
    } catch (error) { this.setData({ loading: false, error: error?.message || '导出学生名单失败' }); }
  },

  async chooseImportFile() {
    if (!this.data.classUuid) {
      wx.showToast({ title: '请先选择班级', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: '', importResult: null });
    try {
      const file = await chooseStudentRosterFile();
      const preview = await previewStudentRosterFile(file, this.data.students);
      this.setData({ loading: false, importFileName: file.name || '学生名单', importPreview: preview });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '读取学生名单失败' });
    }
  },

  cancelStudentImport() {
    this.setData({ importFileName: '', importPreview: null, importResult: null });
  },

  async confirmStudentImport() {
    const preview = this.data.importPreview;
    if (!preview?.rows?.length) return;
    this.setData({ loading: true, error: '', importResult: null });
    try {
      const request = buildStudentImportRequest({
        datasetId: this.data.datasetId,
        classUuid: this.data.classUuid,
        rows: preview.rows,
      });
      const response = await writeStudentData(request);
      if (!response?.ok) throw new Error(response?.errors?.[0] || '导入学生失败');
      const importResult = mergeStudentImportResult({ total: preview.total, localFails: preview.fails, response });
      this.setData({ loading: false, importResult });
      await this.loadStudents();
      wx.showToast({ title: `成功导入 ${importResult.counts.success} 人`, icon: 'success' });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '导入学生失败' });
    }
  },

  openDetail(event) {
    const uuid = event.currentTarget.dataset.uuid || '';
    if (!uuid) return;
    wx.navigateTo({ url: `/pages/student-detail/index?datasetId=${encodeURIComponent(this.data.datasetId)}&uuid=${encodeURIComponent(uuid)}` });
  },

  openCreate() {
    this.setData({ editing: true, form: { name: '', schoolNo: '', gender: '', phone: '', parentPhone: '', birthDate: '', status: '在读', followUpStatus: '正常', isMyopia: false, isBoarding: false, heightCm: '', visionLeft: '', visionRight: '', gradeLevel: '', seatNote: '', healthNote: '', interestDuty: '', remark: '' } });
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  onFormPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const ranges = {
      gender: ['男', '女'],
      status: ['在读', '转出', '休学'],
      followUpStatus: ['正常', '需关注', '跟进中', '已处理'],
      gradeLevel: ['优', '良', '中', '待提高'],
    };
    const value = ranges[field]?.[Number(event.detail.value)] || '';
    this.setData({ [`form.${field}`]: value });
  },

  onFormSwitch(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: Boolean(event.detail.value) });
  },

  cancelEdit() { this.setData({ editing: false }); },

  async saveStudent() {
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const result = await writeStudentData({ action: 'create', datasetId: this.data.datasetId, classUuid: this.data.classUuid, student: this.data.form });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存学生失败');
      this.setData({ editing: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.loadStudents();
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '保存学生失败' });
    }
  },

  retry() { this.loadStudents(); },
});
