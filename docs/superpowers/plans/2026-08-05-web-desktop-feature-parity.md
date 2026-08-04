# Web and Desktop Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship version `0.2.0` from one Vue codebase with reliable seat dragging in both browsers and Tauri WebView2, synchronized version metadata, and an evidence-backed Web/EXE parity audit.

**Architecture:** `web/src` remains the only UI and business source. Cross-runtime differences stay in `runtimeConfig`/`desktopApi`; seat movement becomes a pure domain operation driven by Pointer Events instead of HTML5 `dataTransfer`; `package.json.version` is the only manually edited product version and a validation script blocks inconsistent builds.

**Tech Stack:** Vue 3, Element Plus, Pointer Events, Express 4, better-sqlite3, Node.js test runner, Vite 6, Tauri v2, Rust/Cargo, PowerShell Release QA.

## Global Constraints

- Target product version is exactly `0.2.0`.
- Web and EXE must consume the same `web/src` pages, styles, API wrapper, and domain rules.
- Desktop-only behavior belongs only in `web/src/platform`, Rust startup, or packaging code.
- Do not create a second desktop-specific `Seats.vue` or any duplicated business page.
- Preserve click-source/click-target seat movement as a fallback.
- Do not alter database `user_version` merely because the product version changes.
- Do not delete or overwrite any existing user `data` directory.
- Final completion requires Web verification, MSVC Tauri Release build, portable ZIP extraction, and Release UI QA with the Web development server stopped.

---

### Task 1: Make `package.json` the product version authority

**Files:**
- Create: `scripts/version-contract.mjs`
- Create: `tests/version-contract.test.js`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `web/src/views/Changelog.vue`

**Interfaces:**
- Consumes: `package.json.version`, Tauri JSON, Cargo TOML, and release-note metadata.
- Produces: `validateVersionContract(rootDir)` returning `{ version }` or throwing a file-specific mismatch error; CLI exits nonzero on mismatch; product metadata equals `0.2.0`.

- [ ] **Step 1: Write failing version-contract tests**

Create temporary fixture roots containing matching and mismatching metadata. Assert matching `0.2.0` succeeds, a Cargo mismatch fails with `Cargo.toml`, a Tauri mismatch fails with `tauri.conf.json`, and missing `0.2.0` release notes fails with `Changelog.vue`.

```js
const result = validateVersionContract(fixtureRoot);
assert.equal(result.version, '0.2.0');
assert.throws(() => validateVersionContract(badCargoRoot), /Cargo\.toml.*0\.2\.0/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/version-contract.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/version-contract.mjs`.

- [ ] **Step 3: Implement the validator and update version metadata**

Implement a side-effect-free exported validator plus a CLI entry point. Update all three metadata files to `0.2.0`; add the current `0.2.0` release at the beginning of `Changelog.vue`; add `version:check`, make `test` run it after Node tests, and make `tauri:build` run it before Tauri.

```js
export function validateVersionContract(rootDir) {
  const version = readJson('package.json').version;
  if (readJson('src-tauri/tauri.conf.json').version !== version) throw new Error(...);
  if (cargoVersion !== version) throw new Error(...);
  if (!changelog.includes(`version: '${version}'`)) throw new Error(...);
  return { version };
}
```

- [ ] **Step 4: Verify GREEN and product build**

Run: `node --test tests/version-contract.test.js; npm test; npm run build`

Expected: all tests pass, version check prints `0.2.0`, Vite exits 0.

- [ ] **Step 5: Commit in Chinese**

```powershell
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml web/src/views/Changelog.vue scripts/version-contract.mjs tests/version-contract.test.js
git commit -m "构建：统一产品版本为 0.2.0"
```

### Task 2: Extract and test seat movement domain rules

**Files:**
- Create: `web/src/domain/seatMovement.js`
- Create: `tests/seat-movement.test.js`
- Modify: `web/src/views/Seats.vue`

**Interfaces:**
- Consumes: reactive grid entries keyed as `"row,col"` with `studentId`, student display fields, and `locked`.
- Produces: `moveSeatOccupants(grid, sourceKey, targetKey)` returning `{ moved, targetWasEmpty, reason }`; it mutates only occupant fields and never row/column/locked fields.

- [ ] **Step 1: Write failing movement tests**

Cover occupied-to-empty movement, occupied-to-occupied exchange, locked source, locked target, missing keys, empty source, and identical source/target. Assert occupant fields move but `locked`, `row`, and `col` remain attached to physical seats.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/seat-movement.test.js`

Expected: FAIL because `seatMovement.js` does not exist.

- [ ] **Step 3: Implement and integrate the domain function**

Move the existing occupant swap fields into `moveSeatOccupants`. Keep UI messages and `dirty` mutation in `Seats.vue`, based on the returned result. Both click movement and future pointer movement must call the same page-level `moveSeat` wrapper.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/seat-movement.test.js; npm test; npm run build`

Expected: domain cases, full suite, and Vue compilation pass.

- [ ] **Step 5: Commit in Chinese**

```powershell
git add web/src/domain/seatMovement.js web/src/views/Seats.vue tests/seat-movement.test.js
git commit -m "重构：统一座位移动与交换规则"
```

### Task 3: Replace HTML5 seat drag-and-drop with Pointer Events

**Files:**
- Create: `web/src/domain/pointerDrag.js`
- Create: `tests/pointer-drag.test.js`
- Modify: `web/src/views/Seats.vue`

**Interfaces:**
- Consumes: pointer coordinates, pointer ID, source key, a movement threshold of 6 CSS pixels, and target keys discovered from `[data-seat-key]` elements.
- Produces: pure `pointerDistanceExceeded(start, current, threshold)` and `nextPointerDragState(state, event)` helpers; Vue handlers `onSeatPointerDown`, `onSeatPointerMove`, `onSeatPointerUp`, `onSeatPointerCancel`.

- [ ] **Step 1: Write failing pointer-state tests**

Assert movement below 6 px remains a click, movement above 6 px enters dragging, mismatched pointer IDs are ignored, cancel clears source/target, and pointer-up yields the selected source/target before clearing.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/pointer-drag.test.js`

Expected: FAIL because `pointerDrag.js` does not exist.

- [ ] **Step 3: Implement pointer interaction in `Seats.vue`**

Replace `draggable`, `dragstart`, `dragover`, `dragleave`, and `drop` bindings with Pointer Events and `data-seat-key`. Capture the pointer after threshold activation, use `document.elementFromPoint()` to locate the target, add dragging/target CSS, suppress the post-drag click, and clean state on pointer-up, pointer-cancel, mode change, and unmount.

```vue
<div class="seat" :data-seat-key="keyOf(r,c)"
  @pointerdown="onSeatPointerDown($event,r,c)"
  @pointermove="onSeatPointerMove"
  @pointerup="onSeatPointerUp"
  @pointercancel="onSeatPointerCancel">
```

- [ ] **Step 4: Verify automated behavior and compile**

Run: `node --test tests/pointer-drag.test.js; npm test; npm run build`

Expected: pointer tests and full suite pass; no `dataTransfer` seat drag logic remains; Vite exits 0.

- [ ] **Step 5: Commit in Chinese**

```powershell
git add web/src/domain/pointerDrag.js web/src/views/Seats.vue tests/pointer-drag.test.js
git commit -m "修复：统一 Web 与桌面版座位拖拽"
```

### Task 4: Audit shared features and close high-risk runtime gaps

**Files:**
- Create: `docs/web-desktop-feature-parity-v0.2.0.md`
- Modify when evidence requires: `web/src/platform/desktopApi.js`, `web/src/api.js`, affected shared Vue pages, and focused tests under `tests/`.

**Interfaces:**
- Consumes: the module matrix from the approved design, source scan results, Web runtime, and packaged Tauri runtime.
- Produces: a completed matrix recording each operation as pass/fail/not-applicable, evidence, fix commit, and any residual limitation.

- [ ] **Step 1: Perform a read-only cross-runtime risk scan**

Search shared pages for direct `window`, `document`, `File`, drag/drop, download, print, absolute URL, localhost, filesystem path, and Tauri references. Record each occurrence and whether it is shared-safe, adapter-required, or Release-QA-only.

- [ ] **Step 2: Exercise Web API smoke workflows**

With a temporary Web data directory, run or extend integration tests for class/student creation, seat save/reload, attendance, scores, documents, duties, leave/contact operations, backup export/import, and overview reads. Each test asserts persisted API outcomes rather than source strings.

- [ ] **Step 3: Fix only evidence-backed parity defects using TDD**

For every failed operation: add one failing behavior test, verify RED, implement the smallest shared-code or platform-adapter fix, verify GREEN, and record the result in the matrix. Do not create runtime-specific business pages.

- [ ] **Step 4: Verify audit checkpoint**

Run: `npm test; npm run build; npm run version:check`

Expected: all pass; the matrix has no unexplained failed core operation.

- [ ] **Step 5: Commit in Chinese**

```powershell
git add docs/web-desktop-feature-parity-v0.2.0.md web/src tests
git commit -m "质量：完成 Web 与桌面版功能对照检查"
```

### Task 5: Verify Web UI and Windows Release UI

**Files:**
- Modify: `scripts/qa-portable.ps1` only if the current automation cannot observe required stable outcomes.
- Generate (ignored): `release/教师工作台-v0.2.0-windows-x64-portable.zip`

**Interfaces:**
- Consumes: `npm run dev`, MSVC `VsDevCmd.bat`, `CARGO_TARGET_DIR=C:\tmp\teacher-work-tauri-target`, packaging and QA scripts.
- Produces: Web QA evidence, Release EXE QA evidence, portable ZIP, and SHA256.

- [ ] **Step 1: Run fresh source verification**

Run: `npm test; npm run build; npm run version:check`

Expected: zero failures and version `0.2.0`.

- [ ] **Step 2: Run Web UI QA**

Start the Web server with a temporary data directory and Vite, then use browser automation to create a class and two students, assign seats, pointer-drag one student onto the other, save, reload, and verify the swapped arrangement. Sample every remaining matrix module for entry/load/save feedback.

- [ ] **Step 3: Build with the correct MSVC linker**

```powershell
& cmd.exe /d /s /c 'call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 && set "CARGO_TARGET_DIR=C:\tmp\teacher-work-tauri-target" && npm run tauri:build'
```

Expected: `C:\tmp\teacher-work-tauri-target\release\teacher-work.exe` is rebuilt.

- [ ] **Step 4: Package and run extracted Release QA**

Generate the portable ZIP, extract to a Chinese/space path, start with empty data, create the same two-student seat scenario, pointer-drag and save, restart, and confirm persistence. Confirm normal exit stops bundled Node.

- [ ] **Step 5: Publish artifact to the main workspace**

Copy only the `v0.2.0` ZIP to `E:\CodeFile\MyAIProject\Reasonix-test\teacher-work\release`, compute SHA256, and leave all existing `data` directories untouched.

- [ ] **Step 6: Commit any QA script/report updates in Chinese**

```powershell
git add scripts/qa-portable.ps1 docs/web-desktop-feature-parity-v0.2.0.md
git commit -m "发布：完成 0.2.0 双环境验收"
```

### Task 6: Final branch verification and GitHub update

**Files:**
- Verify only: complete tracked tree.

**Interfaces:**
- Consumes: all previous task commits.
- Produces: a clean `codex/tauri-portable` branch pushed to GitHub with Chinese commit records; merge into `master` remains a separate user-approved action.

- [ ] **Step 1: Run final verification**

Run: `npm test; npm run build; npm run version:check; git diff --check; git status --short`

Expected: all commands exit 0 and the tree is clean.

- [ ] **Step 2: Push the current branch**

Run: `git push origin codex/tauri-portable`

Expected: GitHub accepts the commits without force push.

- [ ] **Step 3: Report integration choices**

Report the branch, Chinese commits, Web/EXE verification, ZIP path and checksum, and ask whether to merge locally into `master`, create a PR, or keep the branch.
