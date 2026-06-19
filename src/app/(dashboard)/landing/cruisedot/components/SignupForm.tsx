'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

// 8가지 신청 형식
const SIGNUP_FORMATS = [
  {
    id: 'product-inquiry',
    icon: '📋',
    title: '상품신청',
    description: '크루즈 여행 상품 신청',
    emoji: '📋',
    popular: true,
    order: 1
  },
  {
    id: 'video-intro',
    icon: '🎥',
    title: '영상 소개',
    description: '크루즈 여행 영상 보기',
    emoji: '🎥',
    popular: true,
    order: 2
  },
  {
    id: 'webinar',
    icon: '🎓',
    title: '설명회',
    description: '실시간 온라인 설명회 참석',
    emoji: '🎓',
    popular: true,
    order: 3
  },
  {
    id: 'consultation',
    icon: '💬',
    title: '전문상담',
    description: '전문가와 1:1 상담',
    emoji: '💬',
    popular: false,
    order: 4
  },
  {
    id: 'brochure',
    icon: '📄',
    title: '브로셔요청',
    description: '상세 브로셔 받기',
    emoji: '📄',
    popular: false,
    order: 5
  },
  {
    id: 'callback',
    icon: '☎️',
    title: '콜백요청',
    description: '편한 시간에 연락받기',
    emoji: '☎️',
    popular: false,
    order: 6
  },
  {
    id: 'group-tour',
    icon: '👥',
    title: '단체여행',
    description: '단체 여행 상담',
    emoji: '👥',
    popular: false,
    order: 7
  },
  {
    id: 'partnership',
    icon: '🤝',
    title: '제휴문의',
    description: '비즈니스 제휴 문의',
    emoji: '🤝',
    popular: false,
    order: 8
  }
];

// 상위 3개 형식 (popular=true)
const POPULAR_FORMATS = SIGNUP_FORMATS.filter(f => f.popular).sort((a, b) => a.order - b.order);
// 나머지 5개 형식 (popular=false)
const OTHER_FORMATS = SIGNUP_FORMATS.filter(f => !f.popular).sort((a, b) => a.order - b.order);

export default function SignupForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    problem: '',
    selectedFormat: POPULAR_FORMATS[0].id,
    budget: ''
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showMoreModal, setShowMoreModal] = useState(false);
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

  const handleFormatSelect = (formatId: string) => {
    setFormData(prev => ({ ...prev, selectedFormat: formatId }));
    setShowMoreModal(false);
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

      // selectedFormat 필드명 유지 (travelType 대신)
      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          travelType: formData.selectedFormat, // 호환성 유지
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
      setFormData({ name: '', email: '', phone: '', problem: '', selectedFormat: POPULAR_FORMATS[0].id, budget: '' });

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
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-label="크루즈 여행 상담 신청 폼"
        noValidate
      >
        {/* 신청 형식 선택 - 상위 3개 크게 표시 */}
        <div>
          <label className="block text-sm font-semibold text-white mb-4">
            어떤 방식으로 신청하시나요? *
          </label>

          {/* 상위 3개: 큰 카드 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {POPULAR_FORMATS.map(format => (
              <button
                key={format.id}
                type="button"
                onClick={() => handleFormatSelect(format.id)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  formData.selectedFormat === format.id
                    ? 'border-yellow-400 bg-yellow-100 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-yellow-300'
                }`}
              >
                <div className="text-3xl mb-2">{format.emoji}</div>
                <div className="text-sm font-bold text-gray-800">{format.title}</div>
                <div className="text-xs text-gray-600 mt-1">{format.description}</div>
              </button>
            ))}
          </div>

          {/* 더보기 버튼 */}
          <button
            type="button"
            onClick={() => setShowMoreModal(true)}
            className="w-full px-3 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 text-sm font-semibold transition-colors"
          >
            더보기 (5가지 추가)
          </button>

          {/* 성과 예측 */}
          <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg text-center">
            <p className="text-white text-sm font-semibold">
              ✨ 평균 등록율 <span className="text-yellow-200">45%</span>
            </p>
            <p className="text-blue-100 text-xs mt-1">
              선택한 형식으로 진행됩니다
            </p>
          </div>
        </div>

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

      {/* 더보기 모달 */}
      {showMoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">모든 신청 형식 (5가지 추가)</h2>
              <button
                type="button"
                onClick={() => setShowMoreModal(false)}
                className="text-white text-2xl hover:text-gray-200 transition"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-6">
              {/* 상위 3개 (이미 선택됨) */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">인기 신청 형식</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {POPULAR_FORMATS.map(format => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => handleFormatSelect(format.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-center ${
                        formData.selectedFormat === format.id
                          ? 'border-yellow-400 bg-yellow-100'
                          : 'border-gray-200 bg-gray-50 hover:border-yellow-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">{format.emoji}</div>
                      <div className="text-sm font-bold text-gray-800">{format.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{format.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <hr className="my-6" />

              {/* 추가 5가지 */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">다른 신청 형식</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {OTHER_FORMATS.map(format => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => handleFormatSelect(format.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        formData.selectedFormat === format.id
                          ? 'border-blue-400 bg-blue-100'
                          : 'border-gray-200 bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{format.emoji}</div>
                        <div>
                          <div className="font-bold text-gray-800">{format.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{format.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="bg-gray-100 px-6 py-4 text-center">
              <button
                type="button"
                onClick={() => setShowMoreModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
