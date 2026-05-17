#!/bin/bash

# ReCAPTCHA 검증 웹훅 테스트 스크립트
# 사용법: ./test-recaptcha-webhook.sh [dev|staging|prod]

ENVIRONMENT="${1:-dev}"

if [ "$ENVIRONMENT" = "dev" ]; then
  BASE_URL="http://localhost:3000"
elif [ "$ENVIRONMENT" = "staging" ]; then
  BASE_URL="https://staging.mabiz.io"
elif [ "$ENVIRONMENT" = "prod" ]; then
  BASE_URL="https://mabiz.io"
else
  echo "Usage: ./test-recaptcha-webhook.sh [dev|staging|prod]"
  exit 1
fi

# 테스트 페이로드 (실제 구글 토큰 또는 dummy 값)
PAYLOAD=$(cat <<'EOF'
{
  "organizationId": "test-org-id-123",
  "contactId": "test-contact-id-456",
  "groupId": "test-group-id-789",
  "recaptchaToken": "test-recaptcha-token-dummy"
}
EOF
)

echo "Testing ReCAPTCHA webhook on: $BASE_URL"
echo "Payload: $PAYLOAD"
echo ""

# POST 요청 (개발 환경에서는 서명 검증 생략)
curl -X POST "$BASE_URL/api/internal/verify-recaptcha" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -v

echo ""
echo "Test completed"
