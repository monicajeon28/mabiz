# Menu #27 Phase 1 10-Lens Code Review: 고객 그룹 관리 (groups/page.tsx)

**분석 대상:** `src/app/(dashboard)/groups/page.tsx` (759줄)  
**분석 일자:** 2026-05-22  
**분석자:** Claude Code  
**목표:** P0/P1/P2 이슈 식별 → Wave 기반 구현 계획 수립

---

## 📊 Executive Summary

| 렌즈 | 심각도 | 이슈 수 | 우선순위 |
|------|--------|--------|---------|
| 보안 (Security) | P0 | 3 | **CRITICAL** |
| 성능 (Performance) | P1 | 3 | HIGH |
| 접근성 (Accessibility) | P1 | 4 | HIGH |
| UX (User Experience) | P1 | 4 | HIGH |
| 확장성 (Scalability) | P1 | 2 | HIGH |
| 에러처리 (Error Handling) | P1 | 3 | HIGH |
| 테스팅 (Testing) | P3 | 1 | LOW |
| 유지보수 (Maintainability) | P1 | 2 | HIGH |
| 호환성 (Compatibility) | P2 | 1 | MEDIUM |
| 비즈니스 (Business) | P2 | 2 | MEDIUM |
| **합계** | | **25** | |

**P0: 2개 (차단)** | **P1: 11개 (긴급)** | **P2: 8개 (개선)** | **P3: 4개 (선택)**

---

## 🔴 P0 Issues (차단 - 반드시 수정)

### P0-1: CSRF 토큰 누락 (모든 API 변경 요청)
**심각도:** CRITICAL - 보안 위험  
**영향 범위:** 보안  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 37, 81, 145, 184, 653  

```typescript
// ❌ 문제: CSRF 토큰 없음
const res = await fetch('/api/setup/regional-groups', { method: 'POST' });
const res = await fetch(`/api/groups/${id}/clone`, { method: 'POST' });
const res = await fetch('/api/groups', { method: 'POST', ... });
const res = await fetch('/api/groups/import', { method: 'POST', ... });
```

**원인:** Menu #25-26에서 구현한 CSRF 토큰 패턴 미적용  
**영향:** POST/PUT/DELETE 요청이 CSRF 공격에 취약  
**해결책:**
1. 컴포넌트 마운트 시 CSRF 토큰 fetch (Menu #25 패턴)
2. 모든 mutation 요청에 `X-CSRF-Token` 헤더 추가
3. 토큰 갱신 로직 구현 (토큰 만료 시)

---

### P0-2: Promise.all 에러 처리 부재
**심각도:** CRITICAL - 데이터 불일치  
**영향 범위:** 에러 처리, 성능  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 46-51, 72-75, 169-175  

```typescript
// ❌ 문제: 하나의 fetch 실패 시 전체 상태 불일치
const [g, f] = await Promise.all([
  fetch('/api/groups').then((r) => r.json()),
  fetch('/api/funnels').then((r) => r.json()),
]);
if (g.ok)  setGroups(g.groups);      // g.groups 미정의면 에러
if (f.ok)  setFunnels(f.funnels);    // 부분 업데이트
```

**원인:** Promise.all이 실패해도 부분 데이터 사용  
**영향:** 
- 한 API 실패 → 다른 데이터는 갱신되지 않음
- UI가 불완전한 상태로 표시될 수 있음
- initRegionalGroups 이후 재로드 시 불일치 가능

**해결책:**
1. 각 fetch에 .catch() 추가하여 독립적 에러 처리
2. 초기 로드 실패 시 에러 상태 표시
3. 부분 업데이트 방지 (both-or-nothing)

---

## 🟠 P1 Issues (긴급 - 세션 내 완료)

### P1-1: 페이지네이션 부재 (성능 / Scalability)
**심각도:** P1 - 대규모 데이터 시 성능 악화  
**영향 범위:** 성능, 확장성  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 423-598 (groups.map 렌더링 전체)  

```typescript
// ❌ 문제: 모든 그룹을 한 번에 렌더링
{groups.map((group) => (
  <div key={group.id} className="...">
    {/* 100개 그룹이면 100개 DOM 노드 */}
  </div>
))}
```

**원인:** 페이지네이션 미구현 (Menu #25 sales에도 TODO P2-4)  
**영향:**
- 그룹 > 100개일 때 초기 렌더링 지연 (LCP 증가)
- 스크롤 성능 저하
- 메모리 사용량 증가

**해결책:**
1. 서버 사이드: API 페이지네이션 (limit/offset)
2. 클라이언트: 10개 단위 로드 또는 가상 스크롤
3. Menu #25 sales 페이지네이션과 동일 패턴 적용

---

### P1-2: ImportModal aria-label 누락 (접근성)
**심각도:** P1 - WCAG 2.1 AA 비준수  
**영향 범위:** 접근성  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 676  

```typescript
// ❌ 문제: 닫기 버튼 aria-label 없음
<button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
```

**원인:** 아이콘만 표시, 스크린 리더 미지원  
**영향:** 시각 장애인 사용자가 닫기 기능 인식 불가  

**해결책:**
```typescript
// ✅ 수정
<button 
  onClick={onClose} 
  className="text-gray-400 hover:text-gray-600"
  aria-label="가져오기 모달 닫기"
>✕</button>
```

---

### P1-3: 색상 선택 aria-label 불명확 (접근성)
**심각도:** P1 - 색상 식별 불가  
**영향 범위:** 접근성  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 347  

```typescript
// ❌ 문제: aria-label이 HEX 코드만 표시
aria-label={`색상 ${c} 선택`}  // "색상 #1E2D4E 선택" → 무의미
```

**원인:** 색상 이름 매핑 부재  
**영향:** 스크린 리더 사용자가 어떤 색상인지 알 수 없음  

**해결책:**
```typescript
// ✅ 수정: 색상 이름 매핑
const COLOR_NAMES = {
  "#1E2D4E": "네이비",
  "#C9A84C": "골드",
  "#10B981": "초록",
  "#3B82F6": "파랑",
  "#8B5CF6": "보라",
  "#EF4444": "빨강",
  "#F59E0B": "주황",
  "#6B7280": "회색",
};
aria-label={`${COLOR_NAMES[c]} 색상 선택`}
```

---

### P1-4: Settings 버튼 미구현 (UX)
**심각도:** P1 - 비활성 기능  
**영향 범위:** UX  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 483-485  

```typescript
// ❌ 문제: onClick 핸들러 없음
<button className="p-2 hover:bg-gray-100 rounded-lg">
  <Settings className="w-4 h-4 text-gray-400" />
</button>
```

**원인:** 기능 미정의  
**영향:**
- 사용자는 클릭 가능하다고 생각함 (버튼처럼 보임)
- 실제로는 아무 일도 일어나지 않음 (혼란 야기)

**해결책:**
- **Option A:** 그룹 편집 모달 연결 (수정, 퍼널 변경)
- **Option B:** 그룹 삭제 확인 (문자 "삭제" 버튼으로 변경)
- **Option C:** Settings 버튼 제거 (P2 단계에서 결정)

---

### P1-5: ImportModal JSON 검증 부재 (보안)
**심각도:** P1 - 스키마 검증 미흡  
**영향 범위:** 보안, 에러 처리  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 614-626  

```typescript
// ❌ 문제: try-catch만으로 검증, 구조 검증 없음
try {
  const parsed = JSON.parse(text) as { groupName?: string; funnelName?: string; stages?: unknown[] };
  // 이게 정말 stages 배열일까? 데이터 타입 검증 없음
} catch {
  setError('JSON 형식이 올바르지 않습니다');
}
```

**원인:** Zod 스키마 검증 미사용  
**영향:**
- 잘못된 JSON 구조 → API 오류
- 사용자가 무엇을 고쳐야 하는지 알 수 없음

**해결책:**
```typescript
// ✅ 수정: Zod 스키마 검증 추가
const ImportSchema = z.object({
  groupName: z.string().min(1, "그룹명 필수"),
  funnelName: z.string().optional(),
  stages: z.array(z.object({
    name: z.string(),
    triggerType: z.enum(['DDAY', 'DELAY']),
    order: z.number(),
    messageContent: z.string(),
  })).optional(),
});

const parsed = ImportSchema.parse(JSON.parse(text));
```

---

### P1-6: 15+ 상태 변수 (유지보수/확장성)
**심각도:** P1 - 코드 복잡도 매우 높음  
**영향 범위:** 유지보수, 확장성  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 19-105  

```typescript
// ❌ 문제: 상태 변수 15개 이상
const [groups, setGroups] = useState<Group[]>([]);
const [funnels, setFunnels] = useState<Funnel[]>([]);
const [loading, setLoading] = useState(true);
const [showNew, setShowNew] = useState(false);
const [form, setForm] = useState({ name: "", ... });
const [saving, setSaving] = useState(false);
const [formError, setFormError] = useState<string | null>(null);
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [setupMsg, setSetupMsg] = useState<string | null>(null);
const [setupLoading, setSetupLoading] = useState(false);
const [copiedExportId, setCopiedExportId] = useState<string | null>(null);
const [showImport, setShowImport] = useState(false);
const [blastGroupId, setBlastGroupId] = useState<string | null>(null);
const [blastMsg, setBlastMsg] = useState("");
const [blastPreview, setBlastPreview] = useState<{ ... } | null>(null);
const [blastConfirm, setBlastConfirm] = useState(false);
const [blasting, setBlasting] = useState(false);
const [blastResult, setBlastResult] = useState<{ ... } | null>(null);
const [checkingBlast, setCheckingBlast] = useState(false);
const [blastError, setBlastError] = useState<string | null>(null);
```

**원인:** 여러 기능을 하나의 컴포넌트에서 관리  
**영향:**
- 기능 추가 시 상태 변수 계속 증가
- 상태 간 의존성 관리 어려움
- 테스트 어려움

**해결책 (Wave 2):**
1. **GroupForm 컴포넌트** 분리
   - form, fieldErrors, formError, saving
2. **GroupCard 컴포넌트** 분리
   - 그룹 렌더링 로직 (clone, export 포함)
3. **BlastPanel 컴포넌트** 분리
   - blastGroupId, blastMsg, blastPreview, blastConfirm, blasting, blastResult, blastError, checkingBlast
4. **RegionalSetup 컴포넌트** 분리
   - setupMsg, setupLoading

---

### P1-7: ImportModal을 별도 파일로 (코드 구성)
**심각도:** P1 - 파일 길이 관리  
**영향 범위:** 유지보수  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 605-759 (154줄)  

```typescript
// ❌ 문제: 154줄의 ImportModal이 같은 파일에 inline
function ImportModal({ onClose, onDone }: { ... }) {
  // ... 154줄
}
```

**원인:** 구성 요소 분리 미실행  
**영향:** 파일이 길어져서 가독성 저하  

**해결책:**
```typescript
// ✅ 수정: src/components/groups/ImportModal.tsx 생성
export function ImportModal({ onClose, onDone }: { ... }) {
  // ... 코드
}

// page.tsx에서 import
import { ImportModal } from "@/components/groups/ImportModal";
```

---

### P1-8: 에러 로깅 부재 (에러 처리/관찰성)
**심각도:** P1 - 디버깅 어려움  
**영향 범위:** 에러 처리  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 58-61, 131-134, 159-162, 214-216, 661-662  

```typescript
// ❌ 문제: catch 블록에서 로깅 없음
} catch {
  const msg = "네트워크 오류가 발생했습니다.";
  setBlastError(msg);
  showError(msg);
}
```

**원인:** Menu #25-26의 logger.error() 패턴 미적용  
**영향:** 
- 서버 로그에 에러가 기록되지 않음
- 운영자가 무엇이 실패했는지 알 수 없음

**해결책:**
```typescript
// ✅ 수정: logger.error() 추가
import { logger } from "@/lib/logger";

} catch (err) {
  const msg = "네트워크 오류가 발생했습니다.";
  logger.error('[GroupsPage]', { err });
  setBlastError(msg);
  showError(msg);
}
```

---

### P1-9: 초기 로드 에러 상태 표시 안 됨 (에러 처리)
**심각도:** P1 - 조용한 실패  
**영향 범위:** 에러 처리, UX  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 168-176  

```typescript
// ❌ 문제: 에러 시에도 loading을 false로 설정
useEffect(() => {
  Promise.all([...])
    .then(([g, f]) => {
      if (g.ok)  setGroups(g.groups);
      if (f.ok)  setFunnels(f.funnels);
    })
    .finally(() => setLoading(false));  // 에러 상태가 없음!
}, []);
```

**원인:** 에러 상태 변수 부재  
**영향:**
- API 실패 시 사용자가 알 수 없음 (스켈레톤만 사라짐)
- 재시도 버튼 없음

**해결책:**
```typescript
// ✅ 수정: error 상태 추가
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  Promise.all([...])
    .then(([g, f]) => { ... })
    .catch(err => {
      logger.error('[GroupsPage]', { err });
      setError("그룹 데이터를 불러올 수 없습니다.");
    })
    .finally(() => setLoading(false));
}, []);

// 렌더링
{error && (
  <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
    {error}
    <button onClick={() => { /* loadGroups 재호출 */ }} className="...">재시도</button>
  </div>
)}
```

---

### P1-10: 형태소 메시지 차별화 부재 (UX)
**심각도:** P1 - 사용자 혼란  
**영향 범위:** UX  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 59-61, 128-134, 214-216  

```typescript
// ❌ 문제: 모든 에러가 같은 메시지
catch {
  const msg = "네트워크 오류가 발생했습니다.";  // 너무 일반적
  showError(msg);
}
```

**원인:** 에러 타입별 메시지 분류 없음  
**영향:**
- "네트워크 오류" vs "서버 오류" vs "검증 오류" 구분 불가
- 사용자가 무엇을 수정해야 하는지 모름

**해결책:** Menu #25 sales 패턴 적용 (상황별 에러 메시지)
```typescript
const getErrorMessage = (err: Error, context: string) => {
  if (err.message.includes('timeout')) return `${context}: 요청 타임아웃 (다시 시도해주세요)`;
  if (err.message.includes('401')) return `${context}: 권한이 없습니다`;
  return `${context}: 알 수 없는 오류가 발생했습니다`;
};
```

---

### P1-11: 파일 업로드 검증 부재 (ImportModal - 보안)
**심각도:** P1 - 파일 사이즈 제한 없음  
**영향 범위:** 보안  
**파일:** `src/app/(dashboard)/groups/page.tsx`  
**라인:** 629-639  

```typescript
// ❌ 문제: 파일 크기 제한 없음
const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target?.result as string;
    parseJson(text);  // 100MB 파일도 처리 가능
  };
  reader.readAsText(file);
};
```

**원인:** 파일 검증 부재  
**영향:**
- 악의적 사용자가 대용량 파일 업로드
- 브라우저 메모리 부족으로 크래시 가능

**해결책:**
```typescript
// ✅ 수정: 파일 크기 검증
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    setError(`파일이 너무 큽니다 (최대 1MB, 현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    return;
  }
  // ... 계속
};
```

---

## 🟡 P2 Issues (개선 - 다음 세션에서 처리 가능)

### P2-1: COLOR_OPTIONS 메모이제이션 (성능)
**라인:** 222-225  
**해결책:** 컴포넌트 외부로 상수 이동  

```typescript
// ✅ 수정: 파일 최상단으로 이동
const COLOR_OPTIONS = [
  "#1E2D4E", "#C9A84C", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#F59E0B", "#6B7280",
];

export default function GroupsPage() { ... }
```

---

### P2-2: 삭제 확인 대화 (UX)
**라인:** 463  
**해결책:** clone/export 전에 확인 대화 추가

---

### P2-3: 초기 로드 최적화 (성능)
**라인:** 168-176  
**해결책:** loadGroups 함수 재사용으로 중복 제거

---

### P2-4: ImportModal 미리보기 개선 (UX)
**라인:** 712-721  
**해결책:** 실제 검증 에러 표시 (필드별 문제 명시)

---

### P2-5: Blast textarea 레이블 (접근성)
**라인:** 503-509  
**해결책:** 올바른 <label> 요소 추가

---

### P2-6: Role="region" 추가 (접근성)
**라인:** 490-595  
**해결책:** 동적 폼 섹션에 role="region" aria-live="polite" 추가

---

### P2-7: 그룹 멤버 조회 기능 (비즈니스)
**라인:** 440  
**해결책:** 멤버 수를 클릭하면 모달로 멤버 목록 표시

---

### P2-8: 복제/내보내기 설명 (비즈니스)
**해결책:** 각 버튼에 title 추가 (현재 title은 기본적임)

---

## 📋 P3 Issues (선택 - P1/P2 완료 후)

### P3-1: 단위 테스트 추가
**해결책:** ImportModal.test.ts, groupForm.test.ts 등 생성

---

## 🎯 Wave-기반 구현 계획

### **Wave 1: P0 + 긴급 P1 (보안/에러 처리)**
**예상 시간:** 2-3시간  
**내용:**
1. CSRF 토큰 fetching + 모든 API 호출에 추가
2. Promise.all → Promise.allSettled + 에러 상태 표시
3. 초기 로드 에러 상태 추가 (error 변수 + UI)
4. logger.error() 모든 catch 블록에 추가
5. Settings 버튼 기능 정의 (delete 또는 edit 모달)

**산출물:**
- CSRF 토큰 관리 로직
- 에러 상태 UI
- 로깅 통합

---

### **Wave 2: P1 접근성 + 코드 구성**
**예상 시간:** 3-4시간  
**내용:**
1. 4개 컴포넌트 분리 (GroupForm, GroupCard, BlastPanel, RegionalSetup)
2. ImportModal → 별도 파일 이동
3. aria-label 개선 (색상 이름 매핑 추가)
4. ImportModal 닫기 버튼 aria-label 추가
5. Zod 스키마 검증 추가

**산출물:**
- src/components/groups/GroupForm.tsx
- src/components/groups/GroupCard.tsx
- src/components/groups/BlastPanel.tsx
- src/components/groups/RegionalSetup.tsx
- src/components/groups/ImportModal.tsx
- 리펙터링된 page.tsx (300줄 이하 목표)

---

### **Wave 3: P1 성능 + P2 UX 개선**
**예상 시간:** 2-3시간  
**내용:**
1. 페이지네이션 구현 (API 연동)
2. 에러 메시지 차별화 (타입별 메시지)
3. 파일 크기 검증 추가
4. ImportModal 미리보기 개선
5. COLOR_OPTIONS 상수화
6. Blast textarea 레이블 추가

**산출물:**
- 페이지네이션 로직 + UI
- 개선된 에러 메시지
- 완성도 높은 ImportModal

---

## 📌 Quick Action Items

| 우선순위 | 항목 | 예상 시간 | Wave |
|----------|------|---------|------|
| P0 | CSRF 토큰 추가 (모든 API) | 30분 | 1 |
| P0 | Promise.all → allSettled | 30분 | 1 |
| P1 | 에러 상태 표시 + 재시도 | 45분 | 1 |
| P1 | logger.error() 통합 | 20분 | 1 |
| P1 | Settings 버튼 기능 정의 | 15분 | 1 |
| P1 | 4개 컴포넌트 분리 | 2시간 | 2 |
| P1 | ImportModal 파일 이동 | 30분 | 2 |
| P1 | aria-label 개선 | 30분 | 2 |
| P1 | Zod 스키마 검증 | 45분 | 2 |
| P1 | 페이지네이션 | 1.5시간 | 3 |
| P2 | 에러 메시지 차별화 | 30분 | 3 |
| P2 | 파일 검증 | 20분 | 3 |

**Wave 1 총 예상:** 2.5시간  
**Wave 2 총 예상:** 3.5시간  
**Wave 3 총 예상:** 2.5시간  
**전체 예상:** 8.5시간 (3개 세션)

---

## 🔗 관련 메모리

- [[메뉴-25-26 마케팅 리펙토링]](../../../) — CSRF, 컴포넌트 추출 패턴 참고
- [[절대법칙]](../../../) — Phase 1-6 실행 확인
- [[10렌즈 검토 프레임워크]](../../../) — 동일 기준 적용

---

## ✅ 다음 단계

**Phase 2 진행:**
1. 이 분석 문서 사용자 검토 (추가 이슈 있는지 확인)
2. Wave 1-3 순서 확정
3. Wave 1 구현 시작 (P0 이슈 우선)

