# DZOFT Windows backup launcher — run interactively on a trusted, encrypted computer.
# This script never stores your Supabase credentials or encryption passphrase.
# It does not use GitHub Actions, public Storage or an unencrypted online archive.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OffsitePath,
  [switch]$NativePostgres,
  [string]$PgHost,
  [string]$PgUser,
  [int]$PgPort = 5432,
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [string]$PgSslRootCert,
  [switch]$SkipStorage
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "backup_dzoft.py"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
  throw "DZOFT backup program was not found next to this Windows launcher."
}
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw "Install Python 3.12+ and cryptography, then try again." }

$local = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'DZOFT-Backups'
$localFull = [System.IO.Path]::GetFullPath($local).TrimEnd('\')
$offsiteFull = [System.IO.Path]::GetFullPath(
  [Environment]::ExpandEnvironmentVariables($OffsitePath)
).TrimEnd('\')
if ($offsiteFull.Equals($localFull,[StringComparison]::OrdinalIgnoreCase) -or
  $offsiteFull.StartsWith(($localFull + '\'),[StringComparison]::OrdinalIgnoreCase)) {
  throw "The destination cannot be the same folder as (or inside) the local backup folder."
}
if ($localFull.StartsWith(($offsiteFull + '\'),[StringComparison]::OrdinalIgnoreCase)) {
  throw "Choose a destination separate from the local backup parent folder."
}
# A backup archive must never be copied to a source-control checkout.
$check = $offsiteFull
while ($check -and (Test-Path -LiteralPath $check)) {
  if (Test-Path -LiteralPath (Join-Path $check '.git')) {
    throw "Refusing to store any private client backup inside a Git repository."
  }
  $parent = Split-Path -Parent $check
  if (-not $parent -or $parent -eq $check) { break }
  $check = $parent
}

New-Item -ItemType Directory -Force -Path $localFull | Out-Null
$before = @{}
Get-ChildItem -LiteralPath $localFull -Filter '*.dzoftbak' -File | ForEach-Object {
  $before[$_.FullName] = $true
}
Write-Host "DZOFT: creating an encrypted, locally verified application-data archive."
Write-Host "You will be asked for your encryption passphrase on this computer. Never send it to GitHub or DZOFT."
if ($NativePostgres) {
  if (-not $PgHost -or -not $PgUser) {
    throw "NativePostgres requires -PgHost and -PgUser from the Supabase Connect panel."
  }
  $native = Join-Path $PSScriptRoot 'backup_dzoft_native.py'
  if (-not (Test-Path -LiteralPath $native -PathType Leaf)) {
    throw "The native PostgreSQL backup program is missing."
  }
  $nativeArgs = @($native, '--host', $PgHost, '--user', $PgUser,
      '--port', [string]$PgPort, '--pg-bin', $PgBin, '--destination', $localFull)
  if ($PgSslRootCert) { $nativeArgs += @('--ssl-root-cert', $PgSslRootCert) }
  if ($SkipStorage) { $nativeArgs += '--skip-storage' }
  & $python.Source @nativeArgs
} else {
  if ($SkipStorage) { throw "-SkipStorage is only supported with -NativePostgres here." }
  & $python.Source $script 'backup' '--destination' $localFull
}
if ($LASTEXITCODE -ne 0) { throw "The encrypted backup failed. No off-site copy was created." }

$newFiles = @(Get-ChildItem -LiteralPath $localFull -Filter '*.dzoftbak' -File |
  Where-Object { -not $before.ContainsKey($_.FullName) })
if ($newFiles.Count -ne 1) {
  throw "Could not uniquely identify the newly generated archive. No off-site copy was created."
}
New-Item -ItemType Directory -Force -Path $offsiteFull | Out-Null
$destination = Join-Path $offsiteFull $newFiles[0].Name
if (Test-Path -LiteralPath $destination) { throw "Destination archive already exists; refusing to overwrite it." }
Copy-Item -LiteralPath $newFiles[0].FullName -Destination $destination -ErrorAction Stop
$localHash = (Get-FileHash -LiteralPath $newFiles[0].FullName -Algorithm SHA256).Hash
$remoteHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
if ($localHash -ne $remoteHash) {
  Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
  throw "The copied archive failed SHA-256 comparison. Copy was discarded."
}
Write-Host "Rechecking the copied encrypted archive. Enter your passphrase again to verify its contents."
& $python.Source $script 'verify' $destination
if ($LASTEXITCODE -ne 0) {
  throw "The copied archive could not be decrypted and verified. Keep the original local backup and investigate the destination."
}
if ([System.IO.Path]::GetPathRoot($localFull).Equals(
    [System.IO.Path]::GetPathRoot($offsiteFull), [StringComparison]::OrdinalIgnoreCase)) {
  Write-Warning "Destination is on the same drive as your local backup. This is NOT independently off-site unless an external sync is confirmed."
}
Write-Host "PASS: encrypted archive was copied and verified at:" -ForegroundColor Green
Write-Host $destination
Write-Host "Important: ensure this destination is genuinely off-site and access-restricted."
Write-Host "A full isolated Supabase Auth / Storage restoration is still NOT verified."
