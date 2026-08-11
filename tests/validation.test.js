import test from 'node:test';
import assert from 'node:assert/strict';
import { finiteNumber, isDateString, isMonthString, positiveInt, text } from '../server/validation.js';

test('positiveInt only accepts safe positive integer IDs', () => {
  assert.equal(positiveInt('12'), 12);
  assert.equal(positiveInt(12), 12);
  assert.equal(positiveInt('1.2'), null);
  assert.equal(positiveInt('0'), null);
  assert.equal(positiveInt('-1'), null);
  assert.equal(positiveInt('12x'), null);
});

test('finiteNumber rejects NaN, infinity and out-of-range values', () => {
  assert.equal(finiteNumber('96', { min: 0, max: 100 }), 96);
  assert.equal(finiteNumber(''), null);
  assert.equal(finiteNumber('NaN'), null);
  assert.equal(finiteNumber('101', { min: 0, max: 100 }), null);
});

test('date and month validators reject syntactically valid impossible dates', () => {
  assert.equal(isDateString('2026-02-28'), true);
  assert.equal(isDateString('2026-02-30'), false);
  assert.equal(isDateString('2026-13-01'), false);
  assert.equal(isMonthString('2026-08'), true);
  assert.equal(isMonthString('2026-13'), false);
});

test('text trims and enforces a maximum length', () => {
  assert.equal(text('  hello  '), 'hello');
  assert.equal(text('12345', { max: 4 }), null);
});
