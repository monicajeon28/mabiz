'use client';

import { FormEvent, useState } from 'react';
import { COMPANY_INFO } from '@/lib/company-info';

export default function SignInContent() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const phoneVal = phone.trim();
    const passVal = password;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phoneVal, password: passVal }),
      });

      const data = await response.json();

      if (data.ok) {
        window.location.href = '/dashboard';
      } else {
        setError(data.error || '로그인 실패');
      }
    } catch (err) {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 좌측: 브랜드 (데스크탑) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between overflow-hidden"
           style={{ backgroundColor: 'var(--color-navy-900)' }}>
        <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-navy-900) 20%, transparent)' }} />
        <div className="relative z-10 p-12 flex-1 flex flex-col justify-center">
          <div className="text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--color-gold-500)' }}>
            크루즈닷파트너스
          </div>
          <h1 className="text-white text-3xl font-bold leading-tight mb-4">
            파트너센터에<br />오신 것을 환영합니다
          </h1>
        </div>
        <div className="relative z-10 p-8">
          <p className="text-white/30 text-xs">(주)마비즈컴퍼니 · mabizcruisedot.com</p>
        </div>
      </div>

      {/* 우측: 로그인 폼 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ backgroundColor: 'var(--color-cream)' }}>
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-gold-500)' }}>
              크루즈닷파트너스
            </div>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>로그인</h2>
            <p className="text-gray-500 text-sm mt-1">계정 아이디와 비밀번호를 입력하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">아이디</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl font-semibold py-3.5 text-sm transition-all shadow-sm"
              style={{
                backgroundColor: loading ? 'var(--color-gold-300)' : 'var(--color-gold-500)',
                color: 'var(--color-navy-900)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 프리마케터 간편 등록 */}
          <div className="mt-6 border-t border-slate-200 pt-5">
            <a
              href="/affiliate-join/pre-sales"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
              style={{ border: '2px solid var(--color-gold-500)', color: 'var(--color-gold-500)', backgroundColor: 'white' }}
            >
              크루즈닷 파트너스 신청하기
            </a>
            <p className="text-center text-xs text-slate-400 mt-2">판매·고객관리(CRM)를 한 곳에서</p>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            문의: {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || COMPANY_INFO.email}
          </p>
        </div>
      </div>
    </div>
  );
}
