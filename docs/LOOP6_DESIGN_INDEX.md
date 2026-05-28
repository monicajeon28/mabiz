# Loop 6 설계 문서 인덱스 (2026-05-28)

## 🎯 전체 5개 에이전트 병렬 작업

| Agent | 담당 | 상태 | 문서 | 예상 효과 |
|-------|------|------|------|---------|
| **A** | Settlement Analyzer | 🔄 설계 중 | `/loop6_agent_a_settlement_analyzer.md` | 1M행 <2초, 정산 자동화 |
| **B** | Webhook Infrastructure | 🔄 설계 중 | `/loop6_agent_b_webhook_infrastructure.md` | 99.9% 성공율 |
| **C** | Affiliate Integration | 🔄 설계 중 | `/loop6_agent_c_affiliate_integration.md` | 파트너 수익 +400% |
| **D** | Customer Integrator | ✅ **완료** | `/loop6_agent_d_customer_integrator.md` | 응답시간 50% ↓ |
| **E** | Communication Automator | ⏳ 예정 | `/loop6_agent_e_communication_automator.md` | Day 0-3 자동화 |

---

## Agent D: Customer Integrator (고객 통합 360도 뷰)

### 📄 설계 문서 (3개)

1. **완전 설계** `/docs/loop6_agent_d_customer_integrator.md`
   - 9개 섹션, 550줄, 모든 상세 사항 포함
   - ERD, OpenAPI 스펙, 성능 최적화, PII 마스킹, 구현 체크리스트 등
   - **읽기**: 30분 (전체 이해)

2. **빠른 참고** `/docs/loop6_agent_d_quick_start.md`
   - 핵심만 정리, 5-10분 만에 파악
   - 아키텍처, 기능 3가지, 개발 체크리스트, 명령어 예시
   - **읽기**: 5분 (빠른 확인)

3. **요약** `/docs/LOOP6_AGENT_D_SUMMARY.txt`
   - 1페이지 요약, 모든 메타데이터 포함
   - 파일 매핑, 배포 계획, 다음 에이전트 정보
   - **읽기**: 3분 (진행 상황 확인)

### 💻 구현 파일 (2개, 기본 골격)

1. **타입 정의** `/src/lib/contact-integrator/types.ts`
   - Contact360Response, MaskOptions, RiskProfile 등 20+ 인터페이스
   - 완전하고 실제 사용 가능

2. **기본 구조** `/src/lib/contact-integrator/index.ts`
   - getContact360(), fetchContact360FromDb(), createDataLoaders()
   - 기본 DataLoader 구조, 캐시 관리 함수
   - TODO 주석으로 채워야 할 부분 표시

### 📋 필수 생성 파일 (8개)

**Lib 파일**:
```
src/lib/contact-integrator/
├── pii-mask.ts           (PII 마스킹 함수)
├── risk-calculator.ts    (위험도 계산 엔진)
└── redis-cache.ts        (캐시 전략)
```

**API 엔드포인트**:
```
src/app/api/contacts/[id]/
├── 360/route.ts          (메인: 360도 뷰)
├── orders/route.ts       (거래 이력)
├── communications/route.ts (로그)
├── psychology/route.ts   (렌즈 정보)
├── risk-score/route.ts   (위험도 + 액션)
└── affiliate/route.ts    (Affiliate 추적)
```

**테스트 파일**:
```
tests/
├── lib/contact-integrator/contact-360.test.ts
├── api/contacts/360.test.ts
├── lib/pii-mask.test.ts
└── lib/risk-calculator.test.ts
```

---

## 🎯 핵심 설계 요점

### 아키텍처

```
GET /api/contacts/:id/360
    ↓
Redis 캐시 (30분 TTL)
    ├─ HIT: <100ms 반환
    └─ MISS: DB 조회
        ↓
    DataLoader + Batch Query (N+1 제거)
        ↓
    데이터 병합 + 위험도 계산
        ↓
    PII 마스킹 (권한 기반)
        ↓
    Redis 저장 + 반환
```

### 성능 목표

| 메트릭 | 현재 | 목표 | 달성율 |
|--------|------|------|--------|
| 응답시간 (캐시) | - | <1s | TBD |
| 응답시간 (신규) | 3-5s | <2s | 50% ↓ |
| DB 쿼리 수 | 5+ | 1 | 80% ↓ |
| DB 부하 | 100% | 30% | 70% ↓ |
| 캐시 히트율 | 0% | 80% | TBD |

### 주요 기능 3가지

1. **통합 360도 뷰** (`/api/contacts/:id/360`)
   - Contact + GoldMember + Partner + Groups + Orders
   - Psychology Lens + Risk + Affiliate
   - 응답: ~50KB JSON (1개)

2. **PII 마스킹** (권한 기반)
   - Admin: 원본
   - Manager: 부분 (전화번호 뒤 4자리)
   - Agent/Viewer: 전체 (010XXXX5678)
   - 준수: GDPR, PIPA

3. **위험도 + 권장액션**
   - Risk Score: 0-100
   - 7가지 플래그 (준비불안, 경쟁사, 배우자동의 등)
   - 자동생성 액션 (3-5개)

---

## 📅 개발 일정 (1주)

### Week 1 (2026-05-29 ~ 2026-06-05)

**Day 1-2 (수-목)**: 기초 구현
- DataLoader + 쿼리 최적화
- API 엔드포인트 (기본)
- Redis 캐싱 설정
- PII 마스킹

**Day 2-3 (목-금)**: 기능 확장
- 위험도 계산
- 주문/커뮤니케이션 조회
- 렌즈 정보 통합
- Affiliate 추적

**Day 4 (토)**: 성능 최적화
- DataLoader 검증
- 캐시 테스트
- 벤치마크 (<1s, <2s)
- 인덱스 추가

**Day 5 (일)**: 테스트 & 배포
- 단위 테스트
- 통합 테스트
- PII 마스킹 검증
- Canary 배포 (50%)

**Day 6-7 (월-화)**: 안정화
- cruisedot 연동
- 모니터링
- 100% 배포

---

## 🚀 예상 효과

### 성능
- 응답시간: 3-5s → 1s (67% ↓)
- DB 부하: 100% → 30% (70% ↓)
- 처리 속도: 40% ↑

### 매출
- Agent 생산성: 40% ↑
- 예상 추가: +$30K-50K USD/월
- ROI: 6개월 회수 가능

### 품질
- 데이터 일관성: 95% → 99%
- 자동분류 정확도: +4%
- 규정 준수: GDPR/PIPA 100%

---

## 🔗 관련 에이전트

### Agent A: Settlement Analyzer
- 정산 데이터 분석 (1M행 <2초)
- 자동 정산 기능
- 세금 계산 자동화

### Agent B: Webhook Infrastructure
- 안정적인 웹훅 처리
- 재시도 메커니즘
- 통계 수집

### Agent C: Affiliate Integration
- Affiliate 파트너 관리
- Commission 자동화
- Revenue Attribution

### Agent E: Communication Automator
- SMS/Email Day 0-3 자동화
- A/B 테스트
- 심리학 기법 적용

---

## 📚 참고 자료

### 설계 문서
- `/docs/loop6_agent_d_customer_integrator.md` (전체)
- `/docs/loop6_agent_d_quick_start.md` (빠른 참고)
- `/docs/LOOP6_AGENT_D_SUMMARY.txt` (요약)

### 구현 파일
- `/src/lib/contact-integrator/types.ts` (타입)
- `/src/lib/contact-integrator/index.ts` (기본 구조)

### 외부 자료
- Prisma DataLoader: https://github.com/graphql/dataloader
- Redis Caching: https://redis.io/docs/
- GDPR PII: https://gdpr-info.eu/
- PIPA (한국): https://www.pipc.go.kr/

---

## ✅ 완료 상태

### 설계 완료 항목
- [x] ERD & 데이터 모델
- [x] API 엔드포인트 (OpenAPI)
- [x] 성능 최적화 전략
- [x] PII 마스킹 방식
- [x] 통합 조회 예시
- [x] 구현 체크리스트
- [x] KPI 정의
- [x] 배포 계획
- [x] 타입 정의
- [x] 기본 구현 스켈레톤

### 다음: 구현 단계 (2026-05-29 시작)

---

## 📞 문의

**설계 질문**: `/docs/loop6_agent_d_customer_integrator.md` 섹션 9 (참고 자료)

**구현 지원**: `/docs/loop6_agent_d_quick_start.md` (명령어 예시)

**통합 문의**: Agent C (Affiliate), Agent A (Settlement)

---

**상태**: ✅ Agent D 설계 완료
**다음**: Agent C & A 병렬 시작 (2026-05-29)
**최종 완료 예정**: 2026-06-30 (5개 에이전트 모두)
