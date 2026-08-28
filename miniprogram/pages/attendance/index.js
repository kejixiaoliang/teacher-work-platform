import { callAttendanceData, loadTeacherData } from '../../services/teacher-data.js';

const STATUSES = ['出勤', '迟到', '请假', '缺勤'];

Page({
  data: { datasetId: '', classUuid: '', date: '', month: new Date().toISOString().slice(0, 7), view: 'daily', classes: [], rows: [], monthlyRows: [], loading: false, saving: false, error: '', statuses: STATUSES },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId, date: new Date().toISOString().slice(0, 10) });
    if (!datasetId) { this.setData({ error: '请先在设置中导入或选择数据集' }); return; }
    this.loadClasses();
  },

  async loadClasses() {
    this.setData({ loading: true, error: '' });
    const result = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId });
    if (!result.ok) { this.setData({ loading: false, error: result.error }); return; }
    const classUuid = this.data.classUuid || result.records[0]?.uuid || '';
    this.setData({ loading: false, classes: result.records, classUuid });
    if (classUuid) this.loadRows(classUuid, this.data.date);
  },

  async loadRows(classUuid = this.data.classUuid, date = this.data.date) {
    this.setData({ loading: true, error: '' });
    const students = await loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId, limit: 100 });
    if (!students.ok) { this.setData({ loading: false, error: students.error }); return; }
    const attendance = await callAttendanceData({ action: 'query', datasetId: this.data.datasetId, classUuid, date });
    if (!attendance?.ok) { this.setData({ loading: false, error: attendance?.errors?.[0] || '读取考勤失败' }); return; }
    const saved = new Map((attendance.rows || []).map((row) => [row.studentUuid, row]));
    const rows = students.records.filter((student) => student.classUuid === classUuid).map((student) => { const stored = saved.get(student.uuid); return {
      studentUuid: student.uuid, name: student.name || '未命名学生', schoolNo: student.schoolNo || student.school_no || '', status: stored?.status || '出勤', remark: stored?.remark || '', linkedLeave: Boolean(stored?.leaveUuid) && stored?.status === '请假' && stored?.remark === '请假联动',
    }; });
    this.setData({ loading: false, rows });
  },

  selectClass(event) { const classUuid = this.data.classes[Number(event.detail.value)]?.uuid || ''; this.setData({ classUuid }); this.loadRows(classUuid); },
  onDateChange(event) { const date = event.detail.value; this.setData({ date }); this.loadRows(this.data.classUuid, date); },
  switchView(event) { const view = event.currentTarget.dataset.view; this.setData({ view }); if (view === 'monthly') this.loadMonthly(); else this.loadRows(); },
  onMonthChange(event) { const month = event.detail.value; this.setData({ month }); if (this.data.view === 'monthly') this.loadMonthly(); },
  async loadMonthly() { this.setData({ loading: true, error: '' }); const [result, students] = await Promise.all([callAttendanceData({ action: 'monthlySummary', datasetId: this.data.datasetId, classUuid: this.data.classUuid, month: this.data.month }), loadTeacherData({ collectionName: 'students', datasetId: this.data.datasetId, limit: 100 })]); if (!result?.ok) return this.setData({ loading: false, error: result?.errors?.[0] || '读取月度考勤失败' }); const names = new Map((students.records || []).map((student) => [student.uuid, student.name || '未命名学生'])); this.setData({ loading: false, monthlyRows: (result.rows || []).map((row) => ({ ...row, name: names.get(row.studentUuid) || row.studentUuid })) }); },
  onStatusChange(event) { const index = Number(event.currentTarget.dataset.index); const status = this.data.statuses[event.detail.value]; this.setData({ [`rows[${index}].status`]: status }); },
  onRemarkInput(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ [`rows[${index}].remark`]: event.detail.value }); },
  markAllPresent() { this.setData({ rows: this.data.rows.map((row) => ({ ...row, status: '出勤' })) }); },

  async save() {
    this.setData({ saving: true, error: '' });
    try {
      const result = await callAttendanceData({ action: 'save', datasetId: this.data.datasetId, classUuid: this.data.classUuid, date: this.data.date, rows: this.data.rows });
      if (!result?.ok) throw new Error(result?.errors?.[0] || '保存考勤失败');
      wx.showToast({ title: `已保存 ${result.count} 人`, icon: 'success' });
    } catch (error) { this.setData({ error: error?.message || '保存考勤失败' }); }
    this.setData({ saving: false });
  },
});
