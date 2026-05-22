# Phase 3 Cycle 1 → 2 배포 준비 체크리스트

**작성일:** 2026-05-22
**대상:** Track A/C/D P0 산출물 (코드 + 마이그레이션 + 문서)
**예상 배포일:** 2026-05-24 오후 3시 (한국시간)

---

## 1단계: 로컬 빌드 검증 (0.5일)

### 목표
- `npm run build` 성공 (0 에러)
- TypeScript 컴파일 경고 확인
- 번들 크기 검증

### 체크리스트
- [ ] npm install 완료
- [ ] node_modules 설치됨
- [ ] npm run build 실행
- [ ] 빌드 성공 (exit code 0)
- [ ] TypeScript 경고 0개 또는 무시 가능 수준
- [ ] 번들 크기 < 10MB

### 실행 명령어
```bash
cd D:\mabiz-crm
npm run build
# 예상 시간: 3-5분
# 예상 결과: ✅ Build successful
```

---

## 2단계: 마이그레이션 검증 (1day)

### Track C 마이그레이션 (자동 세그먼트 필드)

**파일:** `prisma/migrations/20260522_add_contact_segment_fields/migration.sql`

**검증 사항:**
- [ ] 마이그레이션 파일 존재 여부 확인
- [ ] IF NOT EXISTS 구문 포함 (멱등성)
- [ ] Contact 테이블에 8개 컬럼 추가
  - [ ] `autoSegment` (String?)
  - [ ] `segmentScore` (Decimal)
  - [ ] `segmentReason` (String?)
  - [ ] `segmentLastUpdated` (DateTime)
  - [ ] `segmentHistory` (String?)
  - [ ] `autoSegmentEnabled` (Boolean)
  - [ ] `segmentJourney` (String?)
  - [ ] `nextSegmentReview` (DateTime?)
- [ ] 3개 인덱스 생성 (segmentScore, autoSegmentEnabled, nextSegmentReview)

**검증 명령어 (Supabase SQL Editor):**
```sql
-- Contact 테이블 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Contact' 
AND column_name LIKE '%segment%';

-- 결과: 8개 행 반환
```

### Track D 마이그레이션 (A/B 테스트 필드)

**파일:** `prisma/migrations/20260522_add_calllog_abtest/migration.sql`

**검증 사항:**
- [ ] 마이그레이션 파일 존재 여부 확인
- [ ] IF NOT EXISTS 구문 포함 (멱등성)
- [ ] CallLog 테이블에 12개 컬럼 추가
  - [ ] `abTestGroup` (String?)
  - [ ] `abTestVariant` (String?)
  - [ ] `abTestAssignedAt` (DateTime)
  - [ ] `abTestResults` (String?)
  - [ ] `scriptVersion` (String?)
  - [ ] `openingPhase` (Int)
  - [ ] `closingPhase` (Int)
  - [ ] `resolutionTime` (Int?)
  - [ ] `customerInitiated` (Boolean)
  - [ ] `objectionCount` (Int)
  - [ ] `resolutionMethod` (String?)
  - [ ] `abTestMetrics` (String?)
- [ ] 4개 인덱스 생성 (abTestGroup, abTestVariant, scriptVersion, abTestAssignedAt)

**검증 명령어 (Supabase SQL Editor):**
```sql
-- CallLog 테이블 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'CallLog' 
AND column_name LIKE '%test%' OR column_name LIKE '%script%';

-- 결과: 12개 행 반환
```

---

## 3단계: Prisma 생성 검증 (0.5day)

### 목표
- Prisma Client 재생성
- 타입 정의 업데이트
- 새 필드 타입 확인

### 체크리스트
- [ ] `npx prisma generate` 실행
- [ ] src/lib/prisma/client.d.ts 업데이트됨
- [ ] Contact 모델에 새 필드 타입 추가됨
  - [ ] autoSegment?: string | null
  - [ ] segmentScore?: Decimal
  - [ ] etc.
- [ ] CallLog 모델에 새 필드 타입 추가됨
  - [ ] abTestGroup?: string | null
  - [ ] abTestVariant?: string | null
  - [ ] etc.

### 실행 명령어
```bash
npx prisma generate
npx prisma db push --skip-generate  # 선택사항: DB와 동기화
```

---

## 4단계: 환경변수 확인 (0.5day)

### 필요 환경변수

```env
# Database (Neon - Production)
DATABASE_URL=postgres://user:password@ep-xxx.neon.tech/dbname?sslmode=require

# Supabase Backup (Optional)
SUPABASE_BACKUP_URL=postgres://user:password@db.supabase.co/postgres?sslmode=require

# Next.js
NEXT_PUBLIC_APP_URL=https://mabiz.vercel.app
NODE_ENV=production
```

### 체크리스트
- [ ] Vercel 프로젝트 Settings > Environment Variables
- [ ] DATABASE_URL 설정됨
- [ ] NEXT_PUBLIC_APP_URL 설정됨
- [ ] SUPABASE_BACKUP_URL 설정됨 (선택사항)
- [ ] .env.local과 동일한 값 확인

### 검증 명령어 (배포 후)
```bash
# 프로덕션 환경에서
curl https://mabiz.vercel.app/api/health
# 예상 결과: 200 OK with JSON response
```

---

## 5단계: 코드 변경 검증

### Track A: 이의처리 P0
**파일:** `src/lib/contact/segment-classifier.ts`

- [ ] Jest 41개 테스트 통과
- [ ] TypeScript 컴파일 에러 없음
- [ ] 10렌즈 분석 결과 8.7/10 이상

**실행:**
```bash
npm test -- src/lib/contact/segment-classifier.test.ts
# 결과: 41 passed in 2.3s
```

### Track C: SMS 마법사 P0
**파일들:**
- `src/app/api/contacts/segment-auto-fields/route.ts`
- `src/lib/analytics/ab-test-queries.sql`

- [ ] API 엔드포인트 구현 완료
- [ ] SQL 쿼리 문법 검증
- [ ] TypeScript 타입 일치

**검증:**
```bash
npm run build
# 마이그레이션 관련 빌드 에러 없음
```

### Track D: A/B 테스트 P0
**파일:** `src/lib/analytics/ab_test_statistics.py`

- [ ] Python 3.8+ 문법 검증
- [ ] JSON 데이터 구조 유효
- [ ] 통계 함수 로직 검증

**검증:**
```bash
python3 -m py_compile src/lib/analytics/ab_test_statistics.py
# 성공: No errors
```

---

## 6단계: 문서 검증

### 생성된 문서 파일
- [ ] `DEPLOYMENT_READY_CHECKLIST.md` (이 파일)
- [ ] `DEPLOYMENT_TEST_RESULTS.md` (테스트 결과)
- [ ] `DEPLOYMENT_ROLLBACK_PLAN.md` (롤백 계획)
- [ ] `MIGRATION_VALIDATION_REPORT.md` (마이그레이션 검증)

### 문서 내용 검증
- [ ] Markdown 문법 유효
- [ ] 모든 링크 유효 (상대경로 포함)
- [ ] JSON 샘플 데이터 검증 완료

---

## 7단계: Vercel 설정 확인

### 배포 전 Vercel Settings
```
Project: mabiz
Team: hyeseon28@gmail.com
Region: us-west (기본값)
```

### 체크리스트
- [ ] 프로젝트 Settings 확인
- [ ] Environment Variables 3개 모두 설정
- [ ] Auto-deployment OFF (수동 배포만)
- [ ] Ignore Build Step: 없음
- [ ] Root Directory: `./` (default)

### Vercel 설정 명령어
```bash
# Vercel CLI 설치 (선택사항)
npm i -g vercel

# 현재 프로젝트 상태 확인
vercel env list

# 수동 배포
vercel deploy --prod
```

---

## 8단계: 배포 후 검증

### 즉시 검증 (5분)
```bash
# 1. Vercel 빌드 로그 확인
# → https://vercel.com/mabiz/mabiz/deployments

# 2. 마이그레이션 실행 여부 확인
# → Supabase SQL Editor에서 Contact/CallLog 테이블 조회

# 3. 프로덕션 URL 접근성
curl https://mabiz.vercel.app
# 예상: 200 OK
```

### 기능 검증 (10분)
- [ ] 대시보드 로드 (https://mabiz.vercel.app/dashboard)
- [ ] API 엔드포인트 응답
  - [ ] `/api/health` → 200
  - [ ] `/api/contacts/segment-auto-fields` → 200
  - [ ] `/api/analytics/ab-test-metrics` → 200
- [ ] 데이터베이스 쿼리 성공
  - [ ] Contact 8개 필드 조회
  - [ ] CallLog 12개 필드 조회

### 모니터링 (30분)
- [ ] Vercel Analytics 확인 (에러율)
- [ ] Sentry 로그 (에러 없음)
- [ ] Database 커넥션 풀 상태

---

## 9단계: 롤백 계획

### 롤백 시나리오

#### 시나리오 1: 마이그레이션 실패
```bash
# 1. Supabase: 자동 백업에서 복구 (1시간)
# 2. GitHub: 이전 커밋으로 리버트
git revert f7da5da --no-edit
git push origin main

# 3. Vercel: 이전 배포로 되돌리기
# → Vercel Dashboard > Deployments > Previous > Redeploy
```

#### 시나리오 2: 빌드 실패
```bash
# 1. GitHub: 최신 커밋 확인
git log --oneline -5

# 2. 빌드 에러 원인 파악
# → Vercel 빌드 로그 상세 확인

# 3. 핫픽스 커밋 생성
git commit -m "fix(build): [에러 원인]"
git push origin main

# 4. Vercel: 자동 재배포 또는 수동 배포
vercel deploy --prod
```

#### 시나리오 3: 런타임 에러
```bash
# 1. Sentry에서 에러 스택 추적
# 2. 로컬에서 재현 시도
npm run dev
# 같은 에러 재현 여부 확인

# 3. 핫픽스 커밋
git commit -m "fix(runtime): [에러 원인]"
git push origin main

# 4. Vercel 재배포
vercel deploy --prod
```

---

## 10단계: 배포 후 Task

### Track A (50콜 실전 검증)
- [ ] 이의처리 효과 측정 데이터 수집 시작
- [ ] Week 1 클로징율 추적
- [ ] 성공 사례 문서화

### Track C (SMS 마법사)
- [ ] SMS 자동화 시퀀스 시작
- [ ] Day 0-3 전송 이력 모니터링
- [ ] 구독율 추적

### Track D (A/B 테스트)
- [ ] Week 2 테스트 데이터 수집
- [ ] A/B 그룹 균등 분배 확인
- [ ] 통계 분석 준비

### Track B (Full Script)
- [ ] 4세그먼트 스크립트 검증 진행 중
- [ ] 예정 배포: 2026-05-28

---

## 최종 체크리스트

### 배포 직전 확인 (1시간 전)
- [ ] git status: 모든 변경사항 커밋됨
- [ ] git log: 최신 커밋 f7da5da 확인
- [ ] npm run build: 성공
- [ ] Vercel 환경변수: 3개 모두 설정
- [ ] 롤백 계획: 문서화 완료

### 배포 시작
```bash
# Vercel Dashboard > Settings > Auto-deployment OFF
# Vercel Dashboard > Deployments > Deploy manually from branch main
```

### 배포 후 1시간
- [ ] Vercel 빌드 로그 "Build successful" 확인
- [ ] 프로덕션 URL 접근성 확인 (200 OK)
- [ ] API 3개 엔드포인트 응답 확인
- [ ] 데이터베이스 마이그레이션 완료 확인

---

## 담당자 및 연락처

- **배포 담당:** hyeseon28@gmail.com
- **옵저빙 담당:** Track A/B/C/D 각 리더
- **비상 연락처:** 없음 (이 시간대 평상시 배포)

---

## 추가 리소스

- [Next.js 16 마이그레이션 가이드](https://nextjs.org/docs)
- [Prisma 마이그레이션 베스트 프랙티스](https://www.prisma.io/docs/orm/prisma-migrate)
- [Vercel 배포 문서](https://vercel.com/docs/deployments/overview)
- [Supabase 백업 복구](https://supabase.com/docs/guides/platform/backups)

---

**최종 승인:** 2026-05-24 오후 2시 (배포 1시간 전)
