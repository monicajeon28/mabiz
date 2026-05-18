#!/bin/bash
# 크루즈봇 Q&A 564개 DB 업로드 스크립트

API_URL="http://localhost:3000/api/tools/bot-guide-answers"

echo "🔄 배치 업로드 시작..."

# 배치 1: 항목 1-50
curl -X POST $API_URL   -H "Content-Type: application/json"   -d '{"mode":"upsert","items":[...], "confirm":true}'   -w "
배치 1: %{http_code}
"

# 배치 2: 항목 51-100
# ... 반복

echo "
✅ 업로드 완료!"
echo "🔍 검증: curl $API_URL?limit=1"
