import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactCsv, decorateContacts } from '../miniprogram/services/contact-export-service.js';

test('contact CSV matches desktop ledger columns and prevents formula injection', () => {
  const rows = decorateContacts([{ studentUuid: 's1', date: '2026-08-01', method: '微信', topic: '=危险', result: '+反馈', remark: '完成' }], [{ uuid: 's1', name: '@学生', schoolNo: '001' }]);
  const csv = buildContactCsv(rows);
  assert.match(csv, /^\ufeff学生,学号,日期,方式,事由,结果\/反馈,备注/);
  assert.match(csv, /'@学生/);
  assert.match(csv, /'=危险/);
  assert.match(csv, /'\+反馈/);
});
