import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize } = require('../cloudfunctions/class-data/index.js');

test('class data validates scoped create and seat layout fields', () => {
  const result = normalize({ action: 'create', datasetId: 'dataset-1', class: { name: '2025级1班', academicYear: '2025', term: '上', seatRows: 6, seatCols: 8 } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.fields, { name: '2025级1班', academicYear: '2025', term: '上', seatRows: 6, seatCols: 8, aisleMode: 1, headTeacher: '', remark: '' });
});

test('class data rejects missing identity and invalid layouts', () => {
  assert.equal(normalize({ action: 'query' }).code, 'DATASET_REQUIRED');
  assert.equal(normalize({ action: 'update', datasetId: 'dataset-1', class: { name: '1班' } }).code, 'UUID_REQUIRED');
  assert.equal(normalize({ action: 'create', datasetId: 'dataset-1', class: { name: '1班', seatRows: 0, seatCols: 8 } }).code, 'SEAT_LAYOUT_INVALID');
});

test('class settings route and service are registered', async () => {
  const fs = await import('node:fs/promises');
  const app = JSON.parse(await fs.readFile(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
  const settings = await fs.readFile(new URL('../miniprogram/pages/settings/index.js', import.meta.url), 'utf8');
  const service = await fs.readFile(new URL('../miniprogram/services/teacher-data.js', import.meta.url), 'utf8');
  assert.ok(app.pages.includes('pages/class-settings/index'));
  assert.match(settings, /班级设置/);
  assert.match(settings, /openClassSettings/);
  assert.match(service, /callClassData/);
});
