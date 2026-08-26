import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const fn = require(path.resolve('cloudfunctions/business-data/index.js'));

test('business data keeps existing client modules in a server-scoped whitelist', () => {
  for (const collection of ['seats', 'duties', 'scores', 'contacts', 'documents', 'assessment_records']) {
    assert.equal(fn.normalize({ collection, action: 'query', datasetId: 'd1' }).ok, true);
  }
  assert.equal(fn.normalize({ collection: 'exams', action: 'query', datasetId: 'd1' }).ok, true);
  assert.equal(fn.normalize({ collection: 'scores', action: 'bulkSave', datasetId: 'd1', examUuid: 'e1', rows: [{ studentUuid: 's1', subject: '语文', score: 90 }] }).ok, true);
  for (const action of ['autoGroup', 'groupDays', 'presetLeaders', 'presetSubjectLeaders']) {
    assert.equal(fn.normalize({ collection: 'duties', action, datasetId: 'd1', classUuid: 'c1' }).ok, true);
  }
  assert.equal(fn.normalize({ collection: 'users', action: 'query', datasetId: 'd1' }).code, 'COLLECTION_NOT_ALLOWED');
});

test('business data strips client ownership metadata before cloud writes', () => {
  const value = fn.sanitize({ ownerId: 'forged', datasetId: 'forged', uuid: 'forged', title: '  家长沟通  ', score: '98' });
  assert.equal(value.ownerId, undefined);
  assert.equal(value.datasetId, undefined);
  assert.equal(value.title, '家长沟通');
  assert.equal(value.score, 98);
});
