'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

export default function PasswordPage() {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [showCur,  setShowCur]  = useState(false);
  const [showNext, setShowNext] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      showError('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }
    if (next.length < 8) {
      showError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '변경에 실패했습니다.');
        return;
      }
      showSuccess('비밀번호가 변경됐습니다.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch {
      showError('요청 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">비밀번호 변경</h1>
          <p className="text-sm text-gray-500">아이디는 변경할 수 없습니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 현재 비밀번호 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <label className="text-sm font-medium text-gray-700">현재 비밀번호</label>
          <div className="relative mt-1">
            <input
              type={showCur ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="현재 비밀번호 입력"
            />
            <button
              type="button"
              onClick={() => setShowCur(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              tabIndex={-1}
            >
              {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 새 비밀번호 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">새 비밀번호</label>
            <div className="relative mt-1">
              <input
                type={showNext ? 'text' : 'password'}
                value={next}
                onChange={e => setNext(e.target.value)}
                required
                minLength={8}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="8자 이상"
              />
              <button
                type="button"
                onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                tabIndex={-1}
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className={`w-full text-sm border rounded-lg px-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                confirm && next !== confirm ? 'border-red-300' : 'border-gray-200'
              }`}
              placeholder="새 비밀번호 재입력"
            />
            {confirm && next !== confirm && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          className="w-full py-3 bg-navy-900 text-white font-semibold rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />변경 중...</> : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
