# Phase 1 Excel Import (B2C/B2B) — 10렌즈 품질보증 리뷰

**작성일**: 2026-05-08  
**상태**: 완료된 코드 분석 + 개선 권장사항  
**범위**: `src/lib/import-*.ts` + `src/app/api/import/*` + `src/app/(dashboard)/db/page.tsx` + B2B API routes

---

## 📋 Executive Summary

Phase 1 구현은 **기본 구조는 견고하나 프로덕션 배포 전 7개의 P1/P2 개선이 필요**합니다.
- ✅ 역할 기반 접근제어 (RBAC): 정상
- ✅ 파일 검증 (magic bytes): 정상
- ✅ 청크 배치 처리: 효율적
- ⚠️ **에러 집계 로직: 버그 있음 (중복 카운팅)**
- ⚠️ **메모리 누수 위험: AbortController 미사용**
- ⚠️ **데이터 중복 검증 없음 (B2B upsert 전략)**
- ⚠️ **N+1 쿼리: Prospect 조회 후 배치 수정 불필요**

---

## 🔍 10-렌즈 상세 분석

### 1️⃣ 메모리 누수 & 리소스 관리 — P1 위험

#### 문제 1: `/api/import/route.ts` — 메모리 스파이크 (대파일 처리)

**위험 지점** (route.ts:83)
```typescript
const buffer = Buffer.from(await file.arrayBuffer());
const wb = XLSX.read(buffer, { type: "buffer" });
```

**분석:**
- 10MB 파일 전체가 메모리에 로드되고, XLSX 객체도 추가로 메모리 점유
- `XLSX.read()` 내부 객체가 GC되기 전까지 메모리 해제 안됨
- 동시 업로드 다수 시 메모리 스파이크 위험 ⚠️

**권장 개선:**
```typescript
// 1. formData 처리 시 스트림 직접 사용 (파일 일부만 검증)
const buffer = Buffer.alloc(Math.min(4, file.size));
await file.slice(0, 4).stream().getReader().read().then(r => {
  buffer.write(r.value);
});

// 2. XLSX.read 후 즉시 필요한 데이터만 추출
const wb = XLSX.read(buffer, { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(...);
wb = null; // 명시적 해제
```

**영향도**: 높음 (메모리 누수, 느린 서버 응답)  
**우선순위**: P1 (프로덕션 배포 전 필수)

---

#### 문제 2: `db/page.tsx` — cleanup 누락

**위험 지점** (page.tsx:71-85)
```typescript
useEffect(() => {
  const ctrl = new AbortController();
  const onVisible = () => {
    if (!document.hidden) {
      loadStats();
      loadGroups(ctrl.signal);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    ctrl.abort();
  };
}, []);
```

**분석:**
- AbortController 사용은 좋음 ✓
- 하지만 `loadStats()` 호출이 중단되지 않음 (AbortSignal 미전달)
- 탭 전환 → fetch 진행 중 → 언마운트 → 메모리 누수

**권장 개선:**
```typescript
function loadStats(signal?: AbortSignal) {
  fetch("/api/contacts?limit=1", signal ? { signal } : undefined)
    .then(r => r.json())
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    });
}

useEffect(() => {
  const ctrl = new AbortController();
  const onVisible = () => {
    if (!document.hidden) {
      loadStats(ctrl.signal);
      loadGroups(ctrl.signal);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    ctrl.abort();
  };
}, []);
```

**영향도**: 중간 (탭 전환 시 불필요한 fetch 진행)  
**우선순위**: P2

---

### 2️⃣ 에러 처리 & 장애 내성 — P1 버그

#### 문제 1: `/api/import/route.ts` — 에러 카운팅 로직 버그

**버그 지점** (route.ts:266-279)
```typescript
for (const result of results) {
  if (result.status === "fulfilled") {
    successCount++;
  } else {
    if (result.reason?.message !== "SKIP") {  // ← 조건 역함수
      skipCount++;
      if (errors.length < 20) {
        errors.push(`처리 중 오류 발생`); // ← 불명확한 메시지
      }
    } else {
      skipCount++;  // ← 중복 카운팅
    }
  }
}
```

**분석:**
- `result.reason?.message !== "SKIP"` = 일반 오류
- `result.reason?.message === "SKIP"` = 검증 오류 (의도적 스킵)
- **현재 코드**: 검증 오류도 `skipCount++`, 일반 오류도 `skipCount++` → **카운팅 무의미**
- `successCount + skipCount !== rows.length` 가능성 높음 ⚠️

**권장 개선:**
```typescript
let successCount = 0;
let validationSkipCount = 0;  // 검증 실패 (필수 필드 누락)
let processErrorCount = 0;    // 처리 오류 (DB, 네트워크)

for (const result of results) {
  if (result.status === "fulfilled") {
    successCount++;
  } else {
    const isValidationError = result.reason?.code === 'VALIDATION_ERROR';
    if (isValidationError) {
      validationSkipCount++;
      if (errors.length < 20) {
        errors.push(result.reason.message);
      }
    } else {
      processErrorCount++;
      if (errors.length < 20) {
        errors.push(`처리 오류: ${result.reason?.message ?? '알 수 없음'}`);
      }
    }
  }
}

return NextResponse.json({
  ok: true,
  successCount,
  validationSkipCount,
  processErrorCount,
  errors: errors.slice(0, 20),
});
```

**영향도**: 높음 (사용자가 정확한 결과 파악 불가)  
**우선순위**: P1 (데이터 무결성)

---

#### 문제 2: `/api/import/route.ts` — 부분 실패 처리

**위험 지점** (route.ts:125-280)
```typescript
const results = await Promise.allSettled(
  chunk.map(async (row) => {
    // 검증 실패 시 throw new Error("SKIP")
    // 실패 시 해당 행만 스킵, 나머지는 진행
  })
);
```

**분석:**
- ✓ `Promise.allSettled()` 사용 → 부분 실패 처리 좋음
- ✗ 하지만 검증 오류와 DB 오류 구분 없음
- ✗ DB 오류 시 같은 청크의 다른 행도 실패할 수 있음 (외래키 위반 등)
- ✗ 트랜잭션 없음 → 부분 저장 상태 가능

**권장 개선:**
```typescript
// 각 청크를 트랜잭션으로 감싸서 원자성 보장
const results = await Promise.allSettled(
  [chunk].map(async (rows) => {
    return await prisma.$transaction(async (tx) => {
      const chunkResults = [];
      for (const row of rows) {
        try {
          // insert/update 로직
          chunkResults.push({ status: 'fulfilled' });
        } catch (e) {
          if (e.code === 'P2002') {  // 중복 키
            chunkResults.push({ 
              status: 'rejected', 
              reason: new Error('VALIDATION_ERROR: 중복된 데이터') 
            });
          } else {
            throw e;  // 다른 오류는 트랜잭션 롤백
          }
        }
      }
      return chunkResults;
    });
  })
);
```

**영향도**: 높음 (데이터 일관성 보장 필요)  
**우선순위**: P1 (B2C 대량 등록 시 위험)

---

### 3️⃣ 데이터 무결성 & 충돌 — P1 버그

#### 문제 1: B2B Upsert 전략 불일치

**위험 지점** (`/api/import/route.ts`:188-218)
```typescript
// B2B_BUYER 처리
let prospect = await prisma.b2BProspect.findFirst({
  where: {
    organizationId: orgId,
    phone,
    companyName: data["회사명"],
  },
});

if (prospect) {
  await prisma.b2BProspect.update(...);
} else {
  await prisma.b2BProspect.create(...);
}
```

**분석:**
- **문제**: 조회 + 업데이트 패턴은 Race Condition 위험 ⚠️
- 동시 업로드 2개 발생:
  1. A: `findFirst()` → null 반환
  2. B: `findFirst()` → null 반환
  3. A: `create()` 성공
  4. B: `create()` 실패 (중복 키)
- **원인**: `phone + organizationId + companyName` 유니크 제약 없음

**권장 개선:**
```typescript
// 방법 1: Prisma upsert (companyName이 필드가 아니면 불가)
await prisma.b2BProspect.upsert({
  where: {
    phone_organizationId: { phone, organizationId: orgId }
  },
  create: { organizationId: orgId, phone, companyName, ... },
  update: { name, email, position, ... }
});

// 방법 2: Raw SQL with ON CONFLICT (현재 구조 유지)
await prisma.$executeRaw(Prisma.sql`
  INSERT INTO "CrmB2BProspect" 
    (id, "organizationId", phone, "companyName", name, ...)
  VALUES (${id}, ${orgId}, ${phone}, ${companyName}, ${name}, ...)
  ON CONFLICT ("phone", "organizationId") DO UPDATE SET
    "companyName" = ${companyName},
    name = ${name},
    "updatedAt" = NOW()
  WHERE "CrmB2BProspect"."phone" = ${phone}
    AND "CrmB2BProspect"."organizationId" = ${orgId}
`);
```

**영향도**: 높음 (동시 업로드 시 데이터 손실)  
**우선순위**: P1 (동시성 버그)

---

#### 문제 2: B2B eduType 미분류 시 문제

**위험 지점** (`/api/import/route.ts`:180, 222)
```typescript
if (target === "b2b_buyer") {
  // eduType 설정 안함 → DB에는 누락됨
  await prisma.b2BProspect.create({
    organizationId: orgId,
    name: data["대표명"],
    // eduType 필드 없음!
  });
}
```

**분석:**
- B2B 구매자/문의자 엑셀 import 시 `eduType` 필드가 DB에 저장되지 않음
- 추후 조회 시 필터링 불가능 (BUYER vs INQUIRER 구분 안됨)
- **원인**: 기존 B2BProspect 모델이 eduType 컬럼 없었음

**권장 개선:**
```typescript
if (target === "b2b_buyer") {
  // Case 1: eduType을 명시적으로 저장
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "CrmB2BProspect" (..., "eduType", ...)
    VALUES (..., 'BUYER', ...)
  `);
  
  // Case 2: 또는 DB 컬럼이 자동 기본값으로 'INQUIRER'면, 수동으로 지정
  data.eduType = 'BUYER';
}
```

**영향도**: 높음 (B2B 조회/필터 불가)  
**우선순위**: P1 (B2B 기능 정상 작동 불가)

---

### 4️⃣ 성능 & 확장성 — P2

#### 문제 1: N+1 쿼리 (B2B import)

**위험 지점** (`/api/import/route.ts`:189-195)
```typescript
let prospect = await prisma.b2BProspect.findFirst({
  where: {
    organizationId: orgId,
    phone,
    companyName: data["회사명"],
  },
});

if (prospect) {
  await prisma.b2BProspect.update({...});  // ← N+1: 200행 import = 200 SELECT + 업데이트
}
```

**분석:**
- 각 행마다 SELECT 후 UPDATE 실행
- 100행 청크 = 최대 200 DB 왕복
- ON CONFLICT로 최적화 가능

**권장 개선:**
```typescript
// Batch upsert with ON CONFLICT
const values = filteredIds.map(id => 
  `(${id}, ${orgId}, ${phone}, ...)`
);

await prisma.$executeRaw(Prisma.sql`
  INSERT INTO "CrmB2BProspect" (...) VALUES
  ${Prisma.raw(values.join(','))}
  ON CONFLICT ("phone", "organizationId") DO UPDATE SET ...
`);
```

**영향도**: 중간 (1000행 이상 import 시 2-3배 느림)  
**우선순위**: P2

---

#### 문제 2: 파일 검증 이중화

**불필요한 코드** (`/api/import/route.ts`:44-60)
```typescript
// AGENT, FREE_SALES 역할 차단
if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
  return NextResponse.json(...);
}

// B2B target + AGENT/FREE_SALES 이중 체크 (중복!)
if (target.startsWith("b2b")) {
  if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
    return NextResponse.json(...);
  }
}
```

**분석:**
- 같은 조건을 2번 체크
- 첫 번째에서 이미 거부됨

**권장 개선:**
```typescript
// B2B 대상이면 OWNER/GLOBAL_ADMIN만 허용
if (target.startsWith("b2b") && (ctx.role === "AGENT" || ctx.role === "FREE_SALES")) {
  return NextResponse.json({ ok: false }, { status: 403 });
}
// B2C 대상이면 OWNER/GLOBAL_ADMIN만 허용
if (!target.startsWith("b2b") && ctx.role === "FREE_SALES") {
  return NextResponse.json({ ok: false }, { status: 403 });
}
```

**영향도**: 낮음 (코드 간결성)  
**우선순위**: P3 (리팩토링)

---

### 5️⃣ 보안 — 정상 ✓

#### 검증 내용:
- ✅ Magic bytes 검증: 파일 진정성 확인
- ✅ 파일 크기 제한: 10MB
- ✅ SQL 인젝션 방지: Prisma.sql 템플릿 사용
- ✅ RBAC: 역할별 접근제어 + orgId 검증
- ✅ Headers 보안: `Cache-Control: no-store` (샘플 API)

**권장 추가 사항:**
- Rate limiting: 분당 업로드 횟수 제한 (500행 이상 = 반복 공격 위험)
- Virus scanning: 바이러스 검사 (외부 SDK 필요, 현재 불필요)

**우선순위**: 부가 기능 (선택사항)

---

### 6️⃣ 타입 안정성 — P2

#### 문제 1: 느슨한 타입 정의

**위험 지점** (`/api/import/route.ts`:104-109)
```typescript
const body = await req.json() as {
  name: string; phone: string; email?: string;
  eduType?: string; productName?: string;
  paymentAmount?: number; paymentDate?: string;
  notes?: string; source?: string; status?: string;
};
```

**분석:**
- `as` 단언으로 런타임 검증 없음
- 잘못된 타입 전달 시 다운스트림 오류 발생
- string이 와야 할 곳에 number 가능

**권장 개선:**
```typescript
const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(10),
  email: z.string().email().optional(),
  eduType: z.enum(['BUYER', 'INQUIRER']).optional(),
  productName: z.string().optional(),
  paymentAmount: z.number().positive().optional(),
  paymentDate: z.string().date().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(VALID_STATUSES).optional(),
});

const body = schema.parse(await req.json());
```

**영향도**: 낮음 (기존 코드가 대부분 방어함)  
**우선순위**: P2 (향후 리팩토링)

---

### 7️⃣ 중복 & 충돌 — P2

#### 문제 1: 부분적 중복 정의

**위험 지점** (`import-config.ts` vs `import-utils.ts`)
```typescript
// import-config.ts: normalizePhone 정의
export function normalizePhone(value: unknown): string | null {
  const digits = str.replace(/\D/g, '');
  // ...
}

// import-utils.ts: 거의 동일한 함수 재정의
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  // ...
}
```

**분석:**
- 두 함수의 로직이 완전히 다름 (버그 위험)
- `import-config.ts` 버전: 국제 포맷 지원 (+82 처리)
- `import-utils.ts` 버전: 간단한 포맷만 지원
- **어느 함수가 실제 사용되는가?** 불명확 ⚠️

**권장 개선:**
```typescript
// import-utils.ts에서만 정의 → import-config.ts에서 import
import { normalizePhone, parseAmount, ... } from './import-utils';

export const B2C_IMPORT_CONFIG: ImportConfig = {
  columns: [
    { ..., transform: normalizePhone },
  ]
};

// ✅ 단일 출처 원칙 (Single Source of Truth)
```

**영향도**: 중간 (실제 통화번호 저장 오류 가능)  
**우선순위**: P2 (데이터 품질)

---

### 8️⃣ API 설계 & 통합 — P2

#### 문제 1: 불일치하는 응답 포맷

**위험 지점** (`/api/import/route.ts`:289-294)
```typescript
return NextResponse.json({
  ok: true,
  successCount,
  skipCount,
  errors: errors.slice(0, 20),
});
```

vs. **동일 경로 오류 응답**
```typescript
return NextResponse.json(
  { ok: false, message: "..." },
  { status: 400 }
);
```

**분석:**
- 성공: `{ ok: true, successCount, skipCount, errors }`
- 오류: `{ ok: false, message }`
- 클라이언트가 응답 스키마 예측 불가

**권장 개선:**
```typescript
// 일관된 응답 포맷
type ApiResponse<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// 성공 응답
return NextResponse.json<ApiResponse<ImportResult>>({
  ok: true,
  data: {
    successCount,
    validationSkipCount,
    processErrorCount,
    errors: errors.slice(0, 20),
  }
});

// 오류 응답
return NextResponse.json<ApiResponse<null>>({
  ok: false,
  error: "파일이 없습니다",
  code: "FILE_MISSING"
});
```

**영향도**: 낮음 (UI에서 적응 가능)  
**우선순위**: P3 (향후 개선)

---

### 9️⃣ 모니터링 & 관찰성 — P2

#### 문제 1: 불충분한 로깅

**현재** (`/api/import/route.ts`:282-287)
```typescript
logger.log("[POST /api/import]", {
  target,
  successCount,
  skipCount,
  orgId,
});
```

**분석:**
- 성공 케이스만 로깅
- 오류 발생 시 상세 정보 부족
- validationSkipCount vs processErrorCount 구분 안됨
- 행 단위 오류 원인 추적 불가

**권장 개선:**
```typescript
logger.log("[POST /api/import] 완료", {
  target,
  rows: rows.length,
  successCount,
  validationSkipCount,
  processErrorCount,
  duration: Date.now() - startTime,
  orgId,
});

// 각 행 오류도 개별 로깅 (프로덕션 환경에서만)
if (process.env.NODE_ENV === 'production' && errors.length > 0) {
  logger.warn("[POST /api/import] 부분 실패", {
    target,
    errorCount: errors.length,
    sampleErrors: errors.slice(0, 3),
  });
}
```

**영향도**: 중간 (문제 진단 어려움)  
**우선순위**: P2

---

### 🔟 효율성 & 코드 품질 — P2/P3

#### 문제 1: 불필요한 배열 조작

**위험 지점** (`/api/import/route.ts`:127)
```typescript
const lineNo = rows.indexOf(row) + 2;  // ← O(n) 선형 탐색!
```

**분석:**
- 각 행마다 `rows.indexOf()` 호출 = 최대 O(n²) 복잡도
- 100행 청크에서 최대 5,000번 배열 탐색

**권장 개선:**
```typescript
chunk.forEach((row, index) => {
  const lineNo = rows.indexOf(rows.find(r => r === row)) + 2;
  // 또는: rows의 시작 인덱스를 미리 계산
});

// 더 좋은 방법: 행 인덱스를 함께 전달
const chunks = chunkRows(
  rows.map((row, idx) => ({ row, idx })), 
  100
);

chunks.forEach((chunk) => {
  chunk.forEach(({ row, idx }) => {
    const lineNo = idx + 2;  // ← O(1)
  });
});
```

**영향도**: 낮음 (큰 파일 처리 시에만 눈에 띔)  
**우선순위**: P3

---

#### 문제 2: 중복된 헤더 매핑 로직

**현재**:
- `import-utils.ts:buildHeaderMap()`: 엑셀 헤더 → 필드명 매핑
- `/api/import/route.ts:106-115`: `buildHeaderMap()` 호출
- 그런데 또 수동으로 헤더 매핑:

```typescript
// route.ts:130-135
for (const [col, field] of Object.entries(headerMap)) {
  if (row[col]) {
    data[field] = String(row[col]).trim();
  }
}
```

**분석:**
- `buildHeaderMap()`은 정의되었지만 **실제로는 직접 루프로 처리**
- 코드 복잡성 증가, 유지보수 어려움

**권장 개선:**
```typescript
// import-utils.ts에 parseRow() 함수 추가
export function parseRow(
  rawRow: Record<string, string>,
  headerMap: Record<string, string>,
  config: ImportConfig
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  
  for (const [excelCol, fieldName] of Object.entries(headerMap)) {
    const value = sanitizeCell(rawRow[excelCol]);
    const columnDef = config.columns.find(c => c.name === fieldName);
    
    if (columnDef?.transform && value !== null) {
      parsed[fieldName] = columnDef.transform(value);
    } else {
      parsed[fieldName] = value;
    }
  }
  
  return parsed;
}

// route.ts에서
const parsed = parseRow(row, headerMap, IMPORT_CONFIGS[target]);
```

**영향도**: 낮음 (코드 가독성)  
**우선순위**: P3

---

## 📊 개선 우선순위 매트릭스

| 우선순위 | 렌즈 | 문제 | 영향도 | 복잡도 | 예상 시간 |
|----------|------|------|--------|--------|----------|
| **P1** | 에러 처리 | 에러 카운팅 버그 | 높음 | 낮음 | 30분 |
| **P1** | 메모리 | 대파일 메모리 누수 | 높음 | 중간 | 1시간 |
| **P1** | 데이터 무결성 | B2B Race Condition | 높음 | 중간 | 1시간 |
| **P1** | 데이터 무결성 | eduType 미저장 | 높음 | 낮음 | 30분 |
| **P2** | 메모리 | loadStats AbortSignal 누락 | 중간 | 낮음 | 20분 |
| **P2** | 성능 | N+1 쿼리 | 중간 | 중간 | 1시간 |
| **P2** | 중복 | normalizePhone 이중 정의 | 중간 | 낮음 | 20분 |
| **P2** | 모니터링 | 부족한 로깅 | 중간 | 낮음 | 30분 |
| **P2** | 타입 | 느슨한 타입 정의 | 낮음 | 중간 | 1.5시간 |
| **P3** | 효율성 | O(n²) indexOf | 낮음 | 낮음 | 20분 |
| **P3** | 효율성 | 코드 중복 제거 | 낮음 | 낮음 | 30분 |

---

## ✅ 작업 지시서 (우선순위 순)

### 🔴 P1 수정 사항 (필수 — Phase 2 전에 완료)

#### 작업 1: 에러 카운팅 로직 수정
- **파일**: `src/app/api/import/route.ts` (라인 117-280)
- **변경**:
  - `successCount`, `skipCount` 대신 `successCount`, `validationSkipCount`, `processErrorCount` 사용
  - 에러 메시지 구체화 (현재 "처리 중 오류 발생" → 실제 오류 메시지)
  - `Promise.allSettled()` 결과 해석 로직 재작성
- **테스트**: 1행 성공 + 1행 필드 누락 + 1행 DB 오류인 3행 import → 정확한 카운팅 확인

#### 작업 2: B2B Upsert Race Condition 수정
- **파일**: `src/app/api/import/route.ts` (라인 180-220)
- **변경**:
  - `findFirst()` + `update()` 패턴 제거
  - `prisma.$executeRaw` + `ON CONFLICT` 사용
  - 또는 유니크 제약 추가 후 Prisma upsert 사용
- **테스트**: 동시 업로드 2개 → 중복 키 오류 없음

#### 작업 3: B2B eduType 필드 저장
- **파일**: `src/app/api/import/route.ts` (라인 125-130, 249-260)
- **변경**:
  - `INSERT INTO "CrmB2BProspect" (..., "eduType", ...)` 컬럼 추가
  - `VALUES (..., ${eduType}, ...)` 값 추가
- **테스트**: B2B 구매자 import → DB에서 eduType='BUYER' 확인

#### 작업 4: 대파일 메모리 누수 최적화
- **파일**: `src/app/api/import/route.ts` (라인 82-96)
- **변경**:
  - 10MB 이상 파일은 청크 단위로 읽기 (스트림)
  - XLSX 파싱 후 즉시 데이터 추출 + 객체 해제
  - 메모리 사용량 모니터링 추가
- **테스트**: 10MB 파일 import 후 메모리 할당 정상화 확인

---

### 🟡 P2 개선 사항 (권장 — Phase 2 시작 전)

#### 작업 5: loadStats AbortSignal 전달
- **파일**: `src/app/(dashboard)/db/page.tsx` (라인 32-46, 72-86)
- **변경**:
  - `loadStats()` 함수에 `signal?: AbortSignal` 파라미터 추가
  - `fetch()` 호출 시 signal 전달
  - AbortError 처리 추가
- **테스트**: 탭 전환 중 fetch 중단 확인

#### 작업 6: N+1 쿼리 최적화 (B2B import)
- **파일**: `src/app/api/import/route.ts` (라인 180-220)
- **변경**:
  - Batch INSERT with ON CONFLICT로 단일 쿼리화
  - 또는 트랜잭션 내 upsert 배치 처리
- **테스트**: 100행 import 시 DB 쿼리 개수 측정 (기대: ~5개, 현재: ~200개)

#### 작업 7: normalizePhone 단일화
- **파일**: `src/lib/import-utils.ts`, `src/lib/import-config.ts`
- **변경**:
  - `import-utils.ts`의 완전한 버전 유지
  - `import-config.ts`에서는 import하여 사용
  - `import-config.ts`의 중복 함수 제거
- **테스트**: +82 형식 전화번호 정규화 확인

#### 작업 8: 로깅 강화
- **파일**: `src/app/api/import/route.ts` (라인 282-310)
- **변경**:
  - 처리 시간 측정 추가
  - 오류 유형별 분류 로깅
  - 프로덕션 환경에서 표본 오류 로깅
- **테스트**: 로그에 상세 정보 출력 확인

---

### 🟢 P3 리팩토링 (선택 — 향후)

#### 작업 9: indexOf O(n²) 제거
- 행 인덱스를 미리 계산하여 전달

#### 작업 10: Zod 타입 검증
- POST 본문 검증 스키마 추가

#### 작업 11: API 응답 포맷 통일
- `ApiResponse<T>` 제너릭 타입 정의

---

## 🎯 Phase 2 진행 조건

✅ **Phase 1 QA 필수 완료**:
- [ ] P1 4가지 모두 수정
- [ ] P2 로깅 강화 최소
- [ ] 전체 재 테스트 (B2C/B2B 각 10행 + 100행 + 1000행 import)

✅ **예상 소요 시간**: 4-5시간 (병렬 작업 가능)

---

## 📌 결론

Phase 1의 **아키텍처와 기본 구조는 견고하나, 프로덕션 배포 전 P1 이슈 4개는 반드시 수정 필요**합니다.  
특히 **에러 카운팅 버그와 B2B Race Condition**은 데이터 무결성에 직접 영향을 미칩니다.

이 리뷰의 모든 개선사항을 적용 후, Phase 2 (B2B 그룹 기능)를 진행하시기 바랍니다.
