import { loadTeacherData } from '../../services/teacher-data.js';

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
  },

  selectClass(event) {
    const selectedClassUuid = event.currentTarget.dataset.uuid || '';
    this.setData({
      selectedClassUuid,
      visibleStudents: this.data.students.filter((student) => student.classUuid === selectedClassUuid),
    });
  },

  retry() {
    if (this.data.datasetId) this.loadData();
  },

  openImport() {
    wx.navigateTo({ url: '/pages/import/index' });
  },
});
