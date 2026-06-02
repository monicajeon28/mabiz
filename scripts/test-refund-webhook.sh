#!/bin/bash

# Refund Webhook 테스트 스크립트
# 사용법: bash test-refund-webhook.sh

# 환경 설정
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3000/api/webhooks/cruisedot-refund}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-test-secret-key}"

echo "🧪 Refund Webhook 테스트 시작"
echo "URL: $WEBHOOK_URL"
echo ""

# ========================================
# 테스트 1: 정상 환불 (PENDING)
# ========================================
echo "📝 테스트 1: 정상 환불 요청 (PENDING)"

PAYLOAD_1='{"eventId":"evt_ref_20260602_001","eventType":"refund.requested","timestamp":"2026-06-02T10:30:00Z","bookingRef":"CZ-2026-001","refundAmount":1000000,"refundReason":"고객_요청","status":"PENDING","customerPhone":"01012345678","customerName":"홍길동","departureDate":"2026-06-15"}'

SIGNATURE_1=$(echo -n "$PAYLOAD_1" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE_1" \
  -d "$PAYLOAD_1" \
  -w "\nHTTP Status: %{http_code}\n\n"

sleep 2

# ========================================
# 테스트 2: 상태 업데이트 (APPROVED)
# ========================================
echo "📝 테스트 2: 상태 업데이트 (APPROVED)"

PAYLOAD_2='{"eventId":"evt_ref_20260602_001","eventType":"refund.approved","timestamp":"2026-06-02T11:00:00Z","bookingRef":"CZ-2026-001","refundAmount":1000000,"refundReason":"고객_요청","status":"APPROVED","customerPhone":"01012345678","customerName":"홍길동","departureDate":"2026-06-15"}'

SIGNATURE_2=$(echo -n "$PAYLOAD_2" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE_2" \
  -d "$PAYLOAD_2" \
  -w "\nHTTP Status: %{http_code}\n\n"

sleep 2

# ========================================
# 테스트 3: 최종 완료 (COMPLETED)
# ========================================
echo "📝 테스트 3: 환불 완료 (COMPLETED)"

PAYLOAD_3='{"eventId":"evt_ref_20260602_001","eventType":"refund.completed","timestamp":"2026-06-02T12:00:00Z","bookingRef":"CZ-2026-001","refundAmount":1000000,"refundReason":"고객_요청","status":"COMPLETED","customerPhone":"01012345678","customerName":"홍길동","departureDate":"2026-06-15","metadata":{"refundMethod":"카드","processedAt":"2026-06-02T12:00:00Z"}}'

SIGNATURE_3=$(echo -n "$PAYLOAD_3" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE_3" \
  -d "$PAYLOAD_3" \
  -w "\nHTTP Status: %{http_code}\n\n"

sleep 2

# ========================================
# 테스트 4: 중복 요청 (멱등성)
# ========================================
echo "📝 테스트 4: 중복 요청 처리 (멱등성)"

# 같은 eventId로 다시 요청 (PENDING)
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE_1" \
  -d "$PAYLOAD_1" \
  -w "\nHTTP Status: %{http_code}\n\n"

sleep 2

# ========================================
# 테스트 5: 거절된 환불
# ========================================
echo "📝 테스트 5: 거절된 환불 (REJECTED)"

PAYLOAD_5='{"eventId":"evt_ref_20260602_002","eventType":"refund.rejected","timestamp":"2026-06-02T10:45:00Z","bookingRef":"CZ-2026-002","refundAmount":500000,"refundReason":"정책_위반","status":"REJECTED","customerPhone":"01098765432","customerName":"김철수","metadata":{"rejectionReason":"출발 1일 전 취소 불가","rejectedAt":"2026-06-02T10:45:00Z"}}'

SIGNATURE_5=$(echo -n "$PAYLOAD_5" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE_5" \
  -d "$PAYLOAD_5" \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "✅ 모든 테스트 완료!"
