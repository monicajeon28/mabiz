# Phase: 병렬형 코드 검토 (Build Error 예방) - 무한루프

## 🎯 목표
Vercel 배포 전 Stage 4 코드 (Menu #54-59)를 **5개 병렬 에이전트**가 비판적으로 검토하여 빌드 에러 100% 사전 차단

## 📋 5개 병렬 에이전트 역할 분담

### Agent α: TypeScript 타입 안전성 검증
**담당 파일:**
- src/app/api/menu-54/* (L1 렌즈 API)
- src/app/api/menu-55/* (L5+L6 렌즈 API)
- src/app/api/menu-56/* (L10 렌즈 API)

**검사 항목:**
- ✅ 모든 함수 반환 타입 명시
- ✅ req/res 타입 NextRequest/NextResponse 정확성
- ✅ Prisma 타입 자동완성 검증
- ✅ 제네릭 타입 파라미터 정의 완전성
- ✅ any 타입 없음 (strict mode)
- ✅ 배열/객체 타입 완전성
- ✅ 옵셔널 vs 필수 필드 구분
- ✅ 에러 타입 정의

**산출물:**
- [ ] TypeScript 컴파일 에러 목록 (파일:라인:메시지)
- [ ] 수정 제안 코드 스니펫
- [ ] 심각도 (CRITICAL/HIGH/MEDIUM)

---

### Agent β: Prisma Schema + DB 호환성
**담당:**
- prisma/schema.prisma (Menu #54-59 새 필드)
- 모든 @db.* 타입 검증
- 인덱스 정의 완전성

**검사 항목:**
- ✅ 새 필드 타입 Neon PostgreSQL 호환성
- ✅ @index/@unique 문법 정확성
- ✅ 관계(relation) 양방향 대칭성
- ✅ @default 값 문법 및 함수 유효성
- ✅ 마이그레이션 가능성 (prisma migrate 테스트)
- ✅ gin_trgm_ops 같은 호환성 문제 재발 방지
- ✅ 필드명 충돌 검사

**산출물:**
- [ ] Prisma 컴파일 에러 목록
- [ ] 스키마 설계 개선사항
- [ ] 마이그레이션 스크립트 필요성 여부

---

### Agent γ: 의존성 + Package.json 검증
**담당:**
- package.json (모든 의존성)
- yarn.lock 재생성 유효성
- transitive dependency 버전 충돌

**검사 항목:**
- ✅ 모든 dependencies 버전 명시 (undefined 없음)
- ✅ devDependencies에만 있어야 할 패키지 없는지
- ✅ peer dependencies 충돌 없음
- ✅ @types/* 패키지 일관성
- ✅ 사용 중인 패키지만 포함 (불필요한 패키지 제거)
- ✅ 버전 범위 설정 합리성 (^, ~, = 혼용)
- ✅ yarn.lock 재생성 완전성 검증

**산출물:**
- [ ] 문제 있는 의존성 목록
- [ ] package.json 정정 제안
- [ ] yarn.lock 정정 필요성 여부

---

### Agent δ: API 엔드포인트 통합 검증
**담당:**
- src/app/api/menu-54/price-objection.ts
- src/app/api/menu-54/ab-test-variant.ts
- src/app/api/menu-54/apply-best.ts
- src/app/api/menu-54/metrics.ts
- src/app/api/menu-55/* (4 API)
- src/app/api/menu-56/* (5 API)
- src/app/api/menu-57/* (4 API)
- src/app/api/menu-58-59/* (7 API + 2 분석 API)

**검사 항목:**
- ✅ HTTP 메서드 (GET/POST/PUT/DELETE) 정의
- ✅ 요청 바디 검증 (zod/타입)
- ✅ 응답 스키마 일관성
- ✅ 에러 처리 (try-catch, 상태 코드)
- ✅ Prisma 쿼리 문법 (create/update/delete)
- ✅ 환경변수 사용 (.env 필수 필드)
- ✅ 콘솔 로그 제거 (배포 전 cleanup)
- ✅ 보안 (입력 sanitization, SQL injection 방지)
- ✅ 성능 (N+1 쿼리, 인덱스 활용)

**산출물:**
- [ ] API별 에러 목록 (엔드포인트/메서드/문제)
- [ ] 수정 코드
- [ ] 테스트 케이스 제안

---

### Agent ε: SMS Cron + 유틸리티 함수 검증
**담당:**
- src/lib/cron/sms-day0-init.ts
- src/lib/cron/sms-day1-objection.ts
- src/lib/cron/sms-day2-value.ts
- src/lib/cron/sms-day3-action.ts
- src/lib/cron/sms-followup.ts
- src/lib/utils/* (모든 유틸 함수)

**검사 항목:**
- ✅ 크론 시간대 문법 (0 0 * * * 형식)
- ✅ 비동기 처리 (async/await, Promise)
- ✅ 에러 처리 (타임아웃, 재시도 로직)
- ✅ 환경변수 의존성
- ✅ 유틸 함수 순환 호출(circular dependency) 없음
- ✅ SMS 템플릿 문자열 이스케이프 처리
- ✅ 날짜 계산 정확성 (timezone 포함)
- ✅ 로깅 구조 (디버깅 용이)
- ✅ 메모리 누수 방지 (connection pooling)

**산출물:**
- [ ] Cron/유틸 함수 에러 목록
- [ ] 성능 최적화 제안
- [ ] 모니터링 로그 제안

---

## 🔄 무한루프 프로세스

### Iteration 1: 초기 검사
1. 5개 에이전트 **병렬 실행** (동시)
2. 각 에이전트 검사 완료 → 산출물 저장
3. 모든 에이전트 완료 대기

### Iteration 2: 종합 분석
- 5개 산출물 병합
- **우선순위 정렬** (CRITICAL → HIGH → MEDIUM)
- 수정 작업 목록 생성

### Iteration 3: 수정 + 재검증
- 모든 CRITICAL 에러 수정
- 다시 5개 에이전트 재검사
- 순환: 에러 없을 때까지 반복

### Iteration 4: 최종 승인 전
- npm run build 로컬 실행 성공 확인
- TypeScript 컴파일 성공 확인
- yarn.lock 최종 검증

---

## 📊 성공 기준

```
배포 조건 (ALL 만족):
✅ TypeScript 컴파일 에러 = 0
✅ Prisma schema 에러 = 0
✅ Package.json 의존성 에러 = 0
✅ API 엔드포인트 에러 = 0
✅ SMS Cron 함수 에러 = 0
✅ npm run build 성공
✅ 모든 에이전트 재검증 통과
```

## ⏸️ 대기 조건

- Vercel 배포는 **사용자 명령**까지 대기 ("배포 가보자")
- 모든 코드 검토 완료되면 **준비 완료 보고**

---

**시작:** 사용자 명령 시 5개 에이전트 병렬 실행
