$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "RankRush - cai dependency cho o FAT32" -ForegroundColor Cyan
Write-Host "Thu muc: $repoRoot"

Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue

function Remove-DependencyDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Write-Host "Xoa dependency cu: $Path" -ForegroundColor Yellow
  & cmd.exe /d /c "rd /s /q `"$Path`""

  if (Test-Path -LiteralPath $Path) {
    throw "Khong the xoa $Path. Hay dung npm run dev, dong VS Code va chay lai."
  }
}

function Invoke-NpmInstall {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "`n[$Label]" -ForegroundColor Cyan
  & npm.cmd @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Label that bai voi ma loi $LASTEXITCODE."
  }
}

Remove-DependencyDirectory (Join-Path $repoRoot "node_modules")
Remove-DependencyDirectory (Join-Path $repoRoot "apps/api/node_modules")
Remove-DependencyDirectory (Join-Path $repoRoot "apps/web/node_modules")

Invoke-NpmInstall -Label "ROOT" -Arguments @(
  "install",
  "--workspaces=false",
  "--include=dev",
  "--package-lock=false"
)

Invoke-NpmInstall -Label "API" -Arguments @(
  "install",
  "--prefix",
  "apps/api",
  "--workspaces=false",
  "--include=dev",
  "--package-lock=false"
)

Invoke-NpmInstall -Label "WEB" -Arguments @(
  "install",
  "--prefix",
  "apps/web",
  "--workspaces=false",
  "--include=dev",
  "--package-lock=false"
)

$tsxCommand = Join-Path $repoRoot "apps/api/node_modules/.bin/tsx.cmd"
if (-not (Test-Path -LiteralPath $tsxCommand)) {
  throw "Da cai xong nhung khong tim thay tsx.cmd."
}

Write-Host "`nCai dependency thanh cong." -ForegroundColor Green
Write-Host "Tiep theo chay:"
Write-Host "  docker exec rankrush-redis redis-cli ping"
Write-Host "  npm run admin:setup"
Write-Host "  npm run lint"
Write-Host "  npm test"
Write-Host "  npm run build"
Write-Host "  npm run dev"
