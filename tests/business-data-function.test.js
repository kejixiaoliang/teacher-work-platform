import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const fn = require(path.resolve('cloudfunctions/business-data/index.js'));

test('business data keeps existing client modules in a server-scoped whitelist', () => {
  for (const collection of ['seats', 'seat_layouts', 'duties', 'scores', 'contacts', 'documents', 'assessment_records']) {
    assert.equal(fn.normalize({ collection, action: 'query', datasetId: 'd1' }).ok, true);
  }
  assert.equal(fn.normalize({ collection: 'exams', action: 'query', datasetId: 'd1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'scores', action: 'bulkSave', datasetId: 'd1', classUuid: 'c1', examUuid: 'e1', rows: [{ studentUuid: 's1', subject: '语文', score: 90 }] }).ok, true);
  assert.equal(fn.normalize({ collection: 'scores', action: 'bulkSave', datasetId: 'd1', examUuid: 'e1', rows: [{ studentUuid: 's1', subject: '语文', score: 90 }] }).code, 'CLASS_REQUIRED');
  for (const action of ['autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders']) {
    assert.equal(fn.normalize({ collection: 'duties', action, datasetId: 'd1', classUuid: 'c1' }).ok, true);
  }
  assert.equal(fn.normalize({ collection: 'contacts', action: 'contactStats', datasetId: 'd1', classUuid: 'c1', month: '2026-08' }).ok, true);
  for (const collection of ['assessment_categories', 'assessment_items', 'assessment_revisions']) assert.equal(fn.normalize({ collection, action: 'query', datasetId: 'd1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'assessment_revisions', action: 'history', datasetId: 'd1', recordUuid: 'r1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'assessment_records', action: 'batchAssessment', datasetId: 'd1', classUuid: 'c1', rows: [{ studentUuid: 's1', itemName: '守纪', score: 1 }] }).ok, true);
  assert.equal(fn.normalize({ collection: 'assessment_records', action: 'assessmentStats', datasetId: 'd1', classUuid: 'c1', period: 'monthly', month: '2026-08' }).ok, true);
  assert.equal(fn.normalize({ collection: 'assessment_records', action: 'assessmentStats', datasetId: 'd1', period: 'monthly', month: '2026-08' }).code, 'CLASS_REQUIRED');
  assert.equal(fn.normalize({ collection: 'assessment_records', action: 'restore', datasetId: 'd1', uuid: 'r1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'seat_layouts', action: 'layoutHistory', datasetId: 'd1', classUuid: 'c1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'seat_layouts', action: 'layoutSave', datasetId: 'd1', classUuid: 'c1', layout: { rows: 2, cols: 2, grid: [] } }).ok, true);
  assert.equal(fn.normalize({ collection: 'seats', action: 'create', datasetId: 'd1', record: { row: 0, col: 0 } }).code, 'CLASS_REQUIRED');
  assert.equal(fn.normalize({ collection: 'users', action: 'query', datasetId: 'd1' }).code, 'COLLECTION_NOT_ALLOWED');
});

test('business data strips client ownership metadata before cloud writes', () => {
  const value = fn.sanitize({ ownerId: 'forged', datasetId: 'forged', uuid: 'forged', title: '  家长沟通  ', score: '98' });
  assert.equal(value.ownerId, undefined);
  assert.equal(value.datasetId, undefined);
  assert.equal(value.title, '家长沟通');
  assert.equal(value.score, 98);
});

test('seat layout snapshots preserve optional layout rules with bounded values', () => {
  assert.deepEqual(fn.normalizeLayoutSnapshot({
    rows: 4, cols: 6, aisleMode: 2, podiumLabel: '  主讲台  ', remark: '  月度轮换  ',
    autoOpts: { nearVision: true, gender: false, peerHelp: true, forged: true },
    grid: [{ row: 0, col: 0, studentUuid: 's1', locked: true, ownerId: 'forged' }],
  }), {
    rows: 4, cols: 6, aisleMode: 2, podiumLabel: '主讲台', remark: '月度轮换',
    autoOpts: { nearVision: true, gender: false, peerHelp: true },
    grid: [{ row: 0, col: 0, studentUuid: 's1', locked: true }],
  });
  assert.equal(fn.normalizeLayoutSnapshot({ rows: 0, cols: 6, grid: [] }), null);
  assert.equal(fn.normalizeLayoutSnapshot({ rows: 4, cols: 6, aisleMode: 9, grid: [] }), null);
});

test('seat writes validate class ownership and persist the class scope', () => {
  const source = require('node:fs').readFileSync(path.resolve('cloudfunctions/business-data/index.js'), 'utf8');
  assert.match(source, /request\.collection === 'seats'[\s\S]*CLASS_NOT_FOUND/);
  assert.match(source, /classUuid: request\.classUuid/);
  assert.match(source, /SEAT_POSITION_INVALID/);
  assert.match(source, /STUDENT_NOT_IN_CLASS/);
});

test('assessment batch contract enforces rule linkage and diagnostic skips', () => {
  const source = require('node:fs').readFileSync(path.resolve('cloudfunctions/business-data/index.js'), 'utf8');
  assert.match(source, /request\.itemUuid/);
  assert.match(source, /STUDENT_INVALID/);
  assert.match(source, /DUPLICATE_INPUT/);
  assert.match(source, /DAILY_DUPLICATE/);
  assert.match(source, /return \{ ok: true, action: 'batchAssessment', count, total/);
  assert.match(source, /REVISION_REASON_REQUIRED/);
});

test('analytics summary requires a class and matches desktop student profile metrics', () => {
  assert.equal(fn.normalize({ collection: 'scores', action: 'summary', datasetId: 'd1' }).code, 'CLASS_REQUIRED');
  const summary = fn.buildAnalyticsSummary({
    students: [
      { uuid: 's1', name: '张三', gender: '男', height_cm: 150, vision_left: 4.8, vision_right: 5, is_myopia: true, grade_level: '优', is_boarding: true },
      { uuid: 's2', name: '李四', status: '在读', gender: '女', heightCm: 170 },
      { uuid: 's3', name: '转出学生', status: '转出', height_cm: 190 },
    ],
    scores: [
      { studentUuid: 's1', subject: '语文', score: 80 },
      { studentUuid: 's2', subject: '语文', score: 90 },
      { studentUuid: 's3', subject: '语文', score: 100 },
    ],
    assessmentRecords: [
      { studentUuid: 's1', score: 2 },
      { studentUuid: 's2', score: -1 },
      { studentUuid: 's3', score: 10 },
    ],
  });

  assert.deepEqual(summary.overview, {
    studentCount: 2, myopiaCount: 1, myopiaRate: 50, avgHeight: 160, avgVision: 4.9,
    boardingCount: 1, scoreCount: 2, scoreAverage: 85, performanceCount: 2, performanceTotal: 1,
  });
  assert.equal(summary.height.find((item) => item.label === '150-159').value, 1);
  assert.equal(summary.height.find((item) => item.label === '170-179').value, 1);
  assert.deepEqual(summary.vision, [{ label: '近视', value: 1 }, { label: '未近视', value: 1 }]);
  assert.deepEqual(summary.gender, [{ label: '男生', value: 1 }, { label: '女生', value: 1 }]);
  assert.deepEqual(summary.boarding, [{ label: '住宿', value: 1 }, { label: '走读', value: 1 }]);
  assert.deepEqual(summary.grades, [
    { label: '优', value: 1 }, { label: '良', value: 0 }, { label: '中', value: 0 },
    { label: '待提高', value: 0 }, { label: '未录入', value: 1 },
  ]);
  assert.deepEqual(summary.scoreSubjects, [{ subject: '语文', count: 2, avg: 85, max: 90 }]);
  assert.deepEqual(summary.performance, { positiveCount: 1, negativeCount: 1, zeroCount: 0 });
});

test('analytics pagination reads complete pages and reports a bounded truncation', async () => {
  const all = Array.from({ length: 6 }, (_, index) => ({ index }));
  const query = {
    skip(offset) {
      return { limit: (size) => ({ get: async () => ({ data: all.slice(offset, offset + size) }) }) };
    },
  };
  assert.deepEqual(await fn.getAllRecords(query, { pageSize: 2, max: 10 }), { data: all, truncated: false });
  assert.deepEqual(await fn.getAllRecords(query, { pageSize: 2, max: 5 }), { data: all.slice(0, 5), truncated: true });
});

test('assessment stats match desktop monthly ranking and category summaries', () => {
  const result = fn.buildAssessmentStats({
    period: 'monthly', month: '2026-08',
    students: [{ uuid: 's1', name: '甲', schoolNo: '1' }, { uuid: 's2', name: '乙', school_no: '2' }],
    records: [
      { uuid: 'r1', studentUuid: 's1', date: '2026-08-01', categoryName: '纪律', itemName: '表扬', score: 2, status: 'active' },
      { uuid: 'r2', studentUuid: 's1', date: '2026-08-02', categoryName: '纪律', itemName: '迟到', score: -1, status: 'active' },
      { uuid: 'r3', studentUuid: 's2', date: '2026-07-31', categoryName: '卫生', score: 9, status: 'active' },
      { uuid: 'r4', studentUuid: 's2', date: '2026-08-03', categoryName: '卫生', score: 3, status: 'voided' },
    ],
  });
  assert.deepEqual(result.ranking.map(({ name, positive, negative, net, recordCount, rank }) => ({ name, positive, negative, net, recordCount, rank })), [
    { name: '甲', positive: 2, negative: -1, net: 1, recordCount: 2, rank: 1 },
    { name: '乙', positive: 0, negative: 0, net: 0, recordCount: 0, rank: 2 },
  ]);
  assert.deepEqual(result.categories, [{ categoryName: '纪律', recordCount: 2, positive: 2, negative: -1, net: 1, studentCount: 1 }]);
  assert.equal(result.records[0].studentName, '甲');
});
