import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const profile = require(path.resolve('cloudfunctions/student-profile/index.js'));
const followUp = require(path.resolve('cloudfunctions/follow-up-data/index.js'));

test('student profile requires dataset, class and student scope', () => {
  assert.equal(profile.normalize({ action: 'query', collection: 'student_records' }).code, 'DATASET_REQUIRED');
  assert.equal(profile.normalize({ action: 'query', collection: 'student_records', datasetId: 'd1', classUuid: 'c1' }).code, 'STUDENT_SCOPE_REQUIRED');
  assert.equal(profile.normalize({ action: 'update', collection: 'student_records', datasetId: 'd1', classUuid: 'c1', studentUuid: 's1' }).code, 'UUID_REQUIRED');
  assert.equal(profile.normalize({ action: 'query', collection: 'users', datasetId: 'd1', classUuid: 'c1', studentUuid: 's1' }).code, 'COLLECTION_NOT_ALLOWED');
});

test('student profile strips ownership and identity fields before writes', () => {
  const value = profile.sanitize({ ownerId: 'forged', datasetId: 'forged', classUuid: 'forged', studentUuid: 'forged', uuid: 'forged', content: '  表现记录  ', height_cm: '168.5', is_myopia: true });
  assert.equal(value.ownerId, undefined);
  assert.equal(value.studentUuid, undefined);
  assert.equal(value.content, '表现记录');
  assert.equal(value.height_cm, 168.5);
  assert.equal(value.is_myopia, true);
});

test('follow-up query accepts an optional student scope', () => {
  const value = followUp.normalizeRequest({ action: 'query', datasetId: 'd1', classUuid: 'c1', studentUuid: 's1', status: 'pending' });
  assert.equal(value.ok, true);
  assert.equal(value.studentUuid, 's1');
  assert.equal(value.status, 'pending');
});
