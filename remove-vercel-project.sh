#!/bin/bash

# VERCEL_TOKEN이 필요합니다
# 없으면 vercel CLI의 로컬 설정 사용

# mabiz-crm 프로젝트 제거
echo "🗑️  Vercel mabiz-crm 프로젝트 제거 중..."

vercel remove --scope monicajeon28s-projects --force << CONFIRM
mabiz-crm
CONFIRM

if [ $? -eq 0 ]; then
  echo "✅ mabiz-crm 프로젝트 제거 완료"
else
  echo "❌ 제거 실패 - Vercel 웹 대시보드에서 수동 제거 필요"
fi
