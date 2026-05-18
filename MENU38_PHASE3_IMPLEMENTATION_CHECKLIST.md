# Menu #38 Phase 3 구현 체크리스트

**작성일**: 2026-05-18  
**기간**: 2-3주 (Phase 3a)  
**팀**: 3명 (개발자 2명, QA 1명)  
**위험도**: 중간 (호환성 유지 필수)

---

## Phase 3a: 하이브리드 구현 (SendingHistory API 유지)

### Week 1: 설계 & 개발 환경 구성

#### [ ] 1.1 사용자 의사결정 수집
- [ ] Q1: SendingHistory API 계속 사용? → 선택: **a) 계속 사용**
- [ ] Q2: subject/body/metadata 처리? → 선택: **a) 그냥 두기**
- [ ] Q3: 채널별 상세 상태? → 선택: **a) 그냥 두기**
- [ ] 의사결정 문서 작성: `MENU38_PHASE3_DECISIONS.md`
- [ ] 스테이크홀더 검토 완료

#### [ ] 1.2 Enum 매핑 함수 구현
```typescript
// src/lib/enum-mapping.ts
export function mapExecutionToSendingFailureReason(reason: string | null): string | null
export function mapSendingToExecutionFailureReason(reason: string | null): string | null
export function mapExecutionToSendingStatus(status: string): string
```
- [ ] 함수 구현 완료
- [ ] 단위 테스트 작성 (6개 테스트 케이스)
- [ ] 코드 리뷰 승인

#### [ ] 1.3 Feature Flag 설정
```typescript
// .env.local
USE_EXECUTION_LOG_FOR_SENDING_HISTORY=false  // 기본값

// .env.production
USE_EXECUTION_LOG_FOR_SENDING_HISTORY=false  // 안전 기본값
```
- [ ] 환경변수 추가
- [ ] Feature flag 레지스트리 업데이트 (`lib/feature-flags.ts`)
- [ ] Vercel 환경변수 설정 (3개 배포: mabiz, cruiseguide, cruiseai)

#### [ ] 1.4 데이터베이스 연결 확인
```sql
-- Phase 3a: SendingHistory & ExecutionLog 모두 활성
-- 읽기 전용 테스트
SELECT COUNT(*) FROM "SendingHistory" WHERE "sendingType" = 'CAMPAIGN';
SELECT COUNT(*) FROM "ExecutionLog" WHERE "sourceType" = 'CAMPAIGN';
```
- [ ] 쿼리 성능 테스트 (1000 레코드)
- [ ] 인덱스 확인 (idx_execution_campaign_stats)
- [ ] DB 연결 풀 설정 확인

---

### Week 2: API 개발 & 통합 테스트

#### [ ] 2.1 ExecutionLog 기반 GET 로직 구현
```typescript
// src/app/api/campaigns/sending-history/route.ts 수정
// Feature flag 활성화 시 ExecutionLog 사용

if (process.env.USE_EXECUTION_LOG_FOR_SENDING_HISTORY === 'true') {
  // ExecutionLog 쿼리
  // Enum 매핑
  // 응답 직렬화
}
```
- [ ] ExecutionLog 조회 쿼리 작성
- [ ] Contact 조인 추가
- [ ] Campaign 조인 추가
- [ ] Enum 매핑 적용
- [ ] 응답 포맷 검증 (SendingHistory와 동일)
- [ ] 코드 리뷰 승인

#### [ ] 2.2 성능 최적화
```typescript
// Contact N+1 문제 해결
const logs = await prisma.executionLog.findMany({
  include: {  // Contact, Campaign 조인
    contact: { select: { id, name, phone, email } },
    campaign: { select: { id, title } },
  },
  // ... 쿼리 조건
});
```
- [ ] 배치 조인 확인 (explain)
- [ ] 응답 시간 < 500ms (1000 레코드)
- [ ] 메모리 사용량 < 50MB (쿼리당)
- [ ] DB CPU 영향 < 5%

#### [ ] 2.3 통합 테스트 (E2E)
```typescript
// tests/api/campaigns/sending-history.integration.test.ts

describe('GET /api/campaigns/sending-history with ExecutionLog', () => {
  beforeAll(() => {
    process.env.USE_EXECUTION_LOG_FOR_SENDING_HISTORY = 'true';
  });
  
  test('[1] 기본 응답 필드 호환성 (8개 필드)');
  test('[2] Contact 정보 조인 (name 포함)');
  test('[3] Campaign 정보 조인 (title 포함)');
  test('[4] Enum 매핑 (failureReason)');
  test('[5] NULL 처리 (failureReason=null)');
  test('[6] 날짜 포맷 (ISO 8601)');
  test('[7] 페이지네이션 (limit, offset, total)');
  test('[8] 필터링 (status)');
});
```
- [ ] 8개 테스트 모두 PASS
- [ ] 코드 커버리지 > 90%
- [ ] 통합 테스트 환경 구성

#### [ ] 2.4 데이터 검증
```typescript
// scripts/verify-compatibility.ts
// SendingHistory vs ExecutionLog 데이터 비교

async function verifyCompatibility() {
  const shCount = await prisma.sendingHistory.count();
  const elCount = await prisma.executionLog.count({
    where: { sourceType: 'CAMPAIGN' }
  });
  
  if (shCount !== elCount) {
    throw new Error('Data count mismatch');
  }
  
  // 각 필드별 분포 비교
  // failureReason 분포
  // status 분포
  // channel 분포
}
```
- [ ] 스크립트 작성
- [ ] 프로덕션 데이터로 검증
- [ ] 차이 분석 리포트 작성
- [ ] 결과 문서화

---

### Week 3: 배포 & 모니터링

#### [ ] 3.1 배포 전 체크리스트
```
[ ] 코드 리뷰 모두 승인
[ ] 테스트 통과율 100%
[ ] 호환성 검증 완료
[ ] 롤백 절차 문서화
[ ] 모니터링 대시보드 준비
[ ] 버그 추적 이슈 생성
```
- [ ] Git 커밋 메시지 확인
- [ ] 환경변수 검증 (dev, staging, prod)
- [ ] 보안 검토 완료
- [ ] 성능 벤치마크 완료

#### [ ] 3.2 Staging 배포
```
Timeline: 금요일 오후 4시 (수요 최소)

1. 배포 전 (3시 59분)
   [ ] 슬랙 공지
   [ ] 기존 API 헬스 체크
   
2. 배포 (4시 00분)
   [ ] Vercel 배포 (mabiz, cruiseguide, cruiseai)
   [ ] 배포 상태 모니터링
   
3. 배포 후 (4시 15분)
   [ ] API 헬스 체크
   [ ] 응답 시간 검증
   [ ] 로그 확인 (에러 없음)
   [ ] 기본 기능 테스트
```
- [ ] 배포 성공
- [ ] Smoke test PASS
- [ ] 성능 안정적 (응답시간 < 500ms)

#### [ ] 3.3 모니터링 설정
```typescript
// lib/monitoring.ts
export const sendingHistoryMetrics = {
  apiLatency: new Histogram(),  // 응답 시간
  compatibility: new Counter(),  // ExecutionLog vs SendingHistory
  failureReasonMappings: new Counter(),  // INVALID_CONTACT 발생 수
  enumMappingErrors: new Counter(),  // 매핑 오류
};
```
- [ ] Prometheus 메트릭 추가
- [ ] Grafana 대시보드 생성
- [ ] Alert 규칙 설정 (응답시간 > 1초, 에러율 > 1%)
- [ ] 일일 리포트 설정

#### [ ] 3.4 프로덕션 배포 (Phase 3a)
```
Timeline: 월요일 오전 10시

1. 배포 전 (오전 9시 59분)
   [ ] Slack 공지
   [ ] 기존 API 헬스 체크 (마지막 확인)
   
2. 배포 (오전 10시 00분)
   [ ] Vercel 배포 (mabiz 우선)
   [ ] 배포 모니터링 (5분)
   
3. 배포 후 (오전 10시 15분)
   [ ] 헬스 체크 (API 응답 확인)
   [ ] 로그 모니터링 (1시간)
   [ ] 성능 메트릭 확인
   
4. 안정화 (오전 10시 30분 ~ 정오)
   [ ] 주기적 모니터링
   [ ] 문제 없으면 feature flag 테스트 준비
```
- [ ] 배포 성공
- [ ] 주요 메트릭 정상
- [ ] 에러 없음
- [ ] 성능 안정적

#### [ ] 3.5 Feature Flag 점진적 활성화
```
Day 1 (배포 1일 후): 0% → 5% (내부 테스트)
[ ] 5% 트래픽 라우팅
[ ] 로그 모니터링 (에러 없음)
[ ] 응답 시간 비교 (SendingHistory vs ExecutionLog)
[ ] Enum 매핑 결과 검증

Day 2: 5% → 25% (조직 일부)
[ ] 25% 조직에 라우팅
[ ] 호환성 검증 (응답 포맷 동일)
[ ] 성능 메트릭 확인
[ ] 스테이크홀더 피드백

Day 3: 25% → 50% (전체 조직 절반)
[ ] 50% 트래픽 라우팅
[ ] 2일 동안의 데이터 분석
[ ] 정합성 검증 (SendingHistory vs ExecutionLog)
[ ] 문제 없으면 100% 준비

Day 4: 50% → 100% (전체 조직)
[ ] 100% 트래픽 라우팅
[ ] 최종 모니터링
[ ] 성능 안정적 확인
```
- [ ] 각 단계별 모니터링 완료
- [ ] 문제 없음 기록
- [ ] 모든 메트릭 정상

---

## Post-Deployment 모니터링 (1주일)

#### [ ] 4.1 일일 리포트
```
Days 1-7:
[ ] 오전 9시: 전날 메트릭 리뷰
[ ] 오후 6시: 일일 메트릭 확인
[ ] 에러율, 응답 시간, enum 매핑 결과 기록
[ ] 이상 항목 슬랙 공지
```

#### [ ] 4.2 호환성 검증
```sql
-- 3일간의 데이터 비교
SELECT
  CASE WHEN sh.status = el.status THEN 'PASS' ELSE 'FAIL' END as status_match,
  COUNT(*) as count
FROM "SendingHistory" sh
INNER JOIN "ExecutionLog" el ON sh.id = el.id
GROUP BY status_match;
```
- [ ] 상태 매칭 > 99.9%
- [ ] failureReason 매칭 > 99%
- [ ] 차이 분석 및 문서화

#### [ ] 4.3 성능 비교
```
응답 시간:
[ ] SendingHistory 기존: 평균 350ms
[ ] ExecutionLog 신규: 평균 400ms (Contact 조인 영향)
[ ] 허용 범위: < 500ms

DB CPU:
[ ] 기본 사용률: 20%
[ ] 증가량: < 5%
[ ] 메모리: < 50MB 추가
```
- [ ] 성능 문서화
- [ ] 최적화 기회 식별

---

## 잠재적 문제 & 대응

### 문제 1: Contact 조인 느림 (N+1 문제)

**증상**: 응답 시간 > 500ms

**해결책**:
```typescript
// ❌ 느린 버전 (N+1)
const logs = await prisma.executionLog.findMany({
  where: { ... },
  include: {
    contact: { ... },  // ← 각 로그마다 쿼리
  },
});

// ✅ 빠른 버전 (배치 조인)
const logs = await prisma.executionLog.findMany({
  where: { ... },
  include: {
    contact: { select: { ... } },  // ← Prisma 자동 배치
    campaign: { select: { ... } },
  },
});
```
- [ ] Prisma 배치 조인 확인
- [ ] 응답 시간 재측정

### 문제 2: Enum 매핑 오류 (INVALID_CONTACT 혼동)

**증상**: 클라이언트가 "휴대폰 오류"라고 표시하지만 실제로는 "기타 오류"

**대응**:
- [ ] 경고 로그 모니터링 (failureUserMsg 명확화)
- [ ] 클라이언트 피드백 수집
- [ ] 필요시 failureUserMsg 개선

### 문제 3: 과거 Contact 데이터 손실

**증상**: 과거 로그의 contact.name이 현재 값으로 표시됨

**대응**:
- [ ] 문제 심각성 평가
- [ ] 필요시 Phase 3b에서 contactName 필드 추가
- [ ] 또는 Contact 조인 제거 (ID만 반환)

### 문제 4: 성능 저하 (DB CPU > 25%)

**증상**: ExecutionLog 조회로 인한 CPU 스파이크

**대응**:
- [ ] 쿼리 최적화 (인덱스 확인)
- [ ] 캐싱 추가 (Redis)
- [ ] 필요시 feature flag OFF

---

## 롤백 절차 (즉시, < 5분)

### 만약 심각한 문제 발생

```bash
# 1. Feature flag 비활성화
# .env.production 수정
USE_EXECUTION_LOG_FOR_SENDING_HISTORY=false

# 2. Vercel 배포 (긴급)
git add .env.production
git commit -m "fix: disable ExecutionLog for SendingHistory API"
git push origin main

# 3. API 헬스 체크
curl https://api.mabiz.com/api/campaigns/sending-history

# 4. 모니터링 확인 (응답 시간, 에러율 정상화)
```

**복구 시간**: 5-10분

---

## Success Criteria

### Phase 3a 성공 조건

```
✅ API 응답 포맷 100% 호환성
✅ 응답 시간 < 500ms (1000 레코드)
✅ DB 영향 < 5% CPU 증가
✅ 에러율 < 0.1%
✅ Enum 매핑 정확도 > 99%
✅ Feature flag ON/OFF 전환 즉시
✅ 7일 이상 안정적 운영
```

### Phase 3a → 3b 진행 조건

```
✅ 위 모든 조건 달성
✅ 스테이크홀더 승인
✅ 점진적 마이그레이션 계획 수립
✅ 클라이언트 통지 완료
```

---

## 문서 & 산출물

### 배포 전
- [x] 호환성 분석: `MENU38_PHASE3_COMPATIBILITY_ANALYSIS.md`
- [x] Enum 매핑: `MENU38_PHASE3_ENUM_MAPPING.md`
- [x] 구현 체크리스트: `MENU38_PHASE3_IMPLEMENTATION_CHECKLIST.md`
- [ ] 의사결정 문서: `MENU38_PHASE3_DECISIONS.md`
- [ ] 모니터링 대시보드: Grafana

### 배포 후
- [ ] 배포 리포트: `MENU38_PHASE3_DEPLOYMENT_REPORT.md`
- [ ] 성능 비교: `MENU38_PHASE3_PERFORMANCE_COMPARISON.md`
- [ ] 호환성 검증: `MENU38_PHASE3_VALIDATION_REPORT.md`

---

## 담당자

| 역할 | 이름 | 연락처 |
|------|------|--------|
| 리드 개발자 | TBD | @slack |
| API 개발 | TBD | @slack |
| QA | TBD | @slack |
| 스테이크홀더 | TBD | @slack |

---

## 일정 (권장)

| 주차 | 마일스톤 | 상태 |
|------|---------|------|
| Week 1 | 설계, Enum 구현, Feature Flag 설정 | 대기 |
| Week 2 | API 개발, 통합 테스트 | 대기 |
| Week 3 | 배포, 모니터링, 점진적 활성화 | 대기 |
| Week 4+ | 안정화, Phase 3b 준비 | 대기 |

