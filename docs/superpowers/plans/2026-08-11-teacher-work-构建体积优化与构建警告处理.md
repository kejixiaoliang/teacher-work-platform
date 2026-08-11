# 2026-08-11 teacher-work 构建体积优化与构建警告处理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有教学工作流的前提下，降低首屏与业务页面 JavaScript 包体积，并处理可安全处理的 Rollup 构建警告。

**Architecture:** 保留当前 Vite 的功能分包策略，将仅在 Excel 导入/导出流程使用的 ExcelJS 从静态依赖改为按需动态加载；Element Plus 先保持稳定的全局注册，避免一次性引入按需组件插件导致大范围回归。对 VueUse 的第三方注释警告只做精确过滤，不修改依赖源码。

**Tech Stack:** Vue 3、Vite 6、Rollup、Element Plus、ExcelJS、Node.js test runner。

## Global Constraints

- 不改变 API、数据库结构、导入导出格式或用户可见业务流程。
- 每个独立改动必须先有回归测试，再实现、验证并提交。
- 依赖漏洞修复必须保持 `npm audit --omit=dev --audit-level=moderate` 为 0 vulnerabilities。
- 不通过单纯提高 `chunkSizeWarningLimit` 掩盖真实包体积问题。
- 构建必须继续生成相对路径资源和 `.gz` 静态资源。

---

### Task 1: ExcelJS 按需动态加载

**Files:**
- Modify: `web/src/views/Scores.vue`，仅在成绩导入函数内动态加载 ExcelJS
- Modify: `web/src/views/Students.vue`，仅在学生导入/导出函数内动态加载 ExcelJS
- Modify: `web/src/utils/exportExcel.js`，将 ExcelJS 改为函数内动态导入
- Test: `tests/exceljs-loading.test.js`

**Interfaces:**
- Produces: `loadExcelJS()`，返回 `Promise<typeof import('exceljs')>`，所有调用方继续使用 `new ExcelJS.Workbook()`。

- [ ] **Step 1: Write the failing static regression test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ExcelJS is loaded on demand instead of in the initial bundle', () => {
  for (const file of ['web/src/views/Scores.vue', 'web/src/views/Students.vue', 'web/src/utils/exportExcel.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /^import ExcelJS from ['"]exceljs['"];?$/m, file);
    assert.match(source, /import\(['"]exceljs['"]\)/, file);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/exceljs-loading.test.js`

Expected: FAIL because the three files currently statically import ExcelJS.

- [ ] **Step 3: Implement the minimal dynamic-loading changes**

Use this helper in each affected module or central utility:

```js
async function loadExcelJS() {
  const mod = await import('exceljs');
  return mod.default || mod;
}
```

Inside each existing import/export function, replace the static constructor use with:

```js
const ExcelJS = await loadExcelJS();
const wb = new ExcelJS.Workbook();
```

Preserve existing error handling and messages.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/exceljs-loading.test.js`, `npm test`, `npm run build`

Expected: all tests pass; the build contains a separately loaded ExcelJS chunk and no initial static import remains.

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Scores.vue web/src/views/Students.vue web/src/utils/exportExcel.js tests/exceljs-loading.test.js
git commit -m "性能：按需加载 ExcelJS"
```

### Task 2: 精确处理 VueUse Rollup 注释警告

**Files:**
- Modify: `vite.config.js`，增加仅匹配 `@vueuse/core` 的 `INVALID_ANNOTATION` 过滤
- Test: `tests/build-config.test.js`

**Interfaces:**
- Produces: Rollup `onwarn` 过滤器；其他 warning 仍交给默认 Rollup handler。

- [ ] **Step 1: Write the failing configuration test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('build config filters only the known VueUse annotation warning', () => {
  const source = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(source, /INVALID_ANNOTATION/);
  assert.match(source, /@vueuse\/core/);
  assert.match(source, /warn\(warning\)/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/build-config.test.js`

Expected: FAIL because the Vite config has no `onwarn` filter.

- [ ] **Step 3: Implement the narrow warning filter**

Add under `rollupOptions`:

```js
onwarn(warning, warn) {
  if (warning.code === 'INVALID_ANNOTATION' && warning.message?.includes('@vueuse/core')) return;
  warn(warning);
},
```

Do not suppress chunk-size warnings or unrelated warnings.

- [ ] **Step 4: Run verification**

Run: `node --test tests/build-config.test.js`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=moderate`

Expected: tests/build/audit pass; only legitimate chunk-size warnings remain until Task 3.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js tests/build-config.test.js
git commit -m "构建：过滤 VueUse 无害 Rollup 注释警告"
```

### Task 3: 构建结果评估与交付记录

**Files:**
- Modify: `docs/审计报告-2026-08-11.md`，补充优化前后构建结果与未处理项
- Modify: `docs/全面完善实施计划-2026-08-11.md`，标记安全与构建优化进度

- [ ] **Step 1: Capture build artifact sizes**

Run: `npm run build` and record the largest chunks before and after Task 1.

- [ ] **Step 2: Confirm no functional regression**

Run: `npm test` and `npm audit --omit=dev --audit-level=moderate`.

- [ ] **Step 3: Document remaining trade-offs**

Record that Element Plus remains globally registered for compatibility, ECharts is already modularized, and chunk-size warnings are informational if the affected chunks are lazy-loaded.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/审计报告-2026-08-11.md docs/全面完善实施计划-2026-08-11.md
git commit -m "文档：记录构建体积优化结果"
```
