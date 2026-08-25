import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordRecord, verifyPassword, DEFAULT_MODULE_POLICIES, createAccessController } from '../server/access-control.js';

test('password records verify the correct password without exposing plaintext', () => {
  const record = createPasswordRecord('teacher-secret');
  assert.notEqual(record.hash, 'teacher-secret');
  assert.notEqual(record.salt, '');
  assert.equal(verifyPassword('teacher-secret', record), true);
  assert.equal(verifyPassword('wrong-secret', record), false);
});

test('default classroom policies protect sensitive modules', () => {
  assert.equal(DEFAULT_MODULE_POLICIES.scores, 'protected');
  assert.equal(DEFAULT_MODULE_POLICIES.contacts, 'protected');
  assert.equal(DEFAULT_MODULE_POLICIES.attendance, 'open');
  assert.equal(DEFAULT_MODULE_POLICIES.assessment, 'open');
});

test('access controller starts in classroom mode and expires module grants', () => {
  let now = 1_000;
  const controller = createAccessController({ now: () => now });
  assert.equal(controller.getMode(), 'teacher');
  controller.configurePassword('teacher-secret');
  assert.equal(controller.verify('teacher-secret'), true);
  controller.setMode('classroom');
  controller.grantModule('scores');
  assert.equal(controller.isAllowed('scores'), true);
  now += 10 * 60 * 1000 + 1;
  assert.equal(controller.isAllowed('scores'), false);
});

test('access controller automatically locks after inactivity', () => {
  let now = 1_000;
  const controller = createAccessController({ now: () => now });
  controller.configurePassword('teacher-secret');
  controller.setMode('teacher');
  now += 30 * 60 * 1000 + 1;
  assert.equal(controller.getMode(), 'classroom');
});

test('first use starts in teacher mode and classroom mode can be persisted', () => {
  let persisted = {};
  const controller = createAccessController({
    config: persisted,
    onConfigChange: next => { persisted = next; },
  });
  assert.equal(controller.getMode(), 'teacher');
  controller.configurePassword('teacher-secret');
  controller.setMode('classroom');
  assert.equal(persisted.mode, 'classroom');
  const restarted = createAccessController({ config: persisted });
  assert.equal(restarted.getMode(), 'classroom');
  assert.equal(restarted.getSessionState().teacherSession, false);
});

test('password setup returns a one-time recovery key and reset invalidates it', () => {
  const controller = createAccessController();
  const setup = controller.configurePassword('teacher-secret');
  assert.match(setup.recoveryKey, /^[a-f0-9]{32}$/);
  const reset = controller.resetPassword(setup.recoveryKey, 'new-secret');
  assert.match(reset.recoveryKey, /^[a-f0-9]{32}$/);
  assert.equal(controller.verify('new-secret'), true);
  assert.equal(controller.resetPassword(setup.recoveryKey, 'third-secret'), false);
  assert.equal(controller.resetPassword(reset.recoveryKey, 'third-secret').recoveryKey.length, 32);
});

test('changing password requires the current password and returns to classroom mode', () => {
  const controller = createAccessController();
  controller.configurePassword('teacher-secret');
  assert.equal(controller.changePassword('wrong', 'new-secret'), false);
  assert.equal(controller.changePassword('teacher-secret', 'new-secret'), true);
  assert.equal(controller.getMode(), 'classroom');
  assert.equal(controller.verify('new-secret'), true);
});
