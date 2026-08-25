import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('desktop save-file command is exposed through the Tauri bridge', () => {
  const desktopApi = read('web/src/platform/desktopApi.js');
  const rust = read('src-tauri/src/lib.rs');
  assert.match(desktopApi, /saveFile/);
  assert.match(desktopApi, /invoke\('save_file'/);
  assert.match(rust, /#\[tauri::command\]\s*fn save_file/);
  assert.match(rust, /desktop_bootstrap, save_file/);
});

test('all generated downloads use the shared save-file utility', () => {
  const files = [
    'web/src/views/Overview.vue', 'web/src/views/Classes.vue', 'web/src/views/Students.vue',
    'web/src/views/Documents.vue', 'web/src/utils/exportExcel.js', 'web/src/utils/exportAssessment.js',
  ];
  for (const file of files) assert.match(read(file), /saveFileContent/ , file);
  assert.match(read('web/src/utils/saveFile.js'), /desktopApi\.saveFile/);
});

test('assessment exports await the save operation so a chosen path is honored', () => {
  const assessment = read('web/src/views/Assessment.vue');
  const exporter = read('web/src/utils/exportAssessment.js');
  assert.match(assessment, /await\s+downloadAssessment/);
  assert.match(exporter, /(?:await\s+|return\s+)saveFileContent/);
});
