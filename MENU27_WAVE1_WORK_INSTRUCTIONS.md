# Menu #27 Wave 1 상세 작업지시서 (P0 + P1 보안/에러처리)

**목표:** CSRF 토큰 + 에러 처리 + 로깅 통합으로 안전한 기초 구축  
**예상 시간:** 2.5시간  
**범위:** P0 2개 + P1 3개 (보안/에러 처리 중심)

---

## 📋 Task List

### Task W1-1: CSRF 토큰 패턴 적용 (Menu #25 참고)
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 45분  

#### Step 1: State 추가
```typescript
// 라인 16 다음에 추가
const [csrfToken, setCsrfToken] = useState('');
```

#### Step 2: useEffect에서 토큰 fetch
```typescript
// 라인 168-176 useEffect 이전에 삽입
useEffect(() => {
  fetch('/api/csrf-token')
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) {
        setCsrfToken(d.token);
      } else {
        logger.warn('[GroupsPage] CSRF token', { message: d.message });
      }
    })
    .catch((err) => {
      logger.error('[GroupsPage] CSRF token fetch', { err });
    });
}, []);
```

#### Step 3: 모든 API mutation에 헤더 추가
**3-1) initRegionalGroups (라인 37)**
```typescript
// 변경 전
const res = await fetch('/api/setup/regional-groups', { method: 'POST' });

// 변경 후
const res = await fetch('/api/setup/regional-groups', { 
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken || '' },
});
```

**3-2) cloneGroup (라인 81)**
```typescript
// 변경 전
const res = await fetch(`/api/groups/${id}/clone`, { method: 'POST' });

// 변경 후
const res = await fetch(`/api/groups/${id}/clone`, { 
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken || '' },
});
```

**3-3) createGroup (라인 184-192)**
```typescript
// 변경 전
const res = await fetch("/api/groups", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});

// 변경 후
const res = await fetch("/api/groups", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken || '',
  },
  body: JSON.stringify({ ... }),
});
```

**3-4) checkBlast (라인 120)**
```typescript
const res = await fetch(`/api/groups/${blastGroupId}/blast`, {
  method: "POST", 
  headers: { 
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken || '',
  },
  body: JSON.stringify({ message: blastMsg, dryRun: true }),
});
```

**3-5) sendBlast (라인 145)**
```typescript
const res = await fetch(`/api/groups/${blastGroupId}/blast`, {
  method: "POST", 
  headers: { 
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken || '',
  },
  body: JSON.stringify({ message: blastMsg, dryRun: false }),
});
```

**3-6) ImportModal handleImport (라인 653)**
```typescript
const res = await fetch('/api/groups/import', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken || '',  // ← 부모 props로 받아야 함 (아래 참고)
  },
  body: jsonText,
});
```

#### Step 4: ImportModal에 csrfToken prop 전달
**라인 288-291 변경**
```typescript
// 변경 전
<ImportModal
  onClose={() => setShowImport(false)}
  onDone={async () => { await loadGroups(); }}
/>

// 변경 후
<ImportModal
  csrfToken={csrfToken}
  onClose={() => setShowImport(false)}
  onDone={async () => { await loadGroups(); }}
/>
```

#### Step 5: ImportModal 함수 시그니처 업데이트 (라인 605)
```typescript
// 변경 전
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {

// 변경 후
function ImportModal({ 
  csrfToken,
  onClose, 
  onDone 
}: { 
  csrfToken: string;
  onClose: () => void; 
  onDone: () => void;
}) {
```

---

### Task W1-2: Promise.all → Promise.allSettled (에러 처리 P0)
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 45분  

#### Step 1: error 상태 추가
```typescript
// 라인 15 다음에 추가
const [error, setError] = useState<string | null>(null);
```

#### Step 2: loadGroups 함수 리펙토링 (라인 71-78)
```typescript
// 변경 전
const loadGroups = async () => {
  const [g, f] = await Promise.all([
    fetch('/api/groups').then((r) => r.json()),
    fetch('/api/funnels').then((r) => r.json()),
  ]);
  if (g.ok)  setGroups(g.groups);
  if (f.ok)  setFunnels(f.funnels);
};

// 변경 후
const loadGroups = async () => {
  setError(null);
  const [gResult, fResult] = await Promise.allSettled([
    fetch('/api/groups').then((r) => r.json()),
    fetch('/api/funnels').then((r) => r.json()),
  ]);
  
  if (gResult.status === 'fulfilled' && gResult.value.ok) {
    setGroups(gResult.value.groups);
  } else if (gResult.status === 'rejected') {
    logger.error('[loadGroups] groups fetch', { err: gResult.reason });
  }
  
  if (fResult.status === 'fulfilled' && fResult.value.ok) {
    setFunnels(fResult.value.funnels);
  } else if (fResult.status === 'rejected') {
    logger.error('[loadGroups] funnels fetch', { err: fResult.reason });
  }
};
```

#### Step 3: 초기 로드 useEffect 업데이트 (라인 168-176)
```typescript
// 변경 전
useEffect(() => {
  Promise.all([
    fetch("/api/groups").then((r) => r.json()),
    fetch("/api/funnels").then((r) => r.json()),
  ]).then(([g, f]) => {
    if (g.ok)  setGroups(g.groups);
    if (f.ok)  setFunnels(f.funnels);
  }).finally(() => setLoading(false));
}, []);

// 변경 후
useEffect(() => {
  setLoading(true);
  setError(null);
  Promise.allSettled([
    fetch("/api/groups").then((r) => r.json()),
    fetch("/api/funnels").then((r) => r.json()),
  ]).then(([gResult, fResult]) => {
    if (gResult.status === 'fulfilled' && gResult.value.ok) {
      setGroups(gResult.value.groups);
    } else {
      logger.error('[GroupsPage init]', { result: gResult });
    }
    
    if (fResult.status === 'fulfilled' && fResult.value.ok) {
      setFunnels(fResult.value.funnels);
    } else {
      logger.error('[GroupsPage init]', { result: fResult });
    }
  }).catch((err) => {
    logger.error('[GroupsPage init] Promise.allSettled', { err });
    setError('데이터를 불러올 수 없습니다.');
  }).finally(() => setLoading(false));
}, []);
```

#### Step 4: initRegionalGroups 수정 (라인 46-51)
```typescript
// 현재 코드:
const [g, f] = await Promise.all([
  fetch('/api/groups').then((r) => r.json()),
  fetch('/api/funnels').then((r) => r.json()),
]);

// 변경 후:
await loadGroups();  // ← loadGroups 함수 재사용
```

---

### Task W1-3: 모든 catch 블록에 logger.error() 추가
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 20분  

#### Step 1: logger import 확인 (라인 5)
```typescript
import { logger } from "@/lib/logger";  // ← 이미 있는지 확인
```

#### Step 2: 모든 catch 블록 수정

**2-1) initRegionalGroups (라인 58)**
```typescript
} catch {
  const msg = '네트워크 오류가 발생했습니다.';
  setSetupMsg(msg);
  showError(msg);
}

// 변경 후
} catch (err) {
  const msg = '네트워크 오류가 발생했습니다.';
  logger.error('[GroupsPage] initRegionalGroups', { err });
  setSetupMsg(msg);
  showError(msg);
}
```

**2-2) checkBlast (라인 131)**
```typescript
} catch {
  const msg = "네트워크 오류가 발생했습니다.";
  setBlastError(msg);
  showError(msg);
}

// 변경 후
} catch (err) {
  const msg = "네트워크 오류가 발생했습니다.";
  logger.error('[GroupsPage] checkBlast', { err });
  setBlastError(msg);
  showError(msg);
}
```

**2-3) sendBlast (라인 159)**
```typescript
} catch {
  const msg = "네트워크 오류가 발생했습니다.";
  setBlastError(msg);
  showError(msg);
}

// 변경 후
} catch (err) {
  const msg = "네트워크 오류가 발생했습니다.";
  logger.error('[GroupsPage] sendBlast', { err });
  setBlastError(msg);
  showError(msg);
}
```

**2-4) createGroup (라인 214)**
```typescript
} catch {
  setFormError("네트워크 오류가 발생했습니다.");
  showError("네트워크 오류가 발생했습니다.");
}

// 변경 후
} catch (err) {
  const msg = "네트워크 오류가 발생했습니다.";
  logger.error('[GroupsPage] createGroup', { err });
  setFormError(msg);
  showError(msg);
}
```

**2-5) ImportModal parseJson (라인 622)**
```typescript
} catch {
  setError('JSON 형식이 올바르지 않습니다');
  setPreview(null);
  return null;
}

// 변경 후: 로깅 불필요 (사용자 입력 오류, 예상된 동작)
// 기존 코드 유지
```

**2-6) ImportModal handleImport (라인 661)**
```typescript
} catch {
  setError('네트워크 오류가 발생했습니다');
}

// 변경 후
} catch (err) {
  logger.error('[GroupsPage] ImportModal.handleImport', { err });
  setError('네트워크 오류가 발생했습니다');
}
```

---

### Task W1-4: 에러 상태 UI 추가
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 30분  

#### Step 1: 초기 로드 에러 UI (라인 284 근처)
```typescript
// 지역 그룹 초기 설정 블록 이전에 삽입
{error && (
  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-semibold text-red-900">데이터를 불러올 수 없습니다</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
      <button
        onClick={() => {
          setLoading(true);
          loadGroups();
        }}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
      >
        재시도
      </button>
    </div>
  </div>
)}
```

#### Step 2: 로딩 중 상태에서도 에러 메시지 표시 여부 결정
```typescript
// 현재 구조: loading이면 스켈레톤만 표시
// 선택: 에러 있으면 에러 메시지도 함께 표시할 것
if (loading && !error) {
  return (/* 스켈레톤 */);
}

// 에러 있으면 에러 UI 표시
if (error) {
  return (/* 에러 UI */);
}

// 정상 렌더링
```

---

### Task W1-5: Settings 버튼 기능 결정
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 15분  

#### 현재 상태 (라인 483-485)
```typescript
<button className="p-2 hover:bg-gray-100 rounded-lg">
  <Settings className="w-4 h-4 text-gray-400" />
</button>
```

#### Option A: 삭제 버튼으로 변경 (추천)
```typescript
// 사용자 선택이 없으면, 일단 Settings 버튼 제거하고
// P2에서 "편집" 또는 "삭제" 기능 추가 시 결정

// 임시 해결책: 버튼 제거
// (라인 483-485 전체 삭제)
```

#### Option B: 그룹 편집 모달 추가 (Wave 2+)
```typescript
// 추후 구현
// - 그룹 이름 수정
// - 설명 수정
// - 퍼널 변경
// - 색상 변경
```

**Wave 1 결정:** Settings 버튼 제거 (TODO로 남겨둠)
```typescript
// 라인 483-485 제거
{/* TODO (P2): 그룹 편집 또는 삭제 기능 추가 */}
```

---

## ✅ Verification Checklist

### Pre-Implementation
- [ ] logger import 확인 (이미 있는지)
- [ ] CSRF API endpoint 작동 확인
- [ ] 현재 git status 깔끔한지 확인

### During Implementation
- [ ] 각 Task별로 commit 하나씩 생성
- [ ] TypeScript 타입 에러 없는지 확인
- [ ] import 경로 올바른지 확인

### Post-Implementation (로컬 테스트)
- [ ] 초기 로드 성공 (그룹/퍼널 표시)
- [ ] 새 그룹 생성 성공
- [ ] 그룹 복제 성공
- [ ] 그룹 내보내기 성공 (클립보드 복사)
- [ ] 일괄 발송 -> 대상확인 -> 발송 성공
- [ ] 가져오기 모달 파일/텍스트 모두 작동
- [ ] 네트워크 오류 시 에러 메시지 + 재시도 버튼 표시
- [ ] 브라우저 console에 logger.error() 메시지 확인
- [ ] DevTools Network 탭에서 X-CSRF-Token 헤더 확인

---

## 📝 Commit Messages

```
1. "fix(groups): CSRF 토큰 fetching 및 모든 API 호출에 헤더 추가"
2. "fix(groups): Promise.all → allSettled로 변경 (P0 에러 처리)"
3. "fix(groups): 초기 로드 에러 상태 + 재시도 UI 추가"
4. "fix(groups): 모든 catch 블록에 logger.error() 통합"
5. "fix(groups): Settings 버튼 제거 (TODO P2)"
```

---

## 🔗 참고 자료

- Menu #25-26 campaigns/page.tsx (CSRF 토큰 패턴) → L19-32
- Menu #25-26 sales/page.tsx (Promise.all 없이 개별 처리) → L145-163
- logger 사용법 → src/lib/logger.ts

---

## ⏱️ 타임라인

| Task | 예상시간 | 상태 |
|------|--------|------|
| W1-1: CSRF 토큰 | 45분 | ⏳ |
| W1-2: Promise.allSettled | 45분 | ⏳ |
| W1-3: logger.error() | 20분 | ⏳ |
| W1-4: 에러 UI | 30분 | ⏳ |
| W1-5: Settings 버튼 | 15분 | ⏳ |
| **Wave 1 총합** | **2.5시간** | |

