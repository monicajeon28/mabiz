# Cron Endpoint Test Script
$cron_secret = "gQ7bmWM8+yrTgkN0DEjRUJixfTFLi46rhdfjCdXFJ5Y="
$prod_url = "https://mabizcruisedot.com"

# Test critical Cron endpoints
$endpoints = @(
    "/api/cron/health-check",
    "/api/cron/daily-report",
    "/api/cron/passport-reminder"
)

Write-Host "`n🔄 Cron Endpoint Test" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Target: $prod_url"
Write-Host "Auth: x-cron-secret header"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

$results = @()

foreach ($endpoint in $endpoints) {
    try {
        $url = "$prod_url$endpoint"
        Write-Host "📡 Testing: $endpoint" -ForegroundColor Yellow

        $response = Invoke-WebRequest -Uri $url -Method GET `
            -Headers @{"x-cron-secret" = $cron_secret} `
            -ErrorAction SilentlyContinue

        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Success (200 OK)" -ForegroundColor Green
            $results += @{endpoint=$endpoint; status="200 OK"; success=$true}
        } else {
            Write-Host "   ⚠️  Status: $($response.StatusCode)" -ForegroundColor Yellow
            $results += @{endpoint=$endpoint; status="$($response.StatusCode)"; success=$false}
        }
    } catch {
        Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{endpoint=$endpoint; status="Error"; success=$false}
    }
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Summary: $($results | Where-Object {$_.success} | Measure-Object | Select-Object -ExpandProperty Count) passed, $($results | Where-Object {!$_.success} | Measure-Object | Select-Object -ExpandProperty Count) failed" -ForegroundColor Green
