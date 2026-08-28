import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaveCsv, decorateLeaveRecords } from '../miniprogram/services/leave-export-service.js';

test('leave ledger CSV uses desktop fields and prevents formula injection', () => {
  const records = [{ uuid: 'l1', studentUuid: 's1', type: '病假', startDate: '2026-08-01', endDate: '2026-08-02', days: 2, reason: '=SUM(1,1)', status: '已批准', remark: '复诊' }];
  const csv = buildLeaveCsv(records, [{ uuid: 's1', name: '+危险姓名', schoolNo: '001' }]);
  assert.match(csv, /^\ufeff学生姓名,学号,类型,开始日期,结束日期,天数,事由,状态,备注/);
  assert.match(csv, /'\+危险姓名/);
  assert.match(csv, /'=SUM\(1,1\)/);
});

test('leave records flag overdue unreturned entries without flagging returned ones', () => {
  const rows = decorateLeaveRecords([
    { uuid: 'l1', studentUuid: 's1', endDate: '2026-08-01', status: '已批准' },
    { uuid: 'l2', studentUuid: 's1', endDate: '2026-08-01', status: '已销假' },
  ], [{ uuid: 's1', name: '张三' }], '2026-08-02');
  assert.equal(rows[0].studentName, '张三');
  assert.equal(rows[0].isOverdue, true);
  assert.equal(rows[1].isOverdue, false);
});
