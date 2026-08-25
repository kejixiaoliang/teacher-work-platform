/**
 * 通用 Excel 导出工具（阶段二 B2）
 * @param {string} sheetName 工作表名
 * @param {string} fileName  下载文件名（不含扩展名）
 * @param {Array<{title:string, key:string, width?:number, render?:(row)=>any}>} cols 列定义
 * @param {Array<any>} rows 数据行
 */
export async function exportExcel(sheetName, fileName, cols, rows) {
  if (!rows.length) throw new Error('当前没有可导出的数据');
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(cols.map(c => c.title));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow(cols.map(c => (c.render ? c.render(r) : r[c.key] ?? '')));
  }
  cols.forEach((c, i) => { if (c.width) ws.getColumn(i + 1).width = c.width; });
  const buf = await wb.xlsx.writeBuffer();
  return saveFileContent(buf, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
import { saveFileContent } from './saveFile.js';
