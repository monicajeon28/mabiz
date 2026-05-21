#!/bin/bash
# 크루즈닷몰 웹훅 테스트 스크립트

SECRET=$1
URL="http://localhost:3000/api/webhooks/cruisedot-payment"

if [ -z "$SECRET" ]; then
  echo "❌ 사용법: ./test-cruisedot-webhook.sh <sk_staging_xxxxx>"
  exit 1
fi

echo "🧪 크루즈닷몰 웹훅 테스트 시작..."
echo "URL: $URL"
echo ""

# 테스트 1: 인증 없이 요청 (401 expected)
echo "✓ Test 1: 인증 없이 요청 (401 expected)"
curl -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test-001","eventType":"payment.created"}' \
  -w "\nHTTP Status: %{http_code}\n\n"

# 테스트 2: 잘못된 서명 (400 expected)
echo "✓ Test 2: 잘못된 서명 (400 expected)"
BODY='{"eventId":"test-002","eventType":"payment.created","bookingRef":"order-123","status":"CONFIRMED","timestamp":"2026-05-21T10:00:00Z"}'
WRONG_SIG="wrong_signature_here"

curl -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -H "X-Signature: $WRONG_SIG" \
  -d "$BODY" \
  -w "\nHTTP Status: %{http_code}\n\n"

# 테스트 3: 정상 요청 (200 expected) - 실제 HMAC 서명 필요
echo "✓ Test 3: 정상 요청 (준비 중...)"
echo "   → node script로 정상 HMAC 서명 생성 필요"
echo ""

echo "✅ 테스트 완료!"
