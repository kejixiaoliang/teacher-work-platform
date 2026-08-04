$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$batchPath = Join-Path $projectRoot ([string]([char]0x542F) + [char]0x52A8 + '.bat')
$bytes = [System.IO.File]::ReadAllBytes($batchPath)

if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  throw 'Startup batch file must not contain a UTF-8 BOM because cmd.exe treats it as part of the first command.'
}

$nonAscii = $bytes | Where-Object { $_ -gt 0x7F }
if ($nonAscii) {
  throw 'Startup batch file must be ASCII-only so it works independently of the Windows system code page.'
}

$text = [System.Text.Encoding]::ASCII.GetString($bytes)
if (-not $text.StartsWith("@echo off`r`n")) {
  throw 'Startup batch file must start with @echo off and use CRLF line endings.'
}

$withoutCrLf = $text.Replace("`r`n", '')
if ($withoutCrLf.Contains("`n") -or $withoutCrLf.Contains("`r")) {
  throw 'Startup batch file contains mixed or non-CRLF line endings.'
}

if ($text -match '(?im)^\s*timeout(?:\.exe)?\s') {
  throw 'Startup batch file must not use timeout because it fails when standard input is redirected.'
}

if ($text -notmatch "Invoke-WebRequest 'http://127\.0\.0\.1:3210/api/health'") {
  throw 'Startup health checks must use IPv4 because the server listens on 127.0.0.1 and localhost may resolve to IPv6.'
}

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
  if (-not $text.Contains($required)) {
    throw "Startup batch file is missing required Node bootstrap marker: $required"
  }
}

Write-Host 'Startup batch encoding and line-ending checks passed.'
