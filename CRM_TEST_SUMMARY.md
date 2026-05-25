# CRM 연결 및 사용자 역할 테스트 - 종합 요약
**작성일**: 2026-05-25  
**상태**: 수립 완료  
**버전**: 1.0

---

## 📌 Overview

마비즈 CRM 시스템이 Neon DB 복구 이후 **모든 사용자 역할(Admin, Manager, Sales, Pre-Sales)**이 정상 작동하는지 검증하기 위한 통합 테스트 계획입니다.

### 핵심 목표
1. **인증 시스템**: Clerk/NextAuth 정상 작동 확인
2. **권한 관리**: 역할 기반 접근 제어(RBAC) 검증
3. **CRM 기능**: Contact CRUD, 렌즈 분류, SMS 발송 테스트
4. **API 연동**: CruiseDot 상품 조회 및 Webhook 처리
5. **성능**: 로딩 속도, 쿼리 최적화, 메모리 관리

---

## 📂 산출물 (4개 문서)

### 1. **CRM_CONNECTION_TEST_PLAN.md** (메인 계획서)
- ✅ 시스템 아키텍처 개요
- ✅ 4가지 사용자 역할 정의 (Admin, Manager, Sales, PreSales)
- ✅ 6가지 Phase별 테스트 항목 (인증, 권한, CRM, CruiseDot, 성능, 동기화)
- ✅ 테스트 실행 계획 (4 Stage, 총 4시간)
- ✅ 성공 기준 (필수/권장)
- ✅ 문제 해결 가이드 (4가지 시나리오)

**용도**: 테스트 전체 개요 및 전략 수립

---

### 2. **CRM_CONNECTION_DETAILED_TEST_CASES.md** (상세 테스트 케이스)
- ✅ TC-001 ~ TC-050 (50개 테스트 케이스)
- ✅ Phase 1: 인증 (TC-001~010)
- ✅ Phase 2: 권한 (TC-011~025)
- ✅ Phase 3: CRM 기능 (TC-026~035)
- ✅ Phase 4: CruiseDot API (TC-036~045)
- ✅ Phase 5: 성능 (TC-046~050)

**용도**: 각 테스트 케이스 상세 실행 방법

---

### 3. **CRM_TEST_EXECUTION_QUICK_START.md** (빠른 시작 가이드)
- ✅ 10초 안에 시작하기
- ✅ 6 Step 단계별 실행 계획
- ✅ 자동화 테스트 명령어
- ✅ 수동 E2E 테스트 체크리스트
- ✅ 문제 해결 빠른 팁
- ✅ 최종 체크리스트

**용도**: 테스트 엔지니어의 일일 실행 가이드

---

### 4. **CRM_TEST_SUMMARY.md** (이 문서)
- ✅ 종합 요약 및 로드맵
- ✅ 사용자 역할별 권한 매트릭스
- ✅ API 엔드포인트 검증 리스트
- ✅ 렌즈별 데이터 필드 매핑

**용도**: 빠른 참고 및 오버뷰

---

## 👥 사용자 역할 정의 & 권한 매트릭스

### 사용자 4가지 유형

| 역할 | 계정타입 | 권한 | 테스트 이메일 | 접근 가능 경로 |
|------|--------|------|-------------|-------------|
| **Admin** (관리) | GlobalAdmin | GLOBAL_ADMIN | admin@mabiz.test | /admin/*, /contracts/*, /dashboard/* |
| **Manager** (대리점장) | OrganizationMember | MEMBER | manager@mabiz.test | /dashboard/*, /dashboard/team/*, /contacts/* |
| **Sales** (판매원) | OrganizationMember | MEMBER | sales@mabiz.test | /dashboard/*, /contacts/*, /campaigns/* |
| **PreSales** (상담) | OrganizationMember | MEMBER | presales@mabiz.test | /contacts/*, /campaigns/*, /messages/* |

### 권한 레벨 (Hierarchy)
```
GLOBAL_ADMIN (100) ← 최고 권한
    ↓
MEMBER (50) ← 일반 사용자
    ↓
UNKNOWN (0) ← 공개 (로그인 불필요)
```

### 기능별 권한

| 기능 | Admin | Manager | Sales | PreSales |
|------|-------|---------|-------|----------|
| 사용자 관리 (/admin/users) | ✅ | ❌ | ❌ | ❌ |
| 계약서 템플릿 (/contracts/*) | ✅ | ❌ | ❌ | ❌ |
| 팀 관리 (/dashboard/team/*) | ✅ | ✅ | ✅ | ❌ |
| 고객 조회 (/contacts) | ✅ | ✅ | ✅ | ✅ |
| 고객 생성 | ✅ | ✅ | ✅ | ✅ |
| 고객 수정 (본인) | ✅ | ✅ | ✅ | ✅ |
| 고객 수정 (타인) | ✅ | ✅ | ❌ | ❌ |
| SMS 발송 | ✅ | ✅ | ✅ | ❌ |
| 캠페인 조회 | ✅ | ✅ | ✅ | ✅ |
| 메시지 발송 | ✅ | ✅ | ✅ | ✅ |

---

## 🔌 API 엔드포인트 검증 체크리스트

### 인증 API
```
POST   /api/auth/login              로그인
POST   /api/auth/logout             로그아웃
GET    /api/auth/session            세션 조회
POST   /api/auth/refresh            토큰 갱신
```

### Contact 관리 API
```
GET    /api/contacts                목록 조회 (필터링)
POST   /api/contacts                신규 생성
GET    /api/contacts/:id            상세 조회
PATCH  /api/contacts/:id            수정
DELETE /api/contacts/:id            삭제 (Soft)
```

### CRM 렌즈 API
```
PATCH  /api/contacts/:id            L0-L10 렌즈 데이터 업데이트
GET    /api/contacts/:id/lenses     렌즈 분류 결과 조회
POST   /api/contacts/:id/lenses     렌즈 재분류
```

### 상품 API (CruiseDot)
```
GET    /api/products                상품 목록 조회
GET    /api/products/:id            상품 상세 조회
POST   /api/bookings                예약 생성
GET    /api/bookings/:id            예약 상세 조회
```

### SMS 자동화 API
```
GET    /api/sms/templates           SMS 템플릿 조회
POST   /api/sms/send                SMS 발송
GET    /api/sms/logs                발송 로그 조회
```

### Webhook API
```
POST   /api/webhooks/cruisedot-payment    CruiseDot 결제 웹훅
POST   /api/webhooks/contacts-update      고객정보 업데이트 웹훅
```

### 관리자 API
```
GET    /api/admin/users             사용자 목록 (Admin only)
POST   /api/admin/users             사용자 생성 (Admin only)
GET    /api/admin/contacts          모든 조직의 고객 (Admin only)
GET    /api/admin/reports           대시보드 리포트 (Admin only)
```

---

## 📊 CRM 렌즈 데이터 필드 매핑

### L0: 부재중 고객 재활성화
| 필드명 | 타입 | 범위 | 설명 |
|--------|------|------|------|
| reactivationSegment | string | "3-6m" \| "6-12m" \| "1y+" | 부재 기간 세그먼트 |
| reactivationLikelihood | int | 0-100 | 재구매 가능성 점수 |
| lastCruiseDate | datetime | - | 마지막 크루즈 날짜 |
| cruiseCount | int | 0+ | 총 크루즈 이용 횟수 |
| vipStatus | string | "GOLD" \| "SILVER" | VIP 레벨 |

### L1: 가격이의 대응
| 필드명 | 타입 | 설명 |
|--------|------|------|
| priceObjectionFlag | boolean | 가격 관련 이의 여부 |
| l1ABTestVariant | string | A/B 테스트 선택 변형 |
| l1OptimizationScore | int | 최적화 점수 (0-100) |

### L2: 준비 불안도 평가
| 필드명 | 타입 | 설명 |
|--------|------|------|
| anxietyScore | int | 불안도 점수 (0-100) |
| anxietyCategory | string | "low" \| "medium" \| "high" |
| preparationStage | string | 준비 단계 (inquiry, visa_concern, health_concern, ...) |
| visaRequired | boolean | 비자 필요 여부 |
| passportDaysLeft | int | 여권 남은 유효일 |
| healthConcerns | string | 건강 우려사항 (쉼표 구분) |
| firstTimeCruise | boolean | 첫 크루즈 여부 |
| familyWithKids | boolean | 자녀 동반 여부 |

### L3: 차별성 미인지
| 필드명 | 타입 | 설명 |
|--------|------|------|
| competitorMentioned | boolean | 경쟁사 언급 여부 |
| competitorNames | string[] | 언급된 경쟁사 목록 |
| differentiationScore | int | 차별성 이해도 (0-100) |
| lastCompetitorMentionAt | datetime | 마지막 경쟁사 언급 시간 |

### L5: 자기투영 (의료신뢰)
| 필드명 | 타입 | 설명 |
|--------|------|------|
| healthConcerns | string | 배멀미, 당뇨, 고혈압 등 |
| medicalTrustScore | int | 의료 신뢰도 (0-100) |

### L6: 타이밍 (손실회피, 희소성)
| 필드명 | 타입 | 설명 |
|--------|------|------|
| departureDate | datetime | 예정 출발일 (긴박감 유발) |
| inventoryLevel | int | 남은 객실 수 (희소성) |
| priceExpireAt | datetime | 가격 유효 기간 (시간 제한) |

### L7: 동반자 설득
| 필드명 | 타입 | 설명 |
|--------|------|------|
| familyComposition | string | "spouse" \| "parents" \| "friends" \| "mixed" |
| decisionMaker | string | "self" \| "spouse" \| "parent" \| "friend" |
| spouseEngagementLevel | int | 배우자 관심도 (0-100) |

### L8: 재구매 습관화
| 필드명 | 타입 | 설명 |
|--------|------|------|
| cruiseCount | int | 누적 크루즈 횟수 |
| averageRepeatInterval | int | 평균 재구매 간격 (일) |
| ltv | decimal | 생명주기 가치 (평생 예상 구매액) |
| loyaltyTier | string | 로열티 티어 |

### L10: 즉시 구매 클로징
| 필드명 | 타입 | 설명 |
|--------|------|------|
| readinessScore | int | 구매 준비도 (0-100) |
| closingStrategy | string | 선택된 클로징 전략 |
| tripwireOffer | string | 즉시 구매 유도 오퍼 |

---

## 🧪 테스트 실행 시간표

### Phase 1: 인증 시스템 (TC-001~010)
**소요시간**: 30분
- 로그인/로그아웃: 15분
- 세션 관리: 10분
- 에러 처리: 5분

### Phase 2: 권한 검증 (TC-011~025)
**소요시간**: 45분
- 경로 제한: 15분
- Contact RBAC: 15분
- 조직 격리: 15분

### Phase 3: CRM 기능 (TC-026~035)
**소요시간**: 45분
- CRUD 기본: 15분
- L0-L3 렌즈: 20분
- SMS 발송: 10분

### Phase 4: CruiseDot (TC-036~045)
**소요시간**: 30분
- API 연동: 15분
- Webhook: 15분

### Phase 5: 성능 (TC-046~050)
**소요시간**: 30분
- 로딩 속도: 15분
- N+1 최적화: 10분
- 메모리 누수: 5분

**🎯 총 소요시간**: 180분 (3시간)

---

## ✅ 성공 기준

### Tier 1: CRITICAL (필수)
```
□ Admin/Manager/Sales/PreSales 4명 모두 로그인 성공
□ /admin/* 경로 Admin만 접근 가능
□ Contact CRUD API 정상 작동
□ CruiseDot Webhook 수신 및 처리
□ Neon DB 데이터 일관성 확인
□ 페이지 로딩 3초 이내
```

### Tier 2: HIGH (권장)
```
□ Lighthouse 성능 > 85점
□ API 응답 < 200ms
□ 대량 조회 < 500ms
□ N+1 쿼리 없음
□ 에러 로그 0건
```

### Tier 3: MEDIUM (개선사항)
```
□ 코드 커버리지 > 70%
□ 메모리 누수 없음
□ 동시 요청 처리 100% 성공
```

---

## 🔍 주요 검증 포인트

### 1. 미들웨어 (src/middleware.ts)
```
✓ PROTECTED_ROUTES 정의 확인
✓ isProtectedRoute() 로직 검증
✓ RBAC (role-based access control) 동작
✓ 권한 없을 시 /403-forbidden 리다이렉트
✓ 만료된 세션 자동 삭제
```

### 2. 라우트 규칙 (src/lib/route-rules.ts)
```
✓ 15개 경로 규칙 매핑
✓ GLOBAL_ADMIN > MEMBER > UNKNOWN 계층
✓ checkPathAccess() 함수 동작
✓ matchPattern() glob 패턴 매칭
```

### 3. Prisma 스키마 (prisma/schema.prisma)
```
✓ GlobalAdmin 모델
✓ OrganizationMember role 필드
✓ MabizSession 관계 설정
✓ Contact 렌즈 필드 (L0-L10)
✓ 외래키 제약 조건
```

### 4. CruiseDot 웹훅 (src/app/api/webhooks/cruisedot-payment/)
```
✓ HMAC-SHA256 서명 검증
✓ eventType 처리 (payment.created/updated/refunded)
✓ Contact.lastPaymentStatus 업데이트
✓ 거래 내역 기록
```

---

## 📋 테스트 결과 리포팅

### 테스트 결과 기록 템플릿

```markdown
# CRM 테스트 결과 (2026-05-25)

## Summary
- **총 테스트**: 50개
- **성공**: 48개 (96%)
- **실패**: 2개 (4%)
- **소요시간**: 3시간 15분

## Phase별 결과
### Phase 1: 인증 (TC-001~010)
- [x] TC-001: Clerk 로그인 페이지 - PASS
- [x] TC-002: Admin 로그인 - PASS
...

### Phase 2: 권한 (TC-011~025)
- [x] TC-011: Admin /admin/* - PASS
...

## 실패 항목
### [TC-035] Contact 대량 조회 성능
- **증상**: 2.8초 (기준: 2.5초)
- **원인**: missing database index
- **해결**: ADD INDEX on Contact(organizationId)
- **추적**: GitHub Issue #456

## 다음 단계
- [ ] 위 2가지 실패 이슈 해결
- [ ] Phase 2 재테스트
- [ ] Stage 2 배포 승인
```

---

## 🚀 배포 시작 체크리스트

```
테스트 전
[ ] 환경변수 확인 (.env.local, .env.production)
[ ] 데이터베이스 백업 (Neon)
[ ] Clerk 테스트 계정 4개 생성
[ ] CruiseDot API Key 준비

테스트 중
[ ] 자동화 테스트 실행 (npm test)
[ ] 수동 E2E 테스트 (각 사용자별)
[ ] 성능 검증 (Lighthouse)
[ ] 데이터 무결성 확인

테스트 후
[ ] 테스트 결과 리포팅
[ ] 실패 이슈 GitHub 등록
[ ] 코드 리뷰 완료
[ ] 배포 승인 획득
```

---

## 📞 지원 연락처

| 역할 | 이름 | 연락처 | 담당 |
|------|------|--------|------|
| Test Lead | (QA 담당) | qa@mabiz.com | 테스트 계획/결과 |
| Dev Support | (개발 담당) | dev@mabiz.com | 환경 구성/버그 수정 |
| DB Admin | (DB 담당) | dba@mabiz.com | 데이터베이스 관리 |

---

## 📚 참고 문서

| 문서 | 용도 | 대상 |
|------|------|------|
| CRM_CONNECTION_TEST_PLAN.md | 전체 전략 및 상세 가이드 | 테스트 리더, PM |
| CRM_CONNECTION_DETAILED_TEST_CASES.md | 50개 테스트 케이스 상세 실행법 | QA, 테스트 엔지니어 |
| CRM_TEST_EXECUTION_QUICK_START.md | 빠른 시작 가이드 및 명령어 | 테스트 엔지니어 |
| CRM_TEST_SUMMARY.md | 종합 요약 및 오버뷰 | 모든 팀 |

---

## 🎯 목표 달성 로드맵

```
2026-05-25 (오늘)
├─ 테스트 계획 수립 ✅
│  ├─ 메인 계획서 (CRM_CONNECTION_TEST_PLAN.md)
│  ├─ 상세 케이스 (CRM_CONNECTION_DETAILED_TEST_CASES.md)
│  ├─ 빠른 시작 가이드 (CRM_TEST_EXECUTION_QUICK_START.md)
│  └─ 요약 문서 (CRM_TEST_SUMMARY.md)

2026-05-26 (내일)
├─ Stage 1: 환경 준비 (1시간)
├─ Stage 2: 자동화 테스트 (1시간)
└─ Stage 3: 수동 E2E 테스트 (1.5시간)

2026-05-27
├─ Stage 4: CruiseDot API 테스트 (30분)
├─ Stage 5: 성능 테스트 (30분)
└─ 결과 정리 및 리포팅 (30분)

2026-05-28
├─ 실패 이슈 해결 및 재테스트
├─ 최종 코드 리뷰
└─ 배포 승인
```

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0  
**상태**: ✅ 수립 완료, 🚀 실행 준비 완료

