import { callBusinessData, loadTeacherData } from '../../services/teacher-data.js';
Page({
  data: {
    datasetId: '', classes: [], classUuid: '', currentClassName: '', counts: [], loading: false, error: '', analysisWarning: '',
    overviewCards: [], height: [], vision: [], grades: [], gender: [], boarding: [], scoreSubjects: [], performance: null,
  },
  onLoad(options) { const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || ''; this.setData({ datasetId }); if (!datasetId) return this.setData({ error: '请先导入或选择数据集' }); this.load(); },
  async load() {
    this.setData({ loading: true, error: '', analysisWarning: '' });
    try {
      const classes = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId });
      if (!classes.ok) throw new Error(classes.error || '读取班级失败');
      const classUuid = this.data.classUuid || classes.records[0]?.uuid || '';
      const currentClass = classes.records.find((item) => item.uuid === classUuid);
      if (!classUuid) {
        this.setData({ classes: classes.records, loading: false, error: '请先创建班级' });
        return;
      }
      this.setData({ classes: classes.records, classUuid, currentClassName: currentClass?.name || '未命名班级' });
      const result = await callBusinessData({ action: 'summary', collection: 'scores', datasetId: this.data.datasetId, classUuid });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '读取分析数据失败');
      if (!result.metrics?.overview) throw new Error('数据分析云函数版本过旧，请更新云函数后重试');
      const metrics = result.metrics;
      const overview = metrics.overview || {};
      const truncatedLabels = Object.entries(metrics.limits || {}).filter(([, truncated]) => truncated).map(([key]) => ({ students: '学生', scores: '成绩', assessmentRecords: '表现' }[key] || key));
      const labels = { classes: '班级', students: '学生', duties: '值日/班委', contacts: '家校沟通', documents: '文档元数据', exams: '考试', scores: '成绩', assessment_records: '表现记录', seats: '座位' };
      const counts = Object.entries(result.counts || {}).filter(([key]) => labels[key]).map(([key, value]) => ({ key, label: labels[key], value }));
      this.setData({
        counts,
        analysisWarning: truncatedLabels.length ? `${truncatedLabels.join('、')}记录超过移动端分析上限，当前统计为部分数据` : '',
        overviewCards: [
          { key: 'students', label: '在读人数', value: overview.studentCount ?? 0 },
          { key: 'myopia', label: '近视率', value: `${overview.myopiaRate ?? 0}%` },
          { key: 'height', label: '平均身高', value: overview.avgHeight == null ? '—' : `${overview.avgHeight}cm` },
          { key: 'vision', label: '平均视力（较差眼）', value: overview.avgVision ?? '—' },
          { key: 'boarding', label: '住宿人数', value: overview.boardingCount ?? 0 },
        ],
        height: metrics.height || [], vision: metrics.vision || [], grades: metrics.grades || [],
        gender: metrics.gender || [], boarding: metrics.boarding || [], scoreSubjects: metrics.scoreSubjects || [],
        performance: { ...(metrics.performance || { positiveCount: 0, negativeCount: 0, zeroCount: 0 }), count: overview.performanceCount ?? 0, total: overview.performanceTotal ?? 0 },
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false, overviewCards: [], counts: [], analysisWarning: '', error: error?.message || '读取分析数据失败' });
    }
  },
  selectClass(event) { const cls = this.data.classes[Number(event.detail.value)]; if (!cls) return; this.setData({ classUuid: cls.uuid, currentClassName: cls.name || '未命名班级', overviewCards: [], counts: [], analysisWarning: '' }, () => this.load()); },
  refresh() { this.load(); },
});
