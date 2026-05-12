#!/bin/bash
# Batch 2/2 이미지 동기화 API 테스트

echo "🚀 배치 2/2 Cloudinary 업로드 API 호출..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# localhost 개발 환경에서 테스트
curl -X POST http://localhost:3000/api/batch-sync-images \
  -H "Content-Type: application/json" \
  -H "Cookie: __Secure-authToken=test-token" \
  -d '{}' \
  2>/dev/null | jq '.' || echo "API 호출 실패"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
