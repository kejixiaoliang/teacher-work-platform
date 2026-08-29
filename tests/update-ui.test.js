import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const changelog = fs.readFileSync('web/src/views/Changelog.vue', 'utf8');
const backupApi = fs.readFileSync('web/src/api.js', 'utf8');
const backupRoute = fs.readFileSync('server/routes/backup.js', 'utf8');

test('release page exposes version-aware update controls only for installed runtime', () => {
  assert.match(changelog, /desktopApi\.updater\.checkForUpdate/);
  assert.match(changelog, /desktopApi\.updater\.installUpdate/);
  assert.match(changelog, /runtimeProfile/);
  assert.match(changelog, /installed/);
  assert.match(changelog, /手动升级/);
});

test('update installation requires an explicit confirmation and a pre-update backup', () => {
  assert.match(changelog, /store\.seatsDirty/);
  assert.match(changelog, /ElMessageBox\.confirm/);
  assert.match(changelog, /api\.backup\.snapshot/);
  assert.match(changelog, /pre-update/);
  assert.match(changelog, /onProgress/);
});

test('pre-update snapshot is stored internally with attachments and a safe label', () => {
  assert.match(backupApi, /snapshot:/);
  assert.match(backupRoute, /router\.post\('\/snapshot'/);
  assert.match(backupRoute, /includeAttachments:\s*true/);
  assert.match(backupRoute, /pre-update/);
  assert.match(backupRoute, /label/);
});
