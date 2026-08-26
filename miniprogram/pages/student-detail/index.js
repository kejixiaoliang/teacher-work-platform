import { loadTeacherData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', uuid: '', loading: false, error: '', student: null },

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
    this.setData({ loading: false, student, error: result.ok && !student ? '未找到该学生' : (result.error || '') });
  },
});
