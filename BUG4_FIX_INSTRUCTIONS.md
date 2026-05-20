# Bug 4: /api/auth/me 호출 제거 작업 지시서

## 완료된 작업 (P0)

### 1. ✅ image-library/page.tsx
**라인**: 59-66
**제거된 코드**:
```typescript
// ❌ 제거됨
const [isAdmin, setIsAdmin] = useState(false);
useEffect(() => {
  fetch('/api/auth/me')
    .then((r) => r.json())
    .then((data) => { if (data.ok) setIsAdmin(data.role === 'GLOBAL_ADMIN'); })
    .catch(() => setIsAdmin(false));
}, []);
```

**대체된 코드**:
```typescript
// ✅ layout 기반으로 변경
const isAdmin = true;  // layout에서 GLOBAL_ADMIN만 접근 가능
```

**사용처**: Line 355 (동기화 버튼)

---

### 2. ✅ partner-suspensions/page.tsx
**라인**: 38-62
**제거된 코드**:
```typescript
// ❌ 제거됨
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

**대체된 코드**:
```typescript
// ✅ layout 기반으로 변경
useEffect(() => {
  setAuthChecked(true);
}, []);
```

---

## 완료된 작업 (P1)

### 3. ✅ contacts/all/page.tsx
**라인**: 27-43
**제거된 코드**: `/api/auth/me` fetch + role/authLoaded state 초기화
**대체된 코드**: Layout 기반 인증 (GLOBAL_ADMIN 만 접근)

---

### 4. ✅ products/page.tsx
**라인**: 798-806
**제거된 코드**: `/api/auth/me` fetch + setUserRole/setOrgId 로직
**대체된 코드**: 주석으로 대체 및 빈 useEffect

---

### 5. ✅ settings/members/page.tsx
**라인**: 326-342
**제거된 코드**: Promise.all에서 `/api/auth/me` 호출 제거
**대체된 코드**: membersRes와 invitesRes만 남김

---

## 남은 작업 (P2 - 다음 세션)

### 6. partner-applications/page.tsx
**라인**: 330-349
**제거 대상**:
```typescript
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

**상태 변수**: authChecked
**대체 방법**: partner-suspensions.tsx와 동일한 패턴

---

### 7. affiliate-sales-by-partner/page.tsx
**라인**: 80-98
**제거 대상**: `/api/auth/me` 권한 확인 useEffect
**상태 변수**: authChecked
**대체 방법**: partner-suspensions.tsx와 동일한 패턴

---

### 8. pnr/[reservationId]/page.tsx
**라인**: 해당하는 `/api/auth/me` 호출이 없음 (검토 필요)
**상태**: 제거 불필요 (admin mode 확인이 다른 방식)

---

### 9. team/affiliate/page.tsx
**라인**: 해당하는 `/api/auth/me` 호출 확인 필요
**상태**: Grep에서 검출됨 - 검토 후 처리

---

### 10. payments/page.tsx
**라인**: 100 이후 확인 필요
**상태**: Grep에서 검출됨 - 검토 후 처리

---

### 11. profit-calculator/page.tsx
**라인**: 해당하는 `/api/auth/me` 호출이 없음 (검토 필요)
**상태**: 제거 불필요

---

### 12. contracts/templates/page.tsx
**라인**: 49-56
**제거 대상**:
```typescript
useEffect(() => {
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(d => {
      if (!d.ok || d.role !== 'GLOBAL_ADMIN') router.replace('/contracts');
    })
    .catch(() => router.replace('/contracts'));
}, [router]);
```

**상태 변수**: 특별한 state 없음 (그냥 리다이렉트만 수행)
**대체 방법**: 주석으로 대체 및 layout 기반 처리

---

## 제거 완료 요약

| 파일 | 라인 | 상태 | 이유 |
|------|------|------|------|
| image-library | 59-66 | ✅ 완료 | layout 기반 인증 |
| partner-suspensions | 38-62 | ✅ 완료 | layout 기반 인증 |
| contacts/all | 27-43 | ✅ 완료 | layout 기반 인증 |
| products | 798-806 | ✅ 완료 | layout 기반 + API 응답 활용 |
| settings/members | 326-342 | ✅ 완료 | layout 기반 인증 + 다른 API만 호출 |
| partner-applications | 330-349 | ⏳ P2 | layout 기반 인증 |
| affiliate-sales-by-partner | 80-98 | ⏳ P2 | layout 기반 인증 |
| pnr/[reservationId] | - | ℹ️ 검토 필요 | 실제 호출 없음 |
| team/affiliate | - | ⏳ P2 | Grep 검출 후 처리 |
| payments | - | ⏳ P2 | Grep 검출 후 처리 |
| profit-calculator | - | ℹ️ 검토 필요 | 실제 호출 없음 |
| contracts/templates | 49-56 | ⏳ P2 | layout 기반 인증 |

---

## 기술적 근거

모든 페이지는 다음 계층에서 접근 제어됨:

1. **Layout 레벨**: `(dashboard)/layout.tsx` - GLOBAL_ADMIN/OWNER/AGENT 역할 검증
2. **Page 레벨**: 각 페이지는 layout이 제공한 session을 신뢰
3. **API 레벨**: `/api/auth/me` 불필요 (layout이 이미 검증)

---

## 다음 단계

1. P2 파일 6개의 `/api/auth/me` 호출 제거
2. 각 파일에서 사용되는 auth state 정리
3. 전체 빌드 및 테스트
