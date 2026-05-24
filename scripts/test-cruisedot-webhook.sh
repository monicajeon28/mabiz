#!/bin/bash

# 크루즈닷몰 웹훅 스테이징 테스트
# 사용법: bash scripts/test-cruisedot-webhook.sh

STAGING_URL="https://crm-staging.vercel.app/api/webhooks/cruisedot-payment"
SECRET="sk_staging_651ffc29ea402ae3fa003f25bef3cf809660ba6f8dc9c4def22da937c011f3d9"

echo "=== 크루즈닷몰 웹훅 스테이징 기초 테스트 ==="
echo "Target: $STAGING_URL"
echo ""

# 테스트 1: Bearer Token 미제공 → 401 예상
echo "✓ 테스트 1: Bearer Token 미제공 (401 Unauthorized 예상)"
curl -X POST "$STAGING_URL" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n\n"

# 테스트 2: Bearer Token 제공 → 400 예상 (필드 누락)
echo "✓ 테스트 2: Bearer Token 제공, 필드 누락 (400 Bad Request 예상)"
curl -X POST "$STAGING_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n\n"

# 테스트 3: 유효한 요청, 잘못된 서명 → 403 Forbidden 예상
echo "✓ 테스트 3: 유효한 Bearer Token, 잘못된 HMAC-SHA256 서명 (403 Forbidden 예상)"
PAYLOAD='{"eventId":"test-001","eventType":"payment.created","timestamp":"2026-05-24T00:00:00Z","bookingRef":"TEST-BOOKING-001","status":"PENDING"}'
curl -X POST "$STAGING_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -H "X-Signature: invalid_signature_12345" \
  -d "$PAYLOAD" \
  -w "\nStatus: %{http_code}\n\n"

echo ""
echo "=== 기초 테스트 완료 ==="
echo "다음 단계: 2026-05-25 완전 통합 테스트"
echo "- 유효한 HMAC 서명 포함"
echo "- 실제 결제/환불 이벤트 시뮬레이션"
echo "- AdminNotification 확인"
