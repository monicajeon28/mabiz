# Task 3 Step 3: P1-9 (Cron Auth Header) 작업지시서

## 최종 결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| Q1: 현재 코드 정확성 | **Vercel 문서 확인 필수** | 가정일 수 있음 |
| Q2: 테스트 시점 | **배포 전 로컬 테스트** | 사일런트 실패 방지 |
| Q3: 공통화 | **향후 리팩토링** | P1-9는 즉시 정정 우선 |

---

## Step 4 Implementation: P1-9 Cron Auth 검증 강화

**목표:**
1. Vercel 공식 문서 확인 (5분)
2. 로컬 테스트 (5분)
3. 코드 정정 + 주석 추가 (10분)
4. 총 20분

---

### 작업 1: Vercel 공식 문서 확인

**Step 1-1: 현재 코드 추측값 정리**

현재 `/src/app/api/cron/retry-mabiz-dlq/route.ts`:
```typescript
const secret = process.env.CRON_SECRET;
const auth = req.headers.get('authorization') ?? '';
const expectedSecret = Buffer.from(`Bearer ${secret}`);  // ← Bearer 가정
const providedSecret = Buffer.from(auth);
```

**Step 1-2: Vercel 문서 찾기**
- https://vercel.com/docs/cron-jobs
- 문서에서 찾을 항목:
  - ✅ Cron 트리거 시 보내는 헤더 이름
  - ✅ 헤더 값의 형식 (Bearer prefix 있는지)
  - ✅ 환경변수 이름 (추천하는 SECRET 명)
  - ✅ 예제 코드

**Step 1-3: 검증 목록**
```
[ ] 1. Vercel Cron 헤더 이름 확인: 
      현재 가정 → authorization
      실제 → ? (authorization / x-vercel-cron-secret / other)

[ ] 2. 헤더 값 형식 확인:
      현재 가정 → "Bearer <secret>"
      실제 → ? 

[ ] 3. 인증 방식 확인:
      현재 방식 → timingSafeEqual로 직접 비교
      추천 방식 → ?

[ ] 4. 환경변수 명 확인:
      현재 → CRON_SECRET
      추천 → ? (VERCEL_CRON_SECRET 가능)
```

---

### 작업 2: 로컬 테스트

**Step 2-1: curl로 수동 테스트**

```bash
# 현재 가정: authorization: Bearer <secret>

export CRON_SECRET="test-secret-123"
export NODE_ENV=production

# 테스트 1: 정상 인증 (Bearer 포함)
curl -X GET http://localhost:3000/api/cron/retry-mabiz-dlq \
  -H "authorization: Bearer test-secret-123"
# 예상: 200 OK (또는 다른 성공)

# 테스트 2: 잘못된 인증
curl -X GET http://localhost:3000/api/cron/retry-mabiz-dlq \
  -H "authorization: Bearer wrong-secret"
# 예상: 401 Unauthorized

# 테스트 3: Bearer 없이 전송 (Vercel이 이렇게 하면?)
curl -X GET http://localhost:3000/api/cron/retry-mabiz-dlq \
  -H "authorization: test-secret-123"
# 실제: 401 FAIL (Bearer 추가해서)
# 만약 Vercel이 이렇게 보낸다면 → 코드 수정 필요!

# 테스트 4: x-vercel-cron-secret 헤더 (다른 가능성)
curl -X GET http://localhost:3000/api/cron/retry-mabiz-dlq \
  -H "x-vercel-cron-secret: test-secret-123"
# 실제: 401 FAIL (authorization 헤더만 읽어서)
# 만약 Vercel이 이렇게 보낸다면 → 코드 수정 필요!
```

**Step 2-2: 테스트 결과 기록**
```
테스트 1 (Bearer 포함): _____ (성공/실패)
테스트 2 (잘못된 secret): _____ (401 여부)
테스트 3 (Bearer 없음): _____ (작동 여부)
테스트 4 (x-vercel-cron-secret): _____ (작동 여부)
```

---

### 작업 3: 코드 정정 (문서 확인 후)

**Case A: Vercel이 정말 `authorization: Bearer <secret>` 사용하는 경우 (현재 가정 정확)**

```typescript
// src/app/api/cron/retry-mabiz-dlq/route.ts L1-30

// ✅ 현재 코드 유지 + 주석 강화

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      logger.warn('[CronDLQ] CRON_SECRET 미설정');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    
    // [보안] Vercel Cron은 "authorization: Bearer <CRON_SECRET>"로 요청
    // 참고: https://vercel.com/docs/cron-jobs
    // Bearer prefix 추가는 Vercel 표준에 따른 것
    const expectedSecret = Buffer.from(`Bearer ${secret}`);
    const providedSecret = Buffer.from(auth);
    
    if (
      expectedSecret.length !== providedSecret.length ||
      !timingSafeEqual(expectedSecret, providedSecret)
    ) {
      logger.warn('[CronDLQ] 인증 실패', {
        headerPresent: auth.length > 0,
        lenMismatch: expectedSecret.length !== providedSecret.length,
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  
  // ... 나머지 로직
}
```

**Case B: Vercel이 `x-vercel-cron-secret` 헤더 사용하는 경우 (수정 필요)**

```typescript
// src/app/api/cron/retry-mabiz-dlq/route.ts

export async function GET(req: Request) {
  // Vercel Cron은 "x-vercel-cron-secret" 헤더로 요청
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('x-vercel-cron-secret') ?? '';  // ← 헤더 변경
  
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      logger.warn('[CronDLQ] CRON_SECRET 미설정');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    
    // [보안] Vercel Cron 헤더 검증
    const expectedSecret = Buffer.from(secret);  // ← Bearer 제거
    const providedSecret = Buffer.from(auth);
    
    if (
      expectedSecret.length !== providedSecret.length ||
      !timingSafeEqual(expectedSecret, providedSecret)
    ) {
      logger.warn('[CronDLQ] 인증 실패');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  
  // ... 나머지 로직
}
```

**Case C: 둘 다 지원 (가장 안전하지만 복잡)**

```typescript
// 방법: 두 헤더 모두 확인

const bearerAuth = req.headers.get('authorization')?.replace('Bearer ', '');
const headerAuth = req.headers.get('x-vercel-cron-secret');
const providedAuth = bearerAuth || headerAuth;

if (!providedAuth) {
  logger.warn('[CronDLQ] 인증 헤더 없음');
  return NextResponse.json({ ok: false }, { status: 401 });
}

// 나머지 검증...
```

---

### 작업 4: 동일한 문제가 다른 Cron에도 있는지 확인

**Step 4-1: 다른 Cron 엔드포인트 검색**

```bash
grep -r "CRON_SECRET\|x-vercel-cron-secret" src/app/api/cron/
```

현재 발견된 Cron:
- ✅ `/api/cron/retry-mabiz-dlq` (P1-9 대상)
- 🔍 `/api/cron/execute-cron-jobs`
- 🔍 `/api/cron/push-daily`
- 🔍 등등 (vercel.json에 등록된 모든 Cron)

**Step 4-2: 동일한 문제 패턴 확인**

모든 Cron이 동일한 인증 방식 사용하는지 확인:
```bash
grep -A 5 "req.headers.get('authorization" src/app/api/cron/*/route.ts
```

→ 모두 동일하면 한 번에 정정, 다르면 각각 검토

---

## Step 5 검증

### 검증 목록

- [ ] Vercel 문서 확인 완료
- [ ] 로컬 curl 테스트 4가지 모두 실행
- [ ] 코드 정정 완료 (Case A/B/C 중 선택)
- [ ] 주석 추가 (Vercel 문서 링크 포함)
- [ ] 다른 Cron 엔드포인트 동일 패턴 확인
- [ ] TypeScript 빌드 성공 (npm run build)

### 테스트 결과 기록

```
시간: ________
NODE_ENV: production
CRON_SECRET: test-value-123

테스트 1 (Bearer 포함): _____ (성공/실패/상태코드)
테스트 2 (잘못된 secret): _____ 
테스트 3 (Bearer 없음): _____
테스트 4 (x-vercel-cron-secret): _____

결론: Vercel은 _____________ 형식 사용
선택된 해결안: Case _____
```

---

## Step 6 Git 커밋

**파일:**
- src/app/api/cron/retry-mabiz-dlq/route.ts (P1-9 + 동일 패턴)

**커밋 메시지:**

```
fix(cron): P1-9 Vercel Cron Auth 검증 명확화

- Vercel Cron 공식 문서 확인 후 인증 방식 검증
- [authorization vs x-vercel-cron-secret 확인됨]
- timingSafeEqual 검증 + 주석 강화
- 로컬 curl 테스트로 사전 검증
- 다른 Cron 엔드포인트도 동일 패턴 검토

테스트:
- Bearer 포함: ✓
- 잘못된 secret: ✓ (401)
- 형식 불일치: ✓ (401)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 시간 예상

- Step 1 (문서 확인): 5분
- Step 2 (로컬 테스트): 10분
- Step 3 (코드 정정): 5분
- Step 4 (다른 Cron 확인): 5분
- Step 5 (검증): 5분

**총: 30분**

