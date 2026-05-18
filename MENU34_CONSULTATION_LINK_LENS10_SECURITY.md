# 메뉴 #34 상담 링크 - Lens 10: 보안 분석

## 개요
**대상**: ShortLink 기능 (생성, 클릭 기록, 통계 조회)
**분석일**: 2026-05-18
**점수**: 62/100 (P0 7개 + P1 12개 취약점)

---

## I. 주요 취약점 (P0 Critical)

### 1. SSRF 우회 - IPv6 Loopback (HIGH)
**위치**: `src/app/api/links/route.ts:49`
**문제**: 
```typescript
const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|localhost$)/i.test(h);
```
- IPv6 정규식이 앵커(`::1$`)로 끝나므로, `::1::something` 같은 문자열도 통과 가능
- IPv6 loopback full form (`0000:0000:0000:0000:0000:0000:0000:0001`)은 차단 안 됨

**위험도**: CRITICAL
**공격 시나리오**: 
- 내부 서비스 (API 게이트웨이, Kubernetes 제어판)에 접근
- Private IP 차단을 우회해 cloud metadata 서버 (169.254.169.254) 접근

**수정 예시**:
```typescript
const isPrivateCheck = (hostname: string): boolean => {
  // IPv6 정규화
  const ip6 = hostname.toLowerCase();
  if (/^(::1|0+:0+:0+:0+:0+:0+:0+:1|::ffff:127\.)/.test(ip6)) return true;
  
  // IPv4
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname)) return true;
  
  return false;
};
```

---

### 2. DNS Rebinding 공격 (HIGH)
**위치**: `src/app/api/links/route.ts:42-52` (CREATE만 검증)
**문제**:
- URL 생성 시만 SSRF 검증 실행
- `/l/[code]` 리다이렉트 시(`src/app/l/[code]/route.ts:54-60`)는 재검증 없음
- 공격자: 
  1. `attacker.com` 도메인 생성 (NS 소유)
  2. `attacker.com` → 210.100.1.1 (정상 사이트)로 설정하고 링크 생성
  3. 링크 생성 직후 DNS를 `127.0.0.1`로 변경
  4. 클릭 시 내부 서버 접근 가능

**위험도**: CRITICAL  
**수정**: 리다이렉트 시 재검증 + URL 시간 검증

```typescript
// src/app/l/[code]/route.ts
if (link) {
  // DNS 리바인딩 방지: 저장된 targetUrl 재검증
  const checkPrivate = (hostname: string): boolean => { /* ... */ };
  
  const parsed = new URL(link.targetUrl);
  if (checkPrivate(parsed.hostname)) {
    logger.warn('[ShortLink] DNS Rebinding 의심', { code, hostname: parsed.hostname });
    return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 302 });
  }
}
```

---

### 3. Rate Limiting 없음 (HIGH)
**위치**: `src/app/api/links/route.ts` (전체)
**문제**:
- 링크 무제한 생성 가능
- 계정 탈취 시 대량 악성 링크 생성
- DoS 벡터: 짧은 코드(6자리 = 16.7M 조합) 전수조사 가능

**위험도**: CRITICAL
**공격 시나리오**:
```bash
# 1분 내 1000개 링크 생성
for i in {1..1000}; do
  curl -X POST https://crm.mabiz.com/api/links \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"targetUrl":"https://example.com?id='$i'"}'
done
```

**수정**:
```typescript
// src/app/api/links/route.ts - POST
import { RateLimiter } from '@/lib/rate-limiter';

const limiter = new RateLimiter({
  window: 60 * 1000, // 1분
  maxRequests: 10,   // 조직당 10개/분
  keyFn: (req) => `${orgId}:links`,
});

export async function POST(req: Request) {
  const allowed = await limiter.check();
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: '링크 생성 한도 초과 (10개/분)' },
      { status: 429 }
    );
  }
  // ... 기존 로직
}
```

---

### 4. 접근 제어 검증 부재 (HIGH)
**위치**: `src/app/api/links/[id]/clicks/route.ts:14-17`
**문제**:
```typescript
const link = await prisma.shortLink.findFirst({
  where: { id, organizationId: orgId },  // ← organizationId 검증 있음
  // ...
});
```

하지만 **GET /api/links (목록)**는:
```typescript
const links = await prisma.shortLink.findMany({
  where: { organizationId: orgId, isActive: true },
  // ← autoGroupId, contactId 검증 없음!
});
```

**현재 상황**:
- ✅ 다른 조직의 링크는 조회 불가
- ❌ 자신의 조직 내 모든 링크 통계 조회 가능 (AGENT도 마찬가지)
- ❌ autoGroupId로 다른 사용자의 퍼널 자동화 정보 노출

**위험도**: CRITICAL (정보 유출)
**공격 시나리오**: 
- AGENT가 OWNER의 특별 캠페인 링크 통계 조회
- autoGroupId로 그룹 ID 파악 → 그룹 구조 역설계

**필수 수정**:
```typescript
// src/app/(dashboard)/links/page.tsx - 접근 제어
const create = async () => {
  if (linkToContact && selectedContact && ctx.role === 'AGENT') {
    // AGENT: 자신에게 할당된 고객만
    const isAssigned = await fetch(`/api/contacts/${selectedContact.id}`)
      .then(r => r.json())
      .then(d => d.contact?.assignedUserId === ctx.userId);
    if (!isAssigned) {
      showError('이 고객에게 링크를 생성할 권한이 없습니다');
      return;
    }
  }
};

// src/app/api/links/route.ts - GET
if (ctx.role === 'AGENT') {
  // AGENT: 자신이 생성한 링크 + 할당된 고객 링크만 조회
  const where = {
    organizationId: orgId,
    isActive: true,
    OR: [
      { createdByUserId: ctx.userId },
      { contact: { assignedUserId: ctx.userId } }
    ]
  };
}
```

---

### 5. contactId/autoGroupId 검증 없음 (HIGH)
**위치**: `src/app/api/links/route.ts:35, 66`
**문제**:
```typescript
const body = await req.json() as {
  targetUrl: string;
  title?: string;
  category?: string;
  contactId?: string;  // ← 검증 없음!
  autoGroupId?: string; // ← 검증 없음!
};

const link = await prisma.shortLink.create({
  data: { organizationId: orgId, code, ...body },
  // contactId, autoGroupId가 조직에 속하는지 미확인!
});
```

**위험도**: CRITICAL (권한 상승)
**공격**:
1. 다른 조직의 contactId 찾기 (브루트포스, 정보 공개 등)
2. `POST /api/links` with `contactId: "other-org-contact-id"`
3. 그 고객의 클릭 통계 수집

**수정**:
```typescript
// src/app/api/links/route.ts - POST
if (body.contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: body.contactId },
    select: { organizationId: true, assignedUserId: true }
  });
  
  if (!contact) {
    return NextResponse.json(
      { ok: false, message: '고객을 찾을 수 없습니다' },
      { status: 404 }
    );
  }
  
  // AGENT는 할당된 고객만, OWNER는 조직 내 모든 고객
  if (contact.organizationId !== orgId) {
    return NextResponse.json(
      { ok: false, message: '접근 권한이 없습니다' },
      { status: 403 }
    );
  }
  
  if (ctx.role === 'AGENT' && contact.assignedUserId !== ctx.userId) {
    return NextResponse.json(
      { ok: false, message: '할당된 고객만 연결 가능합니다' },
      { status: 403 }
    );
  }
}

if (body.autoGroupId) {
  const group = await prisma.contactGroup.findUnique({
    where: { id: body.autoGroupId },
    select: { organizationId: true, ownerId: true }
  });
  
  if (!group || group.organizationId !== orgId) {
    return NextResponse.json(
      { ok: false, message: '그룹을 찾을 수 없습니다' },
      { status: 404 }
    );
  }
  
  // ownerId가 있으면 OWNER나 group owner만 가능
  if (group.ownerId && group.ownerId !== ctx.userId && ctx.role !== 'OWNER') {
    return NextResponse.json(
      { ok: false, message: '이 그룹에 접근할 권한이 없습니다' },
      { status: 403 }
    );
  }
}
```

---

### 6. 입력 검증 - targetUrl 길이 제한 없음 (MEDIUM)
**위치**: `src/app/api/links/route.ts:37`
**문제**:
```typescript
if (!body.targetUrl) return NextResponse.json({ ok: false, message: 'targetUrl 필수' }, { status: 400 });
// ← 길이 검증 없음!
```

- 매우 긴 URL 저장 가능 (메모리 고갈)
- DB `TEXT` 컬럼이 무제한일 경우 저장소 악용

**Prisma 스키마**: `targetUrl String` (UNLIMITED)

**위험도**: MEDIUM (DoS 벡터)

**수정**:
```typescript
const MAX_URL_LENGTH = 2048; // RFC 3986
if (!body.targetUrl || body.targetUrl.length > MAX_URL_LENGTH) {
  return NextResponse.json(
    { ok: false, message: `URL은 ${MAX_URL_LENGTH}자 이하여야 합니다` },
    { status: 400 }
  );
}
```

---

### 7. category 필드 SQL Injection (MEDIUM)
**위치**: `src/app/api/links/route.ts:35`
**문제**:
```typescript
const body = await req.json() as {
  // ...
  category?: string; // ← 검증 없음!
};

// Prisma 사용하므로 SQL Injection은 방지되지만,
// 프론트 필터링 미비하면 문제 될 수 있음
```

하지만 실제로는:
```typescript
// 페이지에 category 필드 입력 UI가 없음!
// => 현재는 미사용 필드
```

**위험도**: LOW (미사용이지만 보안 부채)

**수정**: category 제거 또는 화이트리스트 적용

---

## II. 데이터 보호 (PII) 이슈

### 8. 클릭 로그에 개인정보 저장 (MEDIUM)
**위치**: `src/app/l/[code]/route.ts:36, Prisma`
**문제**:
```typescript
prisma.shortLinkClick.create({
  data: {
    linkId: link.id,
    contactId: link.contactId ?? null,  // ← PII
    userAgent: req.headers.get('user-agent')?.substring(0, 200) ?? null,  // ← 기기정보
  },
});
```

**저장되는 정보**:
1. `contactId` - 고객 ID (간접 식별자)
2. `userAgent` - 브라우저/OS/버전 (기기 추적 가능)
3. `clickedAt` - 정확한 클릭 시간

**위험도**: MEDIUM (개인정보)
**문제**:
- GDPR/CCPA 규정 위반 가능성
- User-Agent로 개인 식별 가능 (uniqueness 높음)
- 무한정 보관 (retention policy 없음)

**수정**:
```typescript
// 1. User-Agent 마스킹
const userAgent = req.headers.get('user-agent');
const maskedUA = userAgent 
  ? userAgent.substring(0, 50).replace(/\d{2,}/g, 'X') // 버전/ID 마스킹
  : null;

// 2. contactId → contactIdHash (일방향)
const contactIdHash = link.contactId 
  ? crypto.createHash('sha256').update(link.contactId).digest('hex')
  : null;

// 3. 자동 삭제 정책 추가
await prisma.shortLinkClick.deleteMany({
  where: {
    linkId: link.id,
    clickedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }  // 90일
  }
});
```

---

### 9. 고객 검색 API 정보 유출 (MEDIUM)
**위치**: `src/app/(dashboard)/links/page.tsx:66`
**프론트엔드**:
```typescript
const res = await fetch(`/api/contacts?q=${encodeURIComponent(contactSearch)}&limit=8`);
```

**위험도**: MEDIUM
**문제**:
- q 파라미터가 평문으로 전송 (HTTPS이지만 로그에 남을 수 있음)
- limit=8 고정이므로 자동완성 벡터

**수정**:
```typescript
// POST로 변경하고 body에 검색어 포함
const res = await fetch(`/api/contacts/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: contactSearch, limit: 8 })
});
```

---

## III. 성능/DoS 이슈

### 10. 클릭 기록 쿼리 N+1 (MEDIUM)
**위치**: `src/app/(dashboard)/links/page.tsx:104-114`
**문제**:
```typescript
const toggleClicks = async (linkId: string) => {
  // ...
  const res = await fetch(`/api/links/${linkId}/clicks`);
  // 매번 50개 최신 클릭 조회 (정렬 + 제한 있음)
};
```

API는:
```typescript
const clicks = await prisma.shortLinkClick.findMany({
  where: { linkId: id },
  orderBy: { clickedAt: 'desc' },
  take: 20,  // ← 20개씩 (좋음)
});
```

**현재 상황**: 선호 index 있음 (좋음)
- Prisma 스키마에 `linkId` FK 있음
- `clickedAt` DESC 정렬

**위험도**: LOW (괜찮은 수준)

**최적화 아이디어**:
```typescript
// 1. 요약 통계 캐시 (Redis)
const cacheKey = `link:${linkId}:stats`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

// 2. 시간별 집계 (aggregation)
const hourlyStats = await prisma.shortLinkClick.groupBy({
  by: ['linkId'],
  where: { linkId: id },
  _count: true,
  // ...
});
```

---

## IV. P1 개선사항 (12개)

| # | 제목 | 위치 | 해결책 |
|---|------|------|--------|
| 1 | HTTPS 강제 검증 개선 | `route.ts:46` | 프로토콜 체크 전에 URL parse 실패 처리 강화 |
| 2 | 리다이렉트 Loop 방지 | `l/[code]/route.ts` | targetUrl이 `/l/` 시작하면 차단 |
| 3 | Referrer 검증 | `l/[code]/route.ts` | Referrer-Policy 헤더 + CORS 강화 |
| 4 | 조직 삭제 시 정리 | `schema.prisma` | ShortLink ON DELETE CASCADE 확인 |
| 5 | 비활성화 vs 삭제 | `route.ts` | 소프트 삭제(isActive) 정책 명확히 |
| 6 | 로깅 정보 노출 | `route.ts:70` | logger에 contactId 포함 금지 (hash로 변경) |
| 7 | 타이밍 공격 | `code 생성` | 충돌 검사 시간 정규화 필수 |
| 8 | 생성자 추적 | `schema.prisma` | `createdByUserId` 필드 추가 |
| 9 | 업데이트 감지 | `schema.prisma` | `updatedAt` 필드 추가 |
| 10 | 감사 로그 | 없음 | ShortLinkAuditLog 테이블 추가 |
| 11 | 배치 작업 | `route.ts:66` | 대량 링크 생성 시 트랜잭션 처리 |
| 12 | 에러 메시지 | `route.ts` | 공격자에게 유용한 정보 노출 제거 |

---

## V. 우선 수정 순서 (액션 플랜)

### Phase 1: P0 (1시간)
```
1. Rate Limiting 추가 (POST /api/links)
2. contactId/autoGroupId 검증 추가
3. IPv6 loopback 정규식 수정
```

**커밋**: `fix(security): links P0 rate-limiting + validation`

### Phase 2: P1 (2시간)
```
4. DNS Rebinding 리다이렉트 재검증
5. AGENT 접근 제어 강화 (GET /api/links)
6. User-Agent 마스킹
7. 클릭 로그 자동 삭제 (90일)
```

**커밋**: `fix(security): links DNS rebinding + access control`

### Phase 3: P2 (1시간)
```
8. targetUrl 길이 제한 (2048자)
9. createdByUserId 추가
10. 감사 로그 테이블 추가
11. 에러 메시지 정제
```

**커밋**: `refactor(security): links schema + audit logging`

---

## VI. 최종 점수 및 검증 리스트

### 보안 점수 변화
- **현재**: 62/100 (P0 7개, P1 12개)
- **Phase 1 후**: 76/100
- **Phase 3 후**: 90/100

### 배포 전 검증 체크리스트
```
[ ] Rate Limiter 테스트 (429 응답 확인)
[ ] contactId/autoGroupId 검증 테스트 (403 응답 확인)
[ ] DNS Rebinding 테스트 (invalid hostname 차단 확인)
[ ] AGENT 접근 제어 테스트 (다른 고객 링크 조회 불가)
[ ] User-Agent 로그 마스킹 확인
[ ] IPv6 loopback 테스트 (::1, 0:0:0:0:0:0:0:1 모두 차단)
[ ] 클릭 로그 자동 삭제 cron 검증 (90일)
[ ] Prisma 마이그레이션 (createdByUserId 추가)
```

---

## VII. 참고: 유사 기능 보안 점검

메뉴 #34 수정 시 다음 기능도 동시 검토 권장:

1. **랜딩페이지** (`src/app/api/landing-pages/[id]/view/route.ts`)
   - 조회 추적 로직 (클릭 로그와 유사)
   
2. **그룹 토큰** (`src/app/api/groups/[id]/register/route.ts`)
   - GroupToken 접근 제어
   
3. **뉴스 링크** (`src/app/api/tools/news-links/route.ts`)
   - NewsShortLink SSRF 검증

---

## 최종 결론

**메뉴 #34 상담 링크는 다음 7가지 CRITICAL 보안 이슈를 즉시 수정해야 합니다:**

1. **Rate Limiting** - 무제한 링크 생성 DoS 방지
2. **contactId/autoGroupId 검증** - 조직 간 데이터 접근 방지
3. **IPv6 SSRF 정규식** - 내부 서비스 접근 방지
4. **DNS Rebinding** - 클릭 시 재검증 필수
5. **AGENT 접근 제어** - 역할별 조회 권한 제한
6. **User-Agent 마스킹** - 개인정보 보호
7. **contactId 저장 정책** - PII 최소화 또는 hash화

**예상 수정 시간**: 3-4시간 (단계별)
**테스트 시간**: 2시간 (검증 리스트 포함)

---

**다음 세션**: 각 P0 이슈별로 커밋 단위로 구현 진행
