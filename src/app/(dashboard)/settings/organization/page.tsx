'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Check, X, Copy, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

type OrgInfo = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  externalAffiliateProfileId: number | null;
  createdAt: string;
};

const PLAN_BADGE: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  PRO: 'bg-blue-100 text-blue-700',
};

export default function OrganizationPage() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 인라인 편집 상태
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 복사 상태
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/org/info');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setOrg(data.org);
        setNameInput(data.org.name);
      } catch {
        showError('조직 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function startEdit() {
    if (!org) return;
    setNameInput(org.name);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    if (org) setNameInput(org.name);
  }

  async function handleSaveName() {
    if (!org) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      showError('조직명을 입력해주세요.');
      return;
    }
    if (trimmed === org.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/org/info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '저장에 실패했습니다.');
        return;
      }
      setOrg((prev) => prev ? { ...prev, name: trimmed } : prev);
      setEditing(false);
      showSuccess('조직명을 저장했습니다.');
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyCode() {
    if (!org?.externalAffiliateProfileId) return;
    try {
      await navigator.clipboard.writeText(String(org.externalAffiliateProfileId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('클립보드 복사에 실패했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">조직 설정</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0 border-gray-100">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">조직 설정</h1>
        </div>
        <p className="text-sm text-gray-500 text-center py-10">조직 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">조직 설정</h1>
      </div>

      {/* 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

        {/* 조직명 */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-sm text-gray-500 w-24 shrink-0">조직명</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {editing ? (
              <>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="flex-1 text-sm font-semibold text-gray-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="text-green-600 hover:text-green-800 disabled:opacity-50 transition-colors"
                  aria-label="저장"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-gray-900 truncate">{org.name}</span>
                <button
                  onClick={startEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  aria-label="조직명 수정"
                  title="수정"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 플랜 */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-sm text-gray-500 w-24 shrink-0">플랜</span>
          <div className="flex-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PLAN_BADGE[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>
              {org.plan}
            </span>
          </div>
        </div>

        {/* 대리점 코드 */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-sm text-gray-500 w-24 shrink-0">대리점 코드</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {org.externalAffiliateProfileId !== null ? (
              <>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  {org.externalAffiliateProfileId}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  aria-label="코드 복사"
                  title="복사"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                {copied && <span className="text-xs text-green-600">복사됨!</span>}
              </>
            ) : (
              <span className="text-sm text-gray-400">미설정</span>
            )}
          </div>
        </div>

        {/* 가입일 */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-sm text-gray-500 w-24 shrink-0">가입일</span>
          <span className="text-sm font-semibold text-gray-900">
            {new Date(org.createdAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
