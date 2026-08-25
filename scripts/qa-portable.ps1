param([Parameter(Mandatory=$true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
$chineseName = -join @([char]0x6559,[char]0x5E08,' ',[char]0x5DE5,[char]0x4F5C,[char]0x53F0,' QA')
$qaRoot = Join-Path $env:TEMP $chineseName
if (Test-Path -LiteralPath $qaRoot) { Remove-Item -LiteralPath $qaRoot -Recurse -Force }
New-Item -ItemType Directory -Path $qaRoot | Out-Null
Expand-Archive -LiteralPath (Resolve-Path $ZipPath) -DestinationPath $qaRoot
$exe = Get-ChildItem -LiteralPath $qaRoot -Filter '*.exe' -Recurse | Where-Object { $_.Directory.Name -ne 'runtime' } | Select-Object -First 1
if (-not $exe) { throw 'Portable EXE missing from ZIP' }
$productRoot = $exe.Directory.FullName
$process = Start-Process -FilePath $exe.FullName -WorkingDirectory $productRoot -PassThru
$db = Join-Path $productRoot 'data\teacher.db'
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path -LiteralPath $db) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (-not (Test-Path -LiteralPath $db)) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; throw 'Database was not created beside the EXE' }
$process.Refresh()
$windowDeadline = (Get-Date).AddSeconds(30)
while ($process.MainWindowHandle -eq 0 -and (Get-Date) -lt $windowDeadline) { Start-Sleep -Milliseconds 500; $process.Refresh() }
if ($process.MainWindowHandle -eq 0) { throw 'Main window did not become ready' }
Start-Sleep -Seconds 5
if (-not $process.CloseMainWindow()) { throw 'Unable to request a normal window close' }
if (-not $process.WaitForExit(10000)) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; throw 'Main app did not exit after closing its window' }
Start-Sleep -Seconds 2
$runtimeNode = Join-Path $productRoot 'resources\runtime\node.exe'
$orphan = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $runtimeNode }
if ($orphan) { $orphan | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; throw 'Bundled Node backend remained after normal app exit' }
Write-Host "PASS portable first start: $productRoot"
Write-Host "PASS database created: $db"
Write-Host 'PASS normal exit stopped bundled backend'
