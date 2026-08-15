param(
  [string]$RemoteUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Preparando repositorio Git..." -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git nao encontrado. Instale o Git for Windows e abra novamente o PowerShell nesta pasta."
}

if (-not (Test-Path -LiteralPath ".git")) {
  git init
}

git branch -M main

$gitName = git config --global user.name
$gitEmail = git config --global user.email

if (-not $gitName -or -not $gitEmail) {
  Write-Host ""
  Write-Host "Configure seu nome e e-mail do Git antes do commit:" -ForegroundColor Yellow
  Write-Host 'git config --global user.name "Seu Nome"'
  Write-Host 'git config --global user.email "seu-email@exemplo.com"'
  throw "Git sem user.name ou user.email global."
}

git add .

Write-Host ""
Write-Host "Arquivos preparados para commit:" -ForegroundColor Cyan
git status --short

$hasChanges = git diff --cached --name-only

if (-not $hasChanges) {
  Write-Host "Nenhuma alteracao para commitar." -ForegroundColor Yellow
} else {
  git commit -m "Publica mapa de clientes MHS"
}

if ($RemoteUrl.Trim()) {
  $existingRemote = git remote

  if ($existingRemote -contains "origin") {
    git remote set-url origin $RemoteUrl
  } else {
    git remote add origin $RemoteUrl
  }

  git push -u origin main
} else {
  Write-Host ""
  Write-Host "Commit criado. Agora adicione o remote e envie:" -ForegroundColor Yellow
  Write-Host 'git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git'
  Write-Host 'git push -u origin main'
}
