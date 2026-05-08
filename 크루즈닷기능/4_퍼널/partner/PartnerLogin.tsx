'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowRight } from 'react-icons/fi';

interface PartnerLoginProps {
  forceReauth?: boolean;
}

export default function PartnerLogin({ forceReauth = false }: PartnerLoginProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // next 파라미터 가져오기 (관리자 패널에서 대시보드 링크로 들어온 경우)
  const nextPath = searchParams?.get('next') || null;

  // 자동 리다이렉트 기능 완전히 제거 - 무한 루프 방지
  // 사용자가 직접 로그인하거나 "바로 이동하기" 버튼을 클릭해야 함

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // 더블 클릭 방지 강화 - 이미 로딩 중이면 무시
    if (loading) {
      console.log('[PartnerLogin] 이미 로그인 진행 중, 중복 요청 무시');
      return;
    }

    setError(null);
    setLoading(true); // 즉시 로딩 상태로 전환

    try {
      const phoneValue = phone.trim();
      const passwordValue = password.trim();
      
      console.log('[PartnerLogin] 로그인 시도:', { phone: phoneValue, password: passwordValue ? '***' : 'empty' });
      
      if (!phoneValue || !passwordValue) {
        const errorMsg = '아이디와 비밀번호를 모두 입력해주세요.';
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      console.log('[PartnerLogin] API 요청 전송:', { phone: phoneValue, mode: 'partner' });
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ phone: phoneValue, password: passwordValue, mode: 'partner' }),
      });
      
      console.log('[PartnerLogin] API 응답 받음:', { status: response.status, ok: response.ok, statusText: response.statusText });
      
      let json;
      let responseText = '';
      try {
        responseText = await response.text();
        console.log('[PartnerLogin] 응답 텍스트 (처음 500자):', responseText.substring(0, 500));
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('서버가 빈 응답을 반환했습니다.');
        }
        
        json = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[PartnerLogin] JSON 파싱 실패:', {
          error: parseError,
          responseText: responseText.substring(0, 500),
          status: response.status,
          statusText: response.statusText,
        });
        
        let errorMsg = '서버 응답을 파싱할 수 없습니다.';
        if (response.status === 500) {
          errorMsg = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (response.status === 429) {
          errorMsg = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        } else if (response.status >= 400) {
          errorMsg = `서버 오류가 발생했습니다. (상태 코드: ${response.status})`;
        }
        
        // 응답 텍스트에 유용한 정보가 있으면 포함
        if (responseText && responseText.length > 0 && responseText.length < 200) {
          errorMsg += ` (${responseText})`;
        }
        
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      if (!response.ok || !json?.ok) {
        const errorMsg = json?.error || `로그인에 실패했습니다. (상태 코드: ${response.status})`;
        const errorDetails = json?.details || json?.stack || '';
        console.error('[PartnerLogin] 로그인 실패:', {
          status: response.status,
          error: errorMsg,
          details: errorDetails,
          fullResponse: json,
        });
        setError(`${errorMsg}${errorDetails ? ` (${errorDetails})` : ''}`);
        setLoading(false);
        return;
      }

      console.log('[PartnerLogin] 로그인 성공, 응답 데이터:', { 
        next: json.next, 
        partnerId: json.partnerId,
        ok: json.ok 
      });

      // 리다이렉트 경로 결정: API 응답의 next > partnerId > URL의 next 파라미터
      let redirectPath = '/partner';
      
      // 우선순위: API 응답의 next > partnerId > URL의 next 파라미터
      if (json.next) {
        redirectPath = json.next;
        console.log('[PartnerLogin] API 응답의 next 사용:', redirectPath);
      } else if (json.partnerId) {
        redirectPath = `/partner/${json.partnerId}/dashboard`;
        console.log('[PartnerLogin] API 응답의 partnerId 사용:', redirectPath);
      } else if (nextPath) {
        redirectPath = nextPath;
        console.log('[PartnerLogin] URL의 next 파라미터 사용:', redirectPath);
      } else {
        // 마지막으로 /api/auth/me를 호출해서 mallUserId 가져오기
        try {
          const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
          if (meResponse.ok) {
            const meJson = await meResponse.json();
            if (meJson?.ok && meJson?.user?.mallUserId) {
              redirectPath = `/partner/${meJson.user.mallUserId}/dashboard`;
              console.log('[PartnerLogin] /api/auth/me에서 mallUserId 사용:', redirectPath);
            } else {
              const errorMsg = '사용자 정보를 가져올 수 없습니다. mallUserId가 없습니다.';
              setError(errorMsg);
              setLoading(false);
              return;
            }
          } else {
            const errorMsg = '사용자 정보를 가져올 수 없습니다.';
            setError(errorMsg);
            setLoading(false);
            return;
          }
        } catch (meError) {
          console.error('[PartnerLogin] /api/auth/me 호출 실패:', meError);
          const errorMsg = '사용자 정보를 가져올 수 없습니다.';
          setError(errorMsg);
          setLoading(false);
          return;
        }
      }
      
      console.log('[PartnerLogin] 최종 리다이렉트 경로:', redirectPath);
      
      // 강제 리다이렉트 (세션 쿠키가 설정되도록 약간의 지연 후 리다이렉트)
      // window.location.replace를 사용하여 히스토리에 남기지 않음 (뒤로가기 시 무한 루프 방지)
      setTimeout(() => {
        console.log('[PartnerLogin] 리다이렉트 실행:', redirectPath);
        window.location.replace(redirectPath);
      }, 200);
    } catch (error) {
      const errorMsg = `로그인 중 문제가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
      setError(errorMsg);
      console.error('[PartnerLogin] error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100 to-red-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow">
            <img src="/images/ai-cruise-logo.png" alt="크루즈닷" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">파트너 모드 로그인</h1>
          <p className="text-sm text-slate-600">
            대리점장 · 판매원 전용 크루즈몰 관리 메뉴에 접속하려면 로그인하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white/95 p-8 shadow-xl space-y-6 border border-slate-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <strong>오류:</strong> {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">아이디 / 전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder=""
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoComplete="off"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl text-white font-semibold py-3 shadow transition ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 space-y-1">
          <div>계정 정보는 본사에서 발급한 파트너 전용 자격을 사용합니다.</div>
          <div>(주)마비즈컴퍼니 마비즈스쿨 원격평생교육원 수강생들만 사용 가능한 플랫폼 입니다.</div>
          <div>교육문의 jmonica@cruisedot.co.kr</div>
        </div>

        {/* 3일 무료 체험 버튼 */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={() => router.push('/subscription/login')}
            className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold py-3 px-4 shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>3일 무료 마비즈인 체험하기</span>
            <FiArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
