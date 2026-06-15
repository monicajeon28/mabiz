'use client';

import { useState } from 'react';

export default function UnsubscribePage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (value: string) => {
    // 숫자만 추출
    const digitsOnly = value.replace(/\D/g, '');

    // 자동 하이픈 추가: 010-1234-5678
    let formatted = '';
    if (digitsOnly.length <= 3) {
      formatted = digitsOnly;
    } else if (digitsOnly.length <= 7) {
      formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
    } else {
      formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7, 11)}`;
    }

    setPhone(formatted);
  };

  const validatePhone = (value: string): boolean => {
    // 최소 11자리 숫자 필요 (010-1234-5678)
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length === 11;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmed) {
      setError('동의 체크박스를 선택해주세요.');
      return;
    }

    if (!phone.trim()) {
      setError('연락처는 필수입니다.');
      return;
    }

    if (!validatePhone(phone)) {
      setError('연락처 형식을 확인해주세요. (예: 010-1234-5678)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: process.env.NEXT_PUBLIC_ORG_ID || 'default',
          phone,
          name: name.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '오류가 발생했습니다.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      console.error('Unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-4 text-gray-900">수신거부 완료!</h1>
          <p className="text-gray-600 mb-8 text-base leading-relaxed">
            앞으로 더 이상 문자를 받지 않습니다.<br />
            <span className="text-sm text-gray-500">불편함을 끼쳐 드려 죄송합니다.</span>
          </p>
          <a
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-lg transition"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* 제목 */}
        <h1 className="text-4xl font-bold mb-2 text-gray-900">수신거부</h1>

        {/* 설명 문구 */}
        <p className="text-gray-600 mb-8 text-base leading-relaxed">
          문자를 더 이상 받고 싶지 않으신가요?<br />
          <span className="text-sm text-gray-500">언제든 신청을 중단할 수 있습니다.</span>
        </p>

        {/* 구분선 */}
        <div className="border-t border-gray-200 mb-8"></div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 이름 입력 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              이름 <span className="text-gray-400 text-sm">(선택)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 김철수"
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={loading}
            />
          </div>

          {/* 연락처 입력 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={loading}
              inputMode="numeric"
            />
            {phone && !validatePhone(phone) && (
              <p className="mt-1 text-xs text-gray-500">형식: 010-1234-5678</p>
            )}
          </div>

          {/* 동의 체크 */}
          <div className="flex items-start space-x-3 py-4 px-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 cursor-pointer rounded"
              disabled={loading}
            />
            <label htmlFor="confirm" className="text-base text-gray-700 cursor-pointer flex-1">
              영구적으로 수신거부하겠습니다
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || !phone.trim() || !confirmed}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition text-base"
          >
            {loading ? '처리 중...' : '🔴 영구 거부하기'}
          </button>

          {/* 취소 링크 */}
          <div className="text-center pt-2">
            <a
              href="/"
              className="text-gray-500 text-sm hover:text-gray-700 transition"
            >
              취소
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
