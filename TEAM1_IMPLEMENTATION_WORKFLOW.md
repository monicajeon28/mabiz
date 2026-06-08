# Team 1: 구현 워크플로우 및 팀 핸드오프

**문서 버전**: 1.0  
**작성자**: Team 1 - DB 아키텍처 리더  
**기반**: 
- TEAM1_CRITICAL_REVIEW_SHORTLINK_AB_TEST.md (설계 선택)
- TEAM1_SPEC_SHORTLINK_AB_TEST_IMPLEMENTATION.md (기술 스펙)

**상태**: ✅ 설계 완료 | 🚀 Team A/B 구현 시작 준비 완료

---

## 📋 전체 워크플로우

### Phase 1: 설계 검토 (완료) ✅

- [x] **Team 1**: 3가지 옵션 비판적 검토
  - Option 1: 별도 테이블 (간단하지만 API 복잡)
  - Option 2: ShortLink 필드 추가 (마이그레이션 지옥)
  - **Option 3: 하이브리드 (선택됨)** ⭐⭐⭐⭐⭐

- [x] **최종 선택**: Option 3 하이브리드
  - 기존 ShortLink 0줄 수정
  - ShortLinkABTest + ShortLinkImpression 신규 추가
  - 성능 최고, 확장성 최고

---

### Phase 2: 스펙 문서화 (완료) ✅

- [x] **Prisma 스키마** 정의
  - ShortLinkABTest (메타 테이블)
  - ShortLinkImpression (노출 추적)
  - ShortLink 관계 추가 (asVariantA, asVariantB, impressions)

- [x] **API 스펙** 완성
  - POST /api/links/create-test (테스트 생성)
  - GET /api/analytics/ab-tests (테스트 조회)
  - GET /api/analytics/ab-tests/:testId (상세 조회)
  - PATCH /api/links/tests/:testId/start (시작)
  - PATCH /api/links/tests/:testId/declare-winner (우승 선언)

- [x] **리다이렉트 분산 로직** 상세 명시
  - GET /l/[code] 수정 (50:50 분산)
  - A/A 테스트 검증 스크립트

- [x] **에러 처리 & 밸리데이션**
  - 링크 소유권 확인
  - 중복 테스트 방지
  - 리다이렉트 체인 방지

---

### Phase 3: 병렬 구현 (지금부터 시작)

#### 🔵 Team A: DB 마이그레이션 + 기본 API

**담당**: 
- Prisma 마이그레이션
- 데이터베이스 타입 생성 (TypeScript types)
- 기본 CRUD API

**작업 파일**:
```
prisma/
  schema.prisma ← ShortLinkABTest, ShortLinkImpression 추가

src/app/api/links/
  create-test/route.ts ← 신규
  tests/:testId/route.ts ← 신규 (GET, PATCH)

src/lib/
  types/ab-test.ts ← 신규
  validations/shortlink-ab-test.ts ← 신규
  analytics/shortlink-ab-test.ts ← 신규
```

**완료 기준**:
```
✅ npx tsc --noEmit 에러 없음
✅ POST /api/links/create-test 응답 200
✅ GET /api/analytics/ab-tests 응답 200
✅ Unit 테스트 80% 이상 통과
```

**예상 소요시간**: 3-4시간

#### 🟢 Team B: 리다이렉트 로직 + 통계 계산

**담당**:
- 리다이렉트 분산 로직 (GET /l/[code])
- Impression 기록 (SMS 발송 API 수정)
- 통계 계산 유틸리티 (p-value, CTR)
- A/A 테스트 검증

**작업 파일**:
```
src/app/l/[code]/
  route.ts ← 수정 (A/B 분산 로직)

src/app/api/contacts/[id]/
  send-day0-sms/route.ts ← 수정 (Impression 기록)

src/lib/
  analytics/shortlink-ab-test.ts ← 통계 계산
  tests/aa-test-validation.ts ← 신규
```

**완료 기준**:
```
✅ A/A 테스트 통과 (45-55% 분산)
✅ Impression 기록 확인
✅ CTR 계산 정확도 확인 (수동 검증)
✅ Unit 테스트 80% 이상 통과
```

**예상 소요시간**: 3-4시간

---

### Phase 4: 통합 테스트 (순차)

#### 🟠 Team 1: 통합 검증

**담당**:
- E2E 테스트 작성 및 실행
- 데이터 무결성 검증
- 성능 측정 (응답 시간)
- 에러 시나리오 테스트

**테스트 시나리오**:

**Scenario 1: 기본 A/B 테스트 생성 및 실행**
```
1. ShortLink A, B 생성
2. A/B 테스트 생성 (status: DRAFT)
3. 테스트 시작 (status: ACTIVE)
4. SMS 발송 (100회) → Impression 100개 생성
5. 클릭 모의 (각 50회) → A:50, B:50
6. 통계 계산 → p-value 계산
7. 우승 선언 (status: COMPLETED)
✅ 결과 확인
```

**Scenario 2: 리다이렉트 분산 검증**
```
1. A/A 테스트 생성 (같은 링크 2개)
2. 1000회 요청 시뮬레이션
3. 클릭 분산 확인 (A:450-550, B:450-550)
✅ 분산 정상 확인
```

**Scenario 3: 에러 처리**
```
1. 같은 링크 선택 → 400 에러 확인
2. 없는 링크 ID → 404 에러 확인
3. 이미 테스트 중인 링크 → 400 에러 확인
4. 권한 없는 링크 → 403 에러 확인
5. 리다이렉트 체인 방지 → 400 에러 확인
✅ 모든 에러 처리 확인
```

**Scenario 4: 성능 테스트**
```
1. GET /api/analytics/ab-tests (1000개 테스트) → <100ms
2. GET /api/analytics/ab-tests/:testId → <10ms
3. GET /l/[code] (리다이렉트) → <100ms
✅ 성능 목표 달성
```

**완료 기준**:
```
✅ E2E 테스트 100% 통과
✅ 성능 목표 달성
✅ 데이터 무결성 확인
✅ 콘솔 에러 없음
```

**예상 소요시간**: 2-3시간

---

### Phase 5: 배포 (최종)

#### 🔴 Team 1: 배포 준비

**체크리스트**:
```
[ ] 모든 파일 TSC 검증 (npx tsc --noEmit)
[ ] Prisma 마이그레이션 정상 (npx prisma db push)
[ ] 데이터베이스 롤백 플랜 수립
[ ] 모든 테스트 통과 확인
[ ] 코드 리뷰 완료
[ ] 문서 업데이트 완료
```

**배포 절차**:
```
1. Staging 배포
   - 스키마 마이그레이션 실행
   - API 테스트
   - 리다이렉트 테스트
   
2. Production 배포
   - 타이밍: 업무 외 시간 (저녁 6시 이후)
   - 모니터링: 에러율, 응답 시간, DB 상태
   - 롤백 준비: 마이그레이션 rollback 명령어 준비
```

---

## 🎯 각 팀의 책임 범위

### Team A: 데이터베이스 + API 기초

**담당 파일** (수정 금지 영역 외):
```
✅ prisma/schema.prisma (추가만, 기존 수정 X)
✅ src/app/api/links/create-test/
✅ src/app/api/links/tests/
✅ src/app/api/analytics/ab-tests/
✅ src/lib/types/ab-test.ts
✅ src/lib/validations/shortlink-ab-test.ts
✅ src/lib/analytics/shortlink-ab-test.ts
```

**금지 사항**:
```
❌ src/app/l/[code]/route.ts 수정 금지 (Team B)
❌ src/app/api/contacts/*/send-day0-sms/route.ts 수정 금지 (Team B)
❌ src/app/api/messages/** 수정 금지 (Team B)
❌ 기존 ShortLink 모델 수정 금지
```

**완료 서명**:
```
[Team A Lead]
- [ ] 모든 파일 구현 완료
- [ ] Unit 테스트 80% 이상 통과
- [ ] TSC 검증 완료
- [ ] Team B와 인터페이스 검증 완료
- [ ] 코드 리뷰 통과
```

---

### Team B: 리다이렉트 + 통계 + 통합

**담당 파일** (수정 금지 영역 외):
```
✅ src/app/l/[code]/route.ts (리다이렉트 분산 로직)
✅ src/app/api/contacts/[id]/send-day0-sms/route.ts (Impression 기록)
✅ src/app/api/messages/** (Impression 기록이 필요한 경우)
✅ src/lib/tests/aa-test-validation.ts
✅ src/lib/analytics/shortlink-ab-test.ts (통계 계산 함수)
```

**금지 사항**:
```
❌ src/app/api/links/** 수정 금지 (Team A)
❌ prisma/schema.prisma 수정 금지 (Team A)
❌ src/lib/types/ab-test.ts 수정 금지 (Team A)
```

**완료 서명**:
```
[Team B Lead]
- [ ] 리다이렉트 분산 로직 구현 완료
- [ ] Impression 기록 로직 구현 완료
- [ ] 통계 계산 함수 구현 완료
- [ ] A/A 테스트 검증 통과
- [ ] Unit 테스트 80% 이상 통과
- [ ] TSC 검증 완료
- [ ] Team A와 인터페이스 검증 완료
- [ ] 코드 리뷰 통과
```

---

### Team 1: 통합 + 배포

**담당**:
```
✅ E2E 테스트 작성 및 실행
✅ 데이터 무결성 검증
✅ 성능 측정
✅ 배포 준비 (체크리스트)
✅ Staging 배포
✅ Production 배포 지원
```

**최종 서명**:
```
[Team 1 Lead]
- [ ] E2E 테스트 100% 통과
- [ ] 성능 목표 달성
- [ ] 데이터 무결성 확인
- [ ] 배포 체크리스트 완료
- [ ] Production 배포 승인
```

---

## ⚙️ 기술 스택 및 도구

### 필수 사용 도구

**데이터베이스**:
- PostgreSQL (Supabase)
- Prisma ORM

**테스트**:
- Jest (Unit 테스트)
- Playwright (E2E 테스트)
- Vitest (선택사항)

**모니터링**:
- Logger (기존 @/lib/logger 사용)
- Prisma Studio (npx prisma studio)

### 금지 사항

```
❌ npm run build (dev 서버 실행 중 EBUSY 오류)
✅ npx tsc --noEmit (타입 검증만)
✅ npx prisma generate (타입 재생성)
```

---

## 📅 타임라인

### 예상 일정

| Phase | 팀 | 소요시간 | 예상 완료 |
|-------|-----|---------|---------|
| Phase 1: 설계 검토 | Team 1 | 2시간 | 2026-06-06 12:00 ✅ |
| Phase 2: 스펙 문서 | Team 1 | 3시간 | 2026-06-06 15:00 ✅ |
| Phase 3-1: DB + API | Team A | 4시간 | 2026-06-07 12:00 |
| Phase 3-2: 리다이렉트 | Team B | 4시간 | 2026-06-07 12:00 |
| Phase 4: 통합 테스트 | Team 1 | 3시간 | 2026-06-07 15:00 |
| Phase 5: 배포 | Team 1 | 1시간 | 2026-06-07 16:00 |
| **총 소요시간** | | **17시간** | **2026-06-07 16:00** |

### 병렬 실행 가능

```
Phase 3-1 (Team A) ────────────→ Phase 4 (Team 1) → Phase 5
                                   ↑
Phase 3-2 (Team B) ────────────→  │
```

**실제 대기 시간**: ~8시간 (병렬 실행 덕분)

---

## 🚨 위험 요소 및 대응

### Risk 1: 리다이렉트 분산 로직 버그

**증상**: A/A 테스트 실패 (분산 비율이 가우스 분포가 아님)

**대응**:
1. A/A 테스트 선행 (100회 이상)
2. 분산 비율 검증 (45-55% 범위)
3. 로직 재검토 (Math.random() 위치 확인)

### Risk 2: Impression 데이터 불완전

**증상**: CTR 계산 오류 (0% 또는 무한대)

**대응**:
1. 신규 테스트만 Impression 추적
2. 기존 데이터는 "불완전" 표시
3. 최소 샘플 크기 검증 (100 이상)

### Risk 3: 마이그레이션 실패

**증상**: 프로덕션에서 Prisma 마이그레이션 오류

**대응**:
1. Staging 배포에서 사전 테스트
2. 롤백 플랜 준비 (`prisma migrate resolve --rolled-back`)
3. 백업 확보

### Risk 4: 성능 저하

**증상**: GET /api/analytics/ab-tests 응답 시간 >1초

**대응**:
1. 인덱스 추가 (organizationId, status, createdAt)
2. N+1 문제 확인 (leftJoin 사용)
3. 캐싱 고려 (Redis)

---

## 📞 커뮤니케이션 체크포인트

### 일일 스탠드업 (오전 10시)

```
Team A: 
- 어제 진행: ?
- 오늘 계획: ?
- 블로킹 이슈: ?

Team B:
- 어제 진행: ?
- 오늘 계획: ?
- 블로킹 이슈: ?

Team 1:
- 전체 진도 확인
- 의존성 해결
- 위험 요소 모니터링
```

### 전체 동기화 (오후 3시)

```
- 각 팀의 진도 공유
- 인터페이스 검증 (Team A ↔ Team B)
- 최신 이슈 논의
- 내일 일정 확정
```

---

## 📚 참고 문서

1. **TEAM1_CRITICAL_REVIEW_SHORTLINK_AB_TEST.md**
   - 3가지 옵션 비교
   - 최종 선택 근거

2. **TEAM1_SPEC_SHORTLINK_AB_TEST_IMPLEMENTATION.md**
   - 상세 기술 스펙
   - API 문서
   - 코드 예제

3. **기존 코드 참고**
   - `src/app/l/[code]/route.ts` (현재 리다이렉트 로직)
   - `src/app/api/contacts/[id]/send-day0-sms/route.ts` (SMS 발송)
   - `prisma/schema.prisma` (기존 모델들)

---

## ✅ 최종 체크리스트

### Team A 체크리스트

- [ ] Prisma 스키마 추가
  - [ ] ShortLinkABTest 모델
  - [ ] ShortLinkImpression 모델
  - [ ] ShortLink 관계 수정
  - [ ] 인덱스 추가

- [ ] API 구현
  - [ ] POST /api/links/create-test
  - [ ] GET /api/analytics/ab-tests
  - [ ] GET /api/analytics/ab-tests/:testId
  - [ ] PATCH /api/links/tests/:testId/start
  - [ ] PATCH /api/links/tests/:testId/declare-winner

- [ ] 유틸리티 구현
  - [ ] src/lib/types/ab-test.ts
  - [ ] src/lib/validations/shortlink-ab-test.ts

- [ ] 테스트
  - [ ] Unit 테스트 작성
  - [ ] 80% 이상 커버리지
  - [ ] TSC 검증

- [ ] 문서
  - [ ] API 주석
  - [ ] 타입 정의 주석

### Team B 체크리스트

- [ ] 리다이렉트 로직
  - [ ] GET /l/[code]/route.ts 수정
  - [ ] A/B 분산 로직
  - [ ] 테스트 탐지 로직
  - [ ] 통계 업데이트 로직

- [ ] Impression 추적
  - [ ] SMS 발송 API 수정
  - [ ] 링크 코드 추출
  - [ ] Impression 기록

- [ ] 통계 계산
  - [ ] CTR 계산
  - [ ] p-value 계산
  - [ ] 신뢰도 결정

- [ ] A/A 테스트
  - [ ] A/A 테스트 검증 스크립트
  - [ ] 분산 비율 검증
  - [ ] 100회 이상 시뮬레이션

- [ ] 테스트
  - [ ] Unit 테스트 작성
  - [ ] 80% 이상 커버리지
  - [ ] TSC 검증

### Team 1 체크리스트

- [ ] E2E 테스트
  - [ ] Scenario 1: 기본 A/B 테스트
  - [ ] Scenario 2: 리다이렉트 분산
  - [ ] Scenario 3: 에러 처리
  - [ ] Scenario 4: 성능 테스트

- [ ] 데이터 무결성 검증
  - [ ] Impression 개수 확인
  - [ ] Click 개수 확인
  - [ ] 통계 일관성 검증

- [ ] 배포 준비
  - [ ] TSC 검증 (npx tsc --noEmit)
  - [ ] Prisma 마이그레이션 테스트
  - [ ] 롤백 플랜 수립
  - [ ] 모니터링 설정

- [ ] 최종 배포
  - [ ] Staging 배포
  - [ ] Production 배포
  - [ ] 모니터링 확인
  - [ ] 이슈 트래킹

---

**Team 1 최종 메시지**: 이 워크플로우를 따르면 안전하고 빠르게 ShortLink A/B 테스트 시스템을 구축할 수 있습니다. Team A와 B가 병렬로 작업하면 총 8시간 내에 완료 가능합니다. 모두 화이팅! 🚀

**승인자**: Team 1 Lead  
**날짜**: 2026-06-06  
**상태**: ✅ 승인 완료 | 🚀 Team A/B 시작 준비 완료
