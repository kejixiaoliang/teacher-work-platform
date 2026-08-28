import { exportBackupFile, shareBackupFile } from '../../services/backup-service.js';
import { loadTeacherData } from '../../services/teacher-data.js';

Page({
  data: { datasetId: '', classUuid: '', className: '', classes: [], classIndex: 0, loading: false, error: '', filePath: '', fileName: '', counts: null, attachmentNote: '附件不会包含在小程序备份中；文档仅保留元数据。' },

  onLoad(options) {
    const datasetId = options?.datasetId || wx.getStorageSync('activeDatasetId') || '';
    this.setData({ datasetId });
    if (!datasetId) this.setData({ error: '请先导入或选择数据集' });
    else this.loadClasses();
  },

  async loadClasses() {
    try {
      const result = await loadTeacherData({ collectionName: 'classes', datasetId: this.data.datasetId });
      if (!result.ok) throw new Error(result.error || '读取班级失败');
      const classes = [{ uuid: '', name: '整个数据集' }, ...(result.records || [])];
      this.setData({ classes, classUuid: '', className: classes[0].name, classIndex: 0 });
    } catch (error) { this.setData({ error: error?.message || '读取班级失败' }); }
  },

  selectClass(event) {
    const index = Number(event.detail.value);
    const selected = this.data.classes[index];
    if (selected) this.setData({ classIndex: index, classUuid: selected.uuid || '', className: selected.name || '', filePath: '', fileName: '', counts: null });
  },

  confirm(message) {
    return new Promise((resolve) => wx.showModal({ title: '敏感数据操作确认', content: message, confirmText: '继续', success: (result) => resolve(Boolean(result.confirm)), fail: () => resolve(false) }));
  },

  async exportBackup() {
    if (!this.data.datasetId) return;
    const confirmed = await this.confirm('备份包含学生、成绩、考勤、请假和家校沟通等敏感数据。文件会先写入本机小程序目录，不会自动发送；确定继续吗？');
    if (!confirmed) return;
    this.setData({ loading: true, error: '' });
    try {
      const result = await exportBackupFile({ datasetId: this.data.datasetId, classUuid: this.data.classUuid, className: this.data.className || '教师工作台' });
      this.setData({ loading: false, filePath: result.filePath, fileName: result.fileName, counts: result.counts });
      wx.showToast({ title: '备份文件已生成', icon: 'success' });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '完整备份导出失败' });
    }
  },

  async shareBackup() {
    if (!this.data.filePath) return wx.showToast({ title: '请先生成备份文件', icon: 'none' });
    const confirmed = await this.confirm('分享会把完整敏感备份交给你在微信界面选择的目标。请确认目标可信且符合隐私要求。');
    if (!confirmed) return;
    try {
      await shareBackupFile({ filePath: this.data.filePath, fileName: this.data.fileName });
    } catch (error) {
      this.setData({ error: error?.errMsg || error?.message || '分享备份文件失败' });
    }
  },

  openImport() { wx.navigateTo({ url: '/pages/import/index' }); },
});
