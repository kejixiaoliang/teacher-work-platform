import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['web/src/views/Attendance.vue', 'web/src/views/Scores.vue']) {
  test(`${file} only registers beforeunload guard in browser mode`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /desktopApi\.isTauri\(\)/);
    assert.match(
      source,
      /if \(!desktopApi\.isTauri\(\)\) \{[\s\S]*window\.addEventListener\('beforeunload', beforeUnloadGuard\);[\s\S]*onBeforeUnmount\(\(\) => window\.removeEventListener\('beforeunload', beforeUnloadGuard\)\);[\s\S]*\}/,
    );
  });
}
