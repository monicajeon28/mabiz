# Menu #27 Wave 2 상세 작업지시서 (P1 접근성 + 코드 구성)

**목표:** 컴포넌트 분리 + ImportModal 파일화 + 접근성 개선 + 스키마 검증  
**예상 시간:** 3.5시간  
**범위:** P1 7개 (코드 구성, 접근성, 검증)  
**의존성:** Wave 1 완료 (커밋 55b0224)

---

## 📋 Task List

### Task W2-1: GroupForm 컴포넌트 분리
**파일:** `src/components/groups/GroupForm.tsx` (신규)  
**시간:** 1시간  

#### Step 1: 신규 파일 생성
```typescript
// src/components/groups/GroupForm.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  funnelId: string | null;
  funnelName: string | null;
  _count: { members: number };
};

type Funnel = { id: string; name: string };

interface GroupFormProps {
  form: { name: string; description: string; color: string; funnelId: string };
  setForm: (form: { name: string; description: string; color: string; funnelId: string }) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (errors: Record<string, string>) => void;
  formError: string | null;
  setFormError: (error: string | null) => void;
  saving: boolean;
  funnels: Funnel[];
  onSubmit: () => void;
  onCancel: () => void;
}

const COLOR_OPTIONS = [
  "#1E2D4E", "#C9A84C", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#F59E0B", "#6B7280",
];

const COLOR_NAMES: Record<string, string> = {
  "#1E2D4E": "네이비",
  "#C9A84C": "골드",
  "#10B981": "초록",
  "#3B82F6": "파랑",
  "#8B5CF6": "보라",
  "#EF4444": "빨강",
  "#F59E0B": "주황",
  "#6B7280": "회색",
};

export function GroupForm({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  formError,
  setFormError,
  saving,
  funnels,
  onSubmit,
  onCancel,
}: GroupFormProps) {
  return (
    <div className="bg-white border border-gold-300 rounded-xl p-5 mb-4 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">새 그룹 만들기</h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 mb-1">
            그룹 이름 *
          </label>
          <input
            id="group-name"
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setFieldErrors({ ...fieldErrors, name: '' });
            }}
            placeholder="예: 지중해 관심 고객"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
              fieldErrors.name
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'error-name' : undefined}
          />
          {fieldErrors.name && (
            <p id="error-name" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="group-description" className="block text-sm font-medium text-gray-700 mb-1">
            설명
          </label>
          <input
            id="group-description"
            type="text"
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              setFieldErrors({ ...fieldErrors, description: '' });
            }}
            placeholder="이 그룹에 대한 간단한 설명"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
              fieldErrors.description
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.description}
            aria-describedby={fieldErrors.description ? 'error-description' : undefined}
          />
          {fieldErrors.description && (
            <p id="error-description" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.description}
            </p>
          )}
        </div>

        {/* 색상 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setForm({ ...form, color: c });
                  setFieldErrors({ ...fieldErrors, color: '' });
                }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`${COLOR_NAMES[c]} 색상 선택`}
                title={`${COLOR_NAMES[c]} (${c})`}
              />
            ))}
          </div>
          {fieldErrors.color && (
            <p className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.color}
            </p>
          )}
        </div>

        {/* 퍼널 연결 */}
        <div>
          <label htmlFor="group-funnel" className="block text-sm font-medium text-gray-700 mb-1">
            연결할 퍼널 <span className="text-xs text-gray-400 ml-1">(그룹 배정 시 자동 시작)</span>
          </label>
          <select
            id="group-funnel"
            value={form.funnelId}
            onChange={(e) => {
              setForm({ ...form, funnelId: e.target.value });
              setFieldErrors({ ...fieldErrors, funnelId: '' });
            }}
            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none ${
              fieldErrors.funnelId
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.funnelId}
            aria-describedby={fieldErrors.funnelId ? 'error-funnelId' : undefined}
          >
            <option value="">퍼널 없음 (수동 발송만)</option>
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {fieldErrors.funnelId && (
            <p id="error-funnelId" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.funnelId}
            </p>
          )}
          {form.funnelId && !fieldErrors.funnelId && (
            <p className="text-xs text-green-600 mt-1">✅ 이 그룹에 고객 배정 시 즉시 퍼널 시작</p>
          )}
        </div>
      </div>

      {formError && (
        <p className="text-base text-red-600 mt-3 font-medium bg-red-50 p-3 rounded">⚠️ {formError}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSubmit}
          disabled={saving || !form.name.trim()}
          className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-base font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? '저장 중...' : '그룹 만들기'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200"
        >
          취소
        </button>
      </div>
    </div>
  );
}
```

#### Step 2: page.tsx에서 GroupForm 부분 제거 (라인 295-408)
```typescript
// 변경 전
{showNew && (
  <div className="bg-white border border-gold-300 rounded-xl p-5 mb-4 shadow-sm">
    {/* ... 114줄 ... */}
  </div>
)}

// 변경 후 (상단에 import 추가)
import { GroupForm } from '@/components/groups/GroupForm';

{showNew && (
  <GroupForm
    form={form}
    setForm={setForm}
    fieldErrors={fieldErrors}
    setFieldErrors={setFieldErrors}
    formError={formError}
    setFormError={setFormError}
    saving={saving}
    funnels={funnels}
    onSubmit={createGroup}
    onCancel={() => setShowNew(false)}
  />
)}
```

---

### Task W2-2: GroupCard 컴포넌트 분리
**파일:** `src/components/groups/GroupCard.tsx` (신규)  
**시간:** 1시간  

#### Step 1: 신규 파일 생성
```typescript
// src/components/groups/GroupCard.tsx
'use client';

import Link from 'next/link';
import { GitBranch, Zap } from 'lucide-react';

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  funnelId: string | null;
  funnelName: string | null;
  _count: { members: number };
};

interface GroupCardProps {
  group: Group;
  copiedExportId: string | null;
  onClone: (id: string) => void;
  onExport: (id: string) => void;
  onBlast: (id: string) => void;
  children?: React.ReactNode;
}

export function GroupCard({
  group,
  copiedExportId,
  onClone,
  onExport,
  onBlast,
  children,
}: GroupCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        {/* 색상 원 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: group.color ?? '#6B7280' }}
          aria-label={`그룹 색상: ${group.color}`}
        >
          {group.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            <span className="text-xs text-gray-400" aria-label={`멤버 수: ${group._count.members}명`}>
              {group._count.members}명
            </span>
          </div>
          {group.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{group.description}</p>
          )}

          {/* 연결된 퍼널 표시 */}
          {group.funnelId ? (
            <div className="flex items-center gap-1 mt-1.5">
              <GitBranch className="w-3 h-3 text-green-500" aria-hidden="true" />
              <span className="text-xs text-green-600 font-medium">퍼널 연결됨: {group.funnelName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs text-gray-400">퍼널 없음</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-end">
          <button
            onClick={() => onClone(group.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
            title="그룹 복제"
          >
            📋 복제
          </button>
          <button
            onClick={() => onExport(group.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
            title="그룹 내보내기 (JSON 클립보드 복사)"
          >
            {copiedExportId === group.id ? '✅ 복사됨' : '📤 내보내기'}
          </button>
          <button
            onClick={() => onBlast(group.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gold-50 border border-gold-300 text-gold-700 rounded-lg text-xs font-medium hover:bg-gold-100"
            title="그룹 전체에 즉시 문자 발송"
          >
            <Zap className="w-3 h-3" aria-hidden="true" /> 즉시발송
          </button>
        </div>
      </div>

      {/* 일괄 발송 패널 (자식 컴포넌트) */}
      {children}
    </div>
  );
}
```

#### Step 2: page.tsx에서 GroupCard 부분 제거 및 import 추가
```typescript
// 변경 전 (라인 423-596)
{groups.map((group) => (
  <div key={group.id} className="bg-white border...">
    {/* ... 174줄 ... */}
  </div>
))}

// 변경 후 (상단에 import 추가)
import { GroupCard } from '@/components/groups/GroupCard';
import { BlastPanel } from '@/components/groups/BlastPanel';

{groups.map((group) => (
  <GroupCard
    key={group.id}
    group={group}
    copiedExportId={copiedExportId}
    onClone={cloneGroup}
    onExport={exportGroup}
    onBlast={openBlast}
  >
    {blastGroupId === group.id && (
      <BlastPanel
        groupId={group.id}
        blastMsg={blastMsg}
        onMsgChange={setBlastMsg}
        blastPreview={blastPreview}
        blastError={blastError}
        blastConfirm={blastConfirm}
        onConfirmChange={setBlastConfirm}
        onCheckBlast={checkBlast}
        checkingBlast={checkingBlast}
        onSendBlast={sendBlast}
        blasting={blasting}
        blastResult={blastResult}
        onClose={() => setBlastGroupId(null)}
      />
    )}
  </GroupCard>
))}
```

---

### Task W2-3: BlastPanel 컴포넌트 분리
**파일:** `src/components/groups/BlastPanel.tsx` (신규)  
**시간:** 1시간  

#### Step 1: 신규 파일 생성
```typescript
// src/components/groups/BlastPanel.tsx
'use client';

import { Loader2 } from 'lucide-react';

interface BlastPreview {
  willSend: number;
  isOverLimit: boolean;
  overLimitMsg: string | null;
}

interface BlastResult {
  sentCount: number;
  blockedCount: number;
  failedCount: number;
}

interface BlastPanelProps {
  groupId: string;
  blastMsg: string;
  onMsgChange: (msg: string) => void;
  blastPreview: BlastPreview | null;
  blastError: string | null;
  blastConfirm: boolean;
  onConfirmChange: (confirm: boolean) => void;
  onCheckBlast: () => void;
  checkingBlast: boolean;
  onSendBlast: () => void;
  blasting: boolean;
  blastResult: BlastResult | null;
  onClose: () => void;
}

export function BlastPanel({
  blastMsg,
  onMsgChange,
  blastPreview,
  blastError,
  blastConfirm,
  onConfirmChange,
  onCheckBlast,
  checkingBlast,
  onSendBlast,
  blasting,
  blastResult,
  onClose,
}: BlastPanelProps) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {blastResult ? (
        <div className="bg-green-50 rounded-lg p-3 text-sm">
          <p className="font-semibold text-green-800">✅ 발송 완료</p>
          <p className="text-green-700 mt-1">
            성공 {blastResult.sentCount}명 · 차단 {blastResult.blockedCount}명
            {blastResult.failedCount > 0 && ` · 실패 ${blastResult.failedCount}명`}
          </p>
          <button onClick={onClose} className="text-xs text-gray-500 mt-2 underline">
            닫기
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={blastMsg}
            onChange={(e) => {
              onMsgChange(e.target.value);
            }}
            placeholder={
              '크루즈닷 입니다 😊\n[고객명]님, 이번 주 특가 소식이에요!\n→ cruisedot.co.kr'
            }
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 resize-none"
            aria-label="발송 메시지"
          />
          <p className="text-xs text-gray-400">[고객명] 자동 치환됩니다</p>

          {blastError && (
            <p className="text-base text-red-600 font-medium bg-red-50 p-3 rounded">⚠️ {blastError}</p>
          )}

          {blastPreview && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-yellow-800">📢 발송 최종 확인</p>
                <div className="mt-2 space-y-1 text-yellow-700">
                  <p>✓ <span className="font-medium">대상:</span> {blastPreview.willSend}명</p>
                  <p>✓ <span className="font-medium">메시지:</span> {blastMsg.substring(0, 50)}
                    {blastMsg.length > 50 ? '...' : ''}
                  </p>
                </div>
                {blastPreview.isOverLimit && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ 200명 초과 — 첫 200명만 발송됩니다
                  </p>
                )}
              </div>

              {/* UX-004: 최종 확인 체크박스 */}
              <label className="flex items-start gap-2 pt-2 border-t border-yellow-200 cursor-pointer hover:bg-yellow-100/50 p-2 -mx-2 rounded">
                <input
                  type="checkbox"
                  checked={blastConfirm}
                  onChange={(e) => onConfirmChange(e.target.checked)}
                  className="w-5 h-5 rounded border-yellow-300 text-yellow-600 mt-1"
                  aria-label="발송 최종 확인"
                />
                <span className="text-sm text-yellow-900 font-medium">
                  정말로 <span className="font-bold text-red-600">{blastPreview.willSend}명</span>
                  에게 발송하겠습니다.
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-2">
            {!blastPreview ? (
              <button
                onClick={onCheckBlast}
                disabled={!blastMsg.trim() || checkingBlast}
                className="flex-1 border border-blue-300 text-blue-700 py-2 rounded-lg text-base font-medium hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingBlast && <Loader2 className="w-4 h-4 animate-spin" />}
                {checkingBlast ? '확인 중...' : '대상 확인'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    // Reset blast form
                    onMsgChange('');
                    onConfirmChange(false);
                  }}
                  className="flex-1 border border-gray-300 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  onClick={onSendBlast}
                  disabled={blasting || !blastConfirm}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all text-base flex items-center justify-center gap-2 ${
                    blastConfirm && !blasting
                      ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                  }`}
                  title={!blastConfirm ? '체크박스를 체크해주세요' : '발송하기'}
                >
                  {blasting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {blasting ? '발송 중...' : `✓ 발송 (${blastPreview.willSend}명)`}
                </button>
              </>
            )}
            {!blastPreview && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm"
              >
                취소
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---

### Task W2-4: RegionalSetup 컴포넌트 분리
**파일:** `src/components/groups/RegionalSetup.tsx` (신규)  
**시간:** 30분  

```typescript
// src/components/groups/RegionalSetup.tsx
'use client';

import { Loader2 } from 'lucide-react';

interface RegionalSetupProps {
  loading: boolean;
  setupMsg: string | null;
  onSetup: () => void;
}

export function RegionalSetup({ loading, setupMsg, onSetup }: RegionalSetupProps) {
  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
      <p className="text-sm font-semibold text-blue-800 mb-1">📍 지역별 관심 그룹 자동 설정</p>
      <p className="text-xs text-blue-600 mb-3">
        8개 지역 그룹 + 12주 SMS 퍼널을 한 번에 생성합니다
      </p>
      <button
        onClick={onSetup}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? '생성 중...' : '🚀 지역 그룹 초기화'}
      </button>
      {setupMsg && (
        <p
          className={`text-xs mt-2 ${
            setupMsg.includes('이미')
              ? 'text-gray-500'
              : setupMsg.includes('실패') || setupMsg.includes('오류')
                ? 'text-red-600'
                : 'text-green-600'
          }`}
        >
          {setupMsg}
        </p>
      )}
    </div>
  );
}
```

---

### Task W2-5: ImportModal → 별도 파일로 이동
**파일:** `src/components/groups/ImportModal.tsx` (신규)  
**시간:** 30분  

#### Step 1: 기존 ImportModal 함수 (라인 605-759)를 새 파일로 복사

```typescript
// src/components/groups/ImportModal.tsx
'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ImportModalProps {
  csrfToken: string;
  onClose: () => void;
  onDone: () => void;
}

export function ImportModal({ csrfToken, onClose, onDone }: ImportModalProps) {
  const [tab, setTab] = useState<'file' | 'text'>('file');
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ groupName?: string; funnelName?: string; stageCount?: number } | null>(null);

  const parseJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as { groupName?: string; funnelName?: string; stages?: unknown[] };
      setPreview({
        groupName: parsed.groupName,
        funnelName: parsed.funnelName,
        stageCount: parsed.stages?.length ?? 0,
      });
      setError('');
      return parsed;
    } catch {
      setError('JSON 형식이 올바르지 않습니다');
      setPreview(null);
      return null;
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError(`파일이 너무 큽니다 (최대 1MB, 현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
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

  const handleTextChange = (text: string) => {
    setJsonText(text);
    if (text.trim()) parseJson(text);
    else {
      setPreview(null);
      setError('');
    }
  };

  const handleImport = async () => {
    const parsed = parseJson(jsonText);
    if (!parsed) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/groups/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: jsonText,
      });
      const d = await res.json() as { ok: boolean; message?: string };
      if (d.ok) {
        onDone();
        onClose();
      } else setError(d.message ?? '가져오기 실패');
    } catch (err) {
      logger.error('[ImportModal] handleImport', { err });
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">그룹/퍼널 가져오기</h2>
            <p className="text-xs text-gray-500 mt-0.5">JSON 파일 업로드 또는 직접 입력</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="가져오기 모달 닫기"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 탭 */}
          <div className="flex gap-2">
            {(['file', 'text'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t === 'file' ? '파일 업로드' : '직접 입력'}
              </button>
            ))}
          </div>

          {tab === 'file' ? (
            <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-500">JSON 파일을 여기에 끌어놓거나 클릭</p>
              <p className="text-xs text-gray-400 mt-1">.json 파일만 지원</p>
              <input type="file" accept=".json" onChange={handleFile} className="hidden" />
            </label>
          ) : (
            <textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='{"groupName":"그룹명","funnelName":"퍼널명","stages":[...]}'
              className="w-full h-36 border rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="JSON 직접 입력"
            />
          )}

          {/* 미리보기 */}
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

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleImport}
            disabled={!jsonText.trim() || importing || !!error}
            className="w-full py-3 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {importing ? '가져오는 중...' : '가져오기 실행'}
          </button>

          {/* JSON 형식 안내 */}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">JSON 형식 예시 보기</summary>
            <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "groupName": "VIP 고객",
  "funnelName": "VIP 케어",
  "funnelType": "VIP_CARE",
  "stages": [
    {
      "name": "환영 문자",
      "order": 1,
      "triggerType": "DDAY",
      "triggerOffset": 0,
      "channel": "SMS",
      "messageContent": "[고객명]님 환영합니다"
    }
  ]
}`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2: page.tsx의 ImportModal 함수 제거 (라인 605-759 삭제)

---

### Task W2-6: page.tsx에서 import 정리 및 불필요한 것 제거
**시간:** 30분  

#### Step 1: 상단 import 추가
```typescript
import { GroupForm } from '@/components/groups/GroupForm';
import { GroupCard } from '@/components/groups/GroupCard';
import { BlastPanel } from '@/components/groups/BlastPanel';
import { RegionalSetup } from '@/components/groups/RegionalSetup';
import { ImportModal } from '@/components/groups/ImportModal';
```

#### Step 2: 불필요한 색상 매핑 제거
```typescript
// 라인 222-225의 COLOR_OPTIONS 제거 (GroupForm에 있음)
```

#### Step 3: 화면 렌더링 로직 리팩토링
```typescript
// 지역 그룹 초기 설정
<RegionalSetup
  loading={setupLoading}
  setupMsg={setupMsg}
  onSetup={initRegionalGroups}
/>

// 새 그룹 폼
{showNew && (
  <GroupForm
    form={form}
    setForm={setForm}
    fieldErrors={fieldErrors}
    setFieldErrors={setFieldErrors}
    formError={formError}
    setFormError={setFormError}
    saving={saving}
    funnels={funnels}
    onSubmit={createGroup}
    onCancel={() => setShowNew(false)}
  />
)}

// 그룹 목록
{/* loading && error UI는 기존 유지 */}
{groups.map((group) => (
  <GroupCard
    key={group.id}
    group={group}
    copiedExportId={copiedExportId}
    onClone={cloneGroup}
    onExport={exportGroup}
    onBlast={openBlast}
  >
    {blastGroupId === group.id && (
      <BlastPanel
        groupId={group.id}
        blastMsg={blastMsg}
        onMsgChange={setBlastMsg}
        blastPreview={blastPreview}
        blastError={blastError}
        blastConfirm={blastConfirm}
        onConfirmChange={setBlastConfirm}
        onCheckBlast={checkBlast}
        checkingBlast={checkingBlast}
        onSendBlast={sendBlast}
        blasting={blasting}
        blastResult={blastResult}
        onClose={() => setBlastGroupId(null)}
      />
    )}
  </GroupCard>
))}
```

---

## 📊 최종 파일 구조

```
src/
├── app/(dashboard)/groups/
│   └── page.tsx (200줄 이하 - 상태/로직만)
├── components/groups/
│   ├── GroupForm.tsx (새 그룹 생성 폼)
│   ├── GroupCard.tsx (그룹 카드 + 액션 버튼)
│   ├── BlastPanel.tsx (일괄 발송 폼)
│   ├── RegionalSetup.tsx (지역 그룹 초기화)
│   └── ImportModal.tsx (가져오기 모달)
```

---

## ✅ Verification Checklist

### Pre-Implementation
- [ ] 기존 groups/page.tsx 백업 (git 상태 깔끔한지 확인)
- [ ] 각 컴포넌트 디렉토리 생성: `mkdir -p src/components/groups`

### During Implementation
- [ ] 각 컴포넌트별 TypeScript 타입 검증
- [ ] 부모-자식 props 통신 검증
- [ ] 불필요한 state 전달 최소화

### Post-Implementation (로컬 테스트)
- [ ] 새 그룹 생성 작동
- [ ] 그룹 복제 작동
- [ ] 그룹 내보내기 작동
- [ ] 일괄 발송 (미리보기 + 발송) 작동
- [ ] 가져오기 모달 (파일/텍스트) 작동
- [ ] 지역 그룹 초기화 작동
- [ ] 에러 상태 표시 작동
- [ ] aria-label이 색상을 명확히 표현하는지 확인
- [ ] 이전 파일 크기: 759줄 → 목표: page.tsx 200줄 이하 + 컴포넌트 4개 ~500줄

---

## 📝 Commit Messages

```
1. "refactor(groups): GroupForm 컴포넌트 분리 + 색상 이름 매핑 추가"
2. "refactor(groups): GroupCard 컴포넌트 분리 + 접근성 개선"
3. "refactor(groups): BlastPanel 컴포넌트 분리 (일괄 발송 로직)"
4. "refactor(groups): RegionalSetup, ImportModal 컴포넌트 분리"
5. "refactor(groups): page.tsx 리팩토링 (759줄 → 200줄, 컴포넌트 화)"
```

---

## ⏱️ 타임라인

| Task | 예상시간 | 상태 |
|------|--------|------|
| W2-1: GroupForm | 1시간 | ⏳ |
| W2-2: GroupCard | 1시간 | ⏳ |
| W2-3: BlastPanel | 1시간 | ⏳ |
| W2-4: RegionalSetup | 30분 | ⏳ |
| W2-5: ImportModal | 30분 | ⏳ |
| W2-6: page.tsx 정리 | 30분 | ⏳ |
| **Wave 2 총합** | **3.5시간** | |

