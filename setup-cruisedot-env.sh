#!/bin/bash
# 크루즈닷몰 Secret 키 즉시 적용 스크립트
# 사용법: ./setup-cruisedot-env.sh sk_staging_xxxxx

STAGING_SECRET=$1

if [ -z "$STAGING_SECRET" ]; then
  echo "❌ 사용법: ./setup-cruisedot-env.sh <sk_staging_xxxxx>"
  exit 1
fi

echo "🔧 환경변수 설정 중..."

# .env.local에 추가 (개발 서버용)
echo "" >> .env.local
echo "# 크루즈닷몰 웹훅 ($(date))" >> .env.local
echo "CRUISEDOT_WEBHOOK_SECRET=$STAGING_SECRET" >> .env.local

echo "✅ .env.local 업데이트 완료"
echo "✅ 개발 서버 재시작: npm run dev"
echo ""
echo "🧪 테스트 URL: https://localhost:3000/api/webhooks/cruisedot-payment"
echo ""
