'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FreeMatketerRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/free-marketer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '가입 실패');
        return;
      }
      router.replace('/my-sales');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: '#FAF8F5' }}>
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold mb-1" style={{ color: '#C9A84C' }}>크루즈닷파트너스</div>
          <h1 className="text-xl font-bold mt-2" style={{ color: '#1E2D4E' }}>프리마케터 간편 등록</h1>
          <p className="text-sm text-gray-500 mt-1">본사 직속 3% 수당 프리마케터</p>
        </div>

        {/* 안내 박스 */}
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ backgroundColor: '#FFF3CD', border: '1px solid #E8C96B' }}>
          <p className="font-semibold mb-1" style={{ color: '#1E2D4E' }}>프리마케터 혜택</p>
          <ul className="space-y-0.5 text-gray-700">
            <li>• 본사 직속 수당 3%</li>
            <li>• 내 판매 현황 실시간 확인</li>
            <li>• 개인 어필리에이트 링크 제공</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">전화번호 (아이디로 사용)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              inputMode="tel"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl font-semibold py-3.5 text-sm transition-all shadow-sm mt-2"
            style={{
              backgroundColor: loading ? '#E8C96B' : '#C9A84C',
              color: '#1E2D4E',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '등록 중...' : '프리마케터 등록하기'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/sign-in" className="text-sm text-gray-400 hover:text-gray-600">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
          등록 시 크루즈닷 어필리에이트 약관에 동의합니다.<br />
          문의: jmonica@cruisedot.co.kr
        </p>
      </div>
    </div>
  );
}
