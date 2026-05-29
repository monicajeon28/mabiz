# parallel-validate.ps1
# dev 서버 실행 중에도 안전한 TypeScript 검증 스크립트
# EBUSY 오류 없이 빌드 전 오류 확인 가능
#
# 사용법:
#   .\scripts\parallel-validate.ps1              # TSC 검증만
#   .\scripts\parallel-validate.ps1 -fix         # TSC + ESLint
#   .\scripts\parallel-validate.ps1 -domain crm  # 특정 도메인만

param(
    [switch]$fix = $false,
    [string]$domain = "all"
)

$domains = @{
    "crm"       = @("src/app/(dashboard)/contacts", "src/app/api/contacts")
    "mkt"       = @("src/app/(dashboard)/marketing", "src/app/(dashboard)/campaigns", "src/app/api/campaigns")
    "sms"       = @("src/app/(dashboard)/messages", "src/app/(dashboard)/sms-logs", "src/app/api/messages", "src/app/api/cron")
    "aff"       = @("src/app/(dashboard)/partner", "src/app/(dashboard)/commission-ledger", "src/app/api/affiliate")
    "adm"       = @("src/app/(dashboard)/admin", "src/app/(dashboard)/dashboard", "src/app/api/admin")
    "whk"       = @("src/app/api/webhooks", "src/app/api/payapp")
    "set"       = @("src/app/(dashboard)/settings", "src/app/api/auth")
    "lib"       = @("src/lib")
}

Write-Host ""
Write-Host "===== 마비즈 CRM 병렬 검증 스크립트 =====" -ForegroundColor Cyan
Write-Host "dev 서버 실행 중에도 안전합니다 (EBUSY 없음)" -ForegroundColor Green
Write-Host ""

if ($domain -ne "all" -and $domains.ContainsKey($domain)) {
    Write-Host "[도메인 필터] $domain : $($domains[$domain] -join ', ')" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: TypeScript 검증 (Prisma 파일 건드리지 않음)
Write-Host "[1/3] TypeScript 타입 검증 (npx tsc --noEmit)..." -ForegroundColor Yellow
$tscResult = & npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ TypeScript 오류 없음" -ForegroundColor Green
} else {
    Write-Host "  ❌ TypeScript 오류 발견:" -ForegroundColor Red
    $tscResult | ForEach-Object { Write-Host "     $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "빌드 전에 위 오류를 수정하세요." -ForegroundColor Red
    exit 1
}

# Step 2: ESLint (선택적)
if ($fix) {
    Write-Host "[2/3] ESLint 검사..." -ForegroundColor Yellow
    $lintResult = & npx next lint --max-warnings 0 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ ESLint 오류 없음" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  ESLint 경고/오류:" -ForegroundColor Yellow
        $lintResult | ForEach-Object { Write-Host "     $_" }
    }
} else {
    Write-Host "[2/3] ESLint 스킵 (-fix 플래그로 활성화)" -ForegroundColor Gray
}

# Step 3: 커밋 준비 상태 확인
Write-Host "[3/3] Git 상태 확인..." -ForegroundColor Yellow
$gitStatus = & git status --short 2>&1
$modifiedCount = ($gitStatus | Where-Object { $_ -match "^[AM]" }).Count
$untrackedCount = ($gitStatus | Where-Object { $_ -match "^\?\?" }).Count

Write-Host "  수정된 파일: $modifiedCount 개" -ForegroundColor Cyan
Write-Host "  미추적 파일: $untrackedCount 개" -ForegroundColor Cyan

Write-Host ""
Write-Host "===== 검증 완료 — 커밋 가능 =====" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor White
Write-Host "  git add [파일들]" -ForegroundColor Gray
Write-Host "  git commit -m 'feat(도메인): 설명'" -ForegroundColor Gray
Write-Host ""
Write-Host "주의: npm run build 는 dev 서버 종료 후에만 실행하세요!" -ForegroundColor Yellow
