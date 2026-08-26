import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';
Page({
  data: { datasetId: '', classes: [], classUuid: '', counts: [], loading: false, error: '' },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.load(); },
  async load() { this.setData({ loading: true }); const classes = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId }); if (!classes.ok) return this.setData({ loading: false, error: classes.error }); const classUuid = this.data.classUuid || classes.records[0]?.uuid || ''; const result = await callBusinessData({ action: 'summary', collection: 'scores', datasetId: this.data.datasetId, classUuid }); const labels = { classes: '班级', students: '学生', attendance: '考勤', leaves: '请假', follow_up_tasks: '跟进事项', duties: '值日/班委', contacts: '家校沟通', documents: '文档元数据', exams: '考试', scores: '成绩', assessment_records: '表现记录', seats: '座位' }; const counts = Object.entries(result?.counts || {}).map(([key, value]) => ({ key, label: labels[key] || key, value })); this.setData({ classes: classes.records, classUuid, counts, loading: false, error: result?.ok ? '' : (result?.errors?.[0] || '读取分析数据失败') }); },
  selectClass(event) { const cls = this.data.classes[event.detail.value]; if (!cls) return; this.setData({ classUuid: cls.uuid }); this.load(); },
  refresh() { this.load(); },
});
