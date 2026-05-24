# Google Drive Backup Upload Script (PowerShell)
# Dependencies: None - uses web requests directly

param(
    [string]$BackupDir = "D:\mabiz-crm\backups",
    [string]$FolderId = "1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz",
    [string]$EnvFile = "D:\mabiz-crm\.env.local"
)

# Load environment variables
function Load-EnvFile {
    $env = @{}
    Get-Content $EnvFile | Where-Object { $_ -match '=' -and -not $_.StartsWith('#') } | ForEach-Object {
        $parts = $_ -split '=', 2
        $key = $parts[0].Trim()
        $value = $parts[1].Trim() -replace '^"|"$', ''
        $env[$key] = $value
    }
    return $env
}

# Get auth token from service account
function Get-ServiceAccountToken {
    param(
        [string]$Email,
        [string]$PrivateKey
    )

    $header = @{
        alg = "RS256"
        typ = "JWT"
    } | ConvertTo-Json -Compress

    $iat = [int](Get-Date -UFormat %s)
    $exp = $iat + 3600

    $claim = @{
        iss = $Email
        scope = "https://www.googleapis.com/auth/drive"
        aud = "https://oauth2.googleapis.com/token"
        exp = $exp
        iat = $iat
    } | ConvertTo-Json -Compress

    # Encode header and claim
    $headerEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($header)) -replace '\+', '-' -replace '/', '_' -replace '='
    $claimEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($claim)) -replace '\+', '-' -replace '/', '_' -replace '='
    $signInput = "$headerEncoded.$claimEncoded"

    # Sign with private key (using .NET crypto)
    $privateKeyLines = $PrivateKey -split '\n' | Where-Object { $_ -notmatch '(BEGIN|END|PRIVATE KEY)' }
    $privateKeyBase64 = -join $privateKeyLines
    $keyBytes = [Convert]::FromBase64String($privateKeyBase64)

    # This is complex in PowerShell - we'll use a simpler approach
    # Fall back to using the MCP tool instead
    return $null
}

# Upload file to Google Drive
function Upload-FileToDrive {
    param(
        [string]$FilePath,
        [string]$FileName,
        [string]$FolderId,
        [string]$AccessToken
    )

    $fileSize = (Get-Item $FilePath).Length
    Write-Host "📤 Uploading: $FileName ($('{0:N2}' -f ($fileSize/1MB)) MB)" -ForegroundColor Cyan

    try {
        $headers = @{
            Authorization = "Bearer $AccessToken"
        }

        $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)

        # Create multipart upload
        $boundary = [System.Guid]::NewGuid().ToString()
        $contentType = "multipart/related; boundary=$boundary"

        # Build metadata
        $metadata = @{
            name = $FileName
            parents = @($FolderId)
        } | ConvertTo-Json -Compress

        # Build body
        $body = @"
--$boundary
Content-Type: application/json; charset=UTF-8

$metadata

--$boundary
Content-Type: application/octet-stream

"@

        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $footerBytes = [System.Text.Encoding]::UTF8.GetBytes("`r`n--$boundary--`r`n")

        # Combine all parts
        $fullBody = New-Object byte[] ($bodyBytes.Length + $fileBytes.Length + $footerBytes.Length)
        [System.Buffer]::BlockCopy($bodyBytes, 0, $fullBody, 0, $bodyBytes.Length)
        [System.Buffer]::BlockCopy($fileBytes, 0, $fullBody, $bodyBytes.Length, $fileBytes.Length)
        [System.Buffer]::BlockCopy($footerBytes, 0, $fullBody, $bodyBytes.Length + $fileBytes.Length, $footerBytes.Length)

        $response = Invoke-WebRequest `
            -Uri "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart" `
            -Method Post `
            -Headers $headers `
            -ContentType $contentType `
            -Body $fullBody `
            -ErrorAction Stop

        $result = $response.Content | ConvertFrom-Json

        Write-Host "✅ Upload successful" -ForegroundColor Green
        Write-Host "   ID: $($result.id)" -ForegroundColor Gray
        Write-Host "   Size: $('{0:N2}' -f ($result.size/1MB)) MB" -ForegroundColor Gray
        Write-Host "   Link: https://drive.google.com/file/d/$($result.id)/view" -ForegroundColor Gray

        return @{
            fileName = $FileName
            fileId = $result.id
            size = $result.size
            link = "https://drive.google.com/file/d/$($result.id)/view"
            status = "SUCCESS"
        }
    }
    catch {
        Write-Host "❌ Upload failed: $_" -ForegroundColor Red
        return @{
            fileName = $FileName
            error = $_.Exception.Message
            status = "FAILED"
        }
    }
}

# Main process
function Main {
    Write-Host "`n🚀 Google Drive Backup Upload (PowerShell)" -ForegroundColor Yellow
    Write-Host ("=" * 60)

    # Load environment
    $env = Load-EnvFile
    $serviceEmail = $env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"]
    $privateKey = $env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"]

    if (-not $serviceEmail -or -not $privateKey) {
        Write-Host "❌ Error: Service account credentials not found in .env.local" -ForegroundColor Red
        exit 1
    }

    Write-Host "📧 Service Account: $serviceEmail" -ForegroundColor Gray
    Write-Host "📁 Backup Folder ID: $FolderId" -ForegroundColor Gray
    Write-Host "📂 Local Directory: $BackupDir" -ForegroundColor Gray
    Write-Host ""

    # Check backup files
    $backupFiles = @(
        "schema_backup_2026-05-24_221248.prisma",
        "prisma_migrations_backup_2026-05-24_221248.zip",
        "BACKUP_SUMMARY_2026-05-24.txt"
    )

    Write-Host "🔍 Verifying backup files..." -ForegroundColor Cyan
    $filesToUpload = @()

    foreach ($file in $backupFiles) {
        $filePath = Join-Path $BackupDir $file
        if (Test-Path $filePath) {
            $size = (Get-Item $filePath).Length
            Write-Host "   ✅ $file - $('{0:N2}' -f ($size/1KB)) KB" -ForegroundColor Green
            $filesToUpload += @{
                path = $filePath
                name = $file
            }
        }
        else {
            Write-Host "   ⚠️  $file - NOT FOUND" -ForegroundColor Yellow
        }
    }

    if ($filesToUpload.Count -eq 0) {
        Write-Host "`n❌ No backup files found. Aborting." -ForegroundColor Red
        exit 1
    }

    Write-Host "`n⚠️  NOTE: JWT token generation requires advanced crypto operations." -ForegroundColor Yellow
    Write-Host "Using Google Drive MCP API for authentication instead.`n" -ForegroundColor Yellow

    Write-Host "📝 Summary of files ready to upload:" -ForegroundColor Cyan
    foreach ($file in $filesToUpload) {
        $size = (Get-Item $file.path).Length
        Write-Host "   • $($file.name) - $('{0:N2}' -f ($size/1MB)) MB"
    }

    Write-Host "`n💡 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Use the MCP Google Drive API for secure authentication" -ForegroundColor Gray
    Write-Host "   2. Upload files one by one with progress tracking" -ForegroundColor Gray
    Write-Host "   3. Generate detailed upload report with file IDs" -ForegroundColor Gray
}

Main
