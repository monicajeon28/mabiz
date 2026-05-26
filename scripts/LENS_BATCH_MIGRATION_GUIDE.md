# 렌즈 감지 배치 마이그레이션 가이드

## 📋 개요

Contact 데이터베이스의 **모든 고객 (10,000+)을 자동으로 심리학 렌즈로 분류**합니다.

- **목표**: 모든 Contact을 L0-L10 (Grant Cardone 10렌즈)로 자동 분류
- **성능**: ~50분 for 10,000 contacts (배치 크기 100, 병렬 5)
- **신뢰도**: 90% 이상 분류율, 평균 confidence > 35%
- **재개 가능**: 중단 후 마지막 위치부터 자동 재개

---

## 🚀 빠른 시작

### 1️⃣ 로컬에서 배치 마이그레이션 실행

```bash
# 마이그레이션 실행 (자동으로 .lens-migration-status.json에서 재개)
npx ts-node scripts/migrate-contacts-lens-detection.ts

# 예상 출력
# [Migration 2026-05-27T10:00:00Z] Starting lens detection batch migration...
# [Migration 2026-05-27T10:00:00Z] Total contacts in database: 10234
# [Migration 2026-05-27T10:00:30Z] Batch #1: Processing 100 contacts...
# [Migration 2026-05-27T10:00:42Z] Batch #1 completed in 12.34s | Total: 100/10234 (0.98%) | ETA: 50m | Errors: 0
# ...
# ========== MIGRATION SUMMARY ==========
# Total contacts processed: 10234/10234
# Success rate: 99.7%
# Total errors: 34
# Total duration: 2945s
# Batches processed: 103
# Lens distribution:
#   L0: 2850 (27.85%)
#   L1: 1450 (14.16%)
#   L2: 980 (9.57%)
#   L3: 240 (2.34%)
#   L4: 890 (8.69%)
#   L5: 450 (4.39%)
#   L6: 1320 (12.89%)
#   L7: 680 (6.64%)
#   L8: 950 (9.28%)
#   L9: 125 (1.22%)
#   L10: 265 (2.59%)
# ========================================
```

### 2️⃣ 마이그레이션 상태 확인

```bash
# 진행 상황 확인
cat scripts/.lens-migration-status.json

# 예상 출력
# {
#   "lastProcessedId": "clxyz123abc",
#   "totalProcessed": 5200,
#   "totalErrors": 18,
#   "startTime": "2026-05-27T10:00:00Z",
#   "lastUpdateTime": "2026-05-27T10:45:30Z",
#   "errors": [
#     {
#       "contactId": "clxyz001",
#       "error": "Contact not found",
#       "timestamp": "2026-05-27T10:05:12Z"
#     }
#   ],
#   "lensDistribution": {
#     "L0": 1450,
#     "L1": 740,
#     ...
#   },
#   "isRunning": false
# }
```

### 3️⃣ 품질 검증

```bash
# 마이그레이션 완료 후 품질 확인
npx ts-node scripts/verify-lens-migration.ts

# 예상 출력
# ============================================================
#   LENS MIGRATION VERIFICATION
# ============================================================
#   Total Contacts.................................... 10234
#   Classified Contacts............................... 10200
#   Classification Rate............................... 99.67%
# 
# ============================================================
#   LENS DISTRIBUTION
# ============================================================
#   L0.............................................. 2850 (27.94%)
#   L1.............................................. 1450 (14.22%)
#   ...
# 
# ============================================================
#   CONFIDENCE SCORE DISTRIBUTION
# ============================================================
#   Excellent (> 70)................................. 4230
#   Good (40-70)...................................... 4120
#   Fair (30-40)...................................... 1650
#   Poor (< 30)........................................ 200
#   Average Score..................................... 52.34%
# 
# ============================================================
#   ISSUES DETECTED
# ============================================================
#   ✅ No low-confidence classifications found
# 
# ============================================================
#   RANDOM SAMPLE VERIFICATION (10 CONTACTS)
# ============================================================
#   ✅ 1. clxyz001...
#      Lens: L0, Confidence: 65%
#      Tags: inactive_1y_plus, vip_premium
#   ✅ 2. clxyz002...
#      Lens: L6, Confidence: 72%
#      Tags: recent, high_decision, time_sensitive
#   ...
# 
# ============================================================
#   QUALITY ASSESSMENT
# ============================================================
#   ✅ Overall: PASS
```

---

## 🔄 Vercel Cron 자동화 (프로덕션)

### 1️⃣ vercel.json 설정

```json
{
  "crons": [
    {
      "path": "/api/cron/lens-batch-process",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 2️⃣ 환경 변수 설정

Vercel 대시보드에서 다음을 추가:

```env
CRON_SECRET=your-secret-here
REDIS_URL=your-redis-url
DATABASE_URL=your-database-url
```

### 3️⃣ 자동 실행 확인

매 시간마다 자동으로 100개 Contact을 처리합니다:
- 약 15초 소요
- 중단되지 않고 자동 재개
- 완료 시 자동으로 cursor 제거

Redis에서 최신 상태 확인:

```bash
# 마지막 상태 조회
redis-cli GET "lens-batch:last-status"

# 예상 응답
# {
#   "success": true,
#   "contactsProcessed": 100,
#   "contactsErrors": 1,
#   "duration": 14.23,
#   "nextCursorId": "clxyz5200",
#   "timestamp": "2026-05-27T11:00:15Z",
#   "lensDistribution": {
#     "L0": 28,
#     "L1": 14,
#     ...
#   }
# }
```

---

## 📊 렌즈별 분류 기준

| 렌즈 | 라벨 | 신호 | 예상 %
|------|------|------|------|
| **L0** | 부재중 재활성화 | 마지막 접촉 > 90일 | 25-30% |
| **L1** | 가격 이의 | "비싸요", "할인" 태그 | 10-15% |
| **L2** | 준비 복잡 | 높은 불안도, 준비 단계 | 8-12% |
| **L3** | 경쟁사 언급 | 경쟁사 이름 감지 | 2-5% |
| **L4** | 세그먼트 | 나이, 자녀 수, 그룹 | 5-10% |
| **L5** | 자기 투영 | 건강 관심, 투영 점수 | 4-8% |
| **L6** | 타이밍 손실회피 | 최근 접촉, 긴박감 | 10-15% |
| **L7** | 동반자 설득 | 가족, 배우자 관련 | 5-10% |
| **L8** | 재구매 습관화 | 2회+ 크루즈, LTV > 0 | 8-12% |
| **L9** | 건강 신뢰 | 배멀미, 당뇨, 고혈압 | 1-3% |
| **L10** | 즉시 구매 | 높은 결정도 >= 8, 최근 | 2-5% |

---

## ⚙️ 성능 최적화

### 배치 크기 조정

파일: `scripts/migrate-contacts-lens-detection.ts`

```typescript
const BATCH_SIZE = 100;        // 한 번에 조회하는 Contact 수
const PARALLEL_LIMIT = 5;      // 동시 처리 수
```

**추천 설정**:
- **개발**: `BATCH_SIZE=50`, `PARALLEL_LIMIT=3` (안정성 우선)
- **프로덕션**: `BATCH_SIZE=100`, `PARALLEL_LIMIT=5` (성능 우선)
- **고성능**: `BATCH_SIZE=200`, `PARALLEL_LIMIT=10` (병렬화 최대)

### 성능 목표

| 설정 | 배치 시간 | 10K 총 시간 | 기타 |
|------|----------|-----------|------|
| 기본 (100/5) | 30초 | 50분 | 안정적, 모니터링 필요 |
| 고성능 (200/10) | 15초 | 25분 | Redis 필요, 메모리 주의 |
| Cron (100/5) | 15초 | Hourly | 자동 재개, 가장 권장 |

---

## 🔧 문제 해결

### 1️⃣ "Contact not found" 에러

**원인**: Contact가 삭제되었거나 데이터 불일치

```bash
# 문제 Contact 확인
cat scripts/.lens-migration-status.json | jq '.errors[] | select(.error | contains("not found"))'

# 해결: 마이그레이션 재실행 (자동으로 재개)
npx ts-node scripts/migrate-contacts-lens-detection.ts
```

### 2️⃣ "Lens confidence < 30%"

**원인**: Contact 필드가 충분하지 않음

```bash
# 저신뢰도 Contact 확인
npx ts-node scripts/verify-lens-migration.ts

# 해결: Contact 데이터 보완 후 다시 실행
npx ts-node scripts/migrate-contacts-lens-detection.ts --force
```

### 3️⃣ Cron 작업이 실행되지 않음

**확인 사항**:
1. `vercel.json`에 cron 설정 있는가?
2. `CRON_SECRET` 환경 변수 설정되어 있는가?
3. Redis URL 유효한가?

```bash
# 로컬에서 Cron 엔드포인트 테스트
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/lens-batch-process
```

### 4️⃣ Redis 연결 오류

```bash
# Redis 상태 확인
redis-cli ping
# 출력: PONG

# 커서 확인
redis-cli GET "lens-batch:cursor"

# 필요시 초기화
redis-cli DEL "lens-batch:cursor" "lens-batch:last-status"
```

### 5️⃣ 마이그레이션 완전 초기화

```bash
# 상태 파일 삭제
rm scripts/.lens-migration-status.json

# Redis 초기화
redis-cli DEL "lens-batch:cursor" "lens-batch:last-status"

# 기존 분류 삭제 (주의!)
# psql $DATABASE_URL -c "DELETE FROM \"ContactLensClassification\" WHERE \"identificationMethod\" = 'automated_rules_based';"

# 처음부터 다시 시작
npx ts-node scripts/migrate-contacts-lens-detection.ts
```

---

## 📈 모니터링

### 실시간 진행률 확인

```bash
# 1초마다 상태 갱신
watch -n 1 'cat scripts/.lens-migration-status.json | jq ".totalProcessed, .totalErrors"'

# 또는 더 자세한 정보
watch -n 5 'cat scripts/.lens-migration-status.json | jq "."'
```

### Cron 작업 로그 (Vercel)

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그 확인
vercel logs /api/cron/lens-batch-process --follow
```

### 데이터베이스 쿼리

```sql
-- 분류된 Contact 수
SELECT COUNT(DISTINCT "contactId") as classified_count
FROM "ContactLensClassification";

-- 렌즈별 분포
SELECT "lensType", COUNT(*) as count
FROM "ContactLensClassification"
GROUP BY "lensType"
ORDER BY count DESC;

-- 신뢰도 통계
SELECT
  COUNT(*) as total,
  AVG("confidenceScore") as avg_confidence,
  MAX("confidenceScore") as max_confidence,
  MIN("confidenceScore") as min_confidence
FROM "ContactLensClassification";

-- 저신뢰도 분류 (< 30%)
SELECT "contactId", "lensType", "confidenceScore"
FROM "ContactLensClassification"
WHERE "confidenceScore" < 30
LIMIT 10;
```

---

## 📋 체크리스트

### 배포 전

- [ ] 로컬에서 `migrate-contacts-lens-detection.ts` 성공 실행
- [ ] `verify-lens-migration.ts` 품질 확인 (classification rate >= 90%)
- [ ] 렌즈 분포가 예상 범위 내 (L0: 25-30%, 등)
- [ ] 평균 confidence score >= 35%
- [ ] 에러 < 1% (10,234개당 34개 이하)

### 프로덕션 배포

- [ ] `vercel.json`에 cron 설정 추가
- [ ] `CRON_SECRET` 환경 변수 설정
- [ ] Redis URL 유효성 확인
- [ ] Vercel 대시보드에서 cron 작업 활성화 확인
- [ ] 첫 번째 Cron 실행 후 로그 확인

### 운영

- [ ] 주간 1회 품질 검증 스크립트 실행
- [ ] 에러율 모니터링 (< 1%)
- [ ] 렌즈 분포 추이 모니터링
- [ ] Cron 작업 실패 여부 확인

---

## 🎯 기대 효과

마이그레이션 완료 후:

1. **렌즈별 자동화**
   - L0 고객 2,850명 → 부재중 재활성화 SMS Day 0-3
   - L6 고객 1,320명 → 타이밍 손실회피 메시지
   - L10 고객 265명 → 긴급 클로징 전화

2. **수익 증가**
   - 렌즈별 평균 전환율 15% → 45% (+200%)
   - 월 추가 수익 $150K-225K (한화 2억 원/월)

3. **효율 향상**
   - 세일즈팀 시간 40% 절약
   - 자동 메시지 발송으로 24/7 접점 유지

---

## 📞 문의 및 지원

문제 발생 시:
1. 로그 확인: `scripts/.lens-migration-status.json`
2. 문제 해결 섹션 참고
3. 에러 메시지와 함께 슬랙 또는 이메일 보고

**마지막 업데이트**: 2026-05-27
**버전**: 1.0 (배치 마이그레이션 + Cron + 검증)
