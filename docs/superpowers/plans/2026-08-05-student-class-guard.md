# Student Class Prerequisite Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent users from entering or importing student data before a valid class exists, while preserving form contents if the class becomes unavailable and rejecting orphan records at the API boundary.

**Architecture:** Add database-backed class validation to the two student creation endpoints, then add a small pure frontend policy module consumed by a class-aware empty state and guarded action handlers in `Students.vue`. Backend integration tests prove data integrity, while direct policy tests exercise the same decisions used by the Vue page without adding a browser-test framework.

**Tech Stack:** Vue 3, Element Plus, Vue Router, Express 4, better-sqlite3, Node.js test runner, Tauri v2.

## Global Constraints

- Do not auto-create a default class.
- Do not introduce an unassigned-student pool or local draft persistence.
- Existing student editing remains available because those records already have a class.
- A failed save caused by a missing class must not close or reset the open form.
- Do not change the database schema or migration version.
- Preserve existing portable `data` directories when rebuilding the ZIP.

---

### Task 1: Enforce valid class ownership in the student API

**Files:**
- Create: `tests/student-class-guard.test.js`
- Modify: `server/routes/students.js:67-86,187-232`

**Interfaces:**
- Consumes: `POST /api/classes`, `POST /api/students`, and `POST /api/students/import` through `startServer({ port, apiToken })`.
- Produces: both student creation endpoints return `{ ok: false, error: '请先创建并选择有效班级' }` when `class_id` is absent or does not identify a row in `classes`.

- [ ] **Step 1: Write failing backend integration tests**

Create a temporary data directory, start the real Express server, and assert that missing/unknown class IDs create zero student rows while a student under a newly created class succeeds. Cover both single create and batch import.

```js
test('student creation requires an existing class', async () => {
  const noClass = await post('/api/students', { name: '未分班学生' });
  assert.equal(noClass.ok, false);
  assert.equal(noClass.error, '请先创建并选择有效班级');

  const unknown = await post('/api/students', { name: '错误班级', class_id: 999999 });
  assert.equal(unknown.ok, false);

  const cls = await post('/api/classes', { name: '一班' });
  const valid = await post('/api/students', { name: '正常学生', class_id: cls.data.id });
  assert.equal(valid.ok, true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/student-class-guard.test.js`

Expected: FAIL because the current single-create route inserts `class_id = null`, and import only checks whether an ID is truthy.

- [ ] **Step 3: Add one shared route-level class validator**

Add a focused helper near `FIELDS` and call it before name/duplicate checks or transaction setup:

```js
function hasValidClass(classId) {
  const id = Number(classId);
  return Number.isInteger(id) && id > 0
    && Boolean(db.prepare('SELECT 1 FROM classes WHERE id = ?').get(id));
}
```

When false, return `res.json({ ok: false, error: '请先创建并选择有效班级' })`. Pass `Number(class_id)` only after validation.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/student-class-guard.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit backend integrity protection**

```powershell
git add server/routes/students.js tests/student-class-guard.test.js
git commit -m "fix: require valid class for student creation"
```

### Task 2: Guard student entry points and preserve an interrupted draft

**Files:**
- Create: `web/src/domain/studentClassGuard.js`
- Create: `tests/student-class-ui.test.js`
- Modify: `web/src/views/Students.vue:1-50,400-430,620-636,722-768`

**Interfaces:**
- Consumes: `store.currentClassId`, Vue Router `router.push('/classes')`, hidden `fileInput`, existing `openEdit`, `saveEdit`, and `doImport` flows.
- Produces: `studentClassGuard(classId)` returning `{ canCreate, canImport, entryMessage, saveMessage }`; `openCreateStudent()`, `openStudentImport()`, and `goCreateClass()` handlers; a no-class empty state; disabled create/import buttons with explanatory tooltips; a save guard that leaves `editVisible` and `form` unchanged.

- [ ] **Step 1: Write a failing frontend policy behavior test**

Import the not-yet-created policy module and assert its observable decisions for missing and valid class IDs.

```js
const missing = studentClassGuard(null);
assert.equal(missing.canCreate, false);
assert.equal(missing.canImport, false);
assert.match(missing.saveMessage, /已填写内容会为你保留/);

const valid = studentClassGuard(12);
assert.equal(valid.canCreate, true);
assert.equal(valid.canImport, true);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/student-class-ui.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the policy module does not exist yet.

- [ ] **Step 3: Implement minimal class-aware UI behavior**

Implement `studentClassGuard(classId)` as a pure function, import it into `Students.vue`, and expose a computed `classGuard`. Use Element Plus tooltips around disabled buttons so the reason remains visible. Replace direct entry calls with:

```js
function openCreateStudent() {
  if (!classGuard.value.canCreate) return ElMessage.warning(classGuard.value.entryMessage);
  openEdit();
}
function openStudentImport() {
  if (!classGuard.value.canImport) return ElMessage.warning(classGuard.value.entryMessage);
  fileInput.value?.click();
}
function goCreateClass() {
  router.push('/classes');
}
```

Before constructing the create request in `saveEdit`, add:

```js
if (!f.id && !classGuard.value.canCreate) {
  return ElMessage.warning(classGuard.value.saveMessage);
}
```

Render a dedicated no-class panel instead of the toolbar/table, with the text “学生档案需要归属班级，请先创建班级” and a “前往新建班级” button. Keep edit behavior unchanged.

- [ ] **Step 4: Run frontend contract and build verification**

Run: `node --test tests/student-class-ui.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite exits 0 and produces `web/dist/index.html` with relative asset URLs.

- [ ] **Step 5: Commit the user-facing guard**

```powershell
git add web/src/views/Students.vue tests/student-class-ui.test.js
git commit -m "fix: block student entry until a class exists"
```

### Task 3: Rebuild and verify the portable release

**Files:**
- Modify (generated, ignored): `release/教师工作台-v0.1.0-windows-x64-portable.zip`
- Verify: `scripts/qa-portable.ps1`

**Interfaces:**
- Consumes: the correct Visual Studio 2022 x64 developer environment and `CARGO_TARGET_DIR=C:\tmp\teacher-work-tauri-target`.
- Produces: a replacement portable ZIP whose EXE and bundled backend include Tasks 1-2, without modifying any existing user `data` directory.

- [ ] **Step 1: Run final source verification**

Run: `npm test`

Expected: all tests PASS with zero failures.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 2: Build the Release EXE with MSVC**

```powershell
& cmd.exe /d /s /c 'call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 && set "CARGO_TARGET_DIR=C:\tmp\teacher-work-tauri-target" && npm run tauri:build'
```

Expected: `C:\tmp\teacher-work-tauri-target\release\teacher-work.exe` is rebuilt successfully.

- [ ] **Step 3: Package and execute extracted Release QA**

```powershell
$env:CARGO_TARGET_DIR='C:\tmp\teacher-work-tauri-target'
npm run package:portable
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\qa-portable.ps1 -ZipPath 'release\教师工作台-v0.1.0-windows-x64-portable.zip'
```

Expected: the ZIP is generated; QA reports window startup, sibling database creation, and bundled backend shutdown as PASS.

- [ ] **Step 4: Publish the replacement artifact and checksum**

Copy the ZIP to the main workspace `release` directory, then run:

```powershell
Get-FileHash -Algorithm SHA256 'E:\CodeFile\MyAIProject\Reasonix-test\teacher-work\release\教师工作台-v0.1.0-windows-x64-portable.zip'
```

Expected: one SHA256 value for the delivered archive. Do not copy or delete any `data` directory.

- [ ] **Step 5: Record final branch state**

Run: `git status --short; git log -4 --oneline`

Expected: the feature branch is clean and includes the design, backend guard, and frontend guard commits.
