param([string]$OutputPath = (Join-Path $PSScriptRoot '..\..\deliverables\LAYA-Staff-Task-V4-2026-11-06.zip'))
$ErrorActionPreference = 'Stop'
$packageRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packageOutput = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $packageOutput) { throw 'Output already exists. Choose a new filename to preserve the checkpoint.' }
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($packageOutput)) | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageZip = [IO.Compression.ZipFile]::Open($packageOutput, [IO.Compression.ZipArchiveMode]::Create)
$packageSkip = @('node_modules', '.git', '.firebase', 'test-results', 'playwright-report')
function Add-PackageDirectory([string]$Directory) {
 foreach ($packageEntry in Get-ChildItem -LiteralPath $Directory -Force) {
  if ($packageEntry.PSIsContainer) {
   if ($packageSkip -notcontains $packageEntry.Name) { Add-PackageDirectory $packageEntry.FullName }
  } else {
   $packageRelative = [IO.Path]::GetRelativePath($packageRoot, $packageEntry.FullName).Replace('\', '/')
   if ($packageEntry.Extension -eq '.log' -and -not $packageRelative.StartsWith('docs/')) { continue }
   if ($packageEntry.Name.StartsWith('.env') -and $packageEntry.Name -ne '.env.example') { continue }
   [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, $packageEntry.FullName, $packageRelative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
 }
}
try { Add-PackageDirectory $packageRoot } finally { $packageZip.Dispose() }
Get-FileHash -LiteralPath $packageOutput -Algorithm SHA256
