#!/bin/bash

# Google Drive Backup_2026-05-25 파일 다운로드 스크립트
# 각 파일ID를 Google Drive에서 다운로드

BACKUP_DIR="backups/google-drive-backup-2026-05-25"
mkdir -p "$BACKUP_DIR"

# 파일 목록 (ID, 파일명)
# 아래를 Agent 결과로 채워야 함

echo "❌ Agent 2의 파일 목록 필요"
echo "다음 파일들을 Google Drive에서 다운로드 필요:"
echo "- AffiliateProduct_2026-05-25_*.xlsx"
echo "- CruiseProduct_2026-05-25_*.xlsx"
echo "- User_2026-05-25_*.xlsx"
echo "- ProductImage_2026-05-25_*.xlsx"
echo "- ProductCabinPrice_2026-05-25_*.xlsx"
echo "- ProductPricePeriod_2026-05-25_*.xlsx"

