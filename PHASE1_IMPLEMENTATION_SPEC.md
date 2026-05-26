# Phase 1 구현 명세 (Messages + SMS-Logs A/B 분석)

## 📋 개요

**기간**: 2주 (2026-05-27 ~ 2026-06-10)
**목표**: Messages 페이지 Kakao 채널 + A/B 테스트 선택 + SMS-Logs A/B 분석 페이지
**기대 효과**: +5% 응답율, 캠페인 다양성 증대, 우승 메시지 자동화

---

## 파일 1: Messages 페이지 Kakao 채널 추가

### 파일 위치
```
src/app/(dashboard)/messages/page.tsx
```

### 변경 사항

#### 1.1 상태 추가 (line 54-96)
```typescript
// 기존
const [tab, setTab] = useState<"sms" | "email">("sms");

// 변경
type Tab = "sms" | "email" | "kakao";
const [tab, setTab] = useState<Tab>("sms");

// Kakao 탭 관련 상태
const [kakaoConfig, setKakaoConfig] = useState<{
  senderKey: string;
  templates: Array<{ code: string; name: string }>;
} | null>(null);
const [selectedTplCode, setSelectedTplCode] = useState("");
const [kakaoButtons, setKakaoButtons] = useState<Array<{
  text: string;
  type: "YL" | "DS" | "WL" | "AC";  // Aligo button types
  value: string;
}>>([]);
```

#### 1.2 탭 버튼 수정 (line 61-70)
```typescript
// 기존 구조 유지, 새 탭 추가

<button onClick={() => setTab("kakao")}
  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all 
    ${tab === "kakao" ? "bg-white shadow text-green-600" : "text-gray-500 hover:text-gray-700"}`}>
  <MessageCircle className="w-4 h-4" /> 카카오톡
</button>
```

#### 1.3 탭 렌더링 추가 (line 72-74)
```typescript
{tab === "sms"   && <SmsTab />}
{tab === "email" && <EmailTab />}
{tab === "kakao" && <KakaoTab />}  // ← 추가
```

#### 1.4 Kakao 설정 로드 (새 useEffect)
```typescript
// SmsTab 내부의 useEffect와 유사한 구조
useEffect(() => {
  fetch("/api/settings/kakao-config")
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        setKakaoConfig(d.config);
      }
    })
    .catch(() => { /* silently fail */ });
}, []);
```

#### 1.5 KakaoTab 컴포넌트 추가 (새 함수)

**길이**: ~400줄

```typescript
function KakaoTab() {
  const [kakaoConfig, setKakaoConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedTplCode, setSelectedTplCode] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState<Array<{
    id: string;
    text: string;
    type: "YL" | "DS" | "WL" | "AC";
    value: string;
  }>>([]);
  const [dryRunResult, setDryRunResult] = useState<{ count: number; sample: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  // 초기화
  useEffect(() => {
    fetch("/api/csrf-token")
      .then(r => r.json())
      .then(d => { if (d.ok && d.token) setCsrfToken(d.token); });
    
    fetch("/api/settings/kakao-config")
      .then(r => r.json())
      .then(d => { if (d.ok) setKakaoConfig(d.config); })
      .finally(() => setConfigLoading(false));
    
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => { if (d.ok) setGroups(d.groups ?? []); });
  }, []);

  const doDryRun = useCallback(async () => {
    if (!selectedGroup || !message.trim() || !selectedTplCode) {
      showError("그룹, 템플릿 코드, 메시지를 입력하세요");
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          channel: "kakao",
          tplCode: selectedTplCode,
          message,
          buttons,
          dryRun: true,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError("미리보기 실패");
        return;
      }
      setDryRunResult({ count: d.willSend ?? 0, sample: d.sampleMessage ?? "" });
      setConfirmed(false);
    } catch (err) {
      showError("미리보기 중 오류 발생");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [selectedGroup, message, selectedTplCode, buttons, csrfToken]);

  const doSend = useCallback(async () => {
    if (!dryRunResult) {
      showError("먼저 발송 대상을 확인해주세요");
      return;
    }
    if (!confirmed) {
      showError("발송 확인 체크박스를 선택해주세요");
      return;
    }

    const willSend = dryRunResult.count || 0;
    if (!window.confirm(`정말 ${willSend}명에게 카카오톡을 발송하시겠습니까?`)) {
      return;
    }

    setSending(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          channel: "kakao",
          tplCode: selectedTplCode,
          message,
          buttons,
          dryRun: false,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError(d.message ?? "발송 실패");
        return;
      }
      showSuccess(`발송 완료: ${d.sentCount ?? 0}명 성공`);
      setMessage("");
      setButtons([]);
      setDryRunResult(null);
      setConfirmed(false);
    } catch (err) {
      showError("발송 중 오류 발생");
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  }, [selectedGroup, selectedTplCode, message, buttons, csrfToken, dryRunResult, confirmed]);

  const addButton = () => {
    setButtons([
      ...buttons,
      {
        id: Date.now().toString(),
        text: "",
        type: "DS",
        value: "",
      },
    ]);
  };

  const updateButton = (id: string, field: string, value: string) => {
    setButtons(
      buttons.map(btn =>
        btn.id === id ? { ...btn, [field]: value } : btn
      )
    );
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter(btn => btn.id !== id));
  };

  const currentGroup = useMemo(
    () => groups.find(g => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 좌측 설정 */}
      <div className="lg:col-span-1 space-y-4">
        {/* Kakao 연결 상태 */}
        <div className={`rounded-xl p-4 border ${kakaoConfig ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {configLoading ? (
            <div className="h-5 bg-gray-200 rounded animate-pulse" />
          ) : kakaoConfig ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">카카오 연결됨</span>
              </div>
              <p className="text-xs text-green-600">센더키: {kakaoConfig.senderKeyTail}</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">카카오 미연결</span>
              </div>
              <p className="text-xs text-amber-600 mb-2">카카오 계정을 연결해야 발송할 수 있습니다.</p>
              <a href="/settings/kakao" className="text-xs text-blue-600 underline">
                <Settings className="w-3 h-3 inline mr-1" /> 카카오 설정하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1 block">
            <Users className="w-3.5 h-3.5" /> 수신 그룹
          </label>
          <select value={selectedGroup}
            onChange={e => { setSelectedGroup(e.target.value); setDryRunResult(null); }}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {currentGroup && (
            <p className="text-xs text-gray-400 mt-1">최대 {currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 템플릿 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">템플릿 코드</label>
          <input
            type="text"
            value={selectedTplCode}
            onChange={e => setSelectedTplCode(e.target.value)}
            placeholder="예: CRUISE_OFFER"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Aligo 콘솔에 등록한 템플릿 코드</p>
        </div>
      </div>

      {/* 우측 작성 영역 */}
      <div className="lg:col-span-2 space-y-4">
        {/* 메시지 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">메시지 내용</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="카카오톡 알림톡 메시지 입력"
            rows={6}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <p className="text-xs text-gray-400 mt-1">최대 1000자</p>
        </div>

        {/* 버튼 관리 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-500">버튼 추가</label>
            <button
              onClick={addButton}
              disabled={buttons.length >= 5}
              className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded disabled:opacity-40">
              + 버튼 추가
            </button>
          </div>

          <div className="space-y-2">
            {buttons.map(btn => (
              <div key={btn.id} className="flex gap-2">
                <input
                  type="text"
                  value={btn.text}
                  onChange={e => updateButton(btn.id, "text", e.target.value)}
                  placeholder="버튼 텍스트"
                  className="flex-1 border rounded px-2 py-1.5 text-xs"
                  maxLength={20}
                />
                <select
                  value={btn.type}
                  onChange={e => updateButton(btn.id, "type", e.target.value)}
                  className="border rounded px-2 py-1.5 text-xs">
                  <option value="YL">웹 링크</option>
                  <option value="DS">배송 조회</option>
                  <option value="WL">휴대폰</option>
                  <option value="AC">앱</option>
                </select>
                <input
                  type="text"
                  value={btn.value}
                  onChange={e => updateButton(btn.id, "value", e.target.value)}
                  placeholder="값"
                  className="flex-1 border rounded px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => removeButton(btn.id)}
                  className="text-red-500 hover:text-red-700 text-xs">
                  삭제
                </button>
              </div>
            ))}
          </div>
          {buttons.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">버튼을 추가하면 클릭율이 증가합니다.</p>
          )}
        </div>

        {/* 미리보기 & 발송 */}
        <div className="rounded-xl border bg-white p-4">
          <button
            onClick={doDryRun}
            disabled={!selectedGroup || !message.trim() || !selectedTplCode}
            className="w-full py-2.5 border-2 border-green-300 text-green-600 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
            발송 대상 미리보기
          </button>

          {dryRunResult && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  발송 예정: <span className="text-green-600 font-bold text-base">{dryRunResult.count}명</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mb-1">첫 번째 고객 미리보기:</p>
                <div className="text-sm bg-white border rounded p-2.5">
                  {dryRunResult.sample}
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했으며, <strong className="text-green-600">{dryRunResult.count}명</strong>에게 카카오톡을 발송합니다.
                </span>
              </label>

              <button
                onClick={doSend}
                disabled={!dryRunResult || !confirmed || sending}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  !dryRunResult || !confirmed || sending
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}>
                <Send className="w-4 h-4" />
                {sending ? "발송 중..." : `✓ 발송 (${dryRunResult?.count || 0}명)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### API 수정 사항

#### 파일: src/app/api/groups/[id]/blast/route.ts

**변경**: channel 파라미터 추가 + Kakao 처리

```typescript
// 기존 코드에서 POST 핸들러 수정

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // ... 기존 인증 코드 ...

    const {
      message,
      dryRun,
      channel = "sms",  // ← 기본값 추가
      tplCode,
      buttons,
      variantKey,
    } = await request.json();

    // 채널별 처리
    if (channel === "kakao") {
      // Kakao 처리
      if (dryRun) {
        // Kakao dry run
        const contacts = await prisma.contact.findMany({
          where: { groupId: resolvedParams.id },
          select: { id: true, phone: true, name: true },
          take: 100,
        });
        
        return NextResponse.json({
          ok: true,
          willSend: contacts.length,
          sampleMessage: message,
        });
      } else {
        // Kakao 실제 발송
        // → 각 Contact에 대해 personalizeMessage()
        // → Kakao API 호출
        // → SendingHistory 기록
      }
    } else if (channel === "email") {
      // 기존 이메일 처리
    } else {
      // 기존 SMS 처리
    }
  } catch (err) {
    // ...
  }
}
```

---

## 파일 2: A/B 테스트 선택 UI

### 파일 위치
```
src/app/(dashboard)/messages/page.tsx (기존 파일 수정)
```

### SmsTab 내 변경 사항

#### 2.1 상태 추가 (SmsTab 함수 시작 부분)
```typescript
// A/B 테스트 관련 상태
const [useABTest, setUseABTest] = useState(false);
const [messageA, setMessageA] = useState("");
const [messageB, setMessageB] = useState("");
const [variantSplit, setVariantSplit] = useState<"50:50" | "80:20">("50:50");  // A:B 비율
```

#### 2.2 메시지 입력 UI 수정

**기존 코드 (line 370-377)**:
```typescript
<textarea
  ref={textareaRef}
  value={message}
  onChange={e => setMessage(e.target.value)}
  placeholder="내용을 입력하거나 왼쪽에서 템플릿을 선택하세요"
  rows={6}
  className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
/>
```

**변경 후**:
```typescript
<div className="mb-3 flex gap-2">
  <button
    onClick={() => setUseABTest(false)}
    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
      !useABTest ? "bg-blue-100 text-blue-600 border-blue-300" : "bg-white text-gray-600"
    }`}>
    단일 메시지
  </button>
  <button
    onClick={() => setUseABTest(true)}
    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
      useABTest ? "bg-blue-100 text-blue-600 border-blue-300" : "bg-white text-gray-600"
    }`}>
    A/B 테스트
  </button>
</div>

{!useABTest ? (
  <textarea
    ref={textareaRef}
    value={message}
    onChange={e => setMessage(e.target.value)}
    placeholder="내용을 입력하거나 왼쪽에서 템플릿을 선택하세요"
    rows={6}
    className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
  />
) : (
  <div className="space-y-3">
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">변형 A</label>
      <textarea
        value={messageA}
        onChange={e => setMessageA(e.target.value)}
        placeholder="메시지 A"
        rows={4}
        className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">변형 B</label>
      <textarea
        value={messageB}
        onChange={e => setMessageB(e.target.value)}
        placeholder="메시지 B"
        rows={4}
        className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-600 mb-2 block">발송 비율</label>
      <div className="flex gap-2">
        <button
          onClick={() => setVariantSplit("50:50")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg border ${
            variantSplit === "50:50" ? "bg-blue-100 text-blue-600 border-blue-300" : "bg-white text-gray-600"
          }`}>
          50:50 (동등)
        </button>
        <button
          onClick={() => setVariantSplit("80:20")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg border ${
            variantSplit === "80:20" ? "bg-blue-100 text-blue-600 border-blue-300" : "bg-white text-gray-600"
          }`}>
          80:20 (신중)
        </button>
      </div>
    </div>
  </div>
)}
```

#### 2.3 dryRun 함수 수정
```typescript
const doDryRun = useCallback(async () => {
  if (!selectedGroup || !message.trim()) {
    showError("그룹과 메시지를 입력하세요");
    return;
  }

  // A/B 테스트 유효성
  if (useABTest && (!messageA.trim() || !messageB.trim())) {
    showError("A/B 테스트 두 메시지를 모두 입력하세요");
    return;
  }

  // ... 기존 코드 유지 ...
  const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
    method: "POST",
    signal: controller.signal,
    headers: { /* ... */ },
    body: JSON.stringify({
      message: !useABTest ? message : undefined,
      messageA: useABTest ? messageA : undefined,
      messageB: useABTest ? messageB : undefined,
      variantSplit: useABTest ? variantSplit : undefined,
      dryRun: true,
    }),
  });

  // ... 응답 처리 ...
}, [selectedGroup, message, messageA, messageB, useABTest, variantSplit, csrfToken]);
```

#### 2.4 미리보기 UI 수정
```typescript
{dryRunResult && (
  <div className="space-y-3">
    {useABTest ? (
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-medium text-blue-600 mb-2">
            변형 A ({variantSplit.split(":")[0]}%)
          </p>
          <p className="text-xs text-blue-500 font-semibold mb-1">
            {Math.ceil(dryRunResult.count * (variantSplit === "50:50" ? 0.5 : 0.8))}명
          </p>
          <div className="text-xs bg-white border rounded p-2 whitespace-pre-wrap break-words">
            {messageA.substring(0, 100)}...
          </div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs font-medium text-amber-600 mb-2">
            변형 B ({variantSplit.split(":")[1]}%)
          </p>
          <p className="text-xs text-amber-500 font-semibold mb-1">
            {Math.floor(dryRunResult.count * (variantSplit === "50:50" ? 0.5 : 0.2))}명
          </p>
          <div className="text-xs bg-white border rounded p-2 whitespace-pre-wrap break-words">
            {messageB.substring(0, 100)}...
          </div>
        </div>
      </div>
    ) : (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-600 mb-2">
          발송 예정: <span className="text-blue-600 font-bold text-base">{dryRunResult.count}명</span>
        </p>
        <div className="text-sm bg-white border rounded p-2.5">
          {DOMPurify.sanitize(dryRunResult.sample, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
        </div>
      </div>
    )}
    
    {/* 기존 체크박스 + 발송 버튼 */}
  </div>
)}
```

---

## 파일 3: SMS-Logs A/B 분석 페이지

### 파일 위치
```
src/app/(dashboard)/messages/ab-test-results/page.tsx (신규)
```

### 전체 코드 (~500줄)

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { showError } from "@/components/ui/Toast";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

interface ABTestResult {
  campaignId: string;
  title: string;
  status: string;
  createdAt: string;
  variants: {
    A: {
      sent: number;
      successCount: number;
      failedCount: number;
      successRate: number;
    };
    B: {
      sent: number;
      successCount: number;
      failedCount: number;
      successRate: number;
    };
  };
  analysis: {
    chiSquare: number;
    pValue: number;
    isSignificant: boolean;
    winner: "A" | "B" | "TIED";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    cramersV: number;
  };
}

export default function ABTestResultsPage() {
  const [tests, setTests] = useState<ABTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"RUNNING" | "COMPLETED" | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"recent" | "pValue">("recent");

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const params = new URLSearchParams();
        if (filterStatus !== "ALL") params.set("status", filterStatus);
        params.set("sort", sortBy);

        const res = await fetch(`/api/campaigns/ab-test-results?${params.toString()}`);
        const data = await res.json();
        
        if (data.ok) {
          setTests(data.tests ?? []);
        } else {
          showError("테스트 데이터 로드 실패");
        }
      } catch (err) {
        showError("오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [filterStatus, sortBy]);

  const filteredTests = useMemo(() => {
    return tests.sort((a, b) => {
      if (sortBy === "pValue") {
        return a.analysis.pValue - b.analysis.pValue;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tests, sortBy]);

  const confidenceColor = (confidence: string) => {
    switch (confidence) {
      case "HIGH":
        return "bg-green-100 text-green-700 border-green-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "LOW":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const winnerBadge = (winner: string) => {
    if (winner === "TIED") return "bg-gray-100 text-gray-700";
    if (winner === "A") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">📊 A/B 테스트 결과</h1>
      <p className="text-sm text-gray-500 mb-6">발송된 메시지 변형의 성과 분석</p>

      {/* 필터 & 정렬 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {["ALL", "RUNNING", "COMPLETED"].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-3 py-2 rounded text-xs font-medium transition-all ${
                filterStatus === status
                  ? "bg-white shadow text-blue-600"
                  : "text-gray-600 hover:text-gray-700"
              }`}>
              {status === "ALL" ? "전체" : status === "RUNNING" ? "진행중" : "완료"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSortBy("recent")}
            className={`px-3 py-2 rounded text-xs font-medium ${
              sortBy === "recent" ? "bg-white shadow text-blue-600" : "text-gray-600"
            }`}>
            최근순
          </button>
          <button
            onClick={() => setSortBy("pValue")}
            className={`px-3 py-2 rounded text-xs font-medium ${
              sortBy === "pValue" ? "bg-white shadow text-blue-600" : "text-gray-600"
            }`}>
            통계순
          </button>
        </div>
      </div>

      {/* 테스트 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">로드 중...</div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-8 text-gray-400">A/B 테스트가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {filteredTests.map(test => (
            <div
              key={test.campaignId}
              className="border rounded-xl bg-white overflow-hidden">
              {/* 헤더 */}
              <button
                onClick={() =>
                  setExpandedId(
                    expandedId === test.campaignId ? null : test.campaignId
                  )
                }
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-left">
                      {test.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(test.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${winnerBadge(
                        test.analysis.winner
                      )}`}>
                      {test.analysis.winner === "A"
                        ? "A 우승"
                        : test.analysis.winner === "B"
                        ? "B 우승"
                        : "동점"}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${confidenceColor(
                        test.analysis.confidence
                      )}`}>
                      {test.analysis.confidence}
                    </span>
                  </div>
                </div>

                {expandedId === test.campaignId ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                )}
              </button>

              {/* 상세 내용 */}
              {expandedId === test.campaignId && (
                <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
                  {/* 비교 차트 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-3">
                      성공률 비교
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: "변형",
                            A: (test.variants.A.successRate * 100).toFixed(1),
                            B: (test.variants.B.successRate * 100).toFixed(1),
                          },
                        ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip
                          formatter={value => `${value}%`}
                          contentStyle={{ fontSize: "12px" }}
                        />
                        <Bar dataKey="A" fill="#3b82f6" />
                        <Bar dataKey="B" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 통계 테이블 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-600 mb-2">
                        변형 A
                      </p>
                      <p className="text-sm text-gray-700">
                        발송: {test.variants.A.sent}명
                      </p>
                      <p className="text-sm text-gray-700">
                        성공: {test.variants.A.successCount}명
                      </p>
                      <p className="text-lg font-bold text-blue-600 mt-2">
                        {(test.variants.A.successRate * 100).toFixed(1)}%
                      </p>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-600 mb-2">
                        변형 B
                      </p>
                      <p className="text-sm text-gray-700">
                        발송: {test.variants.B.sent}명
                      </p>
                      <p className="text-sm text-gray-700">
                        성공: {test.variants.B.successCount}명
                      </p>
                      <p className="text-lg font-bold text-amber-600 mt-2">
                        {(test.variants.B.successRate * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* 통계 분석 */}
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      통계 분석
                    </p>
                    <div className="space-y-1 text-xs text-gray-700">
                      <p>
                        Chi-square: {test.analysis.chiSquare.toFixed(4)}
                      </p>
                      <p>p-value: {test.analysis.pValue.toFixed(6)}</p>
                      <p>
                        Cramers V:{" "}
                        {test.analysis.cramersV.toFixed(3)} (효과 크기)
                      </p>
                      <p>
                        {test.analysis.isSignificant
                          ? "✓ 통계적으로 유의미함 (p < 0.05)"
                          : "✗ 통계적으로 유의미하지 않음"}
                      </p>
                    </div>
                  </div>

                  {/* 추천 */}
                  {test.analysis.winner !== "TIED" && (
                    <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                      <p className="text-xs font-semibold text-green-600 mb-2">
                        추천
                      </p>
                      <p className="text-sm text-gray-700">
                        변형 {test.analysis.winner}을(를) 다음 캠페인에 사용하세요.
                        ({test.analysis.confidence} 신뢰도,
                        p={test.analysis.pValue.toFixed(4)})
                      </p>
                      <button className="mt-2 w-full py-2 bg-green-600 text-white text-xs rounded font-medium hover:bg-green-700">
                        우승 메시지 적용
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### API 엔드포인트

**파일**: src/app/api/campaigns/ab-test-results/route.ts (신규)

```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const sort = url.searchParams.get('sort') ?? 'recent';

    // Campaign 조회 (variant가 있는 것만)
    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where: {
        organizationId: orgId,
        // status 필터 가능
        ...(status && { status }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    // 각 campaign의 A/B 통계 조회
    const results = [];
    for (const campaign of campaigns) {
      // 기존 /api/campaigns/[id]/variants/stats 호출
      const statsRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/${campaign.id}/variants/stats`,
        {
          headers: {
            'X-Auth-Context': JSON.stringify(ctx),
          },
        }
      );
      const statsData = await statsRes.json();

      if (statsData.variants?.A && statsData.variants?.B) {
        results.push({
          campaignId: campaign.id,
          title: campaign.title,
          status: campaign.status,
          createdAt: campaign.createdAt,
          variants: statsData.variants,
          analysis: statsData.analysis,
        });
      }
    }

    // 정렬
    if (sort === 'pValue') {
      results.sort((a, b) => a.analysis.chiSquare.pValue - b.analysis.chiSquare.pValue);
    } else {
      results.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    logger.log('[GET /ab-test-results]', { orgId, count: results.length });
    return NextResponse.json({ ok: true, tests: results });
  } catch (err) {
    logger.error('[GET /ab-test-results]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 데이터베이스 스키마 변경

**파일**: prisma/schema.prisma

```prisma
// SendingHistory 모델 확장 (variantKey 필드 추가)
// 이미 존재하는 것으로 예상되므로 확인만 필요

model SendingHistory {
  id           String   @id @default(cuid())
  campaignId   String
  contactId    String
  variantKey   String?  // "A", "B", null (단일)
  status       String   // "SENT", "FAILED", "DELIVERED"
  sentAt       DateTime @default(now())

  @@index([campaignId, variantKey])
}
```

---

## 테스트 체크리스트

- [ ] Messages SMS 탭 동작 확인
- [ ] Messages Email 탭 동작 확인
- [ ] Kakao 탭 렌더링 확인
- [ ] Kakao 템플릿 코드 입력 가능
- [ ] Kakao 버튼 추가/제거 동작
- [ ] SMS A/B 테스트 메시지 A/B 입력
- [ ] SMS A/B 테스트 발송 비율 선택 가능
- [ ] dryRun 변형별 개수 표시 정확
- [ ] AB Test Results 페이지 로드
- [ ] 우승자 배지 정확히 표시
- [ ] Chi-square 통계 값 정확
- [ ] 필터/정렬 동작 정상

---

## 배포 전 체크리스트

- [ ] Kakao API 설정 문서 작성
- [ ] A/B 테스트 통계 검증 (개발자 확인)
- [ ] UI/UX 검수 (디자인 리뷰)
- [ ] 보안 검토 (CSRF, 인증, IDOR)
- [ ] 성능 테스트 (대량 발송 시나리오)
- [ ] 사용성 테스트 (팀원 피드백)
- [ ] 배포 일정 확정

---

**작성 일자**: 2026-05-27
**담당**: Communication Automator Agent
**우선순위**: P0 (MVP)
