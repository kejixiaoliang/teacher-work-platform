import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessmentCsv, buildAssessmentExchange } from '../miniprogram/services/assessment-export-service.js';

test('mobile assessment CSV uses desktop detail columns and prevents formula injection', () => {
  const csv = buildAssessmentCsv([{ date: '2026-08-01', studentName: '=危险', categoryName: '纪律', itemName: '守纪', score: 2, status: 'active', remark: '很好' }]);
  assert.match(csv, /^\uFEFF日期,学生,分类,行为项目,分值,状态,备注/);
  assert.match(csv, /'=危险/);
});

test('mobile assessment JSON keeps scoped filters and summaries', () => {
  const payload = buildAssessmentExchange({ datasetId: 'd1', classUuid: 'c1', period: 'monthly', month: '2026-08', stats: { ranking: [{ name: '甲' }], categories: [], records: [] } });
  assert.equal(payload.format, 'teacher-work-assessment-exchange');
  assert.equal(payload.formatVersion, 1);
  assert.equal(payload.classUuid, 'c1');
  assert.equal(payload.stats.ranking[0].name, '甲');
});
