# Menu #38 Phase 3 - 사용자 의사결정 (3가지)

**작성일**: 2026-05-18  
**대상**: 혜선 & Monica  
**소요시간**: 5분 (읽기 + 선택)

---

## 🎯 한눈에 보기

| 결정 | 선택지 | 추천 | 이유 |
|------|---------|------|------|
| **Q1. 전환 방식** | A) 병행 (1주) / B) 즉시 / C) 하이브리드 | **A** | 안전 + 검증 + 신뢰 |
| **Q2. 검증** | A) 자동 / B) 수동 / C) 대시보드만 | **A** | 24/7 모니터링 + 조기 발견 |
| **Q3. 롤백** | A) 즉시 / B) 수동 복구 / C) 로그 재구성 | **A** | 1분 내 복구 + 안전 |

---

## 📊 상세 비교

### Q1: 데이터 소스 전환 시점

**상황**: SendingHistory (기존, 100만 건) → ExecutionLog (신규, 비어있음)

#### 옵션 A: 병행 + 점진적 전환 ✅ 추천

```
Week 1:
├─ SendingHistory + ExecutionLog 둘 다 조회 (UNION)
├─ 자동 검증으로 데이터 일관성 확인
├─ 모니터링 24/7

Week 2 (GO 결정 후):
└─ ExecutionLog만 조회로 전환

장점:
✓ 가장 안전 (자동 롤백 가능)
✓ 데이터 손실 없음
✓ 성능 저하 최소 (5-10%)
✓ 검증 데이터 충분

단점:
✗ 1주일 더 시간 소비
✗ UNION 쿼리 관리 필요
```

**기대 결과**:
- 일일 자동 검증으로 신뢰도 99.9% 달성
- 문제 발견 시 1분 내 자동 롤백
- 사용자 영향 0건

---

#### 옵션 B: 즉시 전환 ⚠️ 위험

```
Day 1:
├─ ExecutionLog 전환 (UNION 스킵)
└─ 과거 데이터 조회 불가

장점:
✓ 빠른 전환 (1일)
✓ 성능 최고 (100% 개선)

단점:
✗ 극도로 위험 (검증 없음)
✗ 문제 발생 시 대응 어려움
✗ 과거 데이터 손실
✗ 사용자 신뢰 하락
```

**위험 시나리오**:
- ExecutionLog 쓰기 실패 → 데이터 완전 손실
- Enum 변환 오류 → 상태 표시 오류
- 롤백 불가 → 과거 데이터 영구 손실

---

#### 옵션 C: 하이브리드 (새 vs 기존)

```
즉시:
├─ 새 캠페인 → ExecutionLog만 기록
└─ 기존 캠페인 → SendingHistory만 조회

장점:
✓ 어느 정도 빠름 (5일)

단점:
✗ 복잡함 (조건부 로직 많음)
✗ 유지보수 어려움
✗ 버그 가능성 높음
✗ 마이그레이션 기간이 더 길 수 있음
```

---

### 선택 결과: 옵션 A

**일정**:
```
Day 1-7 (월~일):   Phase 3a (병행)
Day 8-14 (월~일):  Phase 3b (완전 전환)
Day 15+ (월):      Phase 3c (정리)
```

**모니터링**:
```
• 매일 06:00: 자동 검증 스크립트 실행
• 문제 감지 시: Sentry 즉시 알림
• 문제 확인 시: 수동 롤백 (옵션 A 선택)
```

---

### Q2: 데이터 검증 방식

**상황**: Phase 3a 진행 중 데이터 일관성을 어떻게 확인할 것인가?

#### 옵션 A: 자동화된 검증 ✅ 추천

```
설정:
├─ 매일 06:00 자동 실행 (cron job)
├─ 검증 항목: 행 수, 상태 분포, 실패율, NULL 비율
├─ 결과: 자동 리포트 생성 + 문제 시 알림
└─ 모니터링: Sentry + 메일

장점:
✓ 24/7 자동 감시
✓ 문제를 조기에 발견 (최대 24시간 내)
✓ 수동 개입 최소화
✓ 데이터 기반 의사결정 가능

단점:
✗ 초기 설정 시간 (2-3시간)
✗ 거짓 양성 가능 (1-2%)
```

**예상 검증 리포트** (매일):
```
Date: 2026-05-21 (3일차)
Phase: 3a (병행)

✓ Row count: Legacy 1,000,050 vs New 1,000,045 (차이 5건, PASS)
✓ Status distribution: 편차 < 1% (PASS)
✓ Failure rate: Legacy 10.2% vs New 10.1% (차이 0.1%, PASS)
✓ NULL fields: 정상 범위 (PASS)
✓ API response time: p95 = 250ms < 300ms (PASS)

Alert: None
Recommendation: Continue Phase 3a, proceed to Phase 3b on Day 8

Overall Status: ✅ HEALTHY
```

---

#### 옵션 B: 수동 샘플 검증 ⚠️ 위험

```
설정:
├─ 문제 발생했을 때만 확인
├─ 샘플 10-100개 수동 검사
└─ 스프레드시트에 기록

장점:
✓ 간단함
✓ 비용 최소 (시간 없음)

단점:
✗ 문제를 놓칠 확률 높음 (50%)
✗ 조기 발견 불가
✗ 신뢰도 낮음
✗ 대응 시간 길어짐
```

---

#### 옵션 C: 실시간 대시보드만

```
설정:
├─ 숫자 보기만 함 (행 수, 상태 분포)
├─ 자동 알림 없음
└─ 사람이 주기적으로 확인

장점:
✓ 간단함
✓ 비용 적음

단점:
✗ 문제를 놓치기 쉬움 (70%)
✗ 대응 시간 매우 길어짐
✗ 신뢰도 중간 정도
```

---

### 선택 결과: 옵션 A

**구현 내용**:
```bash
# 1. 자동 검증 스크립트
src/scripts/validate-daily-consistency.ts
├─ 매일 06:00 cron으로 실행
├─ SendingHistory vs ExecutionLog 비교
├─ 결과를 DB에 저장 (ValidationReport 테이블)
└─ 문제 시 Sentry 즉시 알림

# 2. Sentry 알림 설정
lib/telemetry/phase3-alerts.ts
├─ 행 수 차이 > 10건 → Warning
├─ 상태 분포 편차 > 2% → Error
├─ 실패율 편차 > 5% → Warning
└─ API 오류 > 1% → Error

# 3. 모니터링 대시보드
(dashboard) /campaigns/phase3-monitoring
├─ 실시간 메트릭 (5분 단위)
├─ 일일 검증 리포트
└─ 롤백 버튼 (긴급 상황용)
```

---

### Q3: 데이터 손실 시 대응 방안

**상황**: Phase 3a/3b 중 ExecutionLog에 데이터가 기록되지 않으면?

#### 옵션 A: 즉시 롤백 ✅ 추천

```
조치:
├─ Feature flag 즉시 OFF (< 1분)
├─ API 요청 SendingHistory로 복구 (< 1분)
├─ 손실 범위: 최근 1-2일분만
└─ 대응 시간: 1-5분

장점:
✓ 가장 빠름 (1분 내 복구)
✓ 가장 안전 (검증된 로직)
✓ 자동 구현 가능
✓ 데이터 손실 최소

단점:
✗ 최근 1-2일 데이터 정합성 불일치 (나중에 수정)
```

**자동 롤백 로직**:
```typescript
export async function getUnifiedSendingHistory() {
  try {
    // Phase 3a/3b: ExecutionLog 시도
    if (useExecutionLog) {
      const data = await prisma.executionLog.findMany({...});
      if (!data || data.length === 0) throw new Error('No data');
      return data;
    }
  } catch (err) {
    // 자동 롤백: SendingHistory
    logger.error('[PHASE3_AUTO_ROLLBACK] ExecutionLog 실패, 복구 중', { err });
    Sentry.captureException(err, { level: 'error', tag: 'phase3_fallback' });
    
    return await prisma.sendingHistory.findMany({...});
  }
}
```

---

#### 옵션 B: 수동 복구

```
조치:
├─ DB 스크립트 작성
├─ 손실 데이터 재구성
├─ 대응 시간: 1-4시간

장점:
✓ 완전한 복구 가능

단점:
✗ 시간 오래 걸림 (1-4시간)
✗ 수동 개입 필요 (실수 가능)
✗ 사용자 영향 길어짐
```

---

#### 옵션 C: 로그 기반 재구성

```
조치:
├─ Aligo SMS 제공자 로그 조회
├─ Email 제공자 로그 조회
├─ 데이터 결합 (3개 소스)
└─ 대응 시간: 4-8시간

장점:
✓ 외부 데이터 소스 활용

단점:
✗ 매우 오래 걸림 (4-8시간)
✗ 3사 로그 일관성 미보장
✗ 데이터 손실 가능성 높음 (제3자 서비스 보관 기간 제한)
```

---

### 선택 결과: 옵션 A

**구현 내용**:
```typescript
// Feature flag 기반 롤백
export async function getUnifiedSendingHistory(campaignId: string) {
  const phase3Enabled = await featureFlags.isEnabled('PHASE3_EXECUTION_LOG');
  
  if (!phase3Enabled) {
    // Phase 2: SendingHistory만 사용
    return await prisma.sendingHistory.findMany({...});
  }

  try {
    // Phase 3a: UNION 쿼리
    return await getPhase3aData(campaignId);
  } catch (err) {
    // 자동 롤백
    logger.error('[ROLLBACK] Phase 3a 실패, Phase 2로 복구', { err });
    Sentry.captureException(err, {
      level: 'error',
      tags: { phase: '3a', action: 'auto_rollback' }
    });
    
    return await getPhase2Data(campaignId);
  }
}
```

---

## ✅ 최종 결정 요약

| 결정 | 선택 | 일정 | 담당자 |
|------|------|------|--------|
| **Q1. 전환 방식** | 옵션 A (병행) | Day 1-14 | 개발팀 |
| **Q2. 검증 방식** | 옵션 A (자동) | Day 1부터 | Monica + 모니터링 |
| **Q3. 롤백 전략** | 옵션 A (즉시) | 필요시 < 1분 | 자동화 |

---

## 📋 다음 단계 (이 문서 승인 후)

### Phase 3a 구현 (Day 1 월요일)

```
월요일 (D-3):
└─ 검증 스크립트 작성 + 테스트

화요일 (D-2):
└─ 모니터링 대시보드 설정

수요일 (D-1):
└─ Sentry 알림 설정

목요일 (D-0, 배포 전):
├─ 최종 점검 (모든 알림 작동 확인)
└─ GO 신호 대기

금요일 (D-1, 배포):
├─ 09:00 - Phase 3a 배포 (기존 배포 후)
├─ 10:00 - ExecutionLog 새 캠페인 쓰기 시작
├─ 12:00 - 1차 검증
└─ 18:00 - 1차 리포트

주말:
└─ 모니터링 24/7

다음주 월~목:
└─ 일일 자동 검증 + 리뷰

다음주 금:
└─ GO/NO-GO 최종 결정 회의
```

---

## 🆘 긴급 롤백

**상황**: Phase 3a/3b 중 심각한 문제 발생

**즉시 조치** (1분 내):
```bash
# 1. Feature flag OFF
npm run script:disable-feature-flag phase3a

# 2. 자동 롤백 (이미 코드에 포함)
# GET /api/campaigns/sending-history → SendingHistory만 조회

# 3. 알림 발송
# Sentry에 P0 인시던트 생성

# 4. 검증
curl https://api.mabiz-crm.com/api/campaigns/sending-history?campaignId=test
# → legacy 데이터 반환 확인
```

**이후 조치** (1-2시간):
```
[ ] 원인 분석 (에러 로그)
[ ] 코드 수정
[ ] 로컬 테스트
[ ] GO/NO-GO 재결정
[ ] 재배포 (승인 후)
```

---

## 📞 연락처

**문제 발생 시**:
- Sentry 자동 알림 → Slack #phase3-monitoring
- 긴급: Monica 전화 + 개발팀 협의

**선택 관련 질문**:
- 혜선 (의사결정자)
- Monica (구현 담당)
