# 🔴 에이전트 α (Alpha) — API 레이어 전담 작업지시서
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
D:\mabiz-crm\src\app\api\          ← 전체 API 라우트 (~60개 디렉토리)
```

### 우선순위 (P0 먼저)
```
P0 (즉시): auth/, _auth/, _middleware/, webhooks/, payapp/, passport/
P1 (중요): affiliate*, contacts/, funnels/, messages/, sms*, campaigns/
P2 (검토): my/, analytics/, members/, products/, settings/, marketing/
P3 (기타): 나머지 전부
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

### 10-렌즈 체크리스트 (API 라우트 전용)

| 렌즈 | API 라우트 체크 항목 |
|------|---------------------|
| **L1 보안** | auth/CSRF 검증 누락, rate-limit 미적용, SQL injection 가능성, secret 하드코딩 |
| **L2 성능** | N+1 Prisma 쿼리, 무한 루프 위험, 미사용 await, 대용량 응답 미페이지네이션 |
| **L3 접근성** | 해당 없음 (API) |
| **L4 UX** | 에러 메시지 한국어화, 응답 구조 일관성 (ok/data/message) |
| **L5 확장성** | 하드코딩 상수 (숫자/문자열), 비즈니스 로직이 route에 직접 노출 |
| **L6 에러처리** | try/catch 누락, 에러 타입 미분류, 빈 catch 블록, unhandled rejection |
| **L7 테스트** | 테스트 불가능한 구조, 사이드이펙트 혼재 |
| **L8 유지보수** | 중복 코드, 복사붙여넣기 패턴, 500줄 초과 파일 |
| **L9 호환성** | Edge Runtime 호환 불가 모듈 사용 (crypto, fs 등), Node.js 전용 API |
| **L10 비즈니스** | 권한 검사 순서 오류, 조직(org) 격리 누락, 역할(role) 검증 누락 |

---

## 🚨 자주 발견되는 Vercel 배포 버그 패턴

### 1. Edge Runtime 비호환 (P0)
```typescript
// ❌ 위험: crypto 모듈은 Edge에서 못 씀
import crypto from 'crypto';

// ✅ 수정: Web Crypto API 사용
const hash = await crypto.subtle.digest(...)
```

### 2. 빈 catch 블록 (P0)
```typescript
// ❌ 위험: 에러가 조용히 삼켜짐
} catch (e) {
  return NextResponse.json({ ok: false });
}

// ✅ 수정: 에러 로깅 필수
} catch (e) {
  logger.log('[API] 오류', { error: e instanceof Error ? e.message : String(e) });
  return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
}
```

### 3. 인증 없는 API (P0)
```typescript
// ❌ 위험: getAuthContext() 없이 데이터 반환
export async function GET() {
  const data = await prisma.contact.findMany();
  return NextResponse.json(data);
}

// ✅ 수정: 항상 인증 먼저
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.organizationId) return NextResponse.json({}, { status: 401 });
  ...
}
```

### 4. 조직 격리 누락 (P0)
```typescript
// ❌ 위험: 다른 조직 데이터 노출 가능
const contacts = await prisma.contact.findMany({ where: { id } });

// ✅ 수정: organizationId 항상 포함
const contacts = await prisma.contact.findMany({
  where: { id, organizationId: ctx.organizationId }
});
```

### 5. N+1 쿼리 (P1)
```typescript
// ❌ 위험: 루프 안에서 DB 호출
for (const item of items) {
  const detail = await prisma.contact.findUnique({ where: { id: item.id } });
}

// ✅ 수정: include 또는 Promise.all
const details = await prisma.contact.findMany({
  where: { id: { in: items.map(i => i.id) } },
  include: { ... }
});
```

### 6. 더미/하드코딩 데이터 (P1)
```typescript
// ❌ 위험: 테스트 데이터가 프로덕션에
const TEST_ORG_ID = 'test-org-123';
const mockContacts = [{ name: '테스트', phone: '010-1234-5678' }];
```

### 7. Prisma 타입 any/unknown (P1)
```typescript
// ❌ 위험
const data = await res.json() as any;

// ✅ 수정: 명시적 타입
type ApiResponse = { ok: boolean; contacts: Contact[] };
const data = await res.json() as ApiResponse;
```

---

## 📋 작업 실행 순서

### Phase 1: 스캔 (파일별 10-렌즈 검토)
각 API 디렉토리를 열어 다음을 확인:
1. `getAuthContext()` 호출 여부
2. `organizationId` 격리 여부
3. `try/catch` 에러 처리
4. Prisma 쿼리 최적화
5. 하드코딩/더미 데이터

### Phase 2: 분류 (P0/P1/P2)
```
P0: 보안 취약점, 인증 누락, 데이터 노출 → 즉시 수정
P1: 에러 처리 누락, N+1, 타입 any → 이번 사이클에 수정
P2: 코드 스멜, 중복, 주석 → 다음 사이클
```

### Phase 3: 수정 & 커밋
- 파일당 하나의 집중된 수정
- 커밋 메시지: `fix(api/파일명): P0 인증 누락 수정 + 조직 격리 추가`
- 빌드 확인: `npm run build` (성공해야 커밋)

### Phase 4: 재검토
- 수정된 파일 재확인
- 관련 파일 연쇄 영향 확인
- 다음 파일로 이동

---

## 🏁 시작 명령

```
D:\mabiz-crm 에서 시작.

1. src/app/api/auth/ 와 src/app/api/_auth/ 부터 10-렌즈로 검토
2. src/app/api/webhooks/ (특히 purchase/route.ts) 검토
3. src/app/api/payapp/ 검토
4. P0 이슈 발견 즉시 수정 후 커밋
5. P1 이슈 목록화 후 순차 수정
6. 전체 API 디렉토리 완료까지 반복

빌드 명령: npm run build
절대 push 금지. commit까지만.
한국어로 보고할 것.
```

---

## 📊 완료 보고 양식

작업 완료 시 다음 형식으로 보고:

```
## α 에이전트 완료 보고

### 수정된 P0 이슈
- [파일경로] : [이슈 설명] → [수정 내용]

### 수정된 P1 이슈  
- [파일경로] : [이슈 설명] → [수정 내용]

### 발견되었으나 미수정 (P2)
- [파일경로] : [이슈 설명] (다음 사이클)

### 커밋 목록
- [커밋 해시] : [메시지]

### 최종 빌드
- npm run build: ✓ 성공 / ✗ 실패
```
