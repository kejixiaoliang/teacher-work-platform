import { chooseJsonFile, previewSelectedFile, commitImport } from '../../services/import-service.js';

Page({
  data: {
    loading: false,
    error: '',
    fileName: '',
    preview: null,
    payload: '',
    committed: false,
  },

  async chooseFile() {
    this.setData({ loading: true, error: '' });
    try {
      const file = await chooseJsonFile();
      const previewResponse = await previewSelectedFile(file);
      const preview = previewResponse.result || previewResponse;
      if (!preview.ok) throw new Error(preview.errors?.[0] || '导入预检失败');
      const payload = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
        filePath: file.path,
        encoding: 'utf8',
        success: (result) => resolve(result.data),
        fail: reject,
      }));
      this.setData({ loading: false, fileName: file.name, preview, payload });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '读取导入文件失败' });
    }
  },

  async confirmImport() {
    if (!this.data.payload || !this.data.preview?.datasetId) return;
    this.setData({ loading: true, error: '' });
    try {
      const response = await commitImport({ payload: this.data.payload, datasetId: this.data.preview.datasetId });
      const result = response.result || response;
      if (!result.ok) throw new Error(result.errors?.[0] || '导入失败');
      wx.setStorageSync('activeDatasetId', result.datasetId);
      this.setData({ loading: false, committed: true });
    } catch (error) {
      this.setData({ loading: false, error: error?.message || '提交导入失败' });
    }
  },
});
