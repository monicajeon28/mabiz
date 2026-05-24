# Menu #46 (설정) - 프로젝트 요약 (2026-05-24)

## 📋 프로젝트 개요

**프로젝트명**: Menu #46 (설정 / Settings)  
**상태**: ✅ 스펙 작성 완료, 구현 준비 완료  
**우선순위**: P0 (핵심 기능)  
**예상 기간**: 3주 (21일)  
**팀**: 2명 (FE 1명, BE 1명)

---

## 🎯 프로젝트 목표

1. **사용자 역량강화**: 개인/팀 설정으로 플랫폼 커스터마이징
2. **데이터 안전성**: 암호화된 API 키 저장 및 백업/복구 기능
3. **성과 자동화**: 심리학 렌즈 ON/OFF로 자동화 범위 제어
4. **조직 거버넌스**: 팀원 권한 관리 및 감시 추적

---

## 📂 제공 문서

### 1️⃣ MENU_46_SETTINGS_SPECIFICATION.md
**내용**: 기능 상세 설명, UI/UX 가이드, 보안 고려사항

**섹션**:
- 프로필 설정 (이름, 이메일, 전화, 사진, 서명)
- 팀 설정 (정보, 멤버, 초대, 권한)
- 알림 설정 (채널, SMS 커스터마이징, 카테고리)
- 통합 설정 (API 키, OAuth, 웹훅)
- 데이터 설정 (백업, 내보내기, 복구)
- 심리학 설정 (렌즈, A/B 테스트, 목표)

**특징**:
- 6개 탭 기반 구조
- P0/P1/P2 우선순위별 구현 순서
- 데이터베이스 스키마 초안
- 보안 체크리스트

---

### 2️⃣ MENU_46_API_DESIGN.md
**내용**: RESTful API 명세, 요청/응답 형식, 에러 코드

**API 그룹**:
1. 프로필 (5개 엔드포인트)
   - GET/PATCH /api/settings/profile
   - POST /api/upload/avatar, /signature
   - POST /api/auth/change-password

2. 팀 (7개 엔드포인트)
   - GET/PATCH /api/org/info
   - CRUD /api/settings/team/members
   - POST /api/settings/team/invite

3. 알림 (4개 엔드포인트)
   - GET/PATCH /api/settings/notifications
   - GET/PATCH /api/settings/notifications/sms-sequence

4. 통합 (9개 엔드포인트)
   - API 키 관리 (저장, 수정, 삭제)
   - 연결 테스트
   - Gmail OAuth 플로우
   - 웹훅 관리

5. 데이터 (6개 엔드포인트)
   - 백업 (생성, 로그)
   - 내보내기
   - 복구 (조회, 복구, 영구삭제)

6. 심리학 (6개 엔드포인트)
   - 렌즈 관리 (조회, 토글)
   - A/B 테스트 (조회, 설정, 결과)
   - 목표 (조회, 설정)

**총 37개 엔드포인트**

---

### 3️⃣ MENU_46_DATABASE_SCHEMA.md
**내용**: Prisma ORM 스키마 설계, 암호화 방식, 마이그레이션

**신규 모델 (7개)**:
1. **UserSettings**
   - 프로필 확장 (phone, title, bio)
   - 알림 설정 (SMS, Email, Push)
   - 심리학 렌즈 토글
   - A/B 테스트 설정
   - 리포팅 설정

2. **NotificationCategory**
   - 카테고리별 알림 설정
   - 채널 선택 (SMS, Email, Push, Slack)
   - 카테고리 타입 (COMMISSION_DEADLINE, AB_TEST_RESULTS, SALE_COMPLETE, SYSTEM_ALERTS)

3. **SmsSequenceCustomization**
   - Day 0-3 PASONA 메시지
   - 상품별 커스터마이징
   - 활성화 토글

4. **IntegrationKey**
   - 외부 서비스 API 키 (암호화 저장)
   - AES-256-GCM 암호화
   - 연결 테스트 상태

5. **BackupLog**
   - 백업 이력 추적
   - 상태 (PENDING, COMPLETED, FAILED)
   - 파일 정보 (URL, 크기)

6. **PsychologyGoal**
   - 월간 목표 설정
   - 매출, 전환율, 정산율, 고객 수

7. **AuditLog**
   - 모든 설정 변경 감시
   - 사용자, IP, UserAgent 기록
   - 변경 내용 JSON 저장

**확장 모델**:
- User: profileImageUrl, signatureImageUrl
- Organization: 관계 추가
- OrganizationMember: displayName 추가

---

### 4️⃣ MENU_46_IMPLEMENTATION_PLAN.md
**내용**: 10단계 구현 계획, 각 단계별 상세 가이드

**10단계**:
1. DB 마이그레이션
2. 암호화 유틸리티
3. 공통 API 미들웨어
4. 프로필 API
5. 팀 관리 API
6. 알림 설정 API
7. 통합 API
8. 데이터 관리 API
9. 심리학 설정 API
10. 프론트엔드 구현

**각 단계별 제공 정보**:
- 목표 (Goal)
- 작업 (Deliverables)
- 코드 예시 (Pseudocode)
- 체크리스트 (Checklist)

---

## 🏗️ 아키텍처 개요

### 백엔드 스택
- **런타임**: Node.js (Next.js 14)
- **데이터베이스**: PostgreSQL
- **ORM**: Prisma
- **암호화**: Node.js crypto (AES-256-GCM)
- **파일 저장소**: Google Cloud Storage
- **인증**: JWT (Bearer Token)
- **비동기**: Bull/BullMQ (백그라운드 작업)

### 프론트엔드 스택
- **프레임워크**: React 18 + Next.js
- **UI 라이브러리**: Radix UI / Headless UI
- **스타일**: Tailwind CSS
- **상태 관리**: React Query / TanStack Query
- **폼**: React Hook Form + Zod

### 보안
- **API 키**: AES-256-GCM 암호화 저장
- **인증**: JWT + Refresh Token
- **CSRF**: 토큰 기반 검증
- **Rate Limiting**: IP 기반 제한
- **감시**: AuditLog 기록

---

## 📊 데이터 모델 요약

```
User
├── UserSettings (1:1) ─ NotificationCategory (1:N)
└── AuditLog (1:N)

Organization
├── IntegrationKey (1:N)
├── SmsSequenceCustomization (1:N)
├── BackupLog (1:N)
├── PsychologyGoal (1:N)
└── AuditLog (1:N)

OrganizationMember
└── Role: OWNER / AGENT / FREE_SALES
```

---

## 🔐 권한 모델

| 권한 | 프로필 수정 | 팀 관리 | 통합 설정 | 데이터 관리 | 심리학 설정 |
|------|----------|--------|---------|----------|----------|
| **OWNER** | 자신 + 타인 | ✅ | ✅ | ✅ | ✅ |
| **AGENT** | 자신만 | ❌ | ❌ | ❌ | ❌ |
| **FREE_SALES** | 자신만 | ❌ | ❌ | ❌ | ❌ |

---

## ✅ 구현 체크리스트

### Phase 1: 설계 및 준비
- [x] 아키텍처 설계
- [x] 스펙 문서 작성
- [x] API 설계 완료
- [x] DB 스키마 설계 완료
- [ ] 개발 환경 구축 (Day 5)
- [ ] 프로토타입 UI 작성 (Day 5)

### Phase 2: 백엔드 구현
- [ ] DB 마이그레이션 (Day 5)
- [ ] 암호화 유틸리티 (Day 6)
- [ ] API 미들웨어 (Day 6)
- [ ] 프로필 API (Day 6-7)
- [ ] 팀 관리 API (Day 7)
- [ ] 알림 설정 API (Day 8)
- [ ] 통합 API (Day 8-9)
- [ ] 데이터 관리 API (Day 9-10)
- [ ] 심리학 설정 API (Day 10)
- [ ] 단위 테스트 (Day 11)
- [ ] 통합 테스트 (Day 12)

### Phase 3: 프론트엔드 구현
- [ ] 기본 레이아웃 및 탭 (Day 13)
- [ ] 프로필 UI (Day 13)
- [ ] 팀 관리 UI (Day 14)
- [ ] 알림 설정 UI (Day 15)
- [ ] 통합 설정 UI (Day 15)
- [ ] 데이터 관리 UI (Day 16)
- [ ] 심리학 설정 UI (Day 17)
- [ ] 폼 유효성 검사 (Day 18)
- [ ] 반응형 레이아웃 (Day 18)
- [ ] 접근성 검증 (Day 19)

### Phase 4: 배포 및 모니터링
- [ ] 보안 검증 (Day 20)
- [ ] 성능 최적화 (Day 20)
- [ ] Lighthouse 90+ 달성 (Day 20)
- [ ] 배포 준비 (Day 21)
- [ ] 실제 배포 (Day 21)
- [ ] 모니터링 셋업 (Day 21)

---

## 📈 성과 지표

### 기능별 목표

| 기능 | 목표 | 측정 지표 |
|------|------|----------|
| **프로필 관리** | 사용자 정보 커스터마이징 | 프로필 완성율 > 80% |
| **팀 관리** | 권한 기반 접근 제어 | 멤버 관리 오류 < 1% |
| **알림 설정** | 개인화된 알림 | 알림 구독율 > 60% |
| **통합** | 외부 서비스 연동 | 통합 성공률 > 99% |
| **데이터 관리** | 안전한 백업/복구 | 백업 가용성 99.9% |
| **심리학 설정** | 렌즈 기반 자동화 | 렌즈 활성화율 > 70% |

### 기술 성능 목표

| 지표 | 목표 |
|------|------|
| Lighthouse Score | 90+ |
| LCP (Largest Contentful Paint) | < 2.5s |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| 번들 크기 | < 300KB (gzipped) |
| API 응답 시간 | < 200ms (p95) |
| 데이터베이스 쿼리 시간 | < 100ms |
| 테스트 커버율 | > 80% |

---

## 🚀 배포 체크리스트

### 배포 전 확인사항

**보안**:
- [ ] API 키 암호화 검증
- [ ] JWT 토큰 검증
- [ ] CSRF 토큰 구현
- [ ] Rate Limiting 작동
- [ ] 권한 검증 완벽
- [ ] 감사 로그 기록

**성능**:
- [ ] Lighthouse 90+ 달성
- [ ] Core Web Vitals 최적화
- [ ] 번들 크기 최적화
- [ ] DB 쿼리 최적화
- [ ] 캐싱 전략 구현

**기능**:
- [ ] 모든 37개 API 구현
- [ ] 모든 6개 탭 UI 완성
- [ ] 유효성 검사 완벽
- [ ] 에러 핸들링 완벽
- [ ] 로딩 상태 표시

**호환성**:
- [ ] 브라우저 호환성 테스트 (Chrome, Safari, Firefox, Edge)
- [ ] 모바일 반응형 테스트
- [ ] 접근성 WCAG 2.1 AA 준수

**모니터링**:
- [ ] Sentry 에러 추적 설정
- [ ] DataDog APM 설정
- [ ] 로그 수집 설정
- [ ] 알림 규칙 설정

---

## 📞 문의 및 지원

### 기술 지원
- **설계 질문**: 아키텍처 및 스키마 검토
- **구현 가이드**: 각 단계별 상세 지시서
- **테스트 가이드**: 단위 및 통합 테스트 작성 방법

### 관련 문서
- MENU_46_SETTINGS_SPECIFICATION.md - 기능 상세
- MENU_46_API_DESIGN.md - API 명세
- MENU_46_DATABASE_SCHEMA.md - DB 설계
- MENU_46_IMPLEMENTATION_PLAN.md - 구현 가이드

---

## 📅 타임라인

```
Week 1 (설계 + 준비)
├─ Day 1-2: 아키텍처 확정
├─ Day 3-4: UI 목업
└─ Day 5: DB 마이그레이션

Week 2 (백엔드 + 프론트엔드 초반)
├─ Day 6-7: 프로필/팀 API + UI
├─ Day 8-9: 알림/통합 API + UI
└─ Day 10: 데이터/심리학 API

Week 3 (마무리 + 배포)
├─ Day 11-12: 백엔드 테스트
├─ Day 13-19: 프론트엔드 완성 + 통합 테스트
└─ Day 20-21: 배포 + 모니터링
```

---

## 💡 핵심 특징

### 1. 심리학 기반 설정
- L0-L10 렌즈 동적 활성화
- A/B 테스트 자동 실행
- Day 0-3 PASONA 메시지 커스터마이징
- 월간 목표 자동 추적

### 2. 엔터프라이즈급 보안
- AES-256-GCM API 키 암호화
- JWT + Refresh Token 인증
- CSRF 토큰 검증
- IP 기반 Rate Limiting
- 완전한 감시 로그

### 3. 사용자 역량강화
- 직관적인 6탭 UI
- 모바일/태블릿 반응형
- 접근성 WCAG 2.1 AA
- 실시간 피드백 (Toast)

### 4. 데이터 안전성
- 자동 백업 (일일/주간/월간)
- 30일 복구 기간
- CSV/JSON/PDF 내보내기
- GCS 암호화 저장

---

## 🎓 학습 자료

### 참고 메모리
- [[grant_cardone_closing]] - 클로징 전략
- [[pasona_framework_complete]] - SMS 카피라이팅
- [[psychology_theories_master]] - 심리학 이론
- [[menu_39_crm_5product_integration_complete]] - CRM 통합

### 관련 프로젝트
- Menu #38: SMS 자동화
- Menu #39: CRM 통합
- Menu #40: 수익 계산기

---

## ✨ 다음 단계

1. **팀 구성**: FE 1명, BE 1명 배정
2. **개발 환경 준비**: 로컬 개발 환경 설정
3. **스프린트 계획**: 2주 스프린트로 Phase 2-3 진행
4. **일일 스탠드업**: 매일 10:00 AM KST
5. **주간 검토**: 매주 금요일 배포 준비 검토

---

**최종 승인일**: 2026-05-24  
**프로젝트 상태**: ✅ 구현 준비 완료  
**예상 완료일**: 2026-06-14  
**문서 버전**: 1.0  
**작성자**: 마비즈 CRM 팀
