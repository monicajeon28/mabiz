# 🟡 에이전트 β (Beta) — UI 대시보드 전담 작업지시서
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
D:\mabiz-crm\src\app\(dashboard)\    ← 전체 대시보드 페이지 (~45개 디렉토리)
D:\mabiz-crm\src\app\(dashboard)\components\   ← 공유 컴포넌트
```

### 우선순위 (P0 먼저)
```
P0 (즉시): contacts/, messages/, campaigns/, funnels/
P1 (중요): gold-members/, analytics/, products/, members/, sms-logs/
P2 (검토): my-sales/, statements/, team-statements/, contracts/, payslips/
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

### 10-렌즈 체크리스트 (React 컴포넌트 전용)

| 렌즈 | UI 컴포넌트 체크 항목 |
|------|----------------------|
| **L1 보안** | dangerouslySetInnerHTML 사용, XSS 가능 innerHTML, 클라이언트에서 시크릿 노출 |
| **L2 성능** | useEffect 의존성 빠진 경우, 불필요한 re-render, 대용량 리스트 미가상화 |
| **L3 접근성** | 버튼에 aria-label 없음, 색상만으로 상태 구분, 키보드 포커스 불가 |
| **L4 UX** | 로딩 상태 없음, 에러 상태 없음, 빈 상태 없음 |
| **L5 확장성** | 하드코딩 텍스트·숫자, 매직 스트링, 인라인 스타일 과다 |
| **L6 에러처리** | fetch catch 없음, 에러 boundary 없음, AbortController 없음 (타임아웃 미처리) |
| **L7 테스트** | 해당 없음 (UI) |
| **L8 유지보수** | 500줄 초과 컴포넌트, 중복 JSX, 인라인 함수 남용 |
| **L9 호환성** | window/document 직접 접근 (SSR 오류 위험), navigator 직접 사용 |
| **L10 비즈니스** | 더미 데이터 하드코딩, 실제 API 미연결, TODO/FIXME 주석 |

---

## 🚨 자주 발견되는 메모리 누수·버그 패턴

### 1. setTimeout/setInterval 미정리 (P0 - Vercel 서버 메모리 누수)
```typescript
// ❌ 위험: 컴포넌트 언마운트 후에도 실행됨
useEffect(() => {
  const timer = setTimeout(() => setData(...), 3000);
  // cleanup 없음!
}, []);

// ✅ 수정: cleanup 반환
useEffect(() => {
  const timer = setTimeout(() => setData(...), 3000);
  return () => clearTimeout(timer);
}, []);
```

### 2. fetch without AbortController (P1)
```typescript
// ❌ 위험: 컴포넌트 언마운트 후 setState 호출
useEffect(() => {
  fetch('/api/contacts')
    .then(res => res.json())
    .then(data => setContacts(data)); // 언마운트 후 crash!
}, []);

// ✅ 수정: AbortController + 10초 타임아웃
useEffect(() => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  fetch('/api/contacts', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setContacts(data))
    .catch(err => {
      if (err.name === 'AbortError') setError('요청 시간 초과');
      else setError('데이터를 불러오지 못했습니다.');
    })
    .finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });
  
  return () => { controller.abort(); clearTimeout(timeout); };
}, []);
```

### 3. useEffect 의존성 누락 (P1)
```typescript
// ❌ 위험: page 변경 시 refetch 안 됨
useEffect(() => {
  fetchContacts(page);
}, []); // page 누락!

// ✅ 수정
useEffect(() => {
  fetchContacts(page);
}, [page]);
```

### 4. window/document 직접 접근 SSR 오류 (P0 - Next.js)
```typescript
// ❌ 위험: SSR에서 window 없음 → 빌드 오류
const width = window.innerWidth;

// ✅ 수정: 클라이언트 확인 후 사용
const width = typeof window !== 'undefined' ? window.innerWidth : 0;
// 또는 useEffect 내부에서만 사용
```

### 5. dangerouslySetInnerHTML XSS (P0)
```typescript
// ❌ 위험: 사용자 입력이 HTML로 렌더링
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 수정: DOMPurify 또는 텍스트로만 렌더링
<div>{userInput}</div>
// 또는 src/lib/html-sanitizer.ts 의 sanitize() 사용
```

### 6. 더미/하드코딩 데이터 (P1)
```typescript
// ❌ 위험: 프로덕션에 테스트 데이터
const contacts = [
  { id: '1', name: '홍길동', phone: '010-0000-0000' },
  { id: '2', name: '테스트', phone: '010-1234-5678' },
];

// ✅ 수정: API 연결 or 빈 배열로 초기화
const [contacts, setContacts] = useState<Contact[]>([]);
```

### 7. 빈 상태·로딩·에러 처리 누락 (P1)
```typescript
// ❌ 위험: 사용자에게 빈 화면만 보임
if (loading) return null;
if (!data.length) return null;

// ✅ 수정: 명시적 상태 표시
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
if (!data.length) return <EmptyState message="데이터가 없습니다." />;
```

### 8. 접근성 누락 (P1)
```typescript
// ❌ 위험: 스크린 리더 불가
<button onClick={handleEdit}>✏️</button>
<span className="bg-green-100">완료</span>

// ✅ 수정: aria-label 추가
<button onClick={handleEdit} aria-label="수정">✏️</button>
<span className="bg-green-100" aria-label="상태: 완료">완료</span>
```

---

## 📋 작업 실행 순서

### Phase 1: 스캔 (컴포넌트별 10-렌즈)
각 page.tsx를 열어 다음을 확인:
1. useEffect cleanup 반환 여부
2. fetch AbortController 사용 여부
3. 빈/로딩/에러 상태 처리 여부
4. window/document 직접 접근 여부
5. 더미 데이터 하드코딩 여부
6. aria-label 누락 여부

### Phase 2: 분류 (P0/P1/P2)
```
P0: SSR 오류 위험, XSS, window 직접 접근 → 즉시 수정
P1: 메모리 누수, AbortController 없음, 더미 데이터 → 이번 사이클
P2: 접근성, 코드 정리, 중복 JSX → 다음 사이클
```

### Phase 3: 수정 & 커밋
- 연관 page.tsx + route.ts 함께 수정
- 커밋 메시지: `fix(contacts): P0 메모리 누수 수정 + AbortController 추가`
- 빌드 확인: `npm run build` (성공해야 커밋)

### Phase 4: 재검토
- 수정된 파일 재확인
- 같은 패턴의 다른 페이지 확인
- 다음 디렉토리로 이동

---

## 🏁 시작 명령

```
D:\mabiz-crm 에서 시작.

1. src/app/(dashboard)/contacts/page.tsx 부터 10-렌즈 검토
2. src/app/(dashboard)/messages/ 검토
3. src/app/(dashboard)/campaigns/ 검토
4. P0 이슈 즉시 수정 후 커밋
5. P1 이슈 목록화 후 순차 수정
6. 전체 dashboard 디렉토리 완료까지 반복

빌드 명령: npm run build
절대 push 금지. commit까지만.
한국어로 보고할 것.
```

---

## 📊 완료 보고 양식

```
## β 에이전트 완료 보고

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
