# Task 3 Step 2: P1-4/P1-11 (PayApp 페이로드 형식) 10렌즈 토론

## Context
- P0 8개는 모두 완료 (커밋 f474869)
- P1 11개 중 "최상 우선순위" 3개 식별
- **P1-9 선택:** 이미 완료 (Vercel Cron 문서화)
- **P1-4/P1-11 선택:** PayApp form-data ↔ JSON 변환 불일치 (2번째 우선순위)

---

## P1-4/P1-11: PayApp 웹훅 페이로드 형식 불일치

**현황:**
```typescript
// src/app/api/webhooks/payapp/route.ts L44-45
const body = await req.text();
const params = new URLSearchParams(body);  // ← form-data 처리

// ... 처리 ...

// L418 DLQ에 저장할 때
await enqueueDLQ("payapp", { body: "form-data" }, err...)

// src/app/api/cron/retry-mabiz-dlq/route.ts L69
body: JSON.stringify(entry.payload),  // ← JSON으로 직렬화

// ★ 불일치: form-data로 들어왔던 것이 JSON으로 다시 전송됨
```

**문제점:**
- PayApp 웹훅만 **form-data** 형식으로 수신
- 다른 모든 웹훅 (refund/inquiry/gold-inquiry/purchase)은 **JSON** 형식
- DLQ에 저장할 때 실제 body를 저장하지 않고 문자열 "form-data"만 저장 (L418 에러)
- retry-mabiz-dlq에서 재시도할 때 JSON.stringify로 보내므로 원래 form-data와 불일치
- **결과**: PayApp DLQ 재시도는 항상 실패 (400 Bad Request 또는 형식 오류)

---

## 10렌즈 분석

| 렌즈 | 평가 | 설명 |
|------|------|------|
| **보안** | 🟡 중간 | Bearer 토큰 검증 있음, IP 화이트리스트 있음, linkval 검증 있음. 형식 불일치 자체는 보안 이슈 아님 |
| **신뢰성** | 🔴 높음 | DLQ 재시도가 항상 실패함 → 결제 오류 추적 불가능<br/>실패한 PayApp 이벤트는 영구 손실 |
| **운영성** | 🔴 높음 | PayApp에서 결제 취소 → DLQ 재시도 → 실패 → 무시됨<br/>수작업으로 환불 처리 필요할 수 있음<br/>로그만 남고 실제 처리 불가 |
| **테스트성** | 🔴 높음 | form-data vs JSON 차이를 테스트하기 어려움<br/>Postman이나 curl로 manual test 가능하지만 자동화 필수 |
| **명확성** | 🔴 높음 | PayApp만 form-data 쓰는 이유가 문서화 안됨<br/>DLQ에 { body: "form-data" }만 저장한 이유도 불명확<br/>retry 로직과 불일치 |
| **유지보수** | 🔴 높음 | form-data 관련 코드가 산재<br/>- payapp/route.ts (req 처리)<br/>- mabiz-dlq.ts (저장)<br/>- retry-mabiz-dlq/route.ts (재시도)<br/>한 곳 변경 시 3곳 영향 |
| **성능** | ✅ 좋음 | 형식 변환이 무거운 작업 아님<br/>JSON vs form-data 파싱 성능 차이 무시할 수준 |
| **확장성** | 🟡 중간 | 다른 form-data 웹훅이 생기면 동일 문제 반복<br/>일반화된 솔루션 필요 |
| **문서화** | 🔴 높음 | PayApp form-data 형식이 왜인지 설명 없음<br/>Refund는 JSON인데 PayApp은 form-data인 이유 불명확<br/>DLQ 저장/재시도 로직과의 관계 설명 부재 |
| **의도** | 🔴 높음 | "왜 PayApp만 form-data를 써야 하는가?" 불명확<br/>PayApp API 명세에서 요구하는지, 아니면 임시 구현인지 불분명 |

---

## 핵심 의사결정

### **Q1: PayApp이 정말 form-data만 지원하는가?**

**Option A (추정)**: PayApp API는 form-data만 지원
```
근거: 크루즈닷몰의 레거시 연동 (과거 PHP/JSP 페이먼츠 게이트웨이 형식)
```

**Option B (대안)**: PayApp API가 JSON도 지원하지만 form-data로 구현됨
```
근거: 다른 웹훅들은 모두 JSON인데 PayApp만 form-data
→ 형식 통일 가능
```

**Option C (현재)**: 두 형식 모두 지원 필요
```
근거: legacy integration 유지하면서 JSON도 지원
→ 복잡도 높음
```

---

### **Q2: DLQ 저장/재시도 구조를 어떻게 수정할 것인가?**

**Option A (추천)**: 형식 메타데이터를 DLQ에 저장
```typescript
// 저장 시
await enqueueDLQ("payapp", 
  { 
    payload: params,           // ← URLSearchParams object
    format: "form-data"        // ← 형식 명시
  }, 
  error
);

// 재시도 시 (retry-mabiz-dlq)
if (entry.format === "form-data") {
  // form-data로 재구성
} else {
  // JSON으로 직렬화
}
```

**Option B (보조)**: DLQ에 전체 request body 저장
```typescript
// 저장 시
const rawBody = await req.text();  // ← 원본 form-data string
await enqueueDLQ("payapp", 
  { 
    rawBody,                   // ← 원본 그대로
    contentType: "application/x-www-form-urlencoded"
  }, 
  error
);

// 재시도 시
const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': entry.contentType },
  body: entry.rawBody,  // ← 원본 그대로 전송
});
```

**Option C (복잡)**: 각 웹훅별 별도 DLQ 핸들러
```
→ retry-mabiz-dlq 로직을 payapp 특화로 분리
→ 확장성 낮음
```

---

### **Q3: PayApp 재시도 시 원본 form-data 복원이 정말 필요한가?**

**Option A (추천)**: 필요함
```
근거:
1. PayApp API는 form-data 형식만 인정
2. header Content-Type이 중요함
3. 원본 form-data 문자열을 정확히 보내야 linkval 검증 통과
→ 형식을 정확히 복원해야 함
```

**Option B (대안)**: JSON으로 정규화 후 PayApp endpoint가 JSON도 수용하도록 수정
```
근거:
1. 내부 통일성 (모든 웹훅 = JSON)
2. 더 간단한 구현
3. PayApp과 협의 필요
→ 정책 결정 필요
```

---

## 권장 해결책

### **1단계: PayApp API 명세 확인** (필수)
```
Q1-1: PayApp API는 form-data만 지원하는가, JSON도 지원하는가?
Q1-2: linkval 검증 시 Content-Type 헤더가 영향을 미치는가?
Q1-3: 동일한 파라미터를 JSON으로 전송해도 linkval이 동일한가?
```

### **2단계: 형식 메타데이터 추가** (즉시 수정)
```typescript
// mabiz-dlq.ts
export async function enqueueDLQ(
  webhookType: string,
  payload: unknown,
  error: string,
  format: "json" | "form-data" = "json"  // ← 기본값: JSON
) {
  // ...
  await prisma.mabizSyncDLQ.create({
    data: {
      webhookType,
      payload,        // 실제 파라미터
      format,         // ← 형식 명시
      errorMessage: error,
      retryCount: 0,
      status: "PENDING",
    },
  });
}
```

### **3단계: retry-mabiz-dlq 로직 수정** (즉시 수정)
```typescript
// src/app/api/cron/retry-mabiz-dlq/route.ts L63-70

if (entry.format === "form-data") {
  // form-data로 복원
  const formData = new URLSearchParams();
  Object.entries(entry.payload as Record<string, string>).forEach(([k, v]) => {
    formData.append(k, v);
  });
  
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
} else {
  // JSON (기본)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry.payload),
  });
}
```

### **4단계: PayApp endpoint 호출 시 format 지정**
```typescript
// src/app/api/webhooks/payapp/route.ts L418
const error = err instanceof Error ? err.message : String(err);

// 방법 1: form-data 지정
await enqueueDLQ("payapp", params, error, "form-data").catch(() => {});

// 방법 2: Object로 변환 후 저장
const payload = Object.fromEntries(params);
await enqueueDLQ("payapp", payload, error, "form-data").catch(() => {});
```

---

## 의사결정 포인트

**Q1: PayApp은 정말 form-data만 지원하는가?**
- A (추천): PayApp API 문서 확인 필요. 레거시 결제 게이트웨이라면 form-data만 지원 가능.

**Q2: DLQ에 형식 메타데이터를 추가할 것인가?**
- A (추천): 예. 다른 form-data 웹훅이 생길 수 있고, 확장성이 좋음.

**Q3: URLSearchParams를 어떻게 저장할 것인가?**
- A (추천): Object로 변환 후 저장. `Object.fromEntries(params)` 사용.

---

## 구현 범위 (Step 3-4)

### 수정 파일
1. **prisma/schema.prisma** (마이그레이션 필요 ❌)
   - MabizSyncDLQ에 `format` 필드 이미 있는지 확인
   
2. **src/lib/mabiz-dlq.ts**
   - `enqueueDLQ()` 함수에 `format` 파라미터 추가
   
3. **src/app/api/cron/retry-mabiz-dlq/route.ts**
   - form-data vs JSON 처리 로직 추가 (L63-70)
   
4. **src/app/api/webhooks/payapp/route.ts**
   - `enqueueDLQ(..., "form-data")` 호출 변경

### 테스트
1. Postman/curl로 PayApp form-data 웹훅 시뮬레이션
2. DLQ에 entry 저장 확인 (format: "form-data")
3. retry-mabiz-dlq 실행 후 원본 형식 복원 확인

---

## 결론 (Step 2 완료)

**P1-4/P1-11 핵심 문제:**
> PayApp은 form-data로 들어오지만, DLQ 재시도 시 JSON으로 변환되어 **형식 불일치**로 실패

**권장 해결 순서:**
1. ✅ P1-4/P1-11 분석 (완료)
2. 🔄 PayApp API 명세 확인 (Step 3 지시서)
3. ⏳ 형식 메타데이터 추가 (Step 4)
4. ⏳ retry-mabiz-dlq 로직 수정 (Step 4)
5. ⏳ 테스트 및 검증 (Step 5)
6. ⏳ 커밋 (Step 6)

