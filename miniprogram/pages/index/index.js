import { callAttendanceData, callBusinessData, callFollowUpData, callLeaveData, loadTeacherData } from '../../services/teacher-data.js';

const today = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

Page({
  data: {
    title: '教师工作台',
    loading: false,
    error: '',
    datasetId: '',
    classes: [],
    students: [],
    visibleStudents: [],
    selectedClassUuid: '',
    overview: { attendance: 0, leave: 0, duty: 0, exams: 0, followUp: 0, contacts: 0, documents: 0 },
    overviewDate: '',
  },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId });
    if (!datasetId) {
      this.setData({ error: '请先选择一个云端数据集' });
      return;
    }
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    const classesResult = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId });
    if (!classesResult.ok) {
      this.setData({ loading: false, error: classesResult.error });
      return;
    }
    const studentsResult = await loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId });
    if (!studentsResult.ok) {
      this.setData({ loading: false, classes: classesResult.records, error: studentsResult.error });
      return;
    }
    const selectedClassUuid = this.data.selectedClassUuid || classesResult.records[0]?.uuid || '';
    this.setData({
      loading: false,
      classes: classesResult.records,
      students: studentsResult.records,
      visibleStudents: studentsResult.records.filter((student) => student.classUuid === selectedClassUuid),
      selectedClassUuid,
    });
    this.loadOverview(selectedClassUuid);
  },

  async loadOverview(classUuid) {
    const date = today();
    const requests = [
      callAttendanceData({ action: 'query', datasetId: this.data.datasetId, classUuid, date }),
      callLeaveData({ action: 'query', datasetId: this.data.datasetId, classUuid }),
      callBusinessData({ action: 'query', collection: 'duties', datasetId: this.data.datasetId, classUuid }),
      callBusinessData({ action: 'query', collection: 'exams', datasetId: this.data.datasetId, classUuid }),
      callFollowUpData({ action: 'query', datasetId: this.data.datasetId, classUuid }),
      callBusinessData({ action: 'query', collection: 'contacts', datasetId: this.data.datasetId, classUuid }),
      callBusinessData({ action: 'query', collection: 'documents', datasetId: this.data.datasetId, classUuid }),
    ];
    const results = await Promise.all(requests.map((request) => request.catch(() => ({ ok: false, records: [] }))));
    const rows = results.map((result) => Array.isArray(result?.records) ? result.records : (Array.isArray(result?.rows) ? result.rows : []));
    const [attendance, leaves, duties, exams, followUps, contacts, documents] = rows;
    this.setData({ overviewDate: date, overview: {
      attendance: attendance.filter((item) => item.date === date).length,
      leave: leaves.filter((item) => item.date === date || (item.startDate && item.startDate <= date && (!item.endDate || item.endDate >= date))).length,
      duty: duties.filter((item) => item.date === date || item.role === '值日生').length,
      exams: exams.filter((item) => !item.date || item.date >= date).length,
      followUp: followUps.filter((item) => ['pending', 'in_progress'].includes(item.status)).length,
      contacts: contacts.filter((item) => item.date === date).length,
      documents: documents.length,
    } });
  },

  selectClass(event) {
    const selectedClassUuid = event.currentTarget.dataset.uuid || '';
    this.setData({
      selectedClassUuid,
      visibleStudents: this.data.students.filter((student) => student.classUuid === selectedClassUuid),
    });
    this.loadOverview(selectedClassUuid);
  },

  retry() {
    if (this.data.datasetId) this.loadData();
  },

  openImport() {
    wx.navigateTo({ url: '/pages/import/index' });
  },

  openWorkbench() {
    wx.switchTab({ url: '/pages/workbench/index' });
  },
});
