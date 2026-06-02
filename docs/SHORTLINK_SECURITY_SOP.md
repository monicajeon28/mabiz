# ShortLink 보안 강화 SOP (2026-06-02)

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [보안 이슈 정리](#보안-이슈-정리)
3. [실행 계획](#실행-계획)
4. [체크리스트](#체크리스트)
5. [성공 기준](#성공-기준)

---

## 현재 상태 분석

### 1. ShortLink 모델 현황

**경로**: `D:\mabiz-crm\prisma\schema.prisma` (Line 1630-1647)

```prisma
model ShortLink {
  id             String           @id @default(cuid())
  organizationId String
  code           String           @unique
  targetUrl      String
  title          String?
  contactId      String?
  category       String?
  autoGroupId    String?
  clickCount     Int              @default(0)
  isActive       Boolean          @default(true)
  createdAt      DateTime         @default(now())
  contact        Contact?         @relation(fields: [contactId], references: [id])
  organization   Organization     @relation(fields: [organizationId], references: [id])
  clicks         ShortLinkClick[]

  @@map("ShortLink")
}
```

**문제점**:
- ❌ `isPublic` 필드 **없음** (공개/비공개 제어 불가)
- ❌ Funnel 모델과 불일치 (Funnel은 `isPublic` 있음, 라인 727)
- ⚠️ 공유 설정과 무관하게 `code`만으로 접근 가능

### 2. CrmLandingPage ShortLink 마이그레이션 완료 ✅

**경로**: `D:\mabiz-crm\prisma\migrations\20260602151820_add_shortlink_to_crm_landing_page\migration.sql`

```sql
-- ✅ 완료: shortlink 필드 추가
ALTER TABLE "CrmLandingPage" ADD COLUMN "shortlink" TEXT;
ALTER TABLE "CrmLandingPage" ADD CONSTRAINT "CrmLandingPage_shortlink_key" UNIQUE ("shortlink");
CREATE INDEX "idx_crm_landing_page_shortlink" ON "CrmLandingPage"("shortlink");
```

**현황**:
- ✅ CrmLandingPage: `shortlink` 필드 있음 (nullable, unique)
- ❌ ShortLink: `isPublic` 필드 없음 (추가 필요)

### 3. 접근 흐름 분석

#### URL 패턴
```
공개 접근 (누구나):
  GET /l/{code}          → ShortLink.findUnique({ code })
  GET /p/{slug}          → CrmLandingPage.findUnique({ slug })

권한 검증 필요:
  POST /api/landing-pages          → organizationId 검증 필요
  PATCH /api/landing-pages/{id}    → organizationId 검증 필요
  GET /api/landing-pages           → 자신의 페이지만 필터링
```

#### 현재 보안 갭
1. **ShortLink 직접 접근**: 인증 없이 `code`만 알면 접근 가능 ⚠️
2. **비공개 설정 없음**: 모든 shortlink가 공개 상태 (제어 불가)
3. **권한 검증 부재**: `/l/[code]/route.ts`에서 권한 체크 없음

---

## 보안 이슈 정리

### Issue #1: ShortLink 공개 설정 부재 (P1-SEC)

| 항목 | 현재 | 문제 | 영향 |
|------|------|------|------|
| **isPublic 필드** | ❌ 없음 | 비공개 링크 생성 불가 | 모든 shortlink가 공개됨 |
| **Funnel과의 일관성** | ❌ 불일치 | isPublic 필드 위치 다름 | 정책 관리 복잡도 ↑ |
| **권한 검증** | ❌ 없음 | 누구나 접근 가능 | 민감한 정보 노출 위험 |

**해결 방법**: Schema에 `isPublic Boolean @default(true)` 필드 추가

---

### Issue #2: 접근 제어 로직 미흡 (P1-SEC)

#### 현재 코드 분석

**경로**: `src/app/l/[code]/route.ts` (가정)

```typescript
// ❌ 현재: 인증 없음
export async function GET(req: Request, { params }: Params) {
  const { code } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { code, isActive: true },
  });

  if (!link) {
    return NextResponse.redirect('https://www.cruisedot.co.kr');
  }

  // 바로 리다이렉트 (권한 검증 없음) ⚠️
  return NextResponse.redirect(link.targetUrl, { status: 301 });
}
```

**문제점**:
- ✅ `isActive` 검증 (O)
- ❌ `isPublic` 검증 (X)
- ❌ 인증 상태 확인 (X)
- ❌ 조직 소속 확인 (X)

**개선 로직**:
```typescript
// ✅ 수정: 공개 여부 + 권한 검증
if (!link.isPublic) {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx || ctx.organizationId !== link.organizationId) {
    return NextResponse.redirect('https://www.cruisedot.co.kr');
  }
}
```

---

### Issue #3: API 엔드포인트 권한 검증 (P1-SEC)

#### 경로별 검증 현황

| 엔드포인트 | 검증 | 상태 | 수정 대상 |
|-----------|------|------|----------|
| `GET /api/landing-pages` | organizationId | ✅ 있음 | 필터링 강화 |
| `POST /api/landing-pages` | organizationId | ✅ 있음 | shortlink 자동생성 추가 |
| `PATCH /api/landing-pages/{id}` | organizationId | ✅ 있음 | 권한 재확인 |
| `GET /api/links/[code]` | ❌ | ❌ 없음 | 공개 여부 검증 추가 |

---

## 실행 계획

### Phase 1: Schema & 마이그레이션 (30분)

#### Task 1-1: ShortLink 스키마 수정

**파일**: `D:\mabiz-crm\prisma\schema.prisma` (Line 1630-1647)

**변경사항**:
```prisma
model ShortLink {
  id             String           @id @default(cuid())
  organizationId String
  code           String           @unique
  targetUrl      String
  title          String?
  contactId      String?
  category       String?
  autoGroupId    String?
  clickCount     Int              @default(0)
  isActive       Boolean          @default(true)
  isPublic       Boolean          @default(true)      // ✅ 추가
  createdAt      DateTime         @default(now())
  contact        Contact?         @relation(fields: [contactId], references: [id])
  organization   Organization     @relation(fields: [organizationId], references: [id])
  clicks         ShortLinkClick[]

  @@map("ShortLink")
}
```

**체크**:
- [ ] `isPublic Boolean @default(true)` 추가
- [ ] Prisma 형식 검증 (`npx prisma validate`)

#### Task 1-2: Prisma 마이그레이션 파일 생성

```bash
npx prisma migrate dev --name add_shortlink_is_public
```

**생성될 파일**: `prisma/migrations/20260602xxxxxx_add_shortlink_is_public/migration.sql`

```sql
-- ShortLink에 isPublic 필드 추가
ALTER TABLE "ShortLink" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
```

**체크**:
- [ ] 마이그레이션 파일 생성됨
- [ ] SQL 문법 검증 (ALTER TABLE 구문 정확)
- [ ] 데이터베이스 적용 (`npx prisma migrate deploy`)

---

### Phase 2: API 엔드포인트 수정 (1시간)

#### Task 2-1: ShortLink 조회 Route 수정

**파일**: `src/app/l/[code]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth-context';

interface Params {
  params: Promise<{ code: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;

    // Step 1: ShortLink 조회
    const link = await prisma.shortLink.findUnique({
      where: { code },
      select: {
        id: true,
        targetUrl: true,
        isActive: true,
        isPublic: true,          // ✅ 추가
        organizationId: true,
      },
    });

    if (!link || !link.isActive) {
      return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 301 });
    }

    // Step 2: 비공개 링크 권한 검증 (P1-SEC)
    if (!link.isPublic) {
      const ctx = await getAuthContext().catch(() => null);
      
      if (!ctx || ctx.organizationId !== link.organizationId) {
        // 권한 없음: 리다이렉트 (로그 기록)
        console.warn(`[ShortLink Access Denied] code=${code} user=${ctx?.userId || 'anonymous'}`);
        return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 301 });
      }
    }

    // Step 3: Click 기록 (비동기)
    prisma.shortLinkClick.create({
      data: {
        linkId: link.id,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    }).catch(console.error); // 비동기 실패해도 리다이렉트 진행

    // Step 4: 대상 URL로 리다이렉트
    return NextResponse.redirect(link.targetUrl, { status: 301 });

  } catch (error) {
    console.error('[ShortLink Route Error]', error);
    return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 301 });
  }
}
```

**체크**:
- [ ] `isPublic` 필드 조회 추가
- [ ] 비공개 링크 권한 검증 로직 추가
- [ ] 접근 거부 시 로깅 추가
- [ ] TS 타입 검증 (`npx tsc --noEmit`)

#### Task 2-2: ShortLink 생성 API 수정

**파일**: `src/app/api/links/route.ts` (또는 유사 엔드포인트)

```typescript
// POST /api/links
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await getAuthContext();

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // isPublic 필드 저장 (기본값: true)
    const link = await prisma.shortLink.create({
      data: {
        organizationId: ctx.organizationId,
        code: generateUniqueCode(),           // nanoid 또는 crypto.randomBytes
        targetUrl: body.targetUrl,
        title: body.title,
        isPublic: body.isPublic ?? true,      // ✅ 추가 (기본: 공개)
        contactId: body.contactId,
        category: body.category,
        autoGroupId: body.autoGroupId,
      },
    });

    return NextResponse.json(link, { status: 201 });

  } catch (error) {
    console.error('[Links API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

**체크**:
- [ ] `isPublic` 필드 저장 추가
- [ ] 기본값 `true` (공개) 설정
- [ ] 요청 본문 검증 (`body.isPublic` 타입 확인)

#### Task 2-3: ShortLink 수정 API 추가 (공개/비공개 토글)

**파일**: `src/app/api/links/[id]/route.ts` (신규 또는 기존)

```typescript
// PATCH /api/links/{id}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ctx = await getAuthContext();

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: 링크 조회 + 권한 확인
    const link = await prisma.shortLink.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    if (link.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 2: 필드 업데이트 (isPublic, title 등)
    const updated = await prisma.shortLink.update({
      where: { id },
      data: {
        isPublic: body.isPublic,    // ✅ 공개/비공개 토글
        title: body.title,
        targetUrl: body.targetUrl,
      },
    });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('[Links API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

**체크**:
- [ ] 권한 검증 (organizationId 일치)
- [ ] `isPublic` 필드 업데이트
- [ ] 404/403 에러 처리

#### Task 2-4: 목록 조회 API 수정

**파일**: `src/app/api/links/route.ts`

```typescript
// GET /api/links?organizationId={id}&limit=50&offset=0
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // ✅ organizationId 필터링 (권한 검증)
    const links = await prisma.shortLink.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        code: true,
        targetUrl: true,
        title: true,
        isActive: true,
        isPublic: true,          // ✅ 추가
        clickCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json(links);

  } catch (error) {
    console.error('[Links API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

**체크**:
- [ ] `organizationId` 필터링 확인
- [ ] `isPublic` 필드 반환 추가
- [ ] 페이지네이션 (limit/offset) 구현

---

### Phase 3: UI 개선 (1시간)

#### Task 3-1: ShortLink 생성 모달 수정

**파일**: `src/app/(dashboard)/landing-pages/components/CreateShortLinkModal.tsx` (가정)

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox'; // ✅ 추가

interface CreateShortLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (link: any) => void;
}

export function CreateShortLinkModal({ isOpen, onClose, onSuccess }: CreateShortLinkModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);  // ✅ 추가 (기본: 공개)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          title,
          isPublic,  // ✅ 전송
        }),
      });

      if (!res.ok) throw new Error('Failed to create link');

      const link = await res.json();
      onSuccess?.(link);
      onClose();

    } catch (error) {
      console.error('Error creating link:', error);
      alert('숏링크 생성 실패. 다시 시도하세요.');

    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>숏링크 생성</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL 입력 */}
          <div>
            <Label htmlFor="targetUrl">대상 URL</Label>
            <Input
              id="targetUrl"
              type="url"
              placeholder="https://example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </div>

          {/* 제목 입력 */}
          <div>
            <Label htmlFor="title">제목 (선택)</Label>
            <Input
              id="title"
              type="text"
              placeholder="예: 봄 캠페인"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* ✅ 공개/비공개 선택 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(!!checked)}
            />
            <Label htmlFor="isPublic" className="text-sm cursor-pointer">
              공개 (모든 사용자가 접근 가능)
            </Label>
          </div>
          {!isPublic && (
            <p className="text-xs text-gray-500">
              비공개: 같은 조직의 사용자만 접근 가능합니다.
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading || !targetUrl}>
              {isLoading ? '생성 중...' : '생성'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**체크**:
- [ ] `isPublic` 상태 추가
- [ ] Checkbox 컴포넌트 구현
- [ ] "비공개" 설명 텍스트 추가

#### Task 3-2: ShortLink 목록 화면 수정

**파일**: `src/app/(dashboard)/landing-pages/components/ShortLinksList.tsx` (가정)

```tsx
interface ShortLink {
  id: string;
  code: string;
  targetUrl: string;
  title?: string;
  isActive: boolean;
  isPublic: boolean;     // ✅ 추가
  clickCount: number;
  createdAt: string;
}

export function ShortLinksList() {
  const [links, setLinks] = useState<ShortLink[]>([]);

  // ... fetch 로직

  const togglePublic = async (linkId: string, newValue: boolean) => {
    try {
      const res = await fetch(`/api/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newValue }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setLinks(
        links.map(link =>
          link.id === linkId ? { ...link, isPublic: newValue } : link
        )
      );

    } catch (error) {
      console.error('Error updating link:', error);
      alert('업데이트 실패');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-4">코드</th>
            <th className="text-left py-2 px-4">제목</th>
            <th className="text-left py-2 px-4">클릭</th>
            <th className="text-left py-2 px-4">공개 여부</th>
            <th className="text-right py-2 px-4">작업</th>
          </tr>
        </thead>
        <tbody>
          {links.map(link => (
            <tr key={link.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {link.code}
                </code>
              </td>
              <td className="py-3 px-4">{link.title || '(제목 없음)'}</td>
              <td className="py-3 px-4">{link.clickCount}</td>
              {/* ✅ 공개 여부 토글 */}
              <td className="py-3 px-4">
                <button
                  onClick={() => togglePublic(link.id, !link.isPublic)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    link.isPublic
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {link.isPublic ? '공개' : '비공개'}
                </button>
              </td>
              <td className="py-3 px-4 text-right space-x-2">
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/l/${link.code}`)}
                  className="text-blue-600 hover:underline text-xs"
                >
                  복사
                </button>
                <button
                  onClick={() => handleDelete(link.id)}
                  className="text-red-600 hover:underline text-xs"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**체크**:
- [ ] `isPublic` 필드 표시
- [ ] 공개/비공개 토글 버튼 구현
- [ ] API 호출 (`PATCH /api/links/{id}`)

---

### Phase 4: 테스트 & 검증 (1시간)

#### Task 4-1: 단위 테스트 작성

**파일**: `src/app/l/[code]/route.test.ts` (신규)

```typescript
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth-context';

jest.mock('@/lib/prisma');
jest.mock('@/lib/auth-context');

describe('GET /l/[code]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('공개 링크는 누구나 접근 가능', async () => {
    const mockLink = {
      id: '1',
      targetUrl: 'https://example.com',
      isActive: true,
      isPublic: true,
      organizationId: 'org-1',
    };

    (prisma.shortLink.findUnique as jest.Mock).mockResolvedValue(mockLink);

    const req = { headers: { get: jest.fn(() => 'Mozilla/5.0') } } as any;
    const result = await GET(req, { params: Promise.resolve({ code: 'abc123' }) });

    expect(result.status).toBe(301);
    expect(result.url).toBe('https://example.com');
  });

  it('비공개 링크는 권한이 있는 사용자만 접근', async () => {
    const mockLink = {
      id: '2',
      targetUrl: 'https://private.example.com',
      isActive: true,
      isPublic: false,
      organizationId: 'org-1',
    };

    (prisma.shortLink.findUnique as jest.Mock).mockResolvedValue(mockLink);
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
    });

    const req = { headers: { get: jest.fn(() => 'Mozilla/5.0') } } as any;
    const result = await GET(req, { params: Promise.resolve({ code: 'def456' }) });

    expect(result.status).toBe(301);
    expect(result.url).toBe('https://private.example.com');
  });

  it('비공개 링크는 권한이 없으면 거부', async () => {
    const mockLink = {
      id: '3',
      targetUrl: 'https://private.example.com',
      isActive: true,
      isPublic: false,
      organizationId: 'org-2',
    };

    (prisma.shortLink.findUnique as jest.Mock).mockResolvedValue(mockLink);
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',  // 다른 조직
    });

    const req = { headers: { get: jest.fn(() => 'Mozilla/5.0') } } as any;
    const result = await GET(req, { params: Promise.resolve({ code: 'ghi789' }) });

    expect(result.status).toBe(301);
    expect(result.url).toBe('https://www.cruisedot.co.kr');
  });

  it('비활성 링크는 접근 불가', async () => {
    (prisma.shortLink.findUnique as jest.Mock).mockResolvedValue(null);

    const req = { headers: { get: jest.fn(() => 'Mozilla/5.0') } } as any;
    const result = await GET(req, { params: Promise.resolve({ code: 'invalid' }) });

    expect(result.status).toBe(301);
    expect(result.url).toBe('https://www.cruisedot.co.kr');
  });
});
```

**실행**:
```bash
npm test -- src/app/l/[code]/route.test.ts
```

**체크**:
- [ ] 4개 테스트 케이스 모두 패스
- [ ] 커버리지 > 90%

#### Task 4-2: 통합 테스트

```bash
# 1. 개발 서버 시작
npm run dev

# 2. Playwright 테스트 (링크 접근)
npx playwright test tests/shortlink-access.spec.ts

# 3. API 테스트 (cURL)
# 공개 링크 생성
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"targetUrl":"https://example.com","isPublic":true}'

# 비공개 링크 생성
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"targetUrl":"https://example.com","isPublic":false}'

# 공개 링크 접근 (누구나)
curl -L http://localhost:3000/l/{code}

# 비공개 링크 접근 (권한 있음)
curl -L -H "Authorization: Bearer <token>" http://localhost:3000/l/{code}
```

**체크**:
- [ ] 공개 링크: 리다이렉트 성공 (301)
- [ ] 비공개 링크 + 권한: 리다이렉트 성공 (301)
- [ ] 비공개 링크 + 권한 없음: Cruisedot로 리다이렉트 (301)

---

### Phase 5: 배포 & 모니터링 (30분)

#### Task 5-1: Vercel 배포

```bash
# 1. 로컬 변경사항 커밋
git add prisma/schema.prisma prisma/migrations/ src/
git commit -m "feat(security): add isPublic field to ShortLink + RBAC enforcement (P1-SEC)"

# 2. 마이그레이션 검증
npx prisma migrate status

# 3. 푸시 & 배포
git push origin main
# Vercel 자동 배포 트리거

# 4. 배포 후 확인
npx prisma migrate deploy --skip-generate
```

**체크**:
- [ ] Git 커밋 완료
- [ ] Vercel 배포 성공
- [ ] 데이터베이스 마이그레이션 적용됨

#### Task 5-2: 모니터링 설정

**경로**: `src/lib/webhook-monitoring.ts` (기존 파일 활용)

```typescript
// ShortLink 접근 로깅 추가
export async function logShortLinkAccess(props: {
  code: string;
  isPublic: boolean;
  isAllowed: boolean;
  userId?: string;
  organizationId?: string;
  timestamp: Date;
}) {
  await prisma.executionLog.create({
    data: {
      organizationId: props.organizationId || 'unknown',
      actionType: 'SHORTLINK_ACCESS',
      status: props.isAllowed ? 'SUCCESS' : 'DENIED',
      metadata: {
        code: props.code,
        isPublic: props.isPublic,
        userId: props.userId,
        timestamp: props.timestamp.toISOString(),
      },
    },
  });
}
```

**Slack 알림** (비공개 링크 접근 거부):
```typescript
// 권한 없음 시
if (!link.isPublic && !authorized) {
  await notifySlack({
    channel: '#security-alerts',
    message: `⚠️ ShortLink 접근 거부: ${link.code} (비공개, 권한 없음)`,
    severity: 'warning',
  });
}
```

**체크**:
- [ ] 로깅 구현
- [ ] Slack 알림 설정
- [ ] 대시보드에서 접근 로그 조회 가능

---

## 체크리스트

### Phase 1: Schema & 마이그레이션

- [ ] `isPublic` 필드 schema.prisma에 추가
- [ ] `npx prisma validate` 성공
- [ ] 마이그레이션 파일 생성 (`npx prisma migrate dev --name add_shortlink_is_public`)
- [ ] SQL 문법 검증
- [ ] `npx prisma migrate deploy` 성공
- [ ] 데이터베이스에서 `isPublic` 컬럼 생성 확인

### Phase 2: API 엔드포인트

- [ ] `GET /l/[code]` route 수정
  - [ ] `isPublic` 필드 조회
  - [ ] 비공개 링크 권한 검증 로직 추가
  - [ ] 접근 거부 시 로깅
  - [ ] `npx tsc --noEmit` 성공

- [ ] `POST /api/links` 수정
  - [ ] `isPublic` 필드 저장
  - [ ] 기본값 `true` (공개) 설정
  - [ ] 요청 본문 검증

- [ ] `PATCH /api/links/{id}` 추가
  - [ ] 권한 검증 (organizationId)
  - [ ] `isPublic` 필드 업데이트
  - [ ] 404/403 에러 처리

- [ ] `GET /api/links` 수정
  - [ ] `organizationId` 필터링
  - [ ] `isPublic` 필드 반환

### Phase 3: UI 개선

- [ ] ShortLink 생성 모달
  - [ ] Checkbox 컴포넌트 추가
  - [ ] `isPublic` 상태 관리
  - [ ] "비공개" 설명 텍스트

- [ ] ShortLink 목록 화면
  - [ ] `isPublic` 필드 표시
  - [ ] 공개/비공개 토글 버튼
  - [ ] API 호출 구현

### Phase 4: 테스트

- [ ] 단위 테스트 작성 (4개 케이스)
- [ ] 모든 테스트 패스
- [ ] 통합 테스트 실행
  - [ ] 공개 링크 접근: 성공
  - [ ] 비공개 링크 + 권한: 성공
  - [ ] 비공개 링크 + 권한 없음: 거부

### Phase 5: 배포

- [ ] Git 커밋 & 푸시
- [ ] Vercel 배포 성공
- [ ] 데이터베이스 마이그레이션 적용
- [ ] 프로덕션 테스트 (실제 링크 접근)
- [ ] 모니터링 & 로깅 활성화
- [ ] Slack 알림 테스트

---

## 성공 기준

### 기능성 (Functionality)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| **공개 링크 접근** | 누구나 접근 가능 (인증 불필요) | `curl -L http://localhost:3000/l/{code}` |
| **비공개 링크 + 권한** | 권한 있는 사용자만 접근 | `curl -L -H "Authorization: Bearer <token>"` |
| **비공개 링크 + 권한 없음** | 접근 거부 (Cruisedot 리다이렉트) | 다른 조직 사용자로 테스트 |
| **필드 저장** | `isPublic` 필드가 데이터베이스에 저장됨 | `SELECT isPublic FROM shortlink WHERE id='...'` |
| **토글 기능** | PATCH 요청으로 공개/비공개 변경 가능 | API 테스트 |

### 보안성 (Security)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| **테넌트 격리** | 다른 조직 링크에 접근 불가 | 조직 1 사용자가 조직 2 비공개 링크 접근 시도 |
| **권한 검증** | 인증되지 않은 비공개 링크 접근 불가 | 로그인하지 않은 상태에서 비공개 링크 접근 |
| **로깅** | 모든 접근 거부 사건이 기록됨 | 로그 테이블에서 `status='DENIED'` 확인 |
| **감사추적** | 접근 시도자, 시간, 결과 기록 | ExecutionLog 테이블 검토 |

### 성능 (Performance)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| **응답 시간** | 공개 링크: <100ms, 비공개 + 권한: <200ms | `time curl -L http://localhost:3000/l/{code}` |
| **DB 인덱스** | `code` 컬럼에 인덱스 있음 | `SHOW INDEX FROM ShortLink;` |
| **캐싱** | 반복 접근 시 캐시 활용 | 쿠키/세션 검증 |

### 사용성 (Usability)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| **UI 직관성** | 공개/비공개 상태가 명확함 | UI 화면 검토 (초록색=공개, 빨강색=비공개) |
| **오류 메시지** | 접근 실패 시 명확한 메시지 | 권한 없이 비공개 링크 접근 시 UI 메시지 확인 |
| **모달 기능** | 생성 시 `isPublic` 선택 가능 | 모달 화면 테스트 |

### 호환성 (Compatibility)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| **TypeScript 에러** | `npx tsc --noEmit` 성공 (에러 0개) | 빌드 검증 |
| **마이그레이션** | `npx prisma migrate deploy` 성공 | 데이터베이스 마이그레이션 로그 |
| **기존 데이터** | 기존 ShortLink는 모두 `isPublic=true`로 설정됨 | 데이터베이스에서 COUNT 확인 |

---

## 예상 효과

### 보안 개선
- ✅ **비공개 링크 생성 가능**: 민감한 정보 공유 제어
- ✅ **권한 기반 접근 제어**: 조직별 격리 강화
- ✅ **감사추적**: 모든 접근 시도 기록
- ✅ **자동 거부**: 권한 없는 접근 자동 방어

### 사용자 경험
- ✅ **명확한 공개 여부**: UI에서 상태 직관적 표시
- ✅ **쉬운 토글**: 한 번의 클릭으로 공개/비공개 전환
- ✅ **일관된 정책**: Funnel과 동일한 `isPublic` 필드 사용

### 운영 효율성
- ✅ **자동화된 로깅**: 모든 접근 거부 자동 기록
- ✅ **실시간 모니터링**: Slack 알림으로 비정상 접근 감지
- ✅ **정책 일관성**: 전사 차원의 접근 제어 정책 통일

---

## 참고 자료

### 관련 파일
- Schema: `D:\mabiz-crm\prisma\schema.prisma` (Line 1630-1647)
- 마이그레이션: `D:\mabiz-crm\prisma\migrations\20260602151820_add_shortlink_to_crm_landing_page\migration.sql`
- Route: `src/app/l/[code]/route.ts` (예상 경로)
- API: `src/app/api/links/route.ts` (예상 경로)

### 보안 관련
- OWASP: [Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- P1-SEC: Tenant Isolation & RBAC

### 다음 단계
1. **Phase 1 완료** → 데이터베이스 마이그레이션
2. **Phase 2-3 완료** → 기능 테스트
3. **Phase 4 완료** → 배포 전 검증
4. **Phase 5 완료** → 프로덕션 배포

---

**작성일**: 2026-06-02  
**우선순위**: P1 (보안 관련)  
**담당**: Security Team + Full-Stack Engineer  
**완료 예상**: 2026-06-03 (4-6시간)
