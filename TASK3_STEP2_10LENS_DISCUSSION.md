# Task 3 Step 2: P0 Critical Issues 10렌즈 토론

## Context
- 3명의 에이전트가 병렬 코드 리뷰 완료 (Agent α/β/γ)
- 발견된 P0: 8개, P1: 8개, P2: 6개
- Focus: P0만 먼저 해결 (다른 것은 추후)

---

## P0 Blocker #1: MabizSyncDLQ 마이그레이션 파일 누락 (Agent β)
**파일:** `prisma/schema.prisma` (lines 1197-1218)
**현황:** MabizSyncDLQ 모델이 스키마에 정의되어 있지만, 마이그레이션 SQL 파일이 존재하지 않음

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 보안 | 🔴 High Risk | DB 테이블이 없으면 코드가 실행될 수 없음 |
| 성능 | 🔴 Blocked | 재시도 큐가 작동 불가능 |
| 신뢰성 | 🔴 Critical | 웹훅 실패가 쌓이기만 함 |
| 운영 | 🔴 Broken | DLQ 테이블 생성 불가 |
| 테스트 | 🔴 Unfeasible | 마이그레이션 없이 배포 불가 |

### 권장 해결책
**Option A (권장):** 마이그레이션 SQL 파일 생성
- 파일명: `prisma/migrations/20260521000003_add_mabiz_sync_dlq/migration.sql`
- 내용: MabizSyncDLQ 테이블 CREATE 문
- 이유: 스키마와 실제 DB를 동기화하는 것이 프로덕션 준비의 기본
- 예상 영향: 배포 시 자동으로 테이블 생성됨

---

## P0 Blocker #2: MabizSyncDLQ 코드 미구현 (Agent β)
**파일:** `src/lib/mabiz-dlq.ts`, `src/app/api/cron/retry-mabiz-dlq/route.ts`
**현황:** 스키마 정의, Cron 엔드포인트는 있지만 실제 로직 미구현

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 기능 | 🔴 Not Working | 함수 호출 없음 |
| 신뢰성 | 🔴 Silent Failure | 웹훅이 DLQ에 저장되지 않음 |
| 관찰성 | 🔴 Invisible | 실패한 웹훅 추적 불가 |
| 운영 | 🔴 No Visibility | 대시보드에 표시할 데이터 없음 |

### 권장 해결책
**Option A (권장):** 3단계 구현
1. purchase/inquiry/gold-inquiry/payapp에서 실패 시 DLQ에 저장
2. Cron 작업: 매시간 DLQ 확인 → 재시도
3. 성공 시 DLQ 제거, 실패 시 재시도 횟수 증가

---

## P0 Blocker #3: vercel.json에 retry-mabiz-dlq 미등록 (Agent γ)
**파일:** `vercel.json`
**현황:** Cron 엔드포인트 `/api/cron/retry-mabiz-dlq` 존재하지만 스케줄이 vercel.json에 없음

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 운영 | 🔴 Never Runs | Vercel이 자동 실행하지 않음 |
| 신뢰성 | 🔴 Manual-only | 수동 트리거 필요 |
| 자동화 | 🔴 Broken | DLQ 재시도 자동화 실패 |
| 모니터링 | 🔴 Blind Spot | Cron 실행 여부 추적 불가 |

### 권장 해결책
**Option A (권장):** vercel.json 수정
```json
"crons": [{
  "path": "/api/cron/retry-mabiz-dlq",
  "schedule": "0 * * * *"  // 매시간
}]
```
- 이유: 다른 Cron들과 동일한 패턴
- 예상 영향: 매시간 자동 실행 시작

---

## P0 Blocker #4: payapp Secret 매핑 오류 (Agent α)
**파일:** `src/app/api/webhooks/payapp/route.ts` (line 84)
**현황:** `MABIZ_PURCHASE_WEBHOOK_SECRET` 사용하는데, 정확히는 `MABIZ_PAYAPP_WEBHOOK_SECRET` 필요

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 보안 | 🔴 Auth Fails | 잘못된 시크릿으로 HMAC 검증 불가 |
| 신뢰성 | 🔴 100% Reject | 모든 payapp 웹훅 거부됨 |
| 기능 | 🔴 Broken | B2B 결제 데이터 처리 불가 |
| 운영 | 🔴 Silent Failure | 에러 없음, 그냥 거부만 함 |

### 권장 해결책
**Option A (권장):** 환경변수 이름 수정
```typescript
// line 84
const secretKey = process.env.MABIZ_PAYAPP_WEBHOOK_SECRET;
// 이전 (잘못됨): MABIZ_PURCHASE_WEBHOOK_SECRET
```
- 이유: 페이앱은 크루즈닷몰 구매와 다른 시크릿
- 예상 영향: payapp 웹훅 정상 처리

---

## P0 Blocker #5-6: Webhook 멱등성 미완성 (Agent α)
**파일:** `src/app/api/webhooks/inquiry/route.ts`, `gold-inquiry/route.ts`
**문제:** TOCTOU Race Condition
- eventId 체크 (line 75)
- DB 쿼리 (line 97)
- Transaction 시작 (line 98+)

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 보안 | 🔴 Race Condition | 같은 eventId 두 번 처리 가능 |
| 신뢰성 | 🔴 Duplicate Data | 중복 Contact/Inquiry 생성 |
| 데이터 | 🔴 Inconsistent | 부분 실패 시 롤백 불가 |
| 운영 | 🔴 Hard to Debug | 간헐적 중복 발생 |

### 권장 해결책
**Option A (권장):** Transaction 먼저, 그 안에서 체크
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Transaction 시작
  const existing = await tx.webHookLog.findUnique({where: {eventId}});
  if (existing) return null; // 이미 처리됨
  // 이제 안전하게 처리
  return tx.inquiry.create({...});
}, { isolationLevel: 'Serializable' });
```
- 이유: Transaction 경계 내에서만 일관성 보장
- 예상 영향: 중복 처리 100% 방지

---

## P0 Blocker #7: Transaction 경계 오류 (Agent α)
**파일:** `src/app/api/webhooks/purchase/route.ts` (lines 129-131, 143)
**문제:** eventId 저장이 transaction 외부
```typescript
// 문제: eventId가 외부에서 저장되면, 
// transaction 실패 시 eventId만 남아있어 재시도 불가
```

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 신뢰성 | 🔴 Partial Failure | eventId만 저장되고 Contact는 미생성 |
| 복구 | 🔴 Unrecoverable | 재시도 시 "이미 처리됨" 판정 |
| 데이터 | 🔴 Orphaned Logs | WebHookLog만 쌓임 |
| 운영 | 🔴 Manual Intervention Needed | 수동 정정 필요 |

### 권장 해결책
**Option A (권장):** eventId 저장도 Transaction 안에
```typescript
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.goldMember.findUnique({...});
  const contact = await tx.contact.create({...});
  // Transaction 성공 시만 실행
  await tx.webHookLog.create({eventId, status: 'SUCCESS'});
  return {contact, user};
});
```
- 이유: All-or-Nothing 원칙
- 예상 영향: 부분 실패 제거, 안전한 재시도

---

## P0 Blocker #8: Cron 보안 - 타이밍 공격 (Agent γ)
**파일:** `src/app/api/cron/retry-mabiz-dlq/route.ts` (line XX)
**문제:** 문자열 비교 사용
```typescript
if (secret !== process.env.VERCEL_CRON_SECRET) {
  // 문자열 비교는 타이밍 공격 취약
}
```

### 10렌즈 분석
| 렌즈 | 평가 | 이유 |
|------|------|------|
| 보안 | 🔴 Timing Attack | 외부에서 secret 추측 가능 |
| 신뢰성 | 🔴 Unauthorized Access | 누구나 Cron 트리거 가능 |
| 운영 | 🔴 Data Breach Risk | DLQ 데이터 노출 |

### 권장 해결책
**Option A (권장):** timingSafeEqual 사용
```typescript
import { timingSafeEqual } from 'crypto';

const expectedSecret = Buffer.from(process.env.VERCEL_CRON_SECRET || '');
const providedSecret = Buffer.from(req.headers.get('authorization') || '');

if (!timingSafeEqual(expectedSecret, providedSecret)) {
  return NextResponse.json({error: 'Unauthorized'}, {status: 401});
}
```
- 이유: Node.js 권장 사항 (crypto.timingSafeEqual)
- 예상 영향: 타이밍 공격 방지

---

## 우선순위 및 실행 순서

```
1. P0-1: MabizSyncDLQ 마이그레이션 생성
   ├─ 소요: 10분
   └─ 영향: 나머지 P0들의 기반

2. P0-3: vercel.json 등록
   ├─ 소요: 5분
   └─ 영향: Cron 자동 실행 시작

3. P0-2: MabizSyncDLQ 코드 구현
   ├─ 소요: 30분
   └─ 영향: 실제 DLQ 기능

4. P0-4: payapp Secret 수정
   ├─ 소요: 2분
   └─ 영향: B2B 결제 처리 시작

5. P0-5/6: Webhook 멱등성 (inquiry/gold-inquiry)
   ├─ 소요: 30분
   └─ 영향: 중복 처리 방지

6. P0-7: Transaction 경계 (purchase)
   ├─ 소요: 15분
   └─ 영향: 부분 실패 제거

7. P0-8: Cron 타이밍 공격 방지
   ├─ 소요: 10분
   └─ 영향: 보안 강화
```

---

## 의사결정 포인트

**Q1: MabizSyncDLQ를 지금 구현할까?**
- A (추천): 예. DLQ 없으면 웹훅 재시도 불가능
- B: 나중에. P1 이슈부터 먼저.

**Q2: Webhook 멱등성을 모두 Serializable로 할까?**
- A (추천): 예. 다른 isolation level은 미흡
- B: ReadCommitted 사용. 성능이 조금 더 빠름 (대신 중복 위험)

**Q3: Cron 스케줄 간격은?**
- A (추천): 매시간 (hourly). 충분히 자주 재시도
- B: 30분마다. 더 빠른 복구 (리소스 더 많이 소비)

