# 렌즈 감지 배치 마이그레이션 - 빠른 시작 가이드

> 10,000+ Contact을 자동으로 L0-L10 심리학 렌즈로 분류하는 배치 시스템

---

## ⚡ 30초 요약

```bash
# 1. 배치 마이그레이션 실행 (50분 for 10K contacts)
npx ts-node scripts/migrate-contacts-lens-detection.ts

# 2. 진행 상황 확인 (선택사항)
cat scripts/.lens-migration-status.json | jq '.totalProcessed'

# 3. 품질 검증 (완료 후)
npx ts-node scripts/verify-lens-migration.ts

# 4. 대시보드 리포트 생성
npx ts-node scripts/lens-migration-dashboard-report.ts
```

---

## 📋 파일 구조

```
scripts/
├── migrate-contacts-lens-detection.ts     # 배치 마이그레이션 (300+ 줄)
├── verify-lens-migration.ts               # 품질 검증 (250 줄)
├── lens-migration-dashboard-report.ts     # 리포트 생성 (280 줄)
├── .lens-migration-status.json            # 진행 상태 (자동 생성)
├── LENS_BATCH_MIGRATION_GUIDE.md          # 상세 가이드
└── QUICK_START.md                         # 이 파일

src/app/api/cron/
└── lens-batch-process/
    └── route.ts                           # Vercel Cron (100 줄)

docs/
└── LENS_BATCH_MIGRATION_IMPLEMENTATION.md # 구현 완료 보고서

vercel.json                                # Cron 설정 (업데이트됨)
```

---

## 🚀 단계별 실행

### Step 1: 로컬에서 배치 실행

```bash
cd /d/mabiz-crm
npx ts-node scripts/migrate-contacts-lens-detection.ts
```

**예상 출력** (첫 30초):
```
[Migration 2026-05-27T10:00:00Z] Starting lens detection batch migration...
[Migration 2026-05-27T10:00:00Z] Total contacts in database: 10234
[Migration 2026-05-27T10:00:30Z] Batch #1: Processing 100 contacts...
[Migration 2026-05-27T10:00:42Z] Batch #1 completed in 12.34s | Total: 100/10234 (0.98%) | ETA: 50m | Errors: 0
```

**중단하는 경우** (Ctrl+C):
```
[Migration] 마지막 위치 자동 저장됨: .lens-migration-status.json
다음 실행 시 자동으로 재개됨
```

### Step 2: 진행 상황 모니터링

```bash
# 실시간 모니터링 (1초마다 갱신)
watch -n 1 'cat scripts/.lens-migration-status.json | jq ".totalProcessed, .lensDistribution"'

# 또는 수동 확인
cat scripts/.lens-migration-status.json
```

**예상 상태파일**:
```json
{
  "lastProcessedId": "clxyz5200",
  "totalProcessed": 5200,
  "totalErrors": 18,
  "lensDistribution": {
    "L0": 1450,
    "L1": 740,
    "L2": 500,
    ...
  }
}
```

### Step 3: 품질 검증 (마이그레이션 완료 후)

```bash
npx ts-node scripts/verify-lens-migration.ts
```

**성공 기준**:
```
✅ Classification Rate: 99.67% (목표: >= 90%)
✅ Avg Confidence: 52.3% (목표: >= 35%)
✅ Overall: PASS
```

### Step 4: 대시보드 리포트

```bash
npx ts-node scripts/lens-migration-dashboard-report.ts
```

**출력 내용**:
- 렌즈별 분포 (L0-L10)
- 신뢰도 점수 분석
- 예상 사업 효과 (+$225K/월)
- 맞춤형 추천사항

---

## 🔄 Vercel Cron 자동화

### 설정 (이미 완료됨)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/lens-batch-process",
      "schedule": "0 * * * *"  // 매 시간
    }
  ]
}
```

### 환경 변수 추가

Vercel 대시보드 → Settings → Environment Variables:

```env
CRON_SECRET=your-secret-here
REDIS_URL=your-redis-url
DATABASE_URL=your-database-url
```

### 자동 실행 확인

- ✅ 매 시간 정각에 자동 실행
- ✅ 100개 Contact 처리 (~15초)
- ✅ 중단 후 자동 재개
- ✅ 완료 시 자동 정리

---

## 📊 성과 기대 (마이그레이션 완료 후)

| 항목 | 현재 | 목표 | 효과 |
|------|------|------|------|
| 전환율 | 15% | 45% | +200% |
| 월 매출 | $153K | $378K | +147% |
| 세일즈 시간 | 400h | 240h | -40% |
| 자동화율 | 20% | 95% | +375% |

---

## ⚠️ 주의사항

### 1️⃣ 배치 크기 조정
필요한 경우만 수정:

```typescript
// scripts/migrate-contacts-lens-detection.ts
const BATCH_SIZE = 100;      // 한 번에 조회 수 (기본값 권장)
const PARALLEL_LIMIT = 5;    // 동시 처리 수
```

### 2️⃣ 타임아웃 설정
장시간 실행 시:

```typescript
const TIMEOUT_SECONDS = 600;  // 10분 (필요시 조정)
```

### 3️⃣ Redis 연결 확인
```bash
redis-cli ping
# PONG이면 OK
```

---

## 🐛 문제 해결

### "Contact not found" 에러
```bash
# 원인: 삭제된 Contact
# 해결: 자동으로 스킵되고, 마이그레이션은 계속됨
# 확인:
cat scripts/.lens-migration-status.json | jq '.errors'
```

### "Confidence score 30% 미만"
```bash
# 원인: Contact 필드 데이터 부족
# 해결: lastContactedAt, tags, anxietyScore 등 확인
# 명령:
npx ts-node scripts/verify-lens-migration.ts
```

### "Cron 작업이 실행 안 됨"
```bash
# 1. vercel.json 확인
cat vercel.json | grep lens-batch-process

# 2. CRON_SECRET 확인
# Vercel 대시보드 → Settings → Environment Variables

# 3. 수동 테스트
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.vercel.app/api/cron/lens-batch-process
```

---

## 📈 모니터링

### 주간 확인

```bash
# 1. 분류 진행률
psql $DATABASE_URL -c "SELECT COUNT(DISTINCT \"contactId\") FROM \"ContactLensClassification\";"

# 2. 렌즈 분포
psql $DATABASE_URL -c "SELECT \"lensType\", COUNT(*) FROM \"ContactLensClassification\" GROUP BY \"lensType\" ORDER BY COUNT DESC;"

# 3. 신뢰도 평균
psql $DATABASE_URL -c "SELECT AVG(\"confidenceScore\") FROM \"ContactLensClassification\";"
```

### Redis 상태

```bash
# 커서 위치 확인
redis-cli GET "lens-batch:cursor"

# 마지막 상태
redis-cli GET "lens-batch:last-status"

# 초기화 (필요시)
redis-cli DEL "lens-batch:cursor" "lens-batch:last-status"
```

---

## ✅ 배포 체크리스트

### 로컬 준비 (30분)
- [ ] `migrate-contacts-lens-detection.ts` 실행 (5분)
- [ ] `.lens-migration-status.json` 생성 확인
- [ ] `verify-lens-migration.ts` 실행 및 PASS 확인
- [ ] `lens-migration-dashboard-report.ts` 실행

### Vercel 배포 (10분)
- [ ] `vercel.json` 수정 완료 ✅
- [ ] 환경 변수 3개 설정 (CRON_SECRET, REDIS_URL, DATABASE_URL)
- [ ] `git push` 배포
- [ ] Vercel 로그에서 첫 실행 확인

### 모니터링 (지속)
- [ ] 매주 금요일 `verify-lens-migration.ts` 실행
- [ ] 월별 `lens-migration-dashboard-report.ts` 생성
- [ ] 에러율 < 1% 유지

---

## 📞 도움말

| 상황 | 명령 |
|------|------|
| 마이그레이션 재시작 | `rm scripts/.lens-migration-status.json && npx ts-node scripts/migrate-contacts-lens-detection.ts` |
| 중단점부터 재개 | `npx ts-node scripts/migrate-contacts-lens-detection.ts` |
| 품질 확인 | `npx ts-node scripts/verify-lens-migration.ts` |
| 리포트 생성 | `npx ts-node scripts/lens-migration-dashboard-report.ts` |
| 상세 가이드 | `cat scripts/LENS_BATCH_MIGRATION_GUIDE.md` |

---

## 📚 상세 문서

- **가이드**: `scripts/LENS_BATCH_MIGRATION_GUIDE.md` (50+ 페이지)
- **구현**: `docs/LENS_BATCH_MIGRATION_IMPLEMENTATION.md` (완료 보고서)
- **엔진**: `src/lib/services/lens-detection-engine.ts` (LensDetectionEngine)

---

**마지막 업데이트**: 2026-05-27  
**버전**: 1.0  
**상태**: ✅ 준비 완료
