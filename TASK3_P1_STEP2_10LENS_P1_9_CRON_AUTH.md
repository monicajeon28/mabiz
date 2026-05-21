# Task 3 Step 2: P1-9 (Cron Auth Header) 10렌즈 토론

## Context
- P0 8개는 모두 완료 (커밋 f474869)
- P1 11개 중 "최상 우선순위" 3개 식별
- **P1-9 선택:** 가장 간단하면서 중요한 이슈 (간단 난이도, 높은 문제도)

---

## P1-9: Cron Auth Header 검증 불일치

**현황:**
```typescript
// src/app/api/cron/retry-mabiz-dlq/route.ts L13-28

const secret = process.env.CRON_SECRET;
const auth = req.headers.get('authorization') ?? '';

// ...

const expectedSecret = Buffer.from(`Bearer ${secret}`);
const providedSecret = Buffer.from(auth);

if (expectedSecret.length !== providedSecret.length ||
    !timingSafeEqual(expectedSecret, providedSecret)) {
  return NextResponse.json({ ok: false }, { status: 401 });
}
```

**문제점:**
- 코드는 `authorization` 헤더를 읽음 (L14)
- 비교할 때 `Bearer ` 접두사를 **자동 추가** (L21)
- **가정**: Vercel Cron이 `authorization: Bearer <secret>` 형식으로 보낸다
- **위험**: Vercel이 다른 헤더 또는 다른 형식 사용하면 **항상 401 에러**
- 테스트 부재 → 배포 후 Cron이 작동 안 할 수 있음

---

## 10렌즈 분석

| 렌즈 | 평가 | 설명 |
|------|------|------|
| **보안** | 🟡 중간 | timingSafeEqual 사용하므로 타이밍 공격은 방지 ✓<br/>하지만 검증 로직 자체가 틀렸을 수 있음 |
| **신뢰성** | 🔴 높음 | Vercel Cron이 잠자거나 실패할 수 있음<br/>인증 실패 → 401 → Vercel 재시도 안함<br/>→ **사일런트 실패** (로그만 남음) |
| **운영성** | 🔴 높음 | 현재 no-op (NODE_ENV=prod 아니면 인증 스킵)<br/>로컬 테스트 불가능 (NODE_ENV prod 필요)<br/>배포 전 검증 불가 |
| **테스트성** | 🔴 높음 | 테스트할 방법 없음<br/>Vercel에 올렸을 때야 알 수 있음 |
| **명확성** | 🟡 중간 | Vercel Cron 문서 참고 필요<br/>현재 코드는 **가정**만 명시 |
| **유지보수** | 🟡 중간 | Bearer 형식이 고정되어 있음<br/>나중에 다른 인증 방식으로 바뀌면 수정 필수 |
| **성능** | ✅ 좋음 | Buffer 비교만 하므로 성능 이슈 없음 |
| **확장성** | 🟡 중간 | 다른 Cron 엔드포인트가 생기면 동일 코드 반복 필요 |
| **문서화** | 🔴 높음 | Vercel Cron 인증 방식이 주석에 없음<br/>왜 Bearer를 추가하는지 설명 부재 |
| **의도** | 🟡 중간 | "Vercel Cron이 Bearer token 보낸다"는 의도 불명확<br/>공식 문서와 불일치 가능성 |

---

## 핵심 의사결정: Vercel Cron 인증 형식

### **Option A (현재):** `authorization: Bearer <secret>`
```
요청: authorization: Bearer my-secret-123
검증: Bearer my-secret-123 == Bearer my-secret-123 ✓
```

### **Option B (가능성1):** `x-vercel-cron-secret: <secret>`
```
요청: x-vercel-cron-secret: my-secret-123
검증: authorization 헤더 없음 → 401 FAIL ❌
→ Cron 작동 안 함!
```

### **Option C (가능성2):** `authorization: Bearer <base64-encoded>`
```
요청: authorization: Bearer base64(secret)
검증: Bearer raw-secret != Bearer base64-encoded ✗ FAIL
```

---

## 권장 해결책

### **1단계: Vercel 공식 문서 확인** (필수)
```bash
# Vercel Cron 공식 문서:
# https://vercel.com/docs/cron-jobs

# 확인 항목:
# 1. Vercel이 보내는 헤더 이름은? (authorization vs x-vercel-cron-secret vs other)
# 2. 전송 형식은? (Bearer prefix 있는지)
# 3. Secret이 환경변수 이름은? (CRON_SECRET vs VERCEL_CRON_SECRET vs other)
```

### **2단계: 코드 검증 (테스트)**
```typescript
// 현재 가정: authorization: Bearer <secret>
// 확인 방법:
// - 로컬에서 curl로 테스트
// - Vercel Cron 문서와 코드 매칭
// - 실제 배포 후 CloudWatch/로그 확인
```

### **3단계: 코드 정정** (확인 후)
```typescript
// 방안 1: Vercel 가정이 맞으면 (현재 코드 유지)
// → 주석 추가: "Vercel Cron sends 'authorization: Bearer <secret>'"

// 방안 2: x-vercel-cron-secret이면 (수정 필요)
const secret = process.env.CRON_SECRET;
const auth = req.headers.get('x-vercel-cron-secret') ?? '';
// Bearer 제거

// 방안 3: 둘 다 지원 (안전)
const bearerAuth = req.headers.get('authorization')?.replace('Bearer ', '');
const secretHeaderAuth = req.headers.get('x-vercel-cron-secret');
const provided = bearerAuth || secretHeaderAuth;
```

---

## 의사결정 포인트

**Q1: 현재 코드는 정확한가?**
- A (추천): 아니다. Vercel 문서와 검증 필요
- B: 맞다. Bearer 형식이 표준

**Q2: 테스트는 어디서?**
- A (추천): 배포 전 로컬 curl 테스트
- B: 배포 후 로그 확인 (위험)

**Q3: 다른 Cron 엔드포인트가 있을까?**
- A (추천): 있다 (현재 여러 개 존재). 공통 유틸 함수화 필요
- B: 없다. 이 엔드포인트만 특별

---

## 결론 (Step 2 완료)

**P1-9 핵심 문제:**
> Vercel Cron 인증 방식이 **가정**일 뿐, 공식 문서와 검증 부재

**권장 해결 순서:**
1. ✅ P1-9 분석 (완료)
2. 🔄 Vercel 문서 확인 + 로컬 테스트 (Step 3 지시서)
3. ⏳ 코드 수정 (Step 4)
4. ⏳ 검증 (Step 5)
5. ⏳ 커밋 (Step 6)

---

## 추가 노트

**왜 P1-9를 먼저 해결?**
1. **가장 간단** (난이도: 간단)
2. **높은 영향도** (Cron이 작동 안 하면 DLQ 재시도 불가)
3. **빠른 검증** (Vercel 문서 5분 확인 + curl 테스트)
4. **높은 신뢰성** (정확하면 배포 안심)

**P1-4/11 (PayApp)은 왜 나중?**
- 더 복잡함 (form-data ↔ JSON 변환)
- 테스트 어려움 (PayApp 시뮬레이션 필요)

