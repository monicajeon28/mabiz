# 🔵 에이전트 γ (Gamma) — 인프라·공통 라이브러리 전담 작업지시서
## 무한루프 10-렌즈 코드 리뷰 · Vercel 배포 안전화

---

## ⚠️ 절대 규칙 (위반 시 즉시 중단)

| 규칙 | 내용 |
|------|------|
| **배포 금지** | `git push` / Vercel deploy 절대 금지. **커밋(commit)까지만** |
| **시크릿 노출 금지** | API Key, DB URL, 비밀번호를 응답·커밋 어디에도 절대 노출 금지 |
| **DB 절대법칙** | Neon/Supabase는 크루즈닷몰과 **공유 DB**. 스키마 무단 변경·삭제 절대 금지 |
| **한국어 응답** | 모든 설명·보고·코멘트는 무조건 한국어로 작성 |

---

## 📁 담당 영역

```
D:\mabiz-crm\src\lib\          ← 공통 라이브러리 (~85개 파일)
D:\mabiz-crm\src\hooks\        ← React 커스텀 훅
D:\mabiz-crm\src\types\        ← TypeScript 타입 정의
D:\mabiz-crm\src\utils\        ← 유틸리티 함수
D:\mabiz-crm\src\middleware.ts ← Next.js 미들웨어
D:\mabiz-crm\prisma\schema.prisma ← DB 스키마 (읽기만! 변경 금지)
D:\mabiz-crm\next.config.js   ← Next.js 설정
D:\mabiz-crm\package.json     ← 패키지 의존성
D:\mabiz-crm\src\jobs\        ← 백그라운드 잡
```

### 우선순위 (P0 먼저)
```
P0 (즉시): middleware.ts, src/lib/auth.ts, src/lib/rbac.ts, src/lib/prisma.ts
           src/lib/rate-limit.ts, src/lib/csrf.ts, src/lib/sentry.ts
P1 (중요): src/lib/sms-service.ts, src/lib/email.ts, src/lib/redis.ts
           src/lib/logger.ts, src/lib/error-handling.ts, src/lib/validators.ts
P2 (검토): 나머지 lib 파일들, hooks/, utils/, types/
P3 (기타): jobs/, package.json 의존성 감사
```

---

## 🔍 무한루프 프로세스

### 루프 구조
```
① 병렬 코드 검토 (10-렌즈)
   ↓
② 10-렌즈 토론 (우선순위 결정)
   ↓
③ 작업지시서 확정 (P0/P1/P2 분류)
   ↓
④ 작업 실행 (수정)
   ↓
⑤ 재검토 (수정 검증)
   ↓
⑥ 다음 파일로 재반복 → ①
```

### 10-렌즈 체크리스트 (인프라·라이브러리 전용)

| 렌즈 | 인프라 체크 항목 |
|------|-----------------|
| **L1 보안** | 시크릿 하드코딩, JWT 검증 누락, bcrypt 대신 약한 해시, SQL raw query injection |
| **L2 성능** | Redis 연결 풀 미사용, DB 연결 누수, 동기 블로킹 코드, 무거운 계산 미캐시 |
| **L3 접근성** | 해당 없음 (인프라) |
| **L4 UX** | 에러 메시지 구체성, 사용자 친화적 오류 설명 |
| **L5 확장성** | 싱글톤 패턴 오용, 전역 변수 남용, Vercel 서버리스 재시작 시 상태 유실 위험 |
| **L6 에러처리** | Prisma 에러 타입 미분류, Redis 연결 실패 시 폴백 없음, 외부 API 타임아웃 없음 |
| **L7 테스트** | 테스트 불가능한 구조, 사이드이펙트 노출 |
| **L8 유지보수** | 300줄 초과 라이브러리 파일, 중복 로직, 데드 코드 |
| **L9 호환성** | Vercel Edge Runtime 비호환 (Node.js 전용 모듈), 환경변수 미검증 |
| **L10 비즈니스** | 조직(org) 격리 헬퍼 미완성, 역할(role) 체크 일관성 |

---

## 🚨 자주 발견되는 인프라 버그 패턴

### 1. Prisma Client 전역 싱글톤 문제 (P0 - Vercel)
```typescript
// ❌ 위험: 서버리스에서 연결 폭발
const prisma = new PrismaClient();

// ✅ 올바른 패턴 (src/lib/prisma.ts 확인)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2. Redis 연결 실패 폴백 없음 (P1)
```typescript
// ❌ 위험: Redis 다운 시 전체 기능 마비
const result = await redis.get(key); // 예외 처리 없음

// ✅ 수정: try/catch + 폴백
try {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
} catch {
  logger.log('[Redis] 캐시 조회 실패, DB 폴백');
}
return await prisma.contact.findMany(...);
```

### 3. 환경변수 미검증 (P1 - Vercel 사일런트 오류)
```typescript
// ❌ 위험: undefined 값으로 API 호출
const apiKey = process.env.ALIGO_API_KEY; // undefined?
await fetch(`...?apiKey=${apiKey}`); // 잘못된 요청

// ✅ 수정: 시작 시 검증
if (!process.env.ALIGO_API_KEY) {
  throw new Error('[SMS] ALIGO_API_KEY 환경변수 미설정');
}
```

### 4. logger 없이 console.log (P2)
```typescript
// ❌ 위험: Vercel 로그에서 추적 불가, PII 노출 위험
console.log('사용자 로그인:', userPhone);

// ✅ 수정: logger 사용 (src/lib/logger.ts)
logger.log('[Auth] 로그인', { userId: ctx.userId }); // phone 마스킹됨
```

### 5. 외부 API 타임아웃 없음 (P1)
```typescript
// ❌ 위험: Vercel 10초 limit 초과 위험
const res = await fetch('https://external-api.com/...');

// ✅ 수정: AbortController + 타임아웃
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000); // 8초
try {
  const res = await fetch('https://external-api.com/...', {
    signal: controller.signal
  });
} finally {
  clearTimeout(timeout);
}
```

### 6. Vercel Edge 비호환 모듈 (P0)
```typescript
// ❌ 위험: Edge Runtime에서 Node.js 전용 모듈
import { createHash } from 'crypto';      // Node.js only
import { readFileSync } from 'fs';         // Node.js only
import dns from 'dns';                     // Node.js only

// ✅ 수정: Web Standard API 사용
const hash = await crypto.subtle.digest('SHA-256', data);
// 또는 'use server' 지시어로 Node.js 라우트로 이동
```

### 7. Rate Limit 메모리 저장 (P0 - Vercel)
```typescript
// ❌ 위험: 서버리스에서 인스턴스마다 다른 메모리 → rate limit 무효
const requestCounts = new Map<string, number>();

// ✅ 수정: Redis 기반 rate limit (src/lib/rate-limit.ts 확인)
import { rateLimit } from '@/lib/rate-limit';
```

### 8. 데드 코드 / 미사용 exports (P2)
```typescript
// ❌ 코드 스멜: 어디서도 import 안 됨
export function legacyFunction() { ... }
export const OLD_CONSTANT = 'deprecated';
```

---

## 📋 작업 실행 순서

### Phase 1: 스캔 (파일별 10-렌즈)
각 lib 파일을 열어 확인:
1. Prisma 싱글톤 패턴 올바른가
2. Redis 폴백 있는가
3. 환경변수 검증 있는가
4. 외부 API 타임아웃 있는가
5. console.log → logger 교체 필요한가
6. 하드코딩 시크릿 없는가

### Phase 2: 분류 (P0/P1/P2)
```
P0: Edge 비호환, 인증 우회, 시크릿 하드코딩 → 즉시 수정
P1: 타임아웃 없음, Redis 폴백 없음, env 미검증 → 이번 사이클
P2: console.log 교체, 데드 코드 제거 → 다음 사이클
```

### Phase 3: 수정 & 커밋
- 관련 lib 파일들 함께 수정
- 커밋 메시지: `fix(lib/redis): P1 연결 실패 폴백 추가 + 타임아웃 8초`
- 빌드 확인: `npm run build` (성공해야 커밋)

### Phase 4: middleware.ts 특별 검토
```typescript
// middleware.ts는 Edge Runtime에서 실행됨!
// 반드시 확인:
// 1. Node.js 전용 모듈 import 없는가?
// 2. 모든 보호 경로가 인증 검사되는가?
// 3. 퍼블릭 경로 예외 처리 올바른가?
// 4. CORS 헤더 올바른가?
```

---

## 🏁 시작 명령

```
D:\mabiz-crm 에서 시작.

1. src/middleware.ts 부터 Edge Runtime 호환성 검토
2. src/lib/auth.ts, src/lib/rbac.ts 인증·권한 검토
3. src/lib/prisma.ts Prisma 싱글톤 패턴 검토
4. src/lib/rate-limit.ts, src/lib/csrf.ts 보안 검토
5. P0 이슈 즉시 수정 후 커밋
6. P1 이슈 순차 수정
7. 나머지 lib 파일들 완료까지 반복

빌드 명령: npm run build
절대 push 금지. commit까지만.
한국어로 보고할 것.
```

---

## 📊 완료 보고 양식

```
## γ 에이전트 완료 보고

### 수정된 P0 이슈
- [파일경로] : [이슈 설명] → [수정 내용]

### 수정된 P1 이슈
- [파일경로] : [이슈 설명] → [수정 내용]

### 발견되었으나 미수정 (P2)
- [파일경로] : [이슈 설명] (다음 사이클)

### Vercel 호환성 체크
- Edge Runtime 비호환 모듈: ✓ 없음 / ✗ [목록]
- 환경변수 미검증: ✓ 없음 / ✗ [목록]

### 커밋 목록
- [커밋 해시] : [메시지]

### 최종 빌드
- npm run build: ✓ 성공 / ✗ 실패
```
