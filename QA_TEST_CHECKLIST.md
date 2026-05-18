# 크루즈봇 Q&A RAG 시스템 - QA 테스트 체크리스트

**작성자**: QA 담당자  
**대상 시스템**: 크루즈봇 Q&A RAG (564개 항목)  
**테스트 날짜**: 2026-05-18

---

## 📋 테스트 개요

### 시스템 구성
- **API**: GET/POST/PUT/DELETE `/api/tools/bot-guide-answers`
- **UI**: QaLibrary.tsx (검색), QaCard.tsx (결과), QaDetailModal.tsx (상세)
- **DB**: BotGuideAnswer (Prisma)
- **검색 파라미터**: `q` (검색어), `category` (카테고리), `tone` (판매톤), `page`, `limit`

### 초등학생 수준 설명
- **엣지 케이스**: "이상하거나 안 쓸 것 같은 경우인데 실제로는 누군가는 쓸 것"
- **에러 처리**: "뭔가 잘못되면 사용자가 '뭐가 문제인지' 알 수 있게 설명해주는 것"
- **테스트**: "모든 버튼을 눌러보고 이상한 게 없는지 확인하는 것"

---

## 🎯 초등학생 질문 3가지 (사용자 피드백)

### Q1: 검색창에 아무것도 안 쓰고 검색 누르면 뭐가 나와요?

**현재 상태:**
- 검색어 없이 전체 564개 Q&A가 나타남
- 페이지네이션으로 20개씩 표시

**문제점:**
- 사용자가 의도적으로 비운 건지 실수한 건지 모름
- 첫 로드 시 전체 데이터 조회로 성능 영향

**개선 방안:**
```javascript
// 현재
if (query) { /* 검색 */ }
// 개선 후
if (!query) { 
  setItems([]);
  setError("검색어를 입력해주세요");
  return;
}
```

---

### Q2: 인터넷이 끊기면 어떤 메시지가 나와요? 사용자가 알 수 있어요?

**현재 상태:**
```
"검색 중 오류 발생"
```
⚠️ 너무 일반적임. 사용자는 문제가 뭔지 모름.

**문제점:**
- 네트워크 오류인지 서버 오류인지 구분 안 됨
- 재시도 방법이 없음
- 모바일에서 특히 네트워크 불안정할 때 혼동 심함

**개선 방안:**
```javascript
if (err instanceof TypeError && err.message.includes('fetch')) {
  setError("📡 인터넷 연결을 확인해주세요");
  // 재시도 버튼 추가
} else if (err instanceof Error && err.name === 'AbortError') {
  setError("⏱️ 검색이 너무 오래 걸리고 있습니다. 다시 시도해주세요");
} else {
  setError("⚠️ 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요");
}
```

**결과:**
- "인터넷 연결 확인" 버튼 추가
- "다시 시도" 버튼 추가
- 아이콘으로 에러 타입 시각화

---

### Q3: 같은 Q&A를 두 번 업로드하면 중복으로 나와요?

**현재 상태:**
```
POST mode="upsert" → 같은 key면 덮어씀
```
✅ 중복 안 생김. 하지만 사용자가 몰라서 혼동할 수 있음.

**문제점:**
- 업로드 결과가 불명확함
- "몇 개를 추가하고 몇 개를 수정했다"고 안 알려줌
- 데이터 덮어쓰기 경고 없음

**개선 방안:**
```javascript
// 업로드 전 확인
const response = await fetch('/api/tools/bot-guide-answers', {
  method: 'POST',
  body: JSON.stringify({ 
    data,
    mode: 'upsert'
  })
});

// 응답 메시지 명확화
// "✅ 12개 추가됨, 5개 수정됨, 3개 오류"
```

**결과:**
- 아기자기한 아이콘 + 숫자로 결과 표시
- "이 Q&A는 이미 있습니다. 덮어쓸까요?" 컨펌

---

## 🧪 엣지 케이스 테스트

### 카테고리별 테스트 시나리오

#### 1️⃣ 검색 입력값 (Query Parameter)

| 테스트 케이스 | 입력값 | 예상 결과 | 위험도 | 테스트 명령어 |
|---|---|---|---|---|
| 빈 검색 | `q=""` | "검색어를 입력하세요" 메시지 또는 빈 목록 | P1 | `GET /api/tools/bot-guide-answers?q=` |
| 특수문자 - AND | `q="&"` | 결과 반환, SQL Injection 없음 | P0 | `curl "...?q=%26"` |
| 특수문자 - OR | `q="'"` | 결과 반환, SQL Injection 없음 | P0 | `curl "...?q=%27"` |
| 특수문자 - 세미콜론 | `q="; DROP"` | 결과 반환, 데이터 삭제 안 됨 | P0 | SQL Injection 테스트 |
| 매우 긴 검색어 | `q="a" * 10000` | 거부 또는 1000자 이상 자르기 | P1 | 10KB 이상 요청 |
| 공백만 | `q="   "` | 결과 반환 또는 빈 목록 | P2 | `?q=%20%20%20` |
| 한글 검색 | `q="정책"` | 정책 관련 Q&A 반환 | P2 | `?q=정책` |
| 이모지 | `q="🚢"` | 결과 반환 (있으면) | P2 | `?q=🚢` |

---

#### 2️⃣ 필터링 (Category / Tone)

| 테스트 케이스 | 입력값 | 예상 결과 | 위험도 | 체크항목 |
|---|---|---|---|---|
| 없는 카테고리 | `category="아무것도"` | 빈 결과 (에러 아님) | P2 | `?category=아무것도` |
| 모든 카테고리 선택 | `category="all"` | 전체 결과 | P2 | 드롭다운 선택 |
| 없는 톤 | `tone="unknown"` | 빈 결과 | P2 | `?tone=unknown` |
| 카테고리 + 톤 동시 | `category="정책" & tone="friendly"` | **AND 조건 확인** (현재 OR로 병합됨) | P0 | `?category=정책&tone=friendly` |
| 대소문자 | `category="정책&수수료"` vs `"정책&수수료"` | 모두 매치됨 | P2 | 민감도 테스트 |

---

#### 3️⃣ 페이지네이션

| 테스트 케이스 | 입력값 | 예상 결과 | 위험도 | 테스트 |
|---|---|---|---|---|
| limit=0 | `limit=0` | 에러 또는 기본값(20) | P0 | `?limit=0` |
| limit=-1 | `limit=-1` | 에러 또는 거부 | P0 | `?limit=-1` |
| limit=999 | `limit=999` | 최대값(100) 제한 또는 에러 | P0 | `?limit=999` |
| limit=1 | `limit=1` | 1개만 반환 | P2 | `?limit=1` |
| page=0 | `page=0` | 에러 또는 page=1로 강제 | P0 | `?page=0` |
| page=-1 | `page=-1` | 에러 또는 page=1로 강제 | P0 | `?page=-1` |
| page=1 (첫 페이지) | `page=1` | 1-20번 Q&A | P2 | `?page=1` |
| page=999999 | `page=999999` | 빈 배열 또는 404 | P2 | `?page=999999` |
| skip > total | skip=(564) * 20 | 빈 배열 | P2 | 계산: skip=10000 |

---

#### 4️⃣ 응답 필드 검증

| 필드 | 타입 | 필수 | 예상값 | 확인사항 |
|---|---|---|---|---|
| `ok` | boolean | Y | true/false | 응답 상태 |
| `data` | array | Y | QaItem[] | 검색 결과 |
| `meta.total` | number | Y | 0-564 | 전체 개수 |
| `meta.page` | number | Y | ≥1 | 현재 페이지 |
| `meta.limit` | number | Y | 1-100 | 페이지당 개수 |
| `meta.totalPages` | number | Y | ≥1 | 전체 페이지 수 |
| `meta.hasMore` | boolean | Y | true/false | 다음 페이지 존재 |
| `data[].id` | string | Y | cuid() | 고유 ID |
| `data[].question` | string | Y | 100+ chars | 질문 |
| `data[].answer` | string | Y | 200+ chars | 답변 |

---

## ⚠️ 에러 처리 테스트

### 에러 시나리오별 확인

#### 시나리오 1: DB 연결 실패

**테스트 방법:**
```javascript
// Prisma 클라이언트 차단
// 또는 DB 서버 다운

await fetch('/api/tools/bot-guide-answers?q=test');
// 예상: 500 에러
```

**확인사항:**
- [ ] HTTP 상태 코드: 500
- [ ] 메시지: "검색 실패" (현재) → "잠시 후 다시 시도해주세요" (개선)
- [ ] UI: 빨간 배너에 에러 아이콘 표시
- [ ] 재시도 버튼: 있는가?

**개선 코드:**
```typescript
catch (error) {
  console.error("[bot-guide-answers GET]", error);
  
  // 에러 타입 구분
  const isConnectionError = error?.code === 'P2021' || error?.code === 'P2022';
  const message = isConnectionError 
    ? "데이터베이스 연결 오류입니다. 잠시 후 다시 시도해주세요."
    : "검색 중 오류가 발생했습니다.";
  
  return NextResponse.json(
    { ok: false, message, errorCode: error?.code },
    { status: 500 }
  );
}
```

---

#### 시나리오 2: API 응답 시간초과

**테스트 방법:**
```javascript
// 프론트엔드 타임아웃 설정 (30초)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const res = await fetch(url, { signal: controller.signal });
} catch (err) {
  if (err.name === 'AbortError') {
    // 타임아웃 처리
  }
}
```

**확인사항:**
- [ ] 30초 후 자동 타임아웃 트리거
- [ ] 타임아웃 메시지 표시: "⏱️ 검색이 너무 오래 걸리고 있습니다"
- [ ] "다시 시도" 버튼 활성화

---

#### 시나리오 3: 네트워크 끊김

**테스트 방법:**
```javascript
// Chrome DevTools → Network → Offline 설정
// 또는 WiFi 비활성화

await fetch('/api/tools/bot-guide-answers?q=test');
// 예상: TypeError: Failed to fetch
```

**확인사항:**
- [ ] 에러 메시지: "📡 인터넷 연결을 확인해주세요"
- [ ] "인터넷 연결 확인" 버튼
- [ ] 온라인 복구 후 "다시 시도" 성공

---

#### 시나리오 4: JSON 파싱 실패

**테스트 방법:**
```javascript
// 서버에서 잘못된 JSON 반환
// 또는 HTML 에러 페이지

const res = await fetch('/api/tools/bot-guide-answers?q=test');
const data = await res.json(); // 실패
```

**확인사항:**
- [ ] 에러 메시지: "서버 응답이 올바르지 않습니다"
- [ ] 콘솔에 상세 에러 로깅
- [ ] 사용자에게는 간단한 메시지만 표시

---

#### 시나리오 5: POST 업로드 - 중복 Q&A

**테스트 방법:**
```bash
curl -X POST http://localhost:3000/api/tools/bot-guide-answers \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "key": "qa_001",
        "question": "예약 취소 방법은?",
        "answer": "마이페이지에서 취소 가능합니다."
      },
      {
        "key": "qa_001",  # ← 같은 key
        "question": "예약 취소는?",
        "answer": "앱에서 취소하세요."
      }
    ],
    "mode": "upsert"
  }'
```

**확인사항:**
- [ ] 응답: `{ "ok": true, "succeeded": 1, "failed": 0 }`
- [ ] DB: 데이터 1개만 존재 (덮어씀)
- [ ] 메시지: "✅ 1개 추가됨, 1개 수정됨"

---

#### 시나리오 6: POST 업로드 - 필수 필드 누락

**테스트 방법:**
```bash
curl -X POST http://localhost:3000/api/tools/bot-guide-answers \
  -d '{
    "data": [
      {
        "key": "qa_002",
        "question": "질문만 있음",
        # ← answer 필드 없음!
      }
    ]
  }'
```

**확인사항:**
- [ ] 응답: `{ "ok": true, "succeeded": 0, "failed": 1 }`
- [ ] 에러 배열: `{ "key": "qa_002", "error": "필수 필드 누락..." }`
- [ ] UI에 표시: "행 qa_002: answer 필드가 필요합니다"

---

#### 시나리오 7: POST 업로드 - 매우 큰 파일

**테스트 방법:**
```javascript
const largeData = {
  data: Array(100000).fill({
    key: "test",
    question: "a".repeat(1000),
    answer: "b".repeat(1000)
  })
};

await fetch('/api/tools/bot-guide-answers', {
  method: 'POST',
  body: JSON.stringify(largeData) // 10MB 초과
});
```

**확인사항:**
- [ ] HTTP 상태: 413 Payload Too Large
- [ ] 메시지: "파일 크기가 5MB를 초과합니다"
- [ ] 청크 업로드 지원 여부

---

## 🔒 보안 테스트

### SQL Injection

```sql
-- 테스트 쿼리
?q='; DELETE FROM BotGuideAnswer; --

-- 기대 결과
-- 데이터 삭제 안 됨, 특수문자가 이스케이프됨
```

**확인:**
- [ ] `contains` 함수가 자동 이스케이프하는가?
- [ ] 쿼리 파라미터 검증

---

### XSS (Cross-Site Scripting)

```html
<!-- 테스트 입력 -->
?q=<script>alert('XSS')</script>

<!-- 기대 결과 -->
<!-- 스크립트 실행 안 됨, HTML 이스케이프 -->
```

**확인:**
- [ ] `answer` 필드가 HTML로 렌더링되는가?
- [ ] DOMPurify 또는 자동 이스케이프 사용하는가?

---

### Path Traversal

```
GET /api/tools/bot-guide-answers/../../admin
```

**확인:**
- [ ] 경로 검증이 있는가?
- [ ] `key` 값 화이트리스트 검증

---

## 📊 성능 테스트

### 응답 시간

```javascript
// 측정
const start = performance.now();
const res = await fetch('/api/tools/bot-guide-answers?q=정책');
const end = performance.now();
console.log(`응답 시간: ${end - start}ms`);
```

| 시나리오 | 목표 | 한계 |
|---|---|---|
| 빈 검색 (page=1) | < 500ms | < 1000ms |
| 검색 (q="정책") | < 500ms | < 1000ms |
| 대량 페이지 (page=28) | < 1000ms | < 2000ms |
| POST 564개 | < 5초 | < 10초 |

---

### 메모리 누수

```javascript
// 페이지 전환 10회 반복
for (let i = 0; i < 10; i++) {
  performSearch("정책", "all", "all", i);
  await new Promise(r => setTimeout(r, 100));
}

// Chrome DevTools → Memory → Take Heap Snapshot
// 메모리 증가 확인
```

**확인:**
- [ ] 메모리 누수 없는가? (< 10MB 증가)
- [ ] 이전 검색 결과 GC되는가?

---

## 📱 UI/UX 테스트

### 반응형 디자인

| 해상도 | 테스트 항목 | 확인 |
|---|---|---|
| 375px (모바일) | 검색창, 필터 버튼, 결과 카드 | 레이아웃 깨지지 않는가? |
| 768px (태블릿) | 버튼 크기, 텍스트 읽기 | 터치 target ≥ 44px? |
| 1920px (데스크톱) | 여백, 컬럼 레이아웃 | 적절한가? |

---

### 접근성 (WCAG 2.1 AA)

```html
<!-- 스크린 리더 테스트 -->
<input aria-label="Q&A 검색" placeholder="질문 또는 답변으로 검색...">
<button aria-label="필터 토글">필터</button>
<button aria-label="페이지 2로 이동">2</button>
```

**확인:**
- [ ] 모든 요소에 `aria-label` 있는가?
- [ ] 색상 대비 ≥ 4.5:1인가?
- [ ] 포커스 표시자 있는가?
- [ ] 키보드 네비게이션 가능한가? (Tab, Enter, Esc)

---

### 시각적 피드백

- [ ] 로딩 중: 회전하는 스피너 + "검색 중..." 텍스트
- [ ] 에러: 빨간 배너 + 아이콘 + "문제 설명"
- [ ] 성공: 초록 체크 + "완료" (또는 자동 닫음)
- [ ] 비활성 버튼: 회색 + 커서 `not-allowed`

---

## 🧪 통합 테스트 (Playwright)

### 테스트 1: 정상 검색 흐름

```typescript
import { test, expect } from '@playwright/test';

test('정상 검색 흐름', async ({ page }) => {
  await page.goto('http://localhost:3000/tools');
  
  // 1. 검색창에 입력
  await page.fill('input[placeholder="질문 또는 답변으로 검색..."]', '정책');
  
  // 2. 자동 검색 (엔터 안 누르고)
  await page.waitForLoadState('networkidle');
  
  // 3. 결과 확인
  const results = page.locator('[data-testid="qa-card"]');
  await expect(results).toHaveCount(20); // 또는 그 이상
  
  // 4. 카테고리 필터 클릭
  await page.click('button:has-text("정책&수수료")');
  await page.waitForLoadState('networkidle');
  
  // 5. 톤 필터 선택
  await page.click('button:has-text("친근")');
  await page.waitForLoadState('networkidle');
  
  // 6. 페이지 2로 이동
  await page.click('button:has-text("2")');
  await page.waitForLoadState('networkidle');
  
  // 7. URL 확인
  await expect(page).toHaveURL(/page=2/);
});
```

---

### 테스트 2: 에러 처리 (네트워크 오류)

```typescript
test('네트워크 오류 처리', async ({ page, context }) => {
  await page.goto('http://localhost:3000/tools');
  
  // 네트워크 오프라인 설정
  await context.setOffline(true);
  
  // 검색 요청
  await page.fill('input[placeholder*="검색"]', '정책');
  await page.waitForTimeout(2000);
  
  // 에러 메시지 확인
  await expect(page.locator('[role="alert"]')).toContainText('인터넷 연결');
  
  // 온라인 복구
  await context.setOffline(false);
  
  // 재시도 버튼 클릭
  await page.click('button:has-text("다시 시도")');
  await page.waitForLoadState('networkidle');
  
  // 결과 표시 확인
  await expect(page.locator('[data-testid="qa-card"]')).toHaveCount(20);
});
```

---

### 테스트 3: 모달 상호작용

```typescript
test('Q&A 상세 모달', async ({ page }) => {
  await page.goto('http://localhost:3000/tools');
  
  // 결과 대기
  await page.waitForSelector('[data-testid="qa-card"]');
  
  // 첫 번째 카드 클릭
  await page.click('[data-testid="qa-card"]');
  
  // 모달 열림 확인
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  // 내용 확인
  const question = await page.locator('[data-testid="modal-question"]').textContent();
  expect(question?.length).toBeGreaterThan(10);
  
  // ESC로 닫기
  await page.keyboard.press('Escape');
  
  // 모달 닫힘 확인
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
```

---

## 📋 수동 QA 체크리스트 (최종 확인)

```
[ ] 기능 검증
  [ ] 빈 검색 후 전체 564개 중 20개 표시되는가?
  [ ] 카테고리 8개 모두 선택 가능한가?
  [ ] 톤 7개 모두 선택 가능한가?
  [ ] 검색 후 '총 OOO개 중 OOO~OOO개 표시' 정확한가?
  [ ] 페이지 번호 클릭 시 데이터 바뀌는가?
  [ ] 이전/다음 버튼이 적절히 활성화/비활성화되는가?

[ ] 에러 처리
  [ ] 에러 메시지 색상/아이콘 눈에 띄는가?
  [ ] 재시도 버튼이 있고 작동하는가?
  [ ] 오류 메시지가 사용자 친화적인가?

[ ] 로딩 상태
  [ ] 로딩 중 아이콘이 회전하는가?
  [ ] '검색 중...' 텍스트가 표시되는가?
  [ ] 로딩 시간이 너무 길지 않은가? (< 3초)

[ ] 모달
  [ ] 모달 열려있을 때 배경 스크롤 막혀있는가?
  [ ] ESC 키로 닫혀지는가?
  [ ] 배경 어둡게 처리되는가?

[ ] 반응형
  [ ] 모바일(375px)에서 레이아웃 깨지지 않는가?
  [ ] 태블릿(768px)에서 버튼 크기 적절한가?
  [ ] 데스크톱(1920px)에서 여백 균형잡혀있는가?

[ ] 접근성
  [ ] 스크린 리더기로 '검색', '필터', '결과' 모두 읽혀지는가?
  [ ] 키보드만으로 모든 기능 사용 가능한가? (Tab, Enter, Esc)
  [ ] 색상 대비가 충분한가? (검은색/회색/흰색)

[ ] 텍스트
  [ ] 매우 긴 question/answer 텍스트 말줄임 처리되는가?
  [ ] 특수문자(&, <, >) 이스케이프되는가?
  [ ] 이모지가 깨지지 않는가?

[ ] 성능
  [ ] 속도: 검색 응답 시간 < 2초인가?
  [ ] 속도: 페이지 로드 시간 < 3초인가?
  [ ] 페이지 전환 후 메모리 누수 없는가?

[ ] UX
  [ ] 페이지 스크롤 시 '맨위로' 버튼 나타나는가?
  [ ] 결과 없을 때 안내 메시지 표시되는가?
  [ ] 필터 활성 개수 배지가 정확한가?
  [ ] 검색어 강조 표시되는가?
```

---

## 🚀 버그 리포트 템플릿

```markdown
### 버그 제목
[UI/API/성능] 버그 설명

### 재현 단계
1. ...
2. ...
3. ...

### 예상 결과
...

### 실제 결과
...

### 스크린샷/비디오
[첨부]

### 환경
- 브라우저: Chrome 130.0
- 운영체제: macOS 14.6
- 해상도: 1440x900

### 심각도
- [ ] P0 (긴급 - 기능 불가)
- [ ] P1 (높음 - 사용성 저하)
- [ ] P2 (중간 - 개선 사항)
```

---

## 📈 테스트 결과 요약

**테스트 실행일**: _______________

| 항목 | P0 | P1 | P2 | 합계 |
|---|---|---|---|---|
| 통과 | _ | _ | _ | _ |
| 실패 | _ | _ | _ | _ |
| 건너뜀 | _ | _ | _ | _ |
| 성공률 | __% | __% | __% | __% |

**주요 이슈**:
- [ ] (1번) ...
- [ ] (2번) ...

**대응 예정일**: _______________

---

**작성자**: ________________  
**검토자**: ________________  
**승인자**: ________________
