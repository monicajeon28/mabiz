# 크루즈봇 Q&A RAG - 코드 수정 제안서

**날짜**: 2026-05-18  
**대상**: API 엔드포인트 + React 컴포넌트

---

## 🔴 P0 긴급 수정 사항 (필수)

### 1. limit/page 값 검증 누락

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/route.ts`  
**심각도**: P0  
**원인**: limit=-1, limit=999 같은 이상한 값에 대한 검증 없음

**현재 코드** (라인 23-24):
```typescript
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || PAGE_SIZE.toString());
```

**문제**:
- `page=0` → skip=0, 첫 번째 항목 반복
- `page=-1` → skip 음수값, DB 오류 또는 예상 밖 동작
- `limit=0` → 0개 반환
- `limit=-1` → 음수 limit, DB 오류
- `limit=999` → 메모리 부하, OOM 위험

**수정 코드**:
```typescript
// 페이지 검증
const pageRaw = parseInt(searchParams.get("page") || "1");
const page = Math.max(Math.min(pageRaw, 1000), 1); // 1-1000 범위

// limit 검증
const limitRaw = parseInt(searchParams.get("limit") || PAGE_SIZE.toString());
const limit = Math.max(Math.min(limitRaw, 100), 1); // 1-100 범위

// 추가: limit 초과 시 경고
if (limitRaw > 100) {
  console.warn(`[bot-guide-answers] limit=${limitRaw} exceeded max (100), capped to 100`);
}
if (pageRaw !== page) {
  console.warn(`[bot-guide-answers] page=${pageRaw} out of range, adjusted to ${page}`);
}
```

**테스트**:
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?limit=999"
# 예상: limit=100으로 제한됨, 메시지 로깅

curl "http://localhost:3000/api/tools/bot-guide-answers?page=0"
# 예상: page=1로 강제, 메시지 로깅

curl "http://localhost:3000/api/tools/bot-guide-answers?limit=-1"
# 예상: limit=1로 설정
```

---

### 2. category + tone 필터 로직 오류

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/route.ts`  
**심각도**: P0  
**원인**: tone 필터가 OR 조건으로 병합되어 AND가 아닌 OR로 작동

**현재 코드** (라인 30-54):
```typescript
// 키워드 검색
if (query) {
  where.OR = [
    { question: { contains: query, mode: "insensitive" } },
    { answer: { contains: query, mode: "insensitive" } },
    { keywords: { has: query } },
  ];
}

// 카테고리 필터
if (category && category !== "all") {
  where.category = category;
}

// 판매톤 필터
if (tone && tone !== "all") {
  where.OR = [
    ...(where.OR || []),
    {
      salesTone: {
        path: ["primary"],
        equals: tone,
      },
    },
  ];
}
```

**문제**:
- 쿼리 필터와 톤 필터가 하나의 `OR` 배열에 혼합됨
- 예: `category="정책&수수료" + tone="friendly"` → (정책 OR 친근) 데이터 반환
- 예상: 정책 카테고리 중 친근 톤만 반환

**수정 코드**:
```typescript
// 기본 where 조건
const where: any = { isActive: true };

// 1. 키워드 검색 (OR 조건)
if (query) {
  where.OR = [
    { question: { contains: query, mode: "insensitive" } },
    { answer: { contains: query, mode: "insensitive" } },
    { keywords: { has: query } },
  ];
}

// 2. 카테고리 필터 (AND 조건)
if (category && category !== "all") {
  where.category = category;
}

// 3. 톤 필터 (AND 조건, 별도 처리)
if (tone && tone !== "all") {
  // Prisma doesn't support JSON path queries well, 
  // so we'll filter in memory or use raw query
  // 임시: AND 조건으로 추가 필터링
  where.AND = [
    {
      salesTone: {
        path: ["primary"],
        equals: tone,
      },
    },
  ];
}
```

**더 나은 해결책 (Raw SQL)**:
```typescript
// Prisma 쿼리 대신 Raw SQL 사용
const results = await prisma.$queryRaw`
  SELECT * FROM "BotGuideAnswer"
  WHERE "isActive" = true
    AND (${query ? sql`("question" ILIKE ${'%' + query + '%'} OR "answer" ILIKE ${'%' + query + '%'})` : sql`1=1`})
    AND (${category !== "all" ? sql`"category" = ${category}` : sql`1=1`})
    AND (${tone !== "all" ? sql`"salesTone"->>'primary' = ${tone}` : sql`1=1`})
  ORDER BY "updatedAt" DESC
  LIMIT ${limit}
  OFFSET ${skip}
`;
```

**테스트**:
```bash
# 정책 + 친근만 반환
curl "http://localhost:3000/api/tools/bot-guide-answers?category=정책%26수수료&tone=friendly"
# 확인: 반환된 모든 데이터의 category="정책&수수료" AND salesTone.primary="friendly"
```

---

### 3. isActive 기본값 오류

**파일**: `/d/mabiz-crm/prisma/schema.prisma`  
**심각도**: P0  
**원인**: BotGuideAnswer의 기본값이 `false`로 설정되어 업로드 후 검색 불가

**현재 코드** (라인 2186):
```prisma
model BotGuideAnswer {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  // ...
  isActive  Boolean  @default(false)  // ← 문제!
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**문제**:
- POST로 데이터 업로드 → isActive=false (자동)
- GET에서 `WHERE isActive=true` 필터 → 아무것도 안 나옴
- 사용자 혼동: "업로드했는데 왜 안 보여?"

**수정 코드**:
```prisma
model BotGuideAnswer {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  // ...
  isActive  Boolean  @default(true)  // ← 수정: true로 변경
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**또는 POST에서 명시적 설정**:
```typescript
// route.ts POST 핸들러
const record = await tx.botGuideAnswer.upsert({
  where: { key },
  update: {
    // ... 다른 필드 ...
    isActive: true, // ← 명시적으로 true
    updatedAt: new Date(),
  },
  create: {
    // ... 다른 필드 ...
    isActive: true, // ← 명시적으로 true
  },
});
```

**Migration 생성**:
```bash
npx prisma migrate dev --name fix_botguideAnswer_default_isActive
```

---

### 4. 요청 크기 제한 없음

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/route.ts`  
**심각도**: P0  
**원인**: 매우 큰 JSON 파일(10MB+) 업로드 시 메모리 부하/타임아웃

**현재 코드** (라인 114-121):
```typescript
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json(); // ← 크기 제한 없음!
    } catch {
      // JSON 파싱 실패시 기본값 사용
    }
```

**문제**:
- 10MB JSON 파싱 → 메모리 부하
- 50MB JSON → OOM, 서버 다운

**수정 코드**:
```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Content-Length 검증
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength);
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (size > MAX_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            message: `파일 크기가 5MB를 초과합니다 (현재: ${(size / 1024 / 1024).toFixed(2)}MB)`,
          },
          { status: 413 } // Payload Too Large
        );
      }
    }

    // 2. JSON 파싱 (이미 검증됨)
    let body: any = {};
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json(
        { ok: false, message: "유효한 JSON 형식이 필요합니다." },
        { status: 400 }
      );
    }

    // 3. 데이터 배열 크기 검증
    const { data, mode = "upsert", confirm = false } = body;
    if (Array.isArray(data) && data.length > 10000) {
      return NextResponse.json(
        {
          ok: false,
          message: "한 번에 최대 10000개까지 업로드 가능합니다.",
        },
        { status: 400 }
      );
    }
    
    // ... 나머지 코드 ...
  }
}
```

**테스트**:
```bash
# 5MB 초과 파일 업로드
curl -X POST http://localhost:3000/api/tools/bot-guide-answers \
  -H "Content-Type: application/json" \
  -d '{"data": [..10000개..]}'
# 예상: 413 에러, "파일 크기 초과" 메시지
```

---

### 5. 빈 검색어 처리 미정의

**파일**: `/d/mabiz-crm/src/components/tools/QaLibrary.tsx`  
**심각도**: P0  
**원인**: 초기 로드 시 아무 검색어 없이 전체 데이터 조회

**현재 코드** (라인 66-95, 100-102):
```typescript
const performSearch = useCallback(
  async (q: string = query, cat: string = category, t: string = tone, p: number = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.append("q", q); // ← q가 빈 문자열이면 추가 안 함
      // ...
      performSearch(query, category, tone, 1); // ← 초기값: query=""
    } finally {
      setLoading(false);
    }
  }
);

// 초기 로드
useEffect(() => {
  performSearch(query, category, tone, 1); // ← query=""로 호출
}, []);
```

**문제**:
- 페이지 로드 → performSearch("", "all", "all", 1)
- API → SELECT * (전체 564개 필터링 없음)
- 성능 저하, 의도 불명확

**수정 코드** (옵션 A: 빈 상태 유지):
```typescript
// 초기 로드 시 데이터 안 함
useEffect(() => {
  // 아무것도 하지 않음
}, []);

// 또는 명시적으로 빈 상태 설정
useEffect(() => {
  setItems([]); // 검색어 입력 전까지 빈 목록
  setTotal(0);
}, []);
```

**수정 코드** (옵션 B: 카테고리 필터 먼저 보여주기):
```typescript
useEffect(() => {
  // 카테고리만으로 검색
  if (category !== "all") {
    performSearch("", category, tone, 1);
  }
  // 아니면 빈 상태
}, []);
```

**수정 코드** (옵션 C: 사용자에게 선택권 주기):
```typescript
useEffect(() => {
  // 처음엔 검색어 입력 유도
  setItems([]);
  setError("검색어를 입력하거나 카테고리를 선택해주세요");
}, []);
```

**추천**: 옵션 A (초기 로드 시 빈 상태)

---

## 🟠 P1 높음 우선순위 수정

### 6. 검색어 길이 제한 없음

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/route.ts`  
**심각도**: P1

**현재 코드**:
```typescript
const query = searchParams.get("q")?.toLowerCase().trim() || "";
```

**문제**: 10KB 검색어 → DB 성능 저하

**수정**:
```typescript
const queryRaw = searchParams.get("q")?.toLowerCase().trim() || "";
const query = queryRaw.substring(0, 1000); // 1000자 제한

if (queryRaw.length > 1000) {
  console.warn(`[bot-guide-answers] Query truncated from ${queryRaw.length} to 1000 chars`);
}
```

---

### 7. 에러 메시지 불명확

**파일**: `/d/mabiz-crm/src/components/tools/QaLibrary.tsx`  
**심각도**: P1

**현재 코드** (라인 88-92):
```typescript
} catch (err) {
  setError("검색 중 오류 발생");
  console.error(err);
}
```

**문제**: 사용자가 원인을 모름

**수정**:
```typescript
} catch (err) {
  // 에러 타입 구분
  if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
    setError("📡 인터넷 연결을 확인해주세요");
  } else if (err instanceof Error && err.name === 'AbortError') {
    setError("⏱️ 검색이 너무 오래 걸리고 있습니다. 다시 시도해주세요");
  } else {
    setError("⚠️ 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요");
  }
  console.error("[QaLibrary] Search error:", err);
}
```

---

### 8. 타임아웃 처리 없음

**파일**: `/d/mabiz-crm/src/components/tools/QaLibrary.tsx`  
**심각도**: P1

**현재 코드** (라인 78):
```typescript
const res = await fetch(`/api/tools/bot-guide-answers?${params}`);
```

**문제**: API 응답 지연 → 무한 대기

**수정**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초

try {
  const res = await fetch(`/api/tools/bot-guide-answers?${params}`, {
    signal: controller.signal,
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  
  const data: ApiResponse = await res.json();
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

### 9. POST 필드 검증 응답 미흡

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/route.ts`  
**심각도**: P1

**현재 코드** (라인 180-186):
```typescript
if (!key || !item.question || !item.answer) {
  errors.push({
    key: key || "unknown",
    error: "필수 필드 누락 (key/id, question, answer)",
  });
  continue;
}
```

**문제**: 에러 배열이 응답에 포함되지만 처음 5개만 전송 (라인 245)

**수정**:
```typescript
// 응답에 더 많은 에러 정보 포함
return NextResponse.json(
  {
    ok: true,
    message: `${result.succeeded}개 데이터 처리 완료 (실패: ${result.failed}${
      result.deletedCount > 0 ? `, 삭제: ${result.deletedCount}` : ""
    })`,
    ...result,
    // 모든 에러 반환 (5개가 아니라)
    errorSummary: {
      total: errors.length,
      sample: errors.slice(0, 10), // 처음 10개
    }
  },
  { status: result.failed > 0 ? 207 : 200 } // 207 Multi-Status
);
```

---

## 🟡 P2 중간 우선순위 개선

### 10. GET 존재하지 않는 key 에러

**파일**: `/d/mabiz-crm/src/app/api/tools/bot-guide-answers/[key]/route.ts`  
**심각도**: P2

**현재 코드** (라인 34-39):
```typescript
if (!data) {
  return NextResponse.json(
    { ok: false, message: "데이터를 찾을 수 없습니다." },
    { status: 404 }
  );
}
```

**개선**:
```typescript
if (!data) {
  return NextResponse.json(
    { 
      ok: false, 
      message: "요청한 Q&A를 찾을 수 없습니다.",
      key: key,
      suggestion: "목록에서 올바른 key를 확인해주세요."
    },
    { status: 404 }
  );
}
```

---

## 📝 마이그레이션 계획

### Step 1: Prisma 스키마 수정 (즉시)
```bash
# 1. schema.prisma 수정
#   - isActive 기본값: false → true

# 2. 마이그레이션 생성
npx prisma migrate dev --name fix_botguideAnswer_activeDefault

# 3. 기존 데이터 활성화
npx prisma db execute --stdin
# UPDATE "BotGuideAnswer" SET "isActive" = true WHERE "isActive" = false;
```

### Step 2: API 엔드포인트 수정 (1-2일)
```typescript
// 우선순위 순서:
// 1. limit/page 검증 (30분)
// 2. 요청 크기 제한 (20분)
// 3. category+tone 필터 로직 (1시간)
// 4. 검색어 길이 제한 (15분)
// 5. 필드 검증 개선 (30분)
```

### Step 3: UI 컴포넌트 수정 (1-2일)
```typescript
// 우선순위 순서:
// 1. 초기 로드 빈 상태 처리 (20분)
// 2. 에러 메시지 구체화 (30분)
// 3. 타임아웃 처리 (45분)
// 4. 재시도 버튼 추가 (30분)
```

### Step 4: 테스트 & 배포 (1-2일)
```bash
# Jest 테스트 작성 (API)
npm run test:api

# Playwright E2E 테스트
npm run test:e2e

# 수동 QA
# - 위의 체크리스트 참고

# 배포
git add . && git commit -m "fix: Q&A RAG P0 이슈 10개 해결"
git push origin main
```

---

## 🧪 테스트 코드 예시

### Jest 테스트 (API)

```typescript
// __tests__/bot-guide-answers.test.ts
import { GET, POST } from '@/app/api/tools/bot-guide-answers/route';

describe('GET /api/tools/bot-guide-answers', () => {
  it('limit=0 should return error or default to 1', async () => {
    const req = new Request('http://localhost:3000/api/tools/bot-guide-answers?limit=0');
    const res = await GET(req);
    const data = await res.json();
    expect(data.ok).toBe(true); // or false
    expect(data.meta.limit).toBeGreaterThanOrEqual(1);
  });

  it('limit=999 should cap to 100', async () => {
    const req = new Request('http://localhost:3000/api/tools/bot-guide-answers?limit=999');
    const res = await GET(req);
    const data = await res.json();
    expect(data.meta.limit).toBeLessThanOrEqual(100);
  });

  it('category + tone should use AND, not OR', async () => {
    const req = new Request(
      'http://localhost:3000/api/tools/bot-guide-answers?category=정책%26수수료&tone=friendly'
    );
    const res = await GET(req);
    const data = await res.json();
    
    // 모든 결과가 조건을 만족해야 함
    data.data.forEach(item => {
      expect(item.category).toBe('정책&수수료');
      expect(item.salesTone.primary).toBe('friendly');
    });
  });
});
```

---

## ✅ 검증 체크리스트

수정 후 다음을 확인하세요:

```
[ ] 모든 P0 이슈 수정됨
[ ] Jest 테스트 100% 통과
[ ] Playwright E2E 테스트 통과
[ ] 수동 QA 체크리스트 완료
[ ] 성능: 응답 시간 < 500ms
[ ] 메모리: 페이지 전환 후 누수 없음
[ ] 보안: SQL Injection 테스트 통과
[ ] 모바일: 375px에서 UI 깨지지 않음
[ ] 접근성: 스크린 리더기 작동 확인
[ ] 배포: git push 후 Vercel 배포 완료
```

---

**다음 단계**: 이 문서를 검토하고 P0 이슈부터 우선 수정하세요. 예상 소요 시간: 2-3일.
