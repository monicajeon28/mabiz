# Menu #28 Wave 2 작업지시서 — P1 24개 이슈 해결
**상태**: 🔄 4개 에이전트 병렬 무한루프  
**기간**: 3-4일 추정  
**목표**: 10렌즈 점수 4.8/10 → 6.5/10 (배포기준 7.5/10)  
**방법론**: 절대법칙 (각 에이전트 독립 Phase 진행)

---

## 🎯 Wave 2 개요

### P1 이슈 24개 분류
| 렌즈 | 이슈수 | 트랙 | 에이전트 |
|-----|-------|------|--------|
| 🚨 에러처리 | 4개 | A | α |
| 📦 확장성 | 3개 | B | β |
| ♿ 접근성 | 3개 | C | γ |
| ⚡ 성능 | 2개 | D | δ |
| 🎨 UX | 4개 | A+B | α+β |
| 🔧 유지보수 | 2개 | B+C | β+γ |
| 📝 보안 | 2개 | A | α |
| 🌐 호환성 | 2개 | D | δ |

### 파일 분담 (충돌 방지)

```
src/app/(dashboard)/messages/page.tsx
├─ Track A (α): 에러처리 로직 + UX 메시지
├─ Track B (β): 컴포넌트 분리 지점 + 상태관리
├─ Track C (γ): ARIA 속성 추가
└─ Track D (δ): 메모이제이션 + useCallback

src/components/messages/
├─ SmsTab.tsx (신규, β 생성)
├─ EmailTab.tsx (신규, β 생성)
├─ ReviewTab.tsx (수정, γ 접근성)
└─ BlastPanel.tsx (수정, γ+δ 접근성+성능)
```

---

## 🔴 Track A (α): 에러처리 강화 — P1-E2/E3/E4 + P1-S4/S5

**담당**: Agent α  
**파일**: `src/app/(dashboard)/messages/page.tsx` (에러처리 섹션)  
**목표**: 네트워크 오류 구분, 부분실패 재시도, 입력검증

### 작업 1: P1-E2 부분실패 처리 (90분)
**위치**: `page.tsx` ~ 320줄 근처 (doSend 함수)  
**현재 (WRONG)**:
```typescript
// 현재: 발송 완료 후 failedCount 표시만 함
const result = await fetch(`/api/groups/${selectedGroup}/blast`, {
  method: 'POST',
  body: JSON.stringify({ message: blastMsg }),
});
if (result.ok) {
  const data = await result.json();
  setBlastResult(data);  // { sentCount, failedCount, blockedCount }
}
```

**요구사항**:
1. failedCount > 0일 때 사용자에게 **재시도 옵션** 제공
2. 재시도 UI: 빨간 재시도 버튼 + "X명 재전송하시겠습니까?"
3. 최대 3회까지 재시도 가능
4. 재시도 결과 통계 누적 표시

**구현**:
```typescript
// doSend 함수 수정
const [retryCount, setRetryCount] = useState(0);

const handleRetry = async () => {
  if (retryCount >= 3) {
    setBlastError("최대 재시도 횟수(3회)를 초과했습니다");
    return;
  }
  
  setBlastError(null);
  setBlasting(true);
  
  try {
    const response = await fetch(`/api/groups/${selectedGroup}/blast-retry`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        failedCustomerIds: blastResult.failedIds,  // API에서 추가 반환 필요
      }),
    });
    
    if (response.ok) {
      const retryData = await response.json();
      setBlastResult(prev => ({
        ...prev,
        sentCount: prev.sentCount + retryData.sentCount,
        failedCount: retryData.failedCount,
        blockedCount: prev.blockedCount + retryData.blockedCount,
      }));
      setRetryCount(prev => prev + 1);
    } else if (response.status === 429) {
      setBlastError("일일 발송 제한을 초과했습니다");
    }
  } catch (err) {
    logger.error("[SMS] retry failed", { err });
    setBlastError(getErrorMessage(err, "[재시도]"));
  } finally {
    setBlasting(false);
  }
};
```

**UI 수정** (BlastPanel.tsx):
```typescript
// 발송 결과 화면에 재시도 버튼 추가
{blastResult && blastResult.failedCount > 0 && (
  <button
    onClick={handleRetry}
    disabled={retryCount >= 3 || blasting}
    className="w-full py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
  >
    {blasting ? '재전송 중...' : `🔄 ${blastResult.failedCount}명 재전송 (${retryCount}/3)`}
  </button>
)}
```

**테스트**:
- [ ] 발송 후 1명 실패 → 재시도 버튼 표시
- [ ] 재시도 3회 초과 → 버튼 비활성화
- [ ] 각 재시도 후 통계 누적

---

### 작업 2: P1-E3 네트워크 오류 미구분 (60분)
**위치**: `page.tsx` 전체 (모든 fetch 호출)  
**현재 (WRONG)**:
```typescript
// 현재: 모든 에러를 동일하게 처리
catch (err) {
  setBlastError("오류가 발생했습니다");  // 원인 불명
}
```

**요구사항**:
- `ERR_NETWORK` → "네트워크 연결을 확인해주세요"
- `timeout` (15초 초과) → "요청이 타임아웃되었습니다. 다시 시도해주세요"
- `400/422` → "입력값을 확인해주세요" (필드 하이라이트)
- `401` → "재로그인 필요"
- `429` → "일일 발송 제한을 초과했습니다. 내일 HH:MM부터 가능합니다"
- `500+` → "서버 오류입니다. 잠시 후 다시 시도해주세요"

**구현** (src/lib/error-messages.ts 수정):
```typescript
export function getErrorMessage(err: any, context: string): string {
  // 기존 함수 확장
  
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return `${context} 네트워크 연결을 확인해주세요`;
  }
  
  if (err.name === 'AbortError') {
    return `${context} 요청이 타임아웃되었습니다. 다시 시도해주세요`;
  }
  
  // ... 기타 케이스
}

// 새 함수: 타이머 기반 timeout
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = 15000, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    return await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
```

**적용** (page.tsx 수정):
```typescript
// 모든 fetch 호출을 fetchWithTimeout으로 변경
const response = await fetchWithTimeout('/api/groups', {
  timeout: 15000,
  headers: { 'X-CSRF-Token': csrfToken },
});
```

**테스트**:
- [ ] 네트워크 끊음 → "네트워크 연결" 메시지
- [ ] 15초 이상 요청 → "타임아웃" 메시지
- [ ] 429 응답 → Rate limit 메시지 (시간 포함)

---

### 작업 3: P1-E4 SMS 설정 없을 때 UI 개선 (45분)
**위치**: `page.tsx` ~ 150줄 (smsConfigured 체크)  
**현재 (WRONG)**:
```typescript
// 현재: 경고만 표시, 설정 폼 제공 안 함
{!smsConfigured && (
  <p className="text-yellow-600">⚠️ SMS 설정이 필요합니다. 
    <a href="/settings">설정으로 이동</a>
  </p>
)}
```

**요구사항**:
- 현재 페이지 내 inline 설정 폼 제공 (설정 페이지 이동 X)
- 폼: 알리고 API Key + Sender ID
- 저장 후 자동으로 SMS 탭 활성화
- 실패 시 에러 메시지

**구현**:
```typescript
// 새 상태
const [showSmsSetup, setShowSmsSetup] = useState(false);
const [smsApiKey, setSmsApiKey] = useState('');
const [smsSenderId, setSmsSenderId] = useState('');
const [setupLoading, setSetupLoading] = useState(false);

// 저장 함수
const handleSaveSmsConfig = async () => {
  if (!smsApiKey.trim() || !smsSenderId.trim()) {
    setBlastError("API Key와 발신번호를 입력해주세요");
    return;
  }
  
  setSetupLoading(true);
  try {
    const response = await fetchWithTimeout('/api/user/sms-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ apiKey: smsApiKey, senderId: smsSenderId }),
    });
    
    if (response.ok) {
      setSmsConfigured(true);
      setShowSmsSetup(false);
      setSmsApiKey('');
      setBlastError(null);
    } else {
      const data = await response.json();
      setBlastError(data.message || "설정 저장 실패");
    }
  } catch (err) {
    logger.error("[SMS] config save failed", { err });
    setBlastError(getErrorMessage(err, "[SMS 설정]"));
  } finally {
    setSetupLoading(false);
  }
};

// UI
{!smsConfigured && !showSmsSetup && (
  <button
    onClick={() => setShowSmsSetup(true)}
    className="w-full py-3 bg-yellow-50 border-2 border-yellow-300 text-yellow-700 rounded-lg font-medium hover:bg-yellow-100"
  >
    ⚙️ SMS 설정하기
  </button>
)}

{showSmsSetup && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
    <p className="font-semibold text-yellow-800">SMS 설정</p>
    <input
      type="password"
      placeholder="알리고 API Key"
      value={smsApiKey}
      onChange={(e) => setSmsApiKey(e.target.value)}
      className="w-full border border-yellow-200 rounded px-3 py-2 text-sm"
    />
    <input
      type="text"
      placeholder="발신번호 (예: 01012345678)"
      value={smsSenderId}
      onChange={(e) => setSmsSenderId(e.target.value)}
      className="w-full border border-yellow-200 rounded px-3 py-2 text-sm"
    />
    <div className="flex gap-2">
      <button
        onClick={handleSaveSmsConfig}
        disabled={setupLoading || !smsApiKey.trim() || !smsSenderId.trim()}
        className="flex-1 bg-yellow-600 text-white py-2 rounded font-medium hover:bg-yellow-700 disabled:opacity-50"
      >
        {setupLoading ? '저장 중...' : '저장'}
      </button>
      <button
        onClick={() => setShowSmsSetup(false)}
        className="flex-1 border border-gray-300 text-gray-600 py-2 rounded hover:bg-gray-50"
      >
        취소
      </button>
    </div>
  </div>
)}
```

**테스트**:
- [ ] SMS 미설정 → "설정하기" 버튼 표시
- [ ] 버튼 클릭 → inline 폼 표시
- [ ] API Key 빈 값 → 저장 불가
- [ ] 유효한 값 입력 → SMS 탭 활성화

---

### 작업 4: P1-S4/S5 입력검증 강화 (60분)
**위치**: `page.tsx` 메시지 textarea + 기타 입력

**P1-S4: textarea 정규식 검증 (현재 미검증)**
```typescript
// 현재 (WRONG)
<textarea
  value={blastMsg}
  onChange={(e) => onMsgChange(e.target.value)}
/>  // 특수문자/이모지 제약 없음
```

**P1-S5: 민감정보 노출 (localStorage에 알리고 키 저장)**
```typescript
// 현재 (WRONG)
localStorage.setItem('aligoApiKey', apiKey);  // 평문 저장!
```

**구현**:
```typescript
// 1. 텍스트 검증 함수
function validateMessage(msg: string): { valid: boolean; error?: string } {
  if (!msg.trim()) return { valid: false, error: "메시지를 입력해주세요" };
  
  if (msg.length > 1000) {
    return { valid: false, error: "메시지는 1000자 이하여야 합니다" };
  }
  
  // 금지 문자/패턴
  const forbiddenPatterns = [
    /javascript:/i,
    /on\w+\s*=/i,  // onload=, onclick= 등
    /<script/i,
    /[<>{}]/,      // HTML/JS 문자
  ];
  
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(msg)) {
      return {
        valid: false,
        error: "사용할 수 없는 문자가 포함되어 있습니다",
      };
    }
  }
  
  return { valid: true };
}

// 2. 입력 변경 시 검증
const handleMsgChange = (msg: string) => {
  const { valid, error } = validateMessage(msg);
  if (!valid) {
    setInputError(error);
  } else {
    setInputError(null);
  }
  onMsgChange(msg);
};

// 3. localStorage 사용 금지 → 서버 세션 저장
// SMS 설정 저장 시 클라이언트 저장 X
// API `/api/user/sms-config` GET → 서버에서 마스킹된 정보만 반환
// API 응답: { configured: true, maskedApiKey: "***-***-1234" }

// UI
{inputError && (
  <p className="text-red-600 text-sm">{inputError}</p>
)}
```

**테스트**:
- [ ] `<script>` 포함 → 검증 실패
- [ ] `javascript:` 포함 → 검증 실패
- [ ] 정상 메시지 → 검증 성공
- [ ] localStorage에 API Key 저장 X 확인 (개발자 도구)

---

## 🟦 Track B (β): 컴포넌트 분리 — P1-E1/E2 + UX 개선

**담당**: Agent β  
**파일**: 신규 컴포넌트 + `src/app/(dashboard)/messages/page.tsx` 수정  
**목표**: 597줄 → 300줄로 축소, SMS/Email 탭별 독립 관리

### 작업 1: SmsTab.tsx 추출 (3시간)
**신규 파일**: `src/components/messages/SmsTab.tsx`

**구조**:
```typescript
interface SmsTabProps {
  selectedGroup: string | null;
  groups: Group[];
  onGroupChange: (id: string) => void;
  blastMsg: string;
  onMsgChange: (msg: string) => void;
  blastPreview: BlastPreview | null;
  onCheckBlast: () => void;
  checkingBlast: boolean;
  onSendBlast: () => void;
  blasting: boolean;
  blastResult: BlastResult | null;
  blastConfirm: boolean;
  onConfirmChange: (confirm: boolean) => void;
  blastError: string | null;
  onClose: () => void;
}

export function SmsTab({
  selectedGroup,
  groups,
  onGroupChange,
  // ... 기타 props
}: SmsTabProps) {
  return (
    <div className="space-y-3">
      {/* 그룹 선택 */}
      {/* BlastPanel (메시지 입력, 확인, 발송) */}
      {/* 발송 결과 */}
    </div>
  );
}
```

**포함 요소**:
- 그룹 선택 드롭다운
- BlastPanel 컴포넌트 (기존 사용)
- 발송 결과 표시

**테스트**:
- [ ] 그룹 선택 후 메시지 입력 가능
- [ ] dry-run 버튼 클릭 가능
- [ ] 발송 완료 시 통계 표시

---

### 작업 2: EmailTab.tsx 추출 (2시간)
**신규 파일**: `src/components/messages/EmailTab.tsx`

**구조**:
```typescript
interface EmailTabProps {
  selectedGroup: string | null;
  groups: Group[];
  onGroupChange: (id: string) => void;
  emailSubject: string;
  onSubjectChange: (subject: string) => void;
  emailBody: string;
  onBodyChange: (body: string) => void;
  emailScheduleTime: string;
  onScheduleTimeChange: (time: string) => void;
  // ... dry-run, send, result props
}

export function EmailTab({ ... }: EmailTabProps) {
  return (
    <div className="space-y-3">
      {/* 그룹 선택 */}
      {/* 제목 입력 */}
      {/* 본문 편집기 (리치텍스트 또는 마크다운) */}
      {/* 발송 시간 선택 (기본값: 현재+1분) */}
      {/* dry-run 및 발송 */}
    </div>
  );
}
```

**추가 기능**:
- 이메일 발송 시간 선택 (기본값: 현재+1분)
- 리치 에디터 또는 마크다운 지원
- 미리보기 (subject + body)

**테스트**:
- [ ] 제목/본문 입력 가능
- [ ] 발송 시간 기본값 설정
- [ ] dry-run 후 발송 가능

---

### 작업 3: page.tsx 리펙토링 (1.5시간)
**수정 파일**: `src/app/(dashboard)/messages/page.tsx`

**변경 목표**: 597줄 → 200-250줄 (탭 라우터 역할만)

**구조**:
```typescript
'use client';

import { SmsTab } from '@/components/messages/SmsTab';
import { EmailTab } from '@/components/messages/EmailTab';
import { ReviewTab } from '@/components/messages/ReviewTab';

export default function MessagesPage() {
  // 공유 상태 정의 (전체 탭이 사용)
  const [selectedTab, setSelectedTab] = useState<'sms' | 'email'>('sms');
  const [csrfToken, setCsrfToken] = useState('');
  const [userRole, setUserRole] = useState<'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES'>();
  const [groups, setGroups] = useState<Group[]>([]);
  
  // SMS 상태
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [blastMsg, setBlastMsg] = useState('');
  const [blastPreview, setBlastPreview] = useState<BlastPreview | null>(null);
  // ... 기타 SMS 상태
  
  // Email 상태
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailScheduleTime, setEmailScheduleTime] = useState('');
  // ... 기타 Email 상태
  
  // 초기화 & 공통 함수들
  useEffect(() => { /* CSRF 토큰 로드 */ }, []);
  useEffect(() => { /* 사용자 역할 로드 */ }, []);
  useEffect(() => { /* 그룹 로드 */ }, []);
  
  const doDryRun = async () => { /* dry-run 공통 로직 */ };
  const doSend = async () => { /* 발송 공통 로직 */ };
  
  return (
    <div className="space-y-4">
      {/* 탭 버튼 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab('sms')}
          className={`px-4 py-2 font-medium border-b-2 ${
            selectedTab === 'sms'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          📱 문자
        </button>
        <button
          onClick={() => setSelectedTab('email')}
          className={`px-4 py-2 font-medium border-b-2 ${
            selectedTab === 'email'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          ✉️ 이메일
        </button>
      </div>
      
      {/* 탭 컨텐츠 */}
      {selectedTab === 'sms' && (
        <SmsTab
          selectedGroup={selectedGroup}
          groups={groups}
          onGroupChange={setSelectedGroup}
          blastMsg={blastMsg}
          onMsgChange={setBlastMsg}
          blastPreview={blastPreview}
          onCheckBlast={doDryRun}
          checkingBlast={checkingBlast}
          onSendBlast={doSend}
          blasting={blasting}
          blastResult={blastResult}
          blastConfirm={blastConfirm}
          onConfirmChange={setBlastConfirm}
          blastError={blastError}
          onClose={handleClose}
        />
      )}
      
      {selectedTab === 'email' && (
        <EmailTab
          selectedGroup={selectedGroup}
          groups={groups}
          onGroupChange={setSelectedGroup}
          emailSubject={emailSubject}
          onSubjectChange={setEmailSubject}
          emailBody={emailBody}
          onBodyChange={setEmailBody}
          emailScheduleTime={emailScheduleTime}
          onScheduleTimeChange={setEmailScheduleTime}
          // ... 기타 props
        />
      )}
      
      {/* 검토 탭 (관리자/지사장용) */}
      {(userRole === 'GLOBAL_ADMIN' || userRole === 'OWNER') && (
        <ReviewTab
          message={selectedTab === 'sms' ? blastMsg : emailSubject}
          selectedGroup={selectedGroup}
          groups={groups}
        />
      )}
    </div>
  );
}
```

**테스트**:
- [ ] SMS 탭 전환 가능
- [ ] Email 탭 전환 가능
- [ ] 각 탭 상태 독립 유지 (탭 전환 후 복귀 시 이전 값 유지)
- [ ] 관리자만 ReviewTab 표시

---

### 작업 4: P1-U2/U3/U4 UX 개선 (1시간)

**P1-U2: 에러 메시지 구체화**
```typescript
// 현재 (WRONG)
throw new Error("입력 오류");

// 수정
throw new Error("사용할 수 없는 문자: @, #, &");
```

**P1-U3: 로딩 상태 + 스켈레톤**
```typescript
// 그룹 로드 시 스켈레톤 표시
{loadingGroups && (
  <div className="space-y-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
    ))}
  </div>
)}
```

**P1-U4: 200명 초과 경고**
```typescript
// BlastPanel에 이미 표시: "⚠️ 200명 초과 — 첫 200명만 발송됩니다"
```

---

## 🟩 Track C (γ): 접근성 개선 — P1-A1/A2/A3

**담당**: Agent γ  
**파일**: ReviewTab.tsx, BlastPanel.tsx, SmsTab.tsx, EmailTab.tsx  
**목표**: WCAG 2.1 AA 준수

### 작업 1: aria-label 추가 (1시간)

**모든 버튼, 아이콘에 aria-label 추가**:
```typescript
// 탭 버튼
<button
  onClick={() => setSelectedTab('sms')}
  aria-label="문자 메시지 탭 선택"
  aria-selected={selectedTab === 'sms'}
  role="tab"
  className={...}
>
  📱 문자
</button>

// 건물 상세 버튼
<button
  onClick={() => setShowDetails(!showDetails)}
  aria-label="그룹 상세 정보 표시"
  aria-expanded={showDetails}
  className={...}
>
  ▼
</button>

// 발송 버튼
<button
  onClick={doSend}
  aria-label={`${blastPreview?.willSend}명에게 문자 발송`}
  disabled={!blastConfirm || blasting}
  className={...}
>
  ✓ 발송
</button>
```

### 작업 2: label-input 연결 (45분)

**현재 (WRONG)**:
```typescript
<p>메시지</p>
<textarea ... />  // label 연결 X
```

**수정**:
```typescript
<label htmlFor="sms-message" className="block font-medium text-gray-700 mb-2">
  📄 메시지
</label>
<textarea
  id="sms-message"
  aria-label="발송 메시지"
  placeholder="..."
  className={...}
/>
```

**적용**:
- 그룹 선택 `<select>`
- 메시지 textarea (SMS)
- 이메일 제목 input
- 이메일 본문 textarea
- 발신 시간 input[type=datetime-local]

### 작업 3: 색상 대비 개선 (30분)

**현재 (WRONG)**:
```typescript
<p className="text-gray-400">기본 팁</p>  // 대비 부족 (WCAG fail)
```

**수정** (WCAG AA 최소 4.5:1 대비):
```typescript
<p className="text-gray-600">기본 팁</p>  // 더 어두운 회색

// 오류 메시지
<p className="text-red-700">⚠️ {error}</p>  // 더 진한 빨강

// 성공 메시지
<p className="text-green-700">✅ {success}</p>  // 더 진한 초록
```

**검사**:
- [ ] WebAIM Contrast Checker로 모든 텍스트 대비 확인
- [ ] 최소 4.5:1 (일반 텍스트) 또는 3:1 (큰 텍스트)

---

## 🟨 Track D (δ): 성능 최적화 — P1-P1/P2 + 호환성

**담당**: Agent δ  
**파일**: `src/app/(dashboard)/messages/page.tsx`, `src/components/messages/*`  
**목표**: 불필요한 re-render 제거, 메모이제이션

### 작업 1: useEffect 의존성 배열 수정 (60분)

**P1-P1: 무한 re-fetch (의존성 배열 누락)**

**현재 (WRONG)**:
```typescript
useEffect(() => {
  fetch('/api/groups')
    .then(r => r.json())
    .then(d => setGroups(d.groups));
  // 의존성 배열 없음 → 매 렌더마다 실행!
});
```

**수정**:
```typescript
useEffect(() => {
  if (!csrfToken) return;  // 토큰 대기
  
  const loadGroups = async () => {
    try {
      const response = await fetchWithTimeout('/api/groups', {
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      }
    } catch (err) {
      logger.error("[Messages] load groups failed", { err });
      setBlastError(getErrorMessage(err, "[그룹 로드]"));
    }
  };
  
  loadGroups();
}, [csrfToken]);  // csrfToken만 의존성으로

// User role 로드
useEffect(() => {
  // ...
}, []);  // 한 번만 실행
```

### 작업 2: useMemo 추가 (60분)

**P1-P2: 리스트 메모이제이션 부재**

```typescript
// 1. 그룹 필터링 (검색 추가 시)
const filteredGroups = useMemo(() => {
  return groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [groups, searchTerm]);

// 2. 그룹 선택 옵션
const groupOptions = useMemo(() => {
  return groups.map(g => (
    <option key={g.id} value={g.id}>
      {g.name} ({g.customerCount}명)
    </option>
  ));
}, [groups]);

// 3. 각 탭의 props 객체 (객체 참조 변경 방지)
const smsTabProps = useMemo(() => ({
  selectedGroup,
  groups,
  onGroupChange: setSelectedGroup,
  blastMsg,
  onMsgChange: setBlastMsg,
  // ... 기타
}), [selectedGroup, groups, blastMsg, /* 기타 의존성 */]);

return (
  <>
    {selectedTab === 'sms' && <SmsTab {...smsTabProps} />}
    {selectedTab === 'email' && <EmailTab {...emailTabProps} />}
  </>
);
```

### 작업 3: useCallback 추가 (45분)

```typescript
// 콜백 함수를 useCallback으로 래핑
const handleGroupChange = useCallback((groupId: string) => {
  setSelectedGroup(groupId);
  setBlastPreview(null);
  setBlastResult(null);
  setBlastConfirm(false);
}, []);

const handleMsgChange = useCallback((msg: string) => {
  setBlastMsg(msg);
  // 입력검증
  const { valid, error } = validateMessage(msg);
  setInputError(valid ? null : error);
}, []);

const handleCheckBlast = useCallback(async () => {
  // dry-run 로직
  // ...
}, [selectedGroup, blastMsg, csrfToken]);

// 자식 컴포넌트에 전달
<SmsTab
  onGroupChange={handleGroupChange}
  onMsgChange={handleMsgChange}
  onCheckBlast={handleCheckBlast}
  // ...
/>
```

### 작업 4: 불필요한 상태 제거 (45분)

**분석**: 어떤 상태가 불필요한가?
- `loadingGroups` → `groups.length === 0` 으로 대체 가능?
  - 아니오: 실제 로딩 중인지 구분 필요 (유지)
- `inputError` → state로 관리할 필요 없이 실시간 계산?
  - 가능: 메시지 입력 시마다 validateMessage() 호출 후 렌더링
  - 변경: 상태 제거, 렌더링 시 `validateMessage(blastMsg).error` 사용

```typescript
// 제거
// const [inputError, setInputError] = useState(null);

// 렌더링 시
const inputError = useMemo(
  () => validateMessage(blastMsg).error,
  [blastMsg]
);

{inputError && <p className="text-red-600 text-sm">{inputError}</p>}
```

### 작업 5: datetime-local 호환성 (30분 - P2-호환성)

**현재 (WRONG)**:
```typescript
<input
  type="datetime-local"
  value={emailScheduleTime}
/>  // Safari/IE에서 지원 X
```

**수정** (Polyfill):
```typescript
// 1. datetime-local 지원 확인
const supportsDatetimeLocal = () => {
  const input = document.createElement('input');
  input.type = 'datetime-local';
  return input.type === 'datetime-local';
};

// 2. Fallback UI
{supportsDatetimeLocal() ? (
  <input type="datetime-local" {...props} />
) : (
  <>
    <input type="date" {...dateProps} />
    <input type="time" {...timeProps} />
  </>
)}
```

---

## 🔗 4개 트랙 병렬 실행 규칙

### 1️⃣ 파일 분담 명확화
```
page.tsx
├─ 줄 1-50: 상태관리 (모든 트랙 공유)
├─ 줄 51-150: useEffect (α: 에러처리, δ: 의존성배열)
├─ 줄 151-250: 함수들 (α: 에러처리, δ: useCallback/useMemo)
├─ 줄 251-400: JSX - 렌더링 (β: 컴포넌트 분리, γ: aria속성, δ: 메모이제이션)
└─ 줄 400+: 추가 로직

components/messages/
├─ SmsTab.tsx (신규, β 생성)
├─ EmailTab.tsx (신규, β 생성)
├─ ReviewTab.tsx (기존, γ 수정: aria-label)
├─ BlastPanel.tsx (기존, α: 에러처리, γ: aria, δ: 메모이제이션)
└─ ...
```

### 2️⃣ Git 커밋 순서
```
Track A (α) → Track B (β) → Track C (γ) → Track D (δ)
```
각 트랙 완료 후 1개 커밋 생성:
- `feat(messages): Wave 2-A 에러처리 강화`
- `feat(messages): Wave 2-B 컴포넌트 분리`
- `feat(messages): Wave 2-C 접근성 개선`
- `feat(messages): Wave 2-D 성능 최적화`

### 3️⃣ 충돌 방지
- 같은 파일 수정 시 라인 범위 분담
- page.tsx: 상태관리는 공유, 함수/JSX는 트랙별 영역
- 다른 파일은 각 트랙 독립

### 4️⃣ 검증
- 빌드 실패 시 해당 에이전트 재작업
- 타입 에러 → TypeScript 타입 추가
- 런타임 에러 → try-catch 강화

---

## ✅ Wave 2 완료 기준

| 항목 | 기준 |
|-----|------|
| **P1 이슈** | 24개 모두 해결 |
| **10렌즈** | 4.8 → 6.5 이상 |
| **코드 품질** | TypeScript strict, no console.error |
| **테스트** | 모든 UX 흐름 수동 테스트 완료 |
| **커밋** | 4개 커밋 생성 |
| **배포 준비도** | 60% |

---

## 📝 다음 단계

**Phase 3 Wave 3**: P2 10개 이슈 (Lazy loading, 추적기능, A/B테스트)

---

_생성: 2026-05-23_  
_방법론: 절대법칙 (4 에이전트 병렬 무한루프)_

