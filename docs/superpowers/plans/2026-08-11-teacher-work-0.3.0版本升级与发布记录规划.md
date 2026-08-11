# 2026-08-11 teacher-work 0.3.0 版本升级与发布记录规划 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前继承自已发布 `0.2.0` 的综合完善分支正式升级为产品版本 `0.3.0`，并保证源码、构建门禁、更新日志、README 和便携包版本一致。

**Architecture:** `package.json` 继续作为人工维护的产品版本源，版本契约脚本校验 package、Cargo、Tauri 配置和 Changelog 的当前记录；历史 `v0.2.0` 文档保留为历史发布证据，当前项目入口和新发布记录改为 `v0.3.0`。

**Tech Stack:** Node.js、npm lockfile、Vue 3、Vite、Tauri 2、Rust Cargo、PowerShell portable packaging。

## Global Constraints

- 新产品版本必须统一为精确的 `0.3.0`。
- 历史 `v0.2.0` 发布记录不得被伪造为 `v0.3.0`，历史文档只在明确说明当前版本时更新。
- 版本契约、全量测试、生产构建和便携包 QA 必须全部通过。
- 版本修改与发布记录必须单独提交，便于审查和回滚。

---

### Task 1: 建立版本升级回归测试

**Files:**
- Modify: `tests/version-contract.test.js`
- Modify: `tests/workflow-smoke.test.js`，避免测试数据继续使用易混淆的产品版本名称

- [ ] **Step 1: 将版本契约 fixture 和断言目标切换到 `0.3.0`**
- [ ] **Step 2: 运行 `node --test tests/version-contract.test.js`，确认在源码仍为 `0.2.0` 时失败**
- [ ] **Step 3: 保留对 Cargo、Tauri、Changelog 不一致的失败覆盖**

### Task 2: 同步产品元数据与发布记录

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `web/src/views/Changelog.vue`
- Modify: `README.md`
- Modify: `docs/审计报告-2026-08-11.md`
- Modify: `docs/全面完善实施计划-2026-08-11.md`

- [ ] **Step 1: 将产品版本源和 Tauri 元数据统一为 `0.3.0`**
- [ ] **Step 2: 在 Changelog 顶部新增 `0.3.0` 记录，概括安全、功能、构建优化和依赖修复**
- [ ] **Step 3: 更新 README 的当前稳定版本、下载链接、便携包名称和验证命令；保留 `v0.2.0` 历史版本表述**
- [ ] **Step 4: 在审计与实施文档中说明 `master/v0.2.0` 是基线、当前分支目标为 `v0.3.0`**
- [ ] **Step 5: 运行 `npm run version:check`，确认输出 `产品版本检查通过：0.3.0`**

### Task 3: 构建与便携包验收

**Files:**
- Generated/ignored: `release/教师工作台-v0.3.0-windows-x64-portable.zip`

- [ ] **Step 1: 运行 `npm test` 和 `npm run build`**
- [ ] **Step 2: 运行 `npm run tauri:build` 生成 0.3.0 Release EXE**
- [ ] **Step 3: 运行 `npm run package:portable` 生成 0.3.0 便携包**
- [ ] **Step 4: 运行 `npm run qa:portable -- <0.3.0 ZIP>`，验证首次启动、数据库创建和正常退出**
- [ ] **Step 5: 记录 ZIP SHA-256，并提交源码版本变更与发布文档**
