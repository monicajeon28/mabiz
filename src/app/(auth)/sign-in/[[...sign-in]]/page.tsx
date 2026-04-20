'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '로그인 실패');
        return;
      }

      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 좌측: 브랜드 (데스크탑) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between overflow-hidden"
           style={{ backgroundColor: '#1E2D4E' }}>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/크루즈정보사진/그리스 산토리니/그리스 산토리니.webp')" }}
        />
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(30,45,78,0.6)' }} />
        <div className="relative z-10 p-12 flex-1 flex flex-col justify-center">
          <div className="text-4xl font-bold tracking-tight mb-3" style={{ color: '#C9A84C' }}>
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
      <div className="flex-1 flex items-center justify-center bg-[#FAF8F5] px-6 py-12">
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-bold mb-1" style={{ color: '#C9A84C' }}>
              크루즈닷파트너스
            </div>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#1E2D4E' }}>로그인</h2>
            <p className="text-gray-500 text-sm mt-1">파트너 계정으로 접속하세요</p>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl font-semibold py-3.5 text-sm transition-all shadow-sm"
              style={{
                backgroundColor: loading ? '#E8C96B' : '#C9A84C',
                color: '#1E2D4E',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 leading-relaxed">
            본사에서 발급한 파트너 전용 계정을 사용합니다.<br />
            문의: jmonica@cruisedot.co.kr
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <SignInContent />
    </Suspense>
  );
}
