# Loop 6 Agent D: Customer Integrator - 빠른 시작

**완료 일시**: 2026-05-28 16:30 (Loop 5 병렬 중)

**설계 문서**: `/docs/loop6_agent_d_customer_integrator.md`

---

## 핵심 아키텍처

### 데이터 흐름
```
GET /api/contacts/:id/360
    ↓
[1] Redis 캐시 조회 (30분 TTL)
    ├─ HIT → 즉시 반환 (<100ms)
    └─ MISS → [2]로 이동
    ↓
[2] DataLoader + Batch Query (Prisma)
    ├─ Contact + Partner + GoldMember (1 쿼리)
    ├─ Groups (1 쿼리)
    ├─ Orders (1 쿼리)
    ├─ Communications (병렬 3 쿼리)
    └─ Psychology Profile (1 쿼리)
    ↓
[3] 데이터 병합 + 위험도 계산
    ↓
[4] PII 마스킹 (권한 기반)
    ↓
[5] Redis 저장 + 반환
```

**총 응답시간**: < 1s (캐시), < 2s (신규)

---

## 핵심 기능 3가지

### 1. 통합 360도 뷰 (`/api/contacts/:id/360`)
- Contact + GoldMember + Partner + Groups + Orders
- Psychology Lens + Risk Flags + Affiliate Tracking
- 모든 커뮤니케이션 로그 (SMS, Email, Call)
- **응답**: 1 JSON (최대 50KB)

### 2. PII 마스킹 (권한 기반)
```
Admin: 마스킹 안함 (원본)
Manager: 부분 마스킹 (전화번호 뒤 4자리만)
Agent: 전체 마스킹 (010XXXX5678, kim****@example.com)
```

### 3. 위험도 + 권장액션
- Risk Score: 0-100 (낮을수록 좋음)
- Flags: 7가지 (준비불안, 경쟁사언급, 배우자동의 등)
- Recommended Actions: 자동생성 (3-5개)

---

## 성능 최적화 4단계

| 단계 | 기술 | 효과 |
|------|------|------|
| 1️⃣ DataLoader | Batch Query (N+1 제거) | DB 쿼리 80% ↓ |
| 2️⃣ Redis | 30분 캐시 | 응답시간 50% ↓ |
| 3️⃣ View | Materialized View | 읽기 성능 30% ↑ |
| 4️⃣ Index | 추가 인덱스 | 조회 속도 2배 ↑ |

**최종 목표**: 응답시간 3-5s → 1s (캐시) / 2s (신규)

---

## 개발 체크리스트 (1주 일정)

### Day 1-2: 기초 구현
- [ ] `lib/contact-integrator/360.ts` (DataLoader + 쿼리)
- [ ] `app/api/contacts/[id]/360/route.ts` (API)
- [ ] `lib/redis/client.ts` (캐싱)
- [ ] `lib/pii-mask.ts` (기본 마스킹)

### Day 2-3: 기능 확장
- [ ] `lib/risk-calculator.ts` (위험도 계산)
- [ ] `/api/contacts/[id]/orders` (주문 조회)
- [ ] `/api/contacts/[id]/communications` (로그 조회)
- [ ] `/api/contacts/[id]/psychology` (렌즈 정보)

### Day 4: 성능 최적화
- [ ] DataLoader 검증 (쿼리 수 확인)
- [ ] Redis 캐시 테스트
- [ ] 성능 벤치마크 (<1s, <2s)
- [ ] 인덱스 추가

### Day 5: 테스트 & 배포
- [ ] 단위 테스트 (jest)
- [ ] 통합 테스트 (e2e)
- [ ] PII 마스킹 검증
- [ ] 본사 환경 배포

---

## 수동 명령어 (빠른 시작)

### 1. Redis 설정
```bash
# .env.local 에 추가
REDIS_URL=redis://localhost:6379

# 로컬 Redis 시작
redis-server
```

### 2. Prisma DataLoader 설치
```bash
npm install dataloader
```

### 3. 성능 테스트
```bash
# 벤치마크 실행
npm run test:performance

# 캐시 히트율 모니터링
npm run monitor:redis
```

### 4. 배포
```bash
# Canary 배포 (50% 트래픽)
npm run deploy:canary

# 모니터링
npm run monitor:contact-360

# 전체 배포
npm run deploy:production
```

---

## 예상 효과

| 메트릭 | 개선 |
|--------|------|
| 응답시간 | 3-5s → 1s (67% ↓) |
| DB 부하 | 100% → 30% (70% ↓) |
| Agent 생산성 | 40% ↑ |
| 월 추가 매출 | +$30K-50K USD |

---

## 링크

- **상세 설계**: `/docs/loop6_agent_d_customer_integrator.md`
- **Loop 5 병렬 작업들**: `/docs/MEMORY.md#loop-5-병렬-완성`
- **Affiliate 통합**: `/docs/loop6_agent_c_affiliate_*`
- **Settlement 분석**: `/docs/loop6_agent_a_settlement_*`

---

**상태**: ✅ 설계 완료 → 🔄 구현 시작 예정

**다음 에이전트**: Agent C (Affiliate Integration), Agent E (Communication Automator)
