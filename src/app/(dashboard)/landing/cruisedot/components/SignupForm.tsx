'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

export default function SignupForm() {
  const router = useRouter();
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // 폰번호 포맷 정규화 (하이픈 제거 후 재포맷)
      const phoneClean = formData.phone.replace(/[^0-9]/g, '');
      let phoneFormatted = phoneClean;

      // 10-11자리 번호에 하이픈 추가
      if (phoneClean.length === 11) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 7)}-${phoneClean.slice(7)}`;
      } else if (phoneClean.length === 10) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 6)}-${phoneClean.slice(6)}`;
      }

      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          phone: phoneFormatted
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || '신청 중 오류가 발생했습니다');
        return;
      }

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        problem: '',
        travelType: '',
        budget: ''
      });

      // 2초 후 성공 메시지 표시, 3초 후 다시 초기화
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      logger.error('signup-form:submit', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 이름 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          성함 *
        </label>
        <input
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
        <label className="block text-sm font-semibold text-white mb-2">
          이메일 *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="예) kim@email.com"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 폰번호 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          휴대폰 번호 *
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="예) 010-1234-5678"
          pattern="01[0-9]-?\d{3,4}-?\d{4}"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 여행 유형 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          어떤 크루즈를 원하시나요?
        </label>
        <select
          name="travelType"
          value={formData.travelType}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="국내">국내 크루즈 (부산)</option>
          <option value="해외">해외 크루즈 (일본/동남아)</option>
          <option value="프리미엄">프리미엄</option>
          <option value="경제형">경제형</option>
          <option value="gold-member">골드 회원 프로그램</option>
        </select>
      </div>

      {/* 예산 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          예산 범위
        </label>
        <select
          name="budget"
          value={formData.budget}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="20-30만원">20-30만원 (국내)</option>
          <option value="130만원">130만원 (경제형)</option>
          <option value="159만원">159만원 (프리미엄)</option>
          <option value="그 이상">그 이상</option>
        </select>
      </div>

      {/* 신청 사유 / 문제 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          신청 사유 (선택)
        </label>
        <textarea
          name="problem"
          value={formData.problem}
          onChange={handleChange}
          placeholder="예) 혼자 여행이라 불안해요 / 여행 준비가 복잡해서요 / 예산을 아껴야 해서요"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 resize-none"
        />
      </div>

      {/* 에러 메시지 */}
      {status === 'error' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ❌ {errorMessage}
        </div>
      )}

      {/* 성공 메시지 */}
      {status === 'success' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ 신청이 완료되었습니다! 매니저가 2시간 내 연락 드릴 예정입니다.
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-colors ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700'
        }`}
      >
        {loading ? '신청 중...' : '🚀 지금 신청하기 (무료)'}
      </button>

      {/* 약관 동의 */}
      <p className="text-xs text-blue-100 text-center">
        신청함으로써 개인정보 수집·이용에 동의합니다 (
        <a href="#" className="underline hover:text-white">
          이용약관
        </a>
        · <a href="#" className="underline hover:text-white">
          개인정보처리방침
        </a>
        )
      </p>
    </form>
  );
}
