import { loadTeacherData } from '../../services/teacher-data.js';

Page({
  data: {
    datasetId: '',
    loading: false,
    error: '',
    keyword: '',
    students: [],
    visibleStudents: [],
  },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId });
    if (!datasetId) {
      this.setData({ error: '请先在设置中导入或选择数据集' });
      return;
    }
    this.loadStudents();
  },

  async loadStudents() {
    this.setData({ loading: true, error: '' });
    const result = await loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId });
    if (!result.ok) {
      this.setData({ loading: false, error: result.error });
      return;
    }
    this.setData({ loading: false, students: result.records, visibleStudents: this.filterStudents(result.records, this.data.keyword) });
  },

  filterStudents(students, keyword) {
    const normalized = String(keyword || '').trim().toLowerCase();
    if (!normalized) return students;
    return students.filter((student) => [student.name, student.schoolNo, student.school_no]
      .some((value) => String(value || '').toLowerCase().includes(normalized)));
  },

  onKeywordInput(event) {
    const keyword = event.detail.value || '';
    this.setData({ keyword, visibleStudents: this.filterStudents(this.data.students, keyword) });
  },

  openDetail(event) {
    const uuid = event.currentTarget.dataset.uuid || '';
    if (!uuid) return;
    wx.navigateTo({ url: `/pages/student-detail/index?datasetId=${encodeURIComponent(this.data.datasetId)}&uuid=${encodeURIComponent(uuid)}` });
  },

  retry() { this.loadStudents(); },
});
