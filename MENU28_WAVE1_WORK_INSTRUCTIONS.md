# Menu #28 Wave 1 - P0 긴급 수정 작업지시서 (병렬형)

**목표**: P0 5개 + 검수탭/권한/감시로그 핵심 기능  
**예상 시간**: 18시간 (병렬 4에이전트 × 4-5시간)  
**범위**: CSRF + XSS + 발송확인 + Rate limiting + 검수탭 + 테스트  
**의존성**: Menu #27 Wave 1-3 완료 (사용된 CSRF 패턴 참고)  
**비즈니스 맥락**: 선사 전달 전 관리자/대리점장 검수 요구

---

## 🎯 에이전트 배분

| 에이전트 | 담당 Task | 예상시간 | 의존성 |
|---------|---------|--------|--------|
| **α (보안)** | T1-2 (CSRF/XSS) | 4시간 | 없음 |
| **β (UX/발송)** | T3-4 (확인/Rate Limit) | 5시간 | α 완료 후 |
| **γ (검수탭)** | T5 (검수탭 UI) | 5시간 | α,β 부분 |
| **δ (테스트)** | T6 (테스트) | 4시간 | α,β,γ 완료 후 |

---

## 📋 Task T1: CSRF 토큰 구현 (Agent α)

### 목표
모든 fetch 요청에 CSRF 토큰 헤더 추가 (Menu #27 패턴 재사용)

### Step 1: CSRF 토큰 상태 추가
**파일**: `src/app/(dashboard)/messages/page.tsx`  
**위치**: `SmsTab()` 함수 상단 (line 63)

```typescript
// 기존 상태들 다음에 추가
const [csrfToken, setCsrfToken] = useState('');

// useEffect에 추가
useEffect(() => {
  fetch('/api/csrf-token')
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) {
        setCsrfToken(d.token);
      } else {
        logger.warn('[MessagesPage] CSRF token', { message: d.message });
      }
    })
    .catch((err) => {
      logger.error('[MessagesPage] CSRF token fetch', { err });
    });
}, []);
```

### Step 2: doDryRun에 CSRF 토큰 추가
**위치**: `page.tsx` (dry-run 함수)

```typescript
// 현재
const doDryRun = async () => {
  const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, dryRun: true }),
  });
```

→ 수정

```typescript
const doDryRun = async () => {
  const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken || '',  // ← 추가
    },
    body: JSON.stringify({ message, dryRun: true }),
  });
```

### Step 3: doSend에 CSRF 토큰 추가
**위치**: `page.tsx` (send 함수)

```typescript
// 동일한 방식으로 X-CSRF-Token 헤더 추가
headers: {
  "Content-Type": "application/json",
  "X-CSRF-Token": csrfToken || '',  // ← 추가
}
```

### 검증
- [ ] CSRF 토큰 API 호출 성공
- [ ] dry-run/send 요청에 X-CSRF-Token 헤더 포함 (DevTools 확인)
- [ ] 토큰 없을 때 요청은 여전히 진행 (graceful fallback)

---

## 📋 Task T2: XSS 취약점 수정 (Agent α)

### 목표
dryRunResult.sample을 DOMPurify로 정제

### Step 1: DOMPurify 라이브러리 설치
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### Step 2: 임포트 추가
**파일**: `src/app/(dashboard)/messages/page.tsx`  
**위치**: 맨 위 import 섹션

```typescript
import DOMPurify from 'dompurify';
```

### Step 3: dryRunResult 렌더링 수정
**위치**: `page.tsx` (dry-run 결과 표시 부분, line ~122-127)

현재:
```typescript
{dryRunResult && (
  <div className="whitespace-pre-wrap">
    {dryRunResult.sample}  {/* ← XSS 취약점 */}
  </div>
)}
```

→ 수정:
```typescript
{dryRunResult && (
  <div className="whitespace-pre-wrap break-words">
    {DOMPurify.sanitize(dryRunResult.sample, { 
      ALLOWED_TAGS: [],      // 모든 태그 제거
      ALLOWED_ATTR: []       // 모든 속성 제거
    })}
  </div>
)}
```

### 검증
- [ ] 정상 메시지: "안녕하세요" → 그대로 표시
- [ ] XSS 시도: `<script>alert('xss')</script>` → 스크립트 제거되어 텍스트만 표시
- [ ] 특수문자: "[이름] [전화번호]" → 그대로 표시

---

## 📋 Task T3: 발송 확인 로직 강화 (Agent β)

### 목표
2단계 확인: 미리보기 보기 → 최종 확인 체크박스 → confirm 다이얼로그

### Step 1: confirmed 상태 초기화 (기존)
```typescript
const [confirmed, setConfirmed] = useState(false);
```

이미 있음. 그대로 유지.

### Step 2: doDryRun 수정 (성공 후 confirmed 초기화)
**위치**: doDryRun 함수 마지막

```typescript
// 기존
if (data.ok) {
  setDryRunResult(data);
  setConfirmed(false);  // ← 추가: 미리보기 표시 시 체크박스 초기화
}
```

### Step 3: doSend 수정 (최종 확인 추가)
**위치**: doSend 함수 시작

```typescript
const doSend = async () => {
  // Step A: 미리보기 확인
  if (!dryRunResult) {
    showError("먼저 대상을 확인해주세요.");
    return;
  }

  // Step B: 체크박스 확인
  if (!confirmed) {
    showError("발송 확인 체크박스를 선택해주세요.");
    return;
  }

  // Step C: 최종 확인 다이얼로그 (NEW)
  const willSend = dryRunResult.count || 0;
  const confirmMsg = `정말 ${willSend}명에게 SMS를 발송하시겠습니까?\n\n메시지: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
  
  if (!window.confirm(confirmMsg)) {
    return;  // 사용자가 취소함
  }

  // Step D: 발송
  setSending(true);
  setError(null);
  try {
    const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || '',
      },
      body: JSON.stringify({ message, dryRun: false }),
    });
    // ... 기존 처리
  } catch (err) {
    logger.error('[MessagesPage] doSend', { err });
    showError(getErrorMessage(err, '[SMS 발송]'));
  } finally {
    setSending(false);
  }
};
```

### Step 4: 발송 버튼 활성화 조건 수정
**위치**: 발송 버튼 (line ~310)

현재:
```typescript
<button
  onClick={doSend}
  disabled={!message.trim() || sending}  // ← 불완전한 조건
>
```

→ 수정:
```typescript
<button
  onClick={doSend}
  disabled={!dryRunResult || !confirmed || sending}  // ← 강화된 조건
  className={`w-full py-3 rounded-lg font-medium transition-all ${
    !dryRunResult || !confirmed || sending
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-red-600 text-white hover:bg-red-700'
  }`}
>
  {sending ? '발송 중...' : `✓ 발송 (${dryRunResult?.count || 0}명)`}
</button>
```

### 검증
- [ ] 메시지 입력만: 발송 버튼 disabled
- [ ] 대상 확인(dry-run) 후: 발송 버튼 활성화, 체크박스 나타남
- [ ] 체크박스 미선택: 발송 버튼 disabled
- [ ] 체크박스 선택 후: 발송 클릭 → confirm 다이얼로그 표시
- [ ] confirm 취소: 발송 안 됨
- [ ] confirm 확인: 발송 진행

---

## 📋 Task T4: Rate Limiting 구현 (Agent β)

### 목표
같은 그룹에 하루 최대 5회만 발송 가능

### Step 1: API 수정 (Backend)
**파일**: `src/app/api/groups/[id]/blast/route.ts`

```typescript
// 발송 전에 rate limit 체크 추가
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { message, dryRun } = await req.json();
  const userId = getUserId(req);  // 세션에서 추출
  const groupId = params.id;

  // Rate limit 체크
  const allowed = await checkRateLimit(userId, groupId, 'SMS_BLAST');
  if (!allowed) {
    return json({
      ok: false,
      message: "하루 발송 횟수(5회)를 초과했습니다. 내일 다시 시도해주세요.",
    }, { status: 429 });  // Too Many Requests
  }

  // 기존 로직...
}
```

### Step 2: rate-limit 유틸 함수 생성
**파일**: `src/lib/rate-limit.ts` (신규)

```typescript
import { kv } from '@vercel/kv';  // Redis

const RATE_LIMITS = {
  SMS_BLAST: { max: 5, window: 24 * 60 * 60 },  // 5회/24시간
};

export async function checkRateLimit(
  userId: string,
  groupId: string,
  type: 'SMS_BLAST' | 'EMAIL_SEND'
): Promise<boolean> {
  const key = `rate-limit:${type}:${userId}:${groupId}`;
  const limit = RATE_LIMITS[type];

  const count = (await kv.get<number>(key)) ?? 0;
  if (count >= limit.max) {
    return false;
  }

  // 카운트 증가
  await kv.incr(key);
  await kv.expire(key, limit.window);

  return true;
}

export async function getRateLimitStatus(
  userId: string,
  groupId: string,
  type: 'SMS_BLAST'
): Promise<{ used: number; remaining: number; resetAt: Date }> {
  const key = `rate-limit:${type}:${userId}:${groupId}`;
  const limit = RATE_LIMITS[type];

  const used = (await kv.get<number>(key)) ?? 0;
  const ttl = await kv.ttl(key);  // 초 단위
  const remaining = Math.max(0, limit.max - used);
  const resetAt = new Date(Date.now() + ttl * 1000);

  return { used, remaining, resetAt };
}
```

### Step 3: 클라이언트에서 Rate Limit 상태 표시
**위치**: `page.tsx` SmsTab 상단

```typescript
const [rateLimitStatus, setRateLimitStatus] = useState<{
  used: number;
  remaining: number;
  resetAt: Date;
} | null>(null);

// useEffect에서 초기 로드
useEffect(() => {
  if (selectedGroup) {
    fetch(`/api/groups/${selectedGroup}/rate-limit`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setRateLimitStatus(d.status);
      });
  }
}, [selectedGroup]);

// UI에 표시
{selectedGroup && rateLimitStatus && (
  <div className="bg-blue-50 rounded-lg p-3 text-sm">
    <p className="text-blue-700">
      📊 발송 횟수: {rateLimitStatus.used}/5회
      {rateLimitStatus.remaining === 0 && (
        <span className="ml-2 text-red-600 font-semibold">
          ⏰ 내일 {rateLimitStatus.resetAt.toLocaleTimeString()}부터 가능
        </span>
      )}
    </p>
  </div>
)}
```

### 검증
- [ ] 첫 발송: "1/5회" 표시
- [ ] 5회 발송 후: "5/5회" + 내일 시간 표시
- [ ] 6번째 시도: 429 에러 + "하루 횟수 초과" 메시지

---

## 📋 Task T5: 검수 탭 UI (Agent γ)

### 목표
관리자/대리점장만 보는 검수(Review) 탭 추가  
- 전체 고객 정보 표시 (권한 기반)
- 샘플 메시지 확인
- 승인/거절 버튼

### Step 1: 역할 확인 함수 추가
**파일**: `src/lib/auth.ts`

```typescript
export async function getUserRole(req: Request): Promise<'ADMIN' | 'PARTNER' | 'EMPLOYEE' | 'EXTERNAL'> {
  const session = await getSession(req);
  const user = session?.user;
  
  if (!user) throw new Error('Unauthorized');
  
  // DB에서 role 조회
  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  
  return userRecord?.role ?? 'EMPLOYEE';
}

export const canReview = (role: string) => ['ADMIN', 'PARTNER'].includes(role);
```

### Step 2: ReviewTab 컴포넌트 생성
**파일**: `src/components/messages/ReviewTab.tsx` (신규)

```typescript
'use client';

interface ReviewTabProps {
  groupId: string;
  message: string;
  dryRunResult: { count: number; sample: string } | null;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}

export function ReviewTab({
  groupId,
  message,
  dryRunResult,
  onApprove,
  onReject,
  approving,
}: ReviewTabProps) {
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [typos, setTypos] = useState<string[]>([]);

  useEffect(() => {
    if (!dryRunResult) return;
    
    // 고객 목록 로드
    fetch(`/api/groups/${groupId}/customers`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setCustomers(d.customers);
      });

    // 오타 검사 (스펠링 체크)
    const detected = detectTypos(message);
    setTypos(detected);
  }, [groupId, dryRunResult]);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">📋 발송 검수</h3>

      {/* 메시지 미리보기 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">메시지</p>
        <div className="bg-white border rounded p-3 whitespace-pre-wrap break-words text-sm">
          {DOMPurify.sanitize(message, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
        </div>
        {typos.length > 0 && (
          <p className="text-xs text-red-600 mt-2">
            ⚠️ 의심되는 오타: {typos.join(', ')}
          </p>
        )}
      </div>

      {/* 고객 샘플 (처음 5명) */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          고객 샘플 (전체 {customers.length}명 중 처음 5명)
        </p>
        <div className="space-y-2">
          {customers.slice(0, 5).map(c => (
            <div key={c.id} className="text-sm p-2 bg-white rounded border">
              <span className="font-medium">{c.name}</span>
              <span className="text-gray-500 ml-2">{c.phone}</span>
            </div>
          ))}
          {customers.length > 5 && (
            <p className="text-xs text-gray-500">... 외 {customers.length - 5}명</p>
          )}
        </div>
      </div>

      {/* 승인/거절 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={approving}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {approving ? '승인 중...' : '✓ 승인 및 발송'}
        </button>
        <button
          onClick={onReject}
          disabled={approving}
          className="flex-1 bg-gray-400 text-white py-2 rounded-lg font-medium hover:bg-gray-500 disabled:opacity-50"
        >
          ✕ 거절
        </button>
      </div>
    </div>
  );
}
```

### Step 3: 메인 페이지에 ReviewTab 통합
**위치**: `page.tsx` SmsTab 렌더링 부분

```typescript
// 역할 확인
const [userRole, setUserRole] = useState<string | null>(null);

useEffect(() => {
  fetch('/api/user/role')
    .then(r => r.json())
    .then(d => {
      if (d.ok) setUserRole(d.role);
    });
}, []);

// 렌더링: 역할에 따라 다른 탭 표시
{canReview(userRole) && dryRunResult && (
  <ReviewTab
    groupId={selectedGroup}
    message={message}
    dryRunResult={dryRunResult}
    onApprove={doSend}  // 승인 = 발송
    onReject={() => {
      setDryRunResult(null);
      setConfirmed(false);
      showError("검수가 거절되었습니다.");
    }}
    approving={sending}
  />
)}
```

### 검증
- [ ] 관리자/대리점장: ReviewTab 표시
- [ ] 일반 직원: ReviewTab 미표시
- [ ] 샘플 고객 전체 전화번호 표시 (마스킹 X)
- [ ] 오타 감지 (예: "연강"  "연강" 미감지, "발싱" → 오타 감지)
- [ ] 승인 클릭: 발송 진행
- [ ] 거절 클릭: 검수 모드 종료

---

## 📋 Task T6: 테스트 코드 (Agent δ)

### 목표
Wave 1 기능 기본 테스트 (CSRF/XSS/발송/Rate Limit)

### Step 1: 테스트 파일 생성
**파일**: `src/app/__tests__/messages.test.tsx` (신규)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessagesPage from '@/app/(dashboard)/messages/page';

describe('MessagesPage - SMS Tab', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            ok: true,
            config: { senderPhone: '070-1234-5678', aligoKeyTail: '****' },
            groups: [{ id: '1', name: 'VIP', color: '#000', _count: { members: 10 } }],
            templates: [],
            links: [],
          }),
      })
    ) as jest.Mock;
  });

  it('should render SMS tab by default', () => {
    render(<MessagesPage />);
    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('should load groups on mount', async () => {
    render(<MessagesPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups', expect.any(Object));
    });
  });

  it('should include CSRF token in blast request', async () => {
    render(<MessagesPage />);
    // ...
    // CSRF 토큰 포함 확인
  });

  it('should sanitize XSS in dry-run result', async () => {
    render(<MessagesPage />);
    // DOMPurify 검증
  });

  it('should require confirmation before sending', async () => {
    render(<MessagesPage />);
    // confirmed 상태 확인
  });

  it('should show rate limit status', async () => {
    render(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText(/발송 횟수:/)).toBeInTheDocument();
    });
  });

  it('should show review tab for admin', async () => {
    // Mock admin role
    global.fetch = jest.fn((url) => {
      if (url.includes('role')) {
        return Promise.resolve({
          json: () => Promise.resolve({ ok: true, role: 'ADMIN' }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, groups: [] }),
      });
    }) as jest.Mock;

    render(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText('발송 검수')).toBeInTheDocument();
    });
  });
});
```

### Step 2: 에러 처리 테스트 추가
```typescript
it('should show error when CSRF token missing', async () => {
  // CSRF 토큰 없이 요청
  // 에러 메시지 표시 확인
});

it('should show rate limit error on 429', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      status: 429,
      json: () =>
        Promise.resolve({
          ok: false,
          message: "하루 발송 횟수(5회)를 초과했습니다.",
        }),
    })
  ) as jest.Mock;

  render(<MessagesPage />);
  // 에러 표시 확인
});
```

### 검증
- [ ] 모든 테스트 통과
- [ ] CSRF 토큰 포함 확인
- [ ] XSS sanitize 작동 확인
- [ ] Rate limit 표시 확인
- [ ] Review 탭 권한 확인

---

## ✅ Wave 1 완료 체크리스트

### Agent α (보안)
- [ ] CSRF 토큰 구현
- [ ] XSS sanitize (DOMPurify)
- [ ] 코드 병합 테스트
- [ ] 커밋: `fix(messages): CSRF + XSS 보안 강화`

### Agent β (UX/발송)
- [ ] 발송 확인 다이얼로그
- [ ] Rate limiting 구현
- [ ] Rate limit UI 표시
- [ ] 커밋: `feat(messages): 발송 확인 + Rate limit`

### Agent γ (검수탭)
- [ ] ReviewTab 컴포넌트
- [ ] 역할 기반 표시
- [ ] 오타 감지 로직
- [ ] 커밋: `feat(messages): 검수 탭 (관리자/대리점)`

### Agent δ (테스트)
- [ ] 테스트 파일 생성
- [ ] 모든 테스트 통과
- [ ] 커밋: `test(messages): Wave 1 기본 테스트`

### 최종
- [ ] 4개 커밋 모두 main에 병합
- [ ] npm run build 성공
- [ ] P0 이슈 5개 모두 해결
- [ ] 배포준비도: 2.5/10 → 5.0/10 향상

---

## 📝 커밋 메시지 템플릿

```
[α] fix(messages): CSRF 토큰 + XSS sanitize 보안 강화
[β] feat(messages): 발송 확인 다이얼로그 + Rate limit
[γ] feat(messages): 검수 탭 (관리자/대리점장 권한기반)
[δ] test(messages): Wave 1 기본 테스트 (CSRF/XSS/Rate limit)
```

---

## 🎯 의존성 체크

- α 완료 후 → β, γ 진행 가능
- β, γ 완료 후 → δ 진행
- 병렬: α는 독립적, β와 γ 일부 병렬 가능 (α 일부 완료 후)

**추천 실행 순서**:
1. α 시작 (CSRF/XSS)
2. α 진행 중 → β 시작 (발송 확인)
3. β 진행 중 → γ 시작 (검수탭, ReviewTab 컴포넌트)
4. α,β,γ 완료 → δ 시작

---

_작성일: 2026-05-23_  
_대상: 4개 병렬 서브에이전트_  
_총 예상 시간: 18시간 (병렬 4시간~5시간)_
