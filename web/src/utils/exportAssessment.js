function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function assessmentCsv(rows = [], columns = []) {
  const header = columns.map(column => csvCell(column)).join(',');
  const body = rows.map(row => columns.map(column => csvCell(row?.[column])).join(',')).join('\r\n');
  return `\ufeff${header}${body ? `\r\n${body}` : ''}`;
}

export function assessmentJson(filters = {}, summary = {}, records = [], categorySummary = []) {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    filters,
    summary,
    records,
    categorySummary,
  }, null, 2);
}

export async function downloadAssessmentCsv(rows, columns, filename = '学生表现量化.csv') {
  return saveFileContent(assessmentCsv(rows, columns), filename, { mimeType: 'text/csv;charset=utf-8' });
}

export async function downloadAssessmentJson(filters, summary, records, categorySummary, filename = '学生表现量化.json') {
  return saveFileContent(assessmentJson(filters, summary, records, categorySummary), filename, { mimeType: 'application/json;charset=utf-8' });
}

export async function downloadAssessmentExcel({ summary = {}, records = [], categories = [], filename = '学生表现量化.xlsx' } = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet('统计汇总');
  summarySheet.columns = [
    { header: '学生', key: 'name', width: 14 },
    { header: '加分', key: 'positive', width: 10 },
    { header: '扣分', key: 'negative', width: 10 },
    { header: '净分', key: 'net', width: 10 },
    { header: '记录数', key: 'recordCount', width: 10 },
  ];
  summarySheet.addRows(summary.ranking || []);
  const detailSheet = workbook.addWorksheet('记分明细');
  detailSheet.columns = [
    { header: '日期', key: 'behaviorDate', width: 14 },
    { header: '学生', key: 'student_name', width: 14 },
    { header: '分类', key: 'categoryName', width: 16 },
    { header: '行为项目', key: 'itemName', width: 20 },
    { header: '分值', key: 'score_snapshot', width: 10 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'remark', width: 28 },
  ];
  detailSheet.addRows(records);
  const categorySheet = workbook.addWorksheet('分类汇总');
  categorySheet.columns = [
    { header: '分类', key: 'categoryName', width: 18 },
    { header: '次数', key: 'recordCount', width: 10 },
    { header: '加分', key: 'positive', width: 10 },
    { header: '扣分', key: 'negative', width: 10 },
    { header: '净分', key: 'net', width: 10 },
  ];
  categorySheet.addRows(categories);
  const buffer = await workbook.xlsx.writeBuffer();
  return saveFileContent(buffer, filename, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
import { saveFileContent } from './saveFile.js';
