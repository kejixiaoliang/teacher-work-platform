# Node.js Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `启动.bat` detect a missing Node.js/npm installation, obtain user consent, install Node.js LTS through winget, and degrade safely to the official download page.

**Architecture:** Keep the distributable entry point as one ASCII-only Windows batch file. Add a bootstrap section before the first npm call and extend the existing PowerShell static regression test to enforce control-flow ordering, consent, exact package identity, and safe fallback behavior.

**Tech Stack:** Windows Batch, Windows PowerShell 5.1-compatible test script, winget, Node.js LTS

## Global Constraints

- `启动.bat` remains ASCII-only, has no UTF-8 BOM, and uses CRLF line endings.
- Automatic installation uses only `winget install --id OpenJS.NodeJS.LTS --exact` with source-agreement flags.
- No software installation occurs without the user entering `Y`.
- A failed or unavailable winget path opens `https://nodejs.org/en/download` and exits without calling npm.
- The post-install check runs once and never enters an installation loop.

---

### Task 1: Specify the Node.js bootstrap contract

**Files:**
- Modify: `scripts/test-startup-bat.ps1:16-34`
- Test: `scripts/test-startup-bat.ps1`

**Interfaces:**
- Consumes: ASCII text loaded from `启动.bat` in `$text`.
- Produces: Static assertions that reject missing or incorrectly ordered Node/npm checks, missing consent, incorrect winget package IDs, and missing manual-download fallbacks.

- [x] **Step 1: Add failing structural assertions**

Add checks that locate these exact markers in `$text` and throw when any marker is absent:

```powershell
$nodeCheck = $text.IndexOf('where node >nul 2>nul')
$npmCheck = $text.IndexOf('where npm >nul 2>nul')
$firstNpmInstall = $text.IndexOf('call npm install --no-audit --no-fund')
if ($nodeCheck -lt 0 -or $npmCheck -lt 0 -or $nodeCheck -gt $firstNpmInstall -or $npmCheck -gt $firstNpmInstall) {
  throw 'Startup batch file must check node and npm before installing project dependencies.'
}

foreach ($required in @(
  'set /p "INSTALL_NODE=Install Node.js LTS now? [Y/N]: "',
  'if /i not "%INSTALL_NODE%"=="Y" goto :node_declined',
  'where winget >nul 2>nul',
  'winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements',
  'https://nodejs.org/en/download',
  ':node_unavailable',
  ':node_declined'
)) {
  if (-not $text.Contains($required)) { throw "Startup batch file is missing required Node bootstrap marker: $required" }
}
```

- [x] **Step 2: Run the regression test and verify RED**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-startup-bat.ps1
```

Expected: FAIL with `Startup batch file must check node and npm before installing project dependencies.`

- [x] **Step 3: Commit the failing contract test**

```powershell
git add scripts/test-startup-bat.ps1
git commit -m "test: define Node.js bootstrap contract"
```

### Task 2: Implement the consent-based Node.js bootstrap

**Files:**
- Modify: `启动.bat:10-11`
- Test: `scripts/test-startup-bat.ps1`

**Interfaces:**
- Consumes: `where node`, `where npm`, user input in `INSTALL_NODE`, and winget exit status.
- Produces: A verified Node/npm command environment before the existing dependency installation block, or a safe exit/manual-download path.

- [x] **Step 1: Insert the bootstrap before dependency installation**

Implement this flow before the existing `rem 1. Install dependencies on first run.` line:

```bat
rem 1. Ensure Node.js and npm are available.
where node >nul 2>nul
if errorlevel 1 goto :offer_node_install
where npm >nul 2>nul
if errorlevel 1 goto :offer_node_install
goto :node_ready

:offer_node_install
echo [Setup] Node.js LTS and npm are required but were not found.
set "INSTALL_NODE="
set /p "INSTALL_NODE=Install Node.js LTS now? [Y/N]: "
if /i not "%INSTALL_NODE%"=="Y" goto :node_declined
where winget >nul 2>nul
if errorlevel 1 goto :node_unavailable
echo [Setup] Installing Node.js LTS with winget...
winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :node_unavailable
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto :node_restart_required
where npm >nul 2>nul
if errorlevel 1 goto :node_restart_required
echo [Setup] Node.js LTS installed successfully.
goto :node_ready

:node_unavailable
echo [Setup] Automatic installation is unavailable or failed.
echo Download Node.js LTS from: https://nodejs.org/en/download
start "" "https://nodejs.org/en/download"
echo Install Node.js LTS, then run this file again.
pause
goto :end

:node_restart_required
echo [Setup] Node.js was installed, but this window cannot see it yet.
echo Close this window and run this file again.
pause
goto :end

:node_declined
echo [Setup] Installation cancelled. Node.js LTS is required to continue.
pause
goto :end

:node_ready
```

Renumber the later comments so dependency installation becomes step 2, build becomes step 3, port checking becomes step 4, and server startup becomes step 5.

- [x] **Step 2: Normalize the batch file encoding and line endings**

Run this mechanical formatter after the patch:

```powershell
$path = Resolve-Path '.\启动.bat'
$content = [IO.File]::ReadAllText($path) -replace "`r?`n", "`r`n"
[IO.File]::WriteAllText($path, $content, [Text.Encoding]::ASCII)
```

- [x] **Step 3: Run the regression test and verify GREEN**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-startup-bat.ps1
```

Expected: PASS with `Startup batch encoding and line-ending checks passed.`

- [x] **Step 4: Verify the already-installed Node.js path with cmd.exe**

Run:

```powershell
cmd.exe /d /c call ".\启动.bat"
```

Expected: Exit code 0, no install consent prompt, no mojibake, and the service reaches its startup output. Check `http://127.0.0.1:3210/api/health` returns HTTP 200, then stop only the PID listening on port 3210 that this verification started.

Execution note: an existing user-owned instance occupied port 3210, so verification exercised the already-running path instead of stopping it. This exposed standard-user access failures in `Get-NetTCPConnection`; the implementation now checks health first and uses `Net.Sockets.TcpClient` for permission-independent port detection. Regression coverage rejects reintroducing `Get-NetTCPConnection`.

- [x] **Step 5: Run build and repository checks**

Run:

```powershell
npm run build
git diff --check
git status --short
```

Expected: Build exit code 0; diff check has no output; only `启动.bat`, `scripts/test-startup-bat.ps1`, and this plan are changed or committed as part of this feature.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- "启动.bat" "scripts/test-startup-bat.ps1" "docs/superpowers/plans/2026-08-04-node-bootstrap.md"
git commit -m "feat: 自动引导安装 Node.js LTS"
```

- [ ] **Step 7: Push safely to the GitHub default branch**

Confirm `git remote show origin` reports `HEAD branch: master`, confirm `origin/master` is an ancestor of `HEAD`, then run:

```powershell
git push origin HEAD:master
```

Expected: A fast-forward update of `origin/master`; no force push.
