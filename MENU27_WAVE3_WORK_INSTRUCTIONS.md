# Menu #27 Wave 3 상세 작업지시서 (P1 성능 + P2 UX)

**목표:** 페이지네이션 + 메시지 개선 + 파일 검증으로 사용 가능한 수준 완성  
**예상 시간:** 2.5시간  
**범위:** P1 1개 (성능) + P2 7개 (UX/검증)  
**의존성:** Wave 1-2 완료 (커밋 d7a2db8)

---

## 📋 Task List

### Task W3-1: 페이지네이션 구현 (서버+클라이언트)
**파일:** `src/app/(dashboard)/groups/page.tsx` + API 변경  
**시간:** 1시간  

#### Step 1: API 페이지네이션 추가 (가정: /api/groups가 지원)
```typescript
// API 호출에 limit/offset 추가
const loadGroups = async (limit = 10, offset = 0) => {
  setError(null);
  const [gResult, fResult] = await Promise.allSettled([
    fetch(`/api/groups?limit=${limit}&offset=${offset}`).then((r) => r.json()),
    fetch('/api/funnels').then((r) => r.json()),
  ]);
  // ... 기존 처리
};
```

#### Step 2: 페이지네이션 상태 추가
```typescript
// page.tsx 상태 추가
const [currentPage, setCurrentPage] = useState(0);
const [totalCount, setTotalCount] = useState(0);
const ITEMS_PER_PAGE = 10;
```

#### Step 3: API 응답에서 totalCount 추출
```typescript
// gResult.value에서 { groups, totalCount } 구조 가정
if (gResult.status === 'fulfilled' && gResult.value.ok) {
  setGroups(gResult.value.groups);
  setTotalCount(gResult.value.totalCount);
}
```

#### Step 4: 페이지네이션 UI 추가
```typescript
// 그룹 목록 하단에 추가
{!loading && groups.length > 0 && (
  <div className="flex items-center justify-center gap-2 mt-6">
    <button
      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
      disabled={currentPage === 0}
      className="px-3 py-2 border rounded-lg disabled:opacity-50"
    >
      이전
    </button>
    <span className="text-sm text-gray-600">
      {currentPage + 1} / {Math.ceil(totalCount / ITEMS_PER_PAGE)}
    </span>
    <button
      onClick={() => setCurrentPage(currentPage + 1)}
      disabled={(currentPage + 1) * ITEMS_PER_PAGE >= totalCount}
      className="px-3 py-2 border rounded-lg disabled:opacity-50"
    >
      다음
    </button>
  </div>
)}
```

#### Step 5: 페이지 변경 시 데이터 로드
```typescript
useEffect(() => {
  const offset = currentPage * ITEMS_PER_PAGE;
  loadGroups(ITEMS_PER_PAGE, offset);
}, [currentPage]);
```

---

### Task W3-2: 에러 메시지 차별화
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 30분  

#### 문제: 모든 에러가 같은 메시지
```typescript
// 현재 (BAD)
} catch (err) {
  const msg = "네트워크 오류가 발생했습니다.";
  setError(msg);
}
```

#### 해결책: 에러 타입별 메시지
```typescript
// Step 1: 에러 메시지 함수 추가
const getErrorMessage = (err: unknown, context: string): string => {
  if (err instanceof Error) {
    if (err.message.includes('Network')) return `${context}: 네트워크 연결 불안정`;
    if (err.message.includes('timeout')) return `${context}: 요청 타임아웃 (다시 시도해주세요)`;
  }
  return `${context}: 알 수 없는 오류가 발생했습니다`;
};

// Step 2: 모든 catch 블록 업데이트
} catch (err) {
  const msg = getErrorMessage(err, '[그룹 생성]');
  logger.error('[GroupsPage] createGroup', { err });
  setFormError(msg);
  showError(msg);
}
```

---

### Task W3-3: ImportModal 파일 크기 검증 강화
**파일:** `src/components/groups/ImportModal.tsx`  
**시간:** 20분  

#### 현재: 검증 없음
```typescript
// 문제: 100MB 파일도 처리 가능
const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  // ... 바로 읽음
};
```

#### 수정: 파일 크기 + 타입 검증
```typescript
// Step 1: 상수 추가
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// Step 2: handleFile 수정
const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 파일 크기 검증
  if (file.size > MAX_FILE_SIZE) {
    setError(`파일이 너무 큽니다 (최대 1MB, 현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    return;
  }
  
  // 파일 타입 검증
  if (!file.name.endsWith('.json')) {
    setError('JSON 파일만 업로드 가능합니다');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target?.result as string;
    setJsonText(text);
    parseJson(text);
  };
  reader.readAsText(file);
};
```

---

### Task W3-4: ImportModal 미리보기 검증 강화
**파일:** `src/components/groups/ImportModal.tsx`  
**시간:** 30분  

#### 현재: 필드 개수만 표시
```typescript
{preview && (
  <div className="bg-blue-50 rounded-xl p-3 text-sm">
    <p className="font-medium text-blue-800">파싱 결과</p>
    <div className="mt-1.5 space-y-0.5 text-blue-700 text-xs">
      {preview.groupName && <p>그룹명: {preview.groupName}</p>}
      {preview.funnelName && <p>퍼널명: {preview.funnelName}</p>}
      {preview.stageCount !== undefined && <p>스테이지: {preview.stageCount}개</p>}
    </div>
  </div>
)}
```

#### 수정: 필수 필드 검증 추가
```typescript
// Step 1: parseJson에서 검증 강화
const parseJson = (text: string) => {
  try {
    const parsed = JSON.parse(text) as { 
      groupName?: string; 
      funnelName?: string; 
      stages?: unknown[] 
    };
    
    // 필수 필드 검증
    if (!parsed.groupName || parsed.groupName.trim().length === 0) {
      setError('groupName은 필수입니다');
      setPreview(null);
      return null;
    }
    
    if (!parsed.stages || !Array.isArray(parsed.stages)) {
      setError('stages는 배열이어야 합니다');
      setPreview(null);
      return null;
    }
    
    setPreview({
      groupName: parsed.groupName,
      funnelName: parsed.funnelName,
      stageCount: parsed.stages.length,
    });
    setError('');
    return parsed;
  } catch {
    setError('JSON 형식이 올바르지 않습니다');
    setPreview(null);
    return null;
  }
};

// Step 2: 미리보기 UI 개선
{preview && (
  <div className="bg-blue-50 rounded-xl p-3 text-sm">
    <p className="font-medium text-blue-800">✅ 검증됨</p>
    <div className="mt-1.5 space-y-0.5 text-blue-700 text-xs">
      {preview.groupName && <p>그룹명: {preview.groupName}</p>}
      {preview.funnelName && <p>퍼널명: {preview.funnelName}</p>}
      {preview.stageCount !== undefined && (
        <p>스테이지: {preview.stageCount}개 {preview.stageCount === 0 && '(⚠️ 비어있음)'}</p>
      )}
    </div>
  </div>
)}
```

---

### Task W3-5: BlastPanel 메시지 미리보기 길이 제한
**파일:** `src/components/groups/BlastPanel.tsx`  
**시간:** 15분  

#### 현재: 50자만 표시, 긴 메시지 보기 어려움
```typescript
<p>✓ <span className="font-medium">메시지:</span> {blastMsg.substring(0, 50)}
  {blastMsg.length > 50 ? '...' : ''}
</p>
```

#### 수정: 전체 메시지 표시 (스크롤 가능)
```typescript
// Step 1: 메시지 미리보기 컴포넌트화
<div className="bg-white border border-gray-200 rounded-lg p-2 max-h-20 overflow-y-auto">
  <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
    {blastMsg}
  </p>
</div>

// Step 2: 문자 수 표시 추가
<p className="text-xs text-gray-500 mt-1">
  {blastMsg.length}자 {blastMsg.length > 80 && '(LMS 2건)'}
</p>
```

---

### Task W3-6: 기존 색상 상수화 (P2 성능)
**파일:** `src/components/groups/GroupForm.tsx`  
**시간:** 10분  

#### 현재: 컴포넌트 내부에서 배열 생성
```typescript
const COLOR_OPTIONS = [ ... ];
const COLOR_NAMES = { ... };
```

#### 수정: 파일 상단에 이동 (메모이제이션)
```typescript
// 파일 최상단으로 이동
const COLOR_OPTIONS = [
  "#1E2D4E", "#C9A84C", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#F59E0B", "#6B7280",
];

const COLOR_NAMES: Record<string, string> = {
  "#1E2D4E": "네이비",
  // ...
};

export function GroupForm({ ... }) {
  // 이제 COLOR_OPTIONS/COLOR_NAMES는 render마다 재생성되지 않음
}
```

---

### Task W3-7: 삭제 확인 대화 추가 (P2 UX)
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**시간:** 15분  

#### 선택 사항: 복제/내보내기 전 확인
```typescript
// Step 1: cloneGroup에 확인 추가
const cloneGroup = async (id: string) => {
  if (!confirm(`이 그룹을 복제하시겠습니까?`)) return;
  
  const res = await fetch(`/api/groups/${id}/clone`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken || '' },
  });
  // ... 기존 처리
};

// Step 2: exportGroup는 이미 확인 없음 (클립보드만 복사하므로 안전)
```

---

## 📊 최종 파일 크기 비교

| 파일 | Wave 2 | Wave 3 | 변화 |
|------|--------|--------|------|
| page.tsx | 424줄 | 430줄 | +6줄 (페이지네이션) |
| GroupForm.tsx | 110줄 | 105줄 | -5줄 (상수 이동) |
| BlastPanel.tsx | 80줄 | 85줄 | +5줄 (미리보기) |
| ImportModal.tsx | 165줄 | 185줄 | +20줄 (검증) |
| **합계** | **779줄** | **805줄** | **+26줄** |

---

## ✅ Verification Checklist

### Pre-Implementation
- [ ] API가 페이지네이션 지원하는지 확인 (limit/offset)
- [ ] 현재 API 응답 구조 확인 (totalCount 필드 여부)

### During Implementation
- [ ] 각 에러 메시지 정확성 확인
- [ ] 파일 크기 제한 1MB 적절한지 확인
- [ ] 페이지네이션 버튼 disabled 상태 올바른지 확인

### Post-Implementation (로컬 테스트)
- [ ] 그룹 10개 이상 생성 → 페이지네이션 동작
- [ ] 이전/다음 버튼 disabled 상태 확인
- [ ] 1MB 이상 JSON 파일 업로드 → 에러 메시지
- [ ] 필수 필드 없는 JSON → 에러 메시지
- [ ] 메시지 80자 이상 → "LMS 2건" 표시
- [ ] 색상 상수 메모이제이션 확인 (DevTools)

---

## 📝 Commit Messages

```
1. "feat(groups): 페이지네이션 추가 (limit/offset)"
2. "feat(groups): 에러 메시지 차별화 (타입별)"
3. "feat(groups): ImportModal 파일 검증 강화 (크기+타입+필수필드)"
4. "feat(groups): BlastPanel 메시지 미리보기 개선"
5. "perf(groups): 색상 옵션 상수화 (메모이제이션)"
6. "ux(groups): 복제 전 확인 대화 추가"
```

---

## ⏱️ 타임라인

| Task | 예상시간 | 상태 |
|------|--------|------|
| W3-1: 페이지네이션 | 1시간 | ⏳ |
| W3-2: 에러 메시지 | 30분 | ⏳ |
| W3-3: 파일 검증 | 20분 | ⏳ |
| W3-4: 미리보기 검증 | 30분 | ⏳ |
| W3-5: 메시지 길이 | 15분 | ⏳ |
| W3-6: 색상 상수화 | 10분 | ⏳ |
| W3-7: 삭제 확인 | 15분 | ⏳ |
| **Wave 3 총합** | **2.5시간** | |

---

## 🎯 Wave 3 완료 후

Menu #27 전체 완료:
- ✅ P0: 2개 (보안)
- ✅ P1: 12개 (성능+접근성+코드)
- ✅ P2: 7개 (UX)
- ⏭️ P3: 테스트 (선택)

다음: Menu #28 시작 또는 Phase 5-6 코드 리뷰

