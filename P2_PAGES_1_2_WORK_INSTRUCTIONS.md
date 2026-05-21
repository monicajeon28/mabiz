# P2 Pages 1-2 상세 작업지시서

## 개요

P0-5에서 완성된 **서버 미들웨어 기반 권한 검증** 패턴을 Pages 1-2에 적용합니다.

### P0-5 완료 상태
- `/api/auth/me` 엔드포인트 제거 완료
- `src/app/(dashboard)/layout.tsx`에서 `getMabizSession()` 사용 확립
- `partner-suspensions` 페이지를 참고 모델로 사용

### Pages 1-2 대상
1. **Page 1**: `src/app/(dashboard)/admin/partner-applications/page.tsx` (Line 333)
2. **Page 2**: `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` (Line 82)

---

## Page 1: partner-applications

### 현재 상태

**파일**: `src/app/(dashboard)/admin/partner-applications/page.tsx`

**클라이언트 권한 확인** (Lines 329-349):
```typescript
useEffect(() => {
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });  // ← 제거 대상
      if (!res.ok) {
        router.push('/');
        return;
      }
      const ctx = await res.json();
      if (ctx.role !== 'GLOBAL_ADMIN') {
        router.push('/');
        return;
      }
      setAuthChecked(true);
    } catch {
      router.push('/');
    }
  };
  checkAuth();
}, [router]);
```

**/api/auth/me 호출 원인**: 
- 클라이언트에서 직접 GLOBAL_ADMIN 역할 검증
- `authChecked` 상태에 따라 데이터 로드 게이팅

### 수정 내용

#### 1. 파일 A: `src/app/(dashboard)/admin/partner-applications/page.tsx` (메인 페이지)

**Step 1**: `'use client'` 선언 유지하되, 클라이언트 권한 검증 코드 제거

**라인 329-349 삭제** (전체 useEffect 훅):
```typescript
// ❌ 삭제할 코드
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/');
          return;
        }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') {
          router.push('/');
          return;
        }
        setAuthChecked(true);
      } catch {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);
```

**라인 370-374 수정**: `authChecked` 의존성 제거 후 즉시 로드
```typescript
// ❌ 이전
useEffect(() => {
  if (!authChecked) return;
  loadApplications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [statusFilter, authChecked]);

// ✅ 변경
useEffect(() => {
  loadApplications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [statusFilter]);
```

**라인 322 제거**: 상태 선언 삭제
```typescript
// ❌ 삭제
const [authChecked, setAuthChecked] = useState(false);
```

**라인 186-192 수정** (로딩 중 UI): 권한 검증 로딩 제거
```typescript
// ❌ 이전
if (!authChecked) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

// ✅ 제거됨 (현재 코드에 없어서 변화 없음)
```

#### 2. 파일 B: `src/app/(dashboard)/admin/layout.tsx` (신규 생성 또는 수정)

**추가 작업**: Admin 페이지 Layout에서 권한 보호 추가 (Optional)

현재 구조:
- `src/app/(dashboard)/layout.tsx` → 일반 멤버 접근만 허용
- `src/app/(dashboard)/admin/layout.tsx` → 없음 (GLOBAL_ADMIN 검증 없음)

**Option A** (권장): Layout 생성
```typescript
// 신규 파일: src/app/(dashboard)/admin/layout.tsx
import { redirect } from "next/navigation";
import { getMabizSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getMabizSession();
  
  // GLOBAL_ADMIN 역할만 허용
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    redirect("/");
  }

  return children;
}
```

이 경우 페이지에서는:
- 권한 검증 useEffect 완전히 제거 가능
- `setAuthChecked(true)` 한 줄만 남음

**Option B** (현재 상태 유지): 각 페이지에서 검증
- Layout 생성 없음
- 페이지에서 권한 확인 로직 간소화 (아래 참고)

### 예상 소요시간

| 항목 | 시간 |
|------|------|
| 코드 수정 (제거/간소화) | 5분 |
| Layout 생성 (Option A만) | 10분 |
| 테스트 (DevTools + 로직 검증) | 10분 |
| **총합** | **25분** |

### 검증 방법

- [ ] DevTools Network → `/api/auth/me` 요청 미발생 확인
- [ ] GLOBAL_ADMIN 역할로 로그인 → 페이지 로드 성공
- [ ] OWNER 역할로 로그인 → 접근 차단 (redirect 또는 Layout 있으면 레이아웃 로딩 시점에)
- [ ] 상태 필터 변경 시 `/api/affiliate/contracts` API 정상 호출
- [ ] 승인/반려 버튼 기능 정상 작동
- [ ] 로그아웃 후 재접근 → 403/리다이렉트

---

## Page 2: affiliate-sales-by-partner

### 현재 상태

**파일**: `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx`

**클라이언트 권한 확인** (Lines 79-98):
```typescript
useEffect(() => {
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });  // ← 제거 대상
      if (!res.ok) {
        router.push('/');
        return;
      }
      const ctx = await res.json();
      if (ctx.role !== 'GLOBAL_ADMIN') {
        router.push('/');
        return;
      }
      setAuthChecked(true);
    } catch {
      router.push('/');
    }
  };
  checkAuth();
}, [router]);
```

**/api/auth/me 호출 원인**:
- 클라이언트에서 직접 GLOBAL_ADMIN 역할 검증
- `authChecked` 상태에 따라 초기 데이터 로드 게이팅

### 수정 내용

#### 1. 파일 A: `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` (메인 페이지)

**Step 1**: 클라이언트 권한 검증 코드 제거

**라인 79-98 삭제** (전체 useEffect 훅):
```typescript
// ❌ 삭제할 코드
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/');
          return;
        }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') {
          router.push('/');
          return;
        }
        setAuthChecked(true);
      } catch {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);
```

**라인 151-154 수정**: `authChecked` 의존성 제거 후 초기 로드
```typescript
// ❌ 이전
  useEffect(() => {
    if (!authChecked) return;
    handleLoad();
  }, [authChecked]);

// ✅ 변경
  useEffect(() => {
    handleLoad();
  }, []);
```

**라인 76 제거**: 상태 선언 삭제
```typescript
// ❌ 삭제
  const [authChecked, setAuthChecked] = useState(false);
```

**라인 186-192 수정** (권한 확인 중 UI): 조건부 렌더링 제거
```typescript
// ❌ 이전
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

// ✅ 제거됨 (페이지가 레이아웃에서 보호되므로 불필요)
```

#### 2. 파일 B: Layout 보호 (동일)

`src/app/(dashboard)/admin/layout.tsx` 생성 (Page 1과 동일)

### 예상 소요시간

| 항목 | 시간 |
|------|------|
| 코드 수정 (제거/간소화) | 5분 |
| Layout 생성 (초기 1회) | 0분 (Page 1에서 이미 생성) |
| 테스트 (DevTools + 로직 검증) | 10분 |
| **총합** | **15분** |

### 검증 방법

- [ ] DevTools Network → `/api/auth/me` 요청 미발생 확인
- [ ] GLOBAL_ADMIN 역할로 로그인 → 페이지 로드 성공
- [ ] OWNER 역할로 로그인 → 접근 차단
- [ ] 기간/연도 필터 변경 시 `/api/admin/affiliate-sales` API 정상 호출
- [ ] 정렬 버튼 클릭 시 테이블 정렬 정상 작동
- [ ] 로그아웃 후 재접근 → 403/리다이렉트

---

## 통합 수정 체크리스트

### Phase 1: 코드 수정
- [ ] Page 1 - useEffect 권한 검증 삭제
- [ ] Page 1 - authChecked 상태 제거
- [ ] Page 1 - loadApplications 의존성 조정
- [ ] Page 2 - useEffect 권한 검증 삭제
- [ ] Page 2 - authChecked 상태 제거
- [ ] Page 2 - handleLoad 의존성 조정
- [ ] Admin Layout 생성 (src/app/(dashboard)/admin/layout.tsx)

### Phase 2: 빌드 및 테스트
- [ ] `npm run build` 성공
- [ ] `npm run dev` 실행 후 두 페이지 모두 접근 가능
- [ ] DevTools에서 `/api/auth/me` 호출 없음 확인
- [ ] 역할별 접근 제어 정상 작동

### Phase 3: 커밋
```bash
git add src/app/\(dashboard\)/admin/partner-applications/page.tsx
git add src/app/\(dashboard\)/admin/affiliate-sales-by-partner/page.tsx
git add src/app/\(dashboard\)/admin/layout.tsx  # 신규
git commit -m "refactor(admin): P2 Pages 1-2 /api/auth/me 제거 + 서버 미들웨어 권한 검증

- partner-applications: 클라이언트 권한 확인 useEffect 제거
- affiliate-sales-by-partner: 동일 처리
- admin/layout.tsx: 신규 추가 (GLOBAL_ADMIN 역할 검증)
- DevTools 확인: /api/auth/me 호출 미발생
- 역할별 접근 제어: 레이아웃 레벨에서 처리"
```

---

## 구현 순서

### 권장 순서 (병렬 가능)

1. **Step 1** (15분): Page 1 수정 + 테스트
2. **Step 2** (5분): Page 2 수정 + 테스트
3. **Step 3** (10분): Admin Layout 생성 (한 번만)
4. **Step 4** (5분): 전체 통합 테스트
5. **Step 5** (5분): 커밋

**예상 총 소요시간**: 40분

---

## 주요 변경 영향도

| 항목 | 영향 |
|------|------|
| API 호출 | `/api/auth/me` 제거 → 네트워크 요청 감소 |
| 권한 검증 | 클라이언트 → 서버 (레이아웃) |
| 보안 | 강화 (권한 우회 불가능) |
| 성능 | 향상 (불필요한 API 제거) |
| 사용자 경험 | 동일 (권한 없으면 레이아웃 로드 시점에 리다이렉트) |

---

## 참고 사항

### `partner-suspensions` 참고 패턴

```typescript
// 현재 P0-5 완료 페이지의 권한 검증
function PartnerSuspensionsPage() {
  const [authChecked, setAuthChecked] = useState(false);

  // 권한 확인은 layout에서 처리 (GLOBAL_ADMIN만 접근 가능)
  useEffect(() => {
    setAuthChecked(true);  // 단순 플래그만 설정
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchSuspensions();
  }, [filter, authChecked]);
}
```

**핵심**: Layout에서 이미 GLOBAL_ADMIN 역할 검증했으므로, 페이지는 권한을 다시 검증할 필요 없음.

---

## FAQ

**Q1**: Layout 생성 없이도 작동하나요?
**A**: Yes. Option B (현재 상태 유지)로 각 페이지에서 검증 가능하지만, 중복 코드 증가. Layout 권장.

**Q2**: 기존 API 호출들(e.g., `/api/affiliate/contracts`)은 유지되나요?
**A**: Yes. 오직 `/api/auth/me`만 제거. 데이터 로드 API는 유지.

**Q3**: 역할 검증 실패 시 어떻게 되나요?
**A**: Layout에서 `redirect("/")`로 홈으로 이동.

**Q4**: 모바일 환경에서도 동작하나요?
**A**: Yes. Layout 기반이므로 플랫폼 무관.

---

## 변경 요약

| 파일 | 변경 사항 | 라인 |
|------|----------|------|
| `partner-applications/page.tsx` | useEffect 권한 검증 삭제 | 329-349 |
| `partner-applications/page.tsx` | authChecked 상태 제거 | 322 |
| `partner-applications/page.tsx` | loadApplications useEffect 수정 | 370-374 |
| `affiliate-sales-by-partner/page.tsx` | useEffect 권한 검증 삭제 | 79-98 |
| `affiliate-sales-by-partner/page.tsx` | authChecked 상태 제거 | 76 |
| `affiliate-sales-by-partner/page.tsx` | handleLoad useEffect 수정 | 151-154 |
| `admin/layout.tsx` | 신규 파일 생성 | - |
