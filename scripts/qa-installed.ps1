param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][string]$SignaturePath,
  [Parameter(Mandatory=$true)][string]$ManifestPath,
  [Parameter(Mandatory=$true)][string]$ChecksumsPath,
  [string]$ExecutablePath,
  [switch]$SmokeTest
)
$ErrorActionPreference = 'Stop'

function Assert-NonEmptyFile {
  param([string]$Path, [string]$Label)
  $item = Get-Item -LiteralPath $Path -ErrorAction Stop
  if (-not $item.PSIsContainer -and $item.Length -gt 0) { return $item }
  throw "$Label is missing or empty: $Path"
}

$installer = Assert-NonEmptyFile $InstallerPath 'installer'
$signature = Assert-NonEmptyFile $SignaturePath 'signature'
$manifestFile = Assert-NonEmptyFile $ManifestPath 'update manifest'
$checksumsFile = Assert-NonEmptyFile $ChecksumsPath 'SHA-256 manifest'
$manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$checksums = Get-Content -LiteralPath $checksumsFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$platform = $manifest.platforms.'windows-x86_64'
if (-not $manifest.version -or -not $manifest.notes -or -not $platform) { throw 'latest.json is missing version, notes, or windows-x86_64' }
if ($platform.url -notmatch '^https?://') { throw 'latest.json installer URL must be absolute HTTP' }
if (-not $platform.signature) { throw 'latest.json signature is empty' }
if ($checksums.version -ne $manifest.version) { throw 'SHA-256 manifest version differs from latest.json' }

function Assert-Hash {
  param([string]$Path, $Record, [string]$Label)
  if ($Record.name -ne [System.IO.Path]::GetFileName($Path)) { throw "$Label filename is missing from SHA-256 manifest" }
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Record.sha256) { throw "$Label SHA-256 mismatch" }
  if ((Get-Item -LiteralPath $Path).Length -ne [int64]$Record.size) { throw "$Label file size mismatch" }
}
Assert-Hash $installer.FullName $checksums.files.installer 'installer'
Assert-Hash $signature.FullName $checksums.files.signature 'signature'

if ($SmokeTest) {
  if (-not $ExecutablePath) { throw '-SmokeTest requires -ExecutablePath' }
  Assert-NonEmptyFile $ExecutablePath 'installed executable' | Out-Null
  $previousLocalAppData = $env:LOCALAPPDATA
  $qaLocalAppData = Join-Path $env:TEMP ('TeacherWork-Installed-QA-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $qaLocalAppData | Out-Null
  try {
    $env:LOCALAPPDATA = $qaLocalAppData
    $dataRoot = Join-Path $qaLocalAppData 'TeacherWork'
    $dbPath = Join-Path (Join-Path $dataRoot 'data') 'teacher.db'
    for ($attempt = 1; $attempt -le 2; $attempt++) {
      $process = Start-Process -FilePath (Resolve-Path -LiteralPath $ExecutablePath) -PassThru
      $deadline = (Get-Date).AddSeconds(30)
      while (-not (Test-Path -LiteralPath $dbPath) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
      if (-not (Test-Path -LiteralPath $dbPath)) { throw "installed runtime attempt $attempt did not create the database" }
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
    }
  } finally {
    $env:LOCALAPPDATA = $previousLocalAppData
  }
  Write-Host "PASS installed first start and restart: $qaLocalAppData"
}

Write-Host "PASS installer: $($installer.FullName)"
Write-Host "PASS signature: $($signature.FullName)"
Write-Host "PASS manifest: $($manifestFile.FullName)"
Write-Host "PASS SHA-256: $($checksumsFile.FullName)"
