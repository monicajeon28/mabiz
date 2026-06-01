# Wave 3: Message API CRUD Verification
# This script tests the Message API endpoints for CRUD operations

$BASE_URL = "http://localhost:3000"
$ORG_ID = "org_test_20260601"
$CONTACT_ID = "contact_test_20260601"
$startTime = Get-Date

# Color output
function Write-Success { Write-Host -ForegroundColor Green $args }
function Write-Error-Red { Write-Host -ForegroundColor Red $args }
function Write-Warn { Write-Host -ForegroundColor Yellow $args }

# Initialize test results
$tests = @{
    'get_messages' = 'PENDING'
    'create_message' = 'PENDING'
    'update_message' = 'PENDING'
    'delete_message' = 'PENDING'
    'org_isolation' = 'PENDING'
}

Write-Host "================================================"
Write-Host "Wave 3: Message API CRUD Tests"
Write-Host "Base URL: $BASE_URL"
Write-Host "================================================"

# TEST 1: GET /api/messages (List messages)
Write-Host "`n[TEST 1] GET /api/messages - Fetch message list"
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/messages?organizationId=$ORG_ID&page=1&limit=20" `
        -Method GET `
        -Headers @{'Content-Type'='application/json'} `
        -ErrorAction SilentlyContinue

    if ($response.StatusCode -eq 200) {
        $body = $response.Content | ConvertFrom-Json
        Write-Success "✅ PASS: GET messages returned HTTP 200"
        Write-Host "   Response: $($body.messages.Count) messages"
        $tests['get_messages'] = "✅ PASS"
    } else {
        Write-Error-Red "❌ FAIL: Got HTTP $($response.StatusCode)"
        $tests['get_messages'] = "❌ FAIL: HTTP $($response.StatusCode)"
    }
} catch {
    Write-Error-Red "❌ FAIL: $($_.Exception.Message)"
    $tests['get_messages'] = "❌ ERROR: $($_.Exception.Message)"
}

# TEST 2: POST /api/messages (Create message)
Write-Host "`n[TEST 2] POST /api/messages - Create message"
try {
    $createPayload = @{
        contactId = $CONTACT_ID
        messageType = "SMS"
        messageKey = "welcome_day0"
        lens = "L6"
        templateVars = @{
            name = "테스트고객"
            price = "800"
            discount = "600"
            link = "https://example.com/promo"
        }
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$BASE_URL/api/messages" `
        -Method POST `
        -Headers @{'Content-Type'='application/json'} `
        -Body $createPayload `
        -ErrorAction SilentlyContinue

    if ($response.StatusCode -eq 201) {
        $body = $response.Content | ConvertFrom-Json
        Write-Success "✅ PASS: POST message returned HTTP 201"
        Write-Host "   Message ID: $($body.messageId)"
        Write-Host "   Status: $($body.status)"
        $script:createdMessageId = $body.messageId
        $tests['create_message'] = "✅ CREATED: $($body.messageId)"
    } elseif ($response.StatusCode -eq 200) {
        $body = $response.Content | ConvertFrom-Json
        Write-Success "✅ PASS: POST message returned HTTP 200"
        Write-Host "   Message ID: $($body.messageId)"
        $script:createdMessageId = $body.messageId
        $tests['create_message'] = "✅ CREATED: $($body.messageId)"
    } else {
        Write-Error-Red "❌ FAIL: Got HTTP $($response.StatusCode)"
        Write-Host "   Response: $($response.Content)"
        $tests['create_message'] = "❌ FAIL: HTTP $($response.StatusCode)"
    }
} catch {
    Write-Error-Red "❌ FAIL: $($_.Exception.Message)"
    $tests['create_message'] = "❌ ERROR: $($_.Exception.Message)"
}

# Wait for message to be created before next test
Start-Sleep -Milliseconds 500

# TEST 3: PUT /api/messages/{id} (Update message)
Write-Host "`n[TEST 3] PUT /api/messages/{id} - Update message"
if ($script:createdMessageId) {
    try {
        $updatePayload = @{
            content = "수정된 메시지: 특가 50% 할인 지금 바로!"
            status = "SENT"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$BASE_URL/api/messages/$($script:createdMessageId)" `
            -Method PUT `
            -Headers @{
                'Content-Type'='application/json'
                'x-organization-id'=$ORG_ID
            } `
            -Body $updatePayload `
            -ErrorAction SilentlyContinue

        if ($response.StatusCode -eq 200) {
            $body = $response.Content | ConvertFrom-Json
            Write-Success "✅ PASS: PUT message returned HTTP 200"
            Write-Host "   Updated content: $($body.content.Substring(0, [Math]::Min(50, $body.content.Length)))..."
            $tests['update_message'] = "✅ UPDATED"
        } else {
            Write-Error-Red "❌ FAIL: Got HTTP $($response.StatusCode)"
            Write-Host "   Response: $($response.Content)"
            $tests['update_message'] = "❌ FAIL: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error-Red "❌ FAIL: $($_.Exception.Message)"
        $tests['update_message'] = "❌ ERROR: $($_.Exception.Message)"
    }
} else {
    Write-Warn "⊘ SKIP: No message created to update"
    $tests['update_message'] = "⊘ SKIPPED"
}

# TEST 4: DELETE /api/messages/{id} (Soft delete)
Write-Host "`n[TEST 4] DELETE /api/messages/{id} - Delete message (soft delete)"
if ($script:createdMessageId) {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/messages/$($script:createdMessageId)" `
            -Method DELETE `
            -Headers @{
                'Content-Type'='application/json'
                'x-organization-id'=$ORG_ID
            } `
            -ErrorAction SilentlyContinue

        if ($response.StatusCode -eq 200) {
            $body = $response.Content | ConvertFrom-Json
            Write-Success "✅ PASS: DELETE message returned HTTP 200"
            Write-Host "   Deleted at: $($body.deletedAt)"
            $tests['delete_message'] = "✅ DELETED"
        } else {
            Write-Error-Red "❌ FAIL: Got HTTP $($response.StatusCode)"
            Write-Host "   Response: $($response.Content)"
            $tests['delete_message'] = "❌ FAIL: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error-Red "❌ FAIL: $($_.Exception.Message)"
        $tests['delete_message'] = "❌ ERROR: $($_.Exception.Message)"
    }
} else {
    Write-Warn "⊘ SKIP: No message created to delete"
    $tests['delete_message'] = "⊘ SKIPPED"
}

# TEST 5: Organization isolation
Write-Host "`n[TEST 5] Organization Isolation - Access with different org ID"
if ($script:createdMessageId) {
    try {
        $wrongOrgId = "org_wrong_20260601"
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/messages/$($script:createdMessageId)" `
            -Method GET `
            -Headers @{
                'Content-Type'='application/json'
                'x-organization-id'=$wrongOrgId
            } `
            -ErrorAction SilentlyContinue

        if ($response.StatusCode -eq 403) {
            Write-Success "✅ PASS: Wrong org got HTTP 403 Forbidden"
            $tests['org_isolation'] = "✅ 403 FORBIDDEN"
        } elseif ($response.StatusCode -eq 404) {
            Write-Success "✅ PASS: Wrong org got HTTP 404 (acceptable)"
            $tests['org_isolation'] = "✅ 404 NOT FOUND"
        } else {
            Write-Error-Red "❌ FAIL: Wrong org got HTTP $($response.StatusCode) (should be 403/404)"
            Write-Host "   Response: $($response.Content)"
            $tests['org_isolation'] = "❌ FAIL: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error-Red "❌ FAIL: $($_.Exception.Message)"
        $tests['org_isolation'] = "❌ ERROR: $($_.Exception.Message)"
    }
} else {
    Write-Warn "⊘ SKIP: No message created to test org isolation"
    $tests['org_isolation'] = "⊘ SKIPPED"
}

# Summary
Write-Host "`n================================================"
Write-Host "Test Results Summary"
Write-Host "================================================"

$duration = (Get-Date) - $startTime
$durationMs = [int]$duration.TotalMilliseconds

$passed = 0
$failed = 0
$skipped = 0

foreach ($test in $tests.GetEnumerator()) {
    $result = $test.Value
    Write-Host "$($test.Key): $result"

    if ($result -like "✅*") { $passed++ }
    elseif ($result -like "❌*") { $failed++ }
    elseif ($result -like "⊘*") { $skipped++ }
}

Write-Host "`n"
Write-Host "Passed:  $passed"
Write-Host "Failed:  $failed"
Write-Host "Skipped: $skipped"
Write-Host "Duration: ${durationMs}ms"

# JSON Output for machine parsing
$output = @{
    wave = "Wave 3"
    tests = $tests
    duration_ms = $durationMs
    status = if ($failed -eq 0) { "✅ PASS" } else { "❌ FAIL" }
    summary = @{
        passed = $passed
        failed = $failed
        skipped = $skipped
    }
}

Write-Host "`n" + ($output | ConvertTo-Json)
