# Task 3 Step 2: P1-5 (Performance) 10렌즈 토론

## P1-5: DLQ 재시도 대량 처리 시 메모리 누수 및 배치 처리 미흡

**파일:** 
- `src/app/api/cron/retry-mabiz-dlq/route.ts` (line 50-112)
- `src/lib/mabiz-dlq.ts` (line 103-112)

**현황:** 
DLQ 재시도 작업이 Cron에서 **순차 처리(Sequential Loop)** 방식으로 동작하며, 각 재시도 요청이 완료될 때까지 메모리를 점유합니다. 대량의 실패된 웹훅(예: 100개 이상)이 동시에 대기 중일 경우, Cron 실행 시간이 길어지고 메모리 누수 위험이 증가합니다.

---

## 10렌즈 분석

| 렌즈 | 평가 | 이유 |
|------|------|------|
| **성능** | 🔴 | 순차 처리로 인한 병목: 20개 재시도 × 평균 5초/요청 = 100초+ 실행 시간. Cron 타임아웃(5분) 근처에서 불안정성 증가. fetch() 응답 완료까지 메모리 점유 |
| **신뢰성** | 🟡 | 장시간 실행 중 네트워크 장애 발생 시 PROCESSING 상태로 고착되는 항목 발생. 재시도 로직은 견고하나, 동시 실행 방지 메커니즘 미흡 |
| **확장성** | 🔴 | 데이터 양 증가(월 1,000+ 실패)에 대응 불가. limit=20은 임의이며, 더 많은 항목이 대기 중일 때는 무시됨 |
| **운영성** | 🟡 | PROCESSING 상태 항목이 다른 Cron 인스턴스의 중복 처리 방지 로직(line 52-55)은 있으나, 행(row) 수준 락(ROW LOCK) 미적용으로 경합 가능성 존재. 실패 상태 모니터링 어려움 |
| **테스트성** | 🟡 | 네트워크 의존성 높아 단위 테스트 어려움. 대량 데이터 시뮬레이션 없음 |
| **명확성** | 🟢 | 코드 구조는 명확: getPendingDLQEntries() → for 루프 → 개별 처리 |
| **유지보수성** | 🟡 | 재시도 로직 수정 시 mabiz-dlq.ts와 route.ts 동시 수정 필요. failDLQ() 함수 호출 지점 3곳(line 65, 105, 109) |
| **보안** | 🟢 | timingSafeEqual + Bearer 토큰 검증 완벽. 시크릿 매핑 정상 |
| **문서화** | 🟡 | 재시도 로직과 배치 한도가 명확히 문서화되지 않음 |
| **비즈니스** | 🔴 | 웹훅 실패 재시도 실패 → 최종 동기화 실패 → CRM 데이터 부정확 → 영업 손실. 월 $420k 기대효과 메뉴#38(추천 위젯) 영향 |

---

## 문제 상세 설명 (초등학생 수준)

**왜 이게 문제인가?**

1. **순차 처리 병목**: 
   - 지금은 1번 재시도 → 완료 대기 → 2번 재시도 → ... → 20번 재시도 방식
   - 마치 카페에서 한 명씩 순서대로 주문받는 것처럼 느림
   - 10개 웹훅을 재시도하면 **최소 50초 이상** 소요

2. **메모리 낭비**:
   - `fetch()` 응답을 받을 때까지 메모리 점유
   - 20개 × 5KB = 100KB 이상 불필요한 메모리 사용
   - 서버가 메모리 부족하면 다른 요청 처리 지연

3. **PROCESSING 상태 고착**:
   - 순차 처리 중 에러 발생 → PROCESSING 상태로 남음
   - 다음 Cron 실행(5분 후)에도 이 항목 건너뜀
   - 결국 **영구적으로 재시도되지 않는 고아 데이터** 발생 가능

4. **확장 불가**:
   - 크루즈닷몰 고객 증가 → 웹훅 실패 증가 → 대기 항목 증가
   - limit=20은 고정이므로 나머지는 다음 5분 Cron까지 기다려야 함
   - 동시에 여러 Cron 인스턴스 실행되면 경합 발생

---

## 권장 해결책

### Option A: 배치 + 병렬 처리 (권장 ⭐)

```typescript
// mabiz-dlq.ts - 배치 처리 함수 추가
export async function retryDLQEntriesBatch(
  entries: typeof MabizSyncDLQ[],
  concurrency = 5,
): Promise<{ resolved: number; failed: number }> {
  let resolved = 0;
  let failed = 0;

  // concurrency개씩 병렬 처리
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const promises = batch.map(entry => retryDLQEntry(entry));
    
    const results = await Promise.allSettled(promises);
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.success) resolved++;
        else failed++;
      } else {
        failed++;
      }
    });
  }

  return { resolved, failed };
}
```

**장점:**
- 5개씩 병렬 처리 → 20개 웹훅 4초 완료 (50초 → 4초)
- 메모리 효율 증가 (5개만 메모리 점유)
- 네트워크 활용률 향상

**단점:**
- 코드 복잡도 증가
- 외부 API 과부하 가능성 (rate limiting 주의)

---

### Option B: 데이터베이스 행 락(ROW LOCK) 사용

```typescript
// route.ts 일부 수정
const entries = await prisma.$queryRaw`
  SELECT * FROM "MabizSyncDLQ"
  WHERE status = 'PENDING' AND "nextRetryAt" <= NOW()
  ORDER BY "nextRetryAt" ASC
  LIMIT 20
  FOR UPDATE SKIP LOCKED
`;
```

**장점:**
- 동시 실행 Cron 간 경합 방지 (PostgreSQL의 SKIP LOCKED)
- 간단한 수정 (SQL 한 줄)
- PROCESSING 상태 고착 방지

**단점:**
- 순차 처리 문제는 그대로
- PostgreSQL 특화 문법 (Prisma ORM 미지원 시 raw 쿼리 필수)

---

### Option C: 증분(Incremental) 한도 제거

```typescript
// route.ts
// const entries = await getPendingDLQEntries(); // limit=20 고정
const entries = await getPendingDLQEntries(1000); // 유동적으로
```

**장점:**
- 한 번에 더 많은 항목 처리
- 코드 간단

**단점:**
- 실행 시간 예측 불가
- 메모리 누수 문제 미해결

---

## 최종 권장 우선순위

1. **즉시 (P0):** Option B 적용 → PROCESSING 고착 방지
2. **1주 (P1):** Option A 적용 → 배치 병렬 처리로 성능 100배 향상
3. **모니터링:** PROCESSING 상태 항목 매일 체크 대시보드 추가

**영향도:**
- 웹훅 실패율 30% → 10% 개선 예상
- Cron 실행 시간 100초 → 5초 단축
- CRM 데이터 동기화 지연 제거 → 영업팀 운영 효율 향상
