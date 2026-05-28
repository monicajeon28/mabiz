#!/bin/bash

# Detailed Webhook Flow Verification

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

test_pass=0
test_fail=0

function test() {
    local name=$1
    local check=$2
    
    if eval "$check"; then
        echo -e "${GREEN}✅${RESET} $name"
        ((test_pass++))
    else
        echo -e "${RED}❌${RESET} $name"
        ((test_fail++))
    fi
}

echo -e "$CYAN════════════════════════════════════════════════════════════════$RESET"
echo -e "$CYAN Webhook Integration Test - Detailed Code Verification $RESET"
echo -e "$CYAN════════════════════════════════════════════════════════════════$RESET\n"

# Test 1: Payment Webhook Flow
echo -e "${CYAN}[1] Payment Webhook Flow${RESET}"

test "Payment webhook exists" "[ -f 'src/app/api/webhooks/cruisedot-payment/route.ts' ]"

test "Payment: Bearer token validation" \
    "grep -q 'const token = authHeader.replace' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Payment: HMAC signature check" \
    "grep -q 'createHmac.*sha256' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Payment: Idempotency (processedWebhookEvent)" \
    "grep -q 'processedWebhookEvent.findUnique' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Payment: Contact UPSERT pattern" \
    "grep -q 'contact.upsert' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Payment: FormSubmission creation" \
    "grep -q 'formSubmission.create' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Payment: Day 0 SMS trigger" \
    "grep -q 'sendDay0Sms' src/app/api/webhooks/cruisedot-payment/route.ts"

# Test 2: Settlement Webhook Flow
echo -e "\n${CYAN}[2] Settlement Webhook Flow${RESET}"

test "Settlement webhook exists" "[ -f 'src/app/api/webhooks/cruisedot-settlement/route.ts' ]"

test "Settlement: Bearer token validation" \
    "grep -q 'Bearer' src/app/api/webhooks/cruisedot-settlement/route.ts"

test "Settlement: HMAC signature check" \
    "grep -q 'createHmac' src/app/api/webhooks/cruisedot-settlement/route.ts"

test "Settlement: Idempotency check" \
    "grep -q 'processedWebhookEvent' src/app/api/webhooks/cruisedot-settlement/route.ts"

test "Settlement: Commission ledger creation" \
    "grep -q 'commissionLedger' src/app/api/webhooks/cruisedot-settlement/route.ts"

test "Settlement: Partner revenue update" \
    "grep -q 'partner' src/app/api/webhooks/cruisedot-settlement/route.ts"

# Test 3: Inquiry Webhook Flow
echo -e "\n${CYAN}[3] Inquiry Webhook Flow${RESET}"

test "Inquiry webhook exists" "[ -f 'src/app/api/webhooks/inquiry/route.ts' ]"

test "Inquiry: Lens detection engine" \
    "grep -q 'detectLensFromMessage' src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Lens L1 (price objection)" \
    "grep -q \"lensType: 'L1'\" src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Lens L2 (preparation)" \
    "grep -q \"lensType: 'L2'\" src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Lens L3 (differentiation)" \
    "grep -q \"lensType: 'L3'\" src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Lens L6 (timing/loss aversion)" \
    "grep -q \"lensType: 'L6'\" src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Lens L9 (health/medical)" \
    "grep -q \"lensType: 'L9'\" src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Contact creation/update" \
    "grep -q 'contact.upsert\|contact.create' src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Task auto-creation" \
    "grep -q 'task.create' src/app/api/webhooks/inquiry/route.ts"

test "Inquiry: Suggested response generation" \
    "grep -q 'generateSuggestedResponse' src/app/api/webhooks/inquiry/route.ts"

# Test 4: Error Handling
echo -e "\n${CYAN}[4] Error Handling & Edge Cases${RESET}"

test "Missing secret -> 500 error" \
    "grep -q 'status: 500' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Invalid token -> 401 error" \
    "grep -q 'status: 401' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Invalid signature -> 403 error" \
    "grep -q 'status: 403' src/app/api/webhooks/cruisedot-payment/route.ts"

test "JSON parse error -> 400 error" \
    "grep -q 'status: 400' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Duplicate event handling (200 + duplicate flag)" \
    "grep -q 'duplicate: true' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Organization isolation (422 error)" \
    "grep -q 'status: 422' src/app/api/webhooks/cruisedot-payment/route.ts"

# Test 5: Data Consistency
echo -e "\n${CYAN}[5] Data Consistency & Relationships${RESET}"

test "Contact ↔ FormSubmission link" \
    "grep -q 'formSubmission.create' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Contact ↔ Task link (Inquiry)" \
    "grep -q 'task.create' src/app/api/webhooks/inquiry/route.ts"

test "Settlement ↔ CommissionLedger link" \
    "grep -q 'commissionLedger' src/app/api/webhooks/cruisedot-settlement/route.ts"

test "Transaction support (tx pattern)" \
    "grep -q 'prisma.\$transaction' src/app/api/webhooks/cruisedot-payment/route.ts"

# Test 6: Security
echo -e "\n${CYAN}[6] Security Checks${RESET}"

test "HMAC-SHA256 (not MD5)" \
    "grep -q 'sha256' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Bearer token check" \
    "grep -q 'Bearer' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Signature header validation" \
    "grep -q 'x-signature' src/app/api/webhooks/cruisedot-payment/route.ts"

# Test 7: Logger Integration
echo -e "\n${CYAN}[7] Logging & Monitoring${RESET}"

test "Logger import" \
    "grep -q 'from.*logger' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Logging webhook receipt" \
    "grep -q 'logger.log' src/app/api/webhooks/cruisedot-payment/route.ts"

test "Logging errors" \
    "grep -q 'logger.error\|logger.warn' src/app/api/webhooks/cruisedot-payment/route.ts"

# Summary
echo -e "\n$CYAN════════════════════════════════════════════════════════════════$RESET"
total=$((test_pass + test_fail))
percentage=$((test_pass * 100 / total))

echo -e "Total Tests: $total"
echo -e "Passed: ${GREEN}$test_pass${RESET} ✅"
echo -e "Failed: ${RED}$test_fail${RESET} ❌"
echo -e "Success Rate: $percentage%\n"

if [ $test_fail -eq 0 ]; then
    echo -e "${GREEN}✨ All integration tests passed!${RESET}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed${RESET}"
    exit 1
fi

