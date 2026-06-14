param (
    [Parameter(Mandatory=$true)]
    [string[]]$FilesToKeep
)

Write-Host "🚀 Начинаю умный откат Git..." -ForegroundColor Cyan

# 1. Запоминаем текущий хэш на всякий случай
$currentHash = git rev-parse HEAD
Write-Host "📍 Текущий коммит: $currentHash"

# 2. Делаем Hard Reset
Write-Host "🔄 Откатываюсь на HEAD~1..." -ForegroundColor Yellow
git reset --hard HEAD~1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при откате!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Возвращаем файлы
Write-Host "📦 Восстанавливаю выбранные файлы из ORIG_HEAD..." -ForegroundColor Yellow
foreach ($file in $FilesToKeep) {
    Write-Host "  -> Восстановление: $file"
    git checkout ORIG_HEAD -- $file
}

Write-Host "✅ Готово! Проект откатан, файлы сохранены." -ForegroundColor Green
Write-Host "💡 Теперь эти файлы находятся в вашем рабочем каталоге как измененные."
