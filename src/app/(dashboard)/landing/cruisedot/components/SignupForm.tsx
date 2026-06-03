'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    problem: '',
    travelType: '',
    budget: ''
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 setTimeout 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const phoneClean = formData.phone.replace(/[^0-9]/g, '');
      let phoneFormatted = phoneClean;
      if (phoneClean.length === 11) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 7)}-${phoneClean.slice(7)}`;
      } else if (phoneClean.length === 10) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 6)}-${phoneClean.slice(6)}`;
      }

      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, phone: phoneFormatted })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || '신청 중 오류가 발생했습니다');
        return;
      }

      setStatus('success');
      setFormData({ name: '', email: '', phone: '', problem: '', travelType: '', budget: '' });

      timerRef.current = setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      logger.error('signup-form:submit', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label="크루즈 여행 상담 신청 폼"
      noValidate
    >
      {/* 성함 */}
      <div>
        <label htmlFor="signup-name" className="block text-sm font-semibold text-white mb-2">
          성함 *
        </label>
        <input
          id="signup-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="예) 김민지"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 이메일 */}
      <div>
        <label htmlFor="signup-email" className="block text-sm font-semibold text-white mb-2">
          이메일 *
        </label>
        <input
          id="signup-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="예) kim@email.com"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 휴대폰 번호 */}
      <div>
        <label htmlFor="signup-phone" className="block text-sm font-semibold text-white mb-2">
          휴대폰 번호 *
        </label>
        <input
          id="signup-phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="예) 010-1234-5678"
          pattern="01[0-9]-?[0-9]{3,4}-?[0-9]{4}"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 여행 유형 */}
      <div>
        <label htmlFor="signup-travel-type" className="block text-sm font-semibold text-white mb-2">
          어떤 크루즈를 원하시나요?
        </label>
        <select
          id="signup-travel-type"
          name="travelType"
          value={formData.travelType}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="국내">국내 크루즈 (부산, 20-30만원)</option>
          <option value="해외">해외 크루즈 — 일본 프리미엄 (159만원)</option>
          <option value="경제형">해외 크루즈 — 동남아 경제형 (130만원)</option>
          <option value="프리미엄">프리미엄 패키지</option>
          <option value="gold-member">골드 회원 프로그램</option>
        </select>
      </div>

      {/* 예산 */}
      <div>
        <label htmlFor="signup-budget" className="block text-sm font-semibold text-white mb-2">
          예산 범위
        </label>
        <select
          id="signup-budget"
          name="budget"
          value={formData.budget}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="20-30만원">월 3만원대 (국내, 20-30만원)</option>
          <option value="130만원">월 4만원대 (동남아, 130만원)</option>
          <option value="159만원">월 5만원대 (일본, 159만원)</option>
          <option value="그 이상">프리미엄 (그 이상)</option>
        </select>
      </div>

      {/* 신청 사유 */}
      <div>
        <label htmlFor="signup-problem" className="block text-sm font-semibold text-white mb-2">
          궁금하신 점 (선택)
        </label>
        <textarea
          id="signup-problem"
          name="problem"
          value={formData.problem}
          onChange={handleChange}
          placeholder="예) 혼자 여행이라 불안해요 / 할부가 정말 가능한지 / 어떤 상품이 맞는지"
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 resize-none"
        />
        <p className="text-xs text-blue-200 text-right mt-1">{formData.problem.length}/500</p>
      </div>

      {/* 에러 메시지 */}
      {status === 'error' && (
        <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ❌ {errorMessage}
        </div>
      )}

      {/* 성공 메시지 */}
      {status === 'success' && (
        <div role="status" aria-live="polite" className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ 신청이 완료됐습니다! 매니저가 2시간 내 연락 드릴 예정입니다.
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-colors ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700'
        }`}
      >
        {loading ? '신청 중...' : '📞 매니저 연결하기 (무료 상담)'}
      </button>

      {/* 약관 동의 */}
      <p className="text-xs text-blue-100 text-center">
        신청함으로써 개인정보 수집·이용에 동의합니다 (
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
          이용약관
        </a>
        ·{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
          개인정보처리방침
        </a>
        )
      </p>
    </form>
  );
}
