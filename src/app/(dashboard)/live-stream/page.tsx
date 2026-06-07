'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showSuccess, showError } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
const toast = {
  success: (msg: string) => showSuccess(msg),
  error: (msg: string) => showError(msg),
};

/**
 * Live Stream Registration Page
 * 라이브방송 신청 폼 UI
 */

type Segment = 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON';

export default function LiveStreamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment>('LOW_PRICE');

  // 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    note: '',
    consent: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/live-stream/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          segment: selectedSegment,
          eventDate: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || '신청 실패');
        return;
      }

      // 성공
      toast.success('🎉 신청 완료! 24시간 내 담당자가 연락드리겠습니다.');

      // 입력창 초기화
      setFormData({ name: '', phone: '', email: '', note: '', consent: false });

      // 2초 후 페이지 이동 (선택사항)
      setTimeout(() => {
        // router.push('/dashboard'); // 원하는 페이지로 이동
      }, 2000);
    } catch (error) {
      logger.error('Registration error:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎬 마비즈 라이브방송 신청
          </h1>
          <p className="text-xl text-gray-600">
            매주 화요일 19:00 | 60분 특별 강의
          </p>
        </div>

        {/* 세그먼트 선택 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            여행 유형을 선택하세요
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 저가 */}
            <SegmentCard
              id="LOW_PRICE"
              title="💰 저가 여행"
              description="300-500만 원 예산"
              subtitle="가족 중심 / 실리 중심"
              selected={selectedSegment === 'LOW_PRICE'}
              onClick={() => setSelectedSegment('LOW_PRICE')}
            />

            {/* 효도 */}
            <SegmentCard
              id="FILIAL"
              title="👴👵 효도 여행"
              description="의료진 동반"
              subtitle="부모님 중심 / 안심"
              selected={selectedSegment === 'FILIAL'}
              onClick={() => setSelectedSegment('FILIAL')}
            />

            {/* 신혼 */}
            <SegmentCard
              id="HONEYMOON"
              title="💑 신혼 여행"
              description="로맨스 + 사진"
              subtitle="부부 중심 / 추억"
              selected={selectedSegment === 'HONEYMOON'}
              onClick={() => setSelectedSegment('HONEYMOON')}
            />
          </div>
        </div>

        {/* 신청 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 mb-8">
          {/* 이름 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              성명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 김미영"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 전화번호 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              휴대폰 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="010-1234-5678"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 이메일 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="example@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 추가 요청사항 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              추가 요청사항 (선택)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="예: 휠체어 필요, 특정 음식 알레르기 등"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 동의 */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.consent}
                onChange={(e) =>
                  setFormData({ ...formData, consent: e.target.checked })
                }
                className="w-4 h-4 mt-1 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">
                <strong>SMS 수신 동의</strong> - 신청 완료 및 Day 0-3 자동 메시지를 받으실 수 있습니다.
              </span>
            </label>
          </div>

          {/* 버튼 */}
          <button
            type="submit"
            disabled={loading || !formData.consent}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            {loading ? '신청 중...' : '🎬 지금 신청하기'}
          </button>
        </form>

        {/* 혜택 안내 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            ⏰ 지금 신청하면?
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li>✅ 추가 20% 할인권</li>
            <li>✅ 1시간 내 신청 시: 가족사진 촬영권 (50만 원 상당)</li>
            <li>✅ 2시간 내 신청 시: 여행보험료 100% 환급</li>
            <li>✅ 24시간 담당자 전담 상담 (무료)</li>
          </ul>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            자주 묻는 질문
          </h3>

          <FAQItem
            question="비자는 어디서 처리하나요?"
            answer="저희가 전부 처리해드립니다. 여권만 있으면 됩니다!"
          />

          <FAQItem
            question="취소하면 돈을 잃나요?"
            answer="아니요, 72시간 내 전액 환불을 보증합니다."
          />

          <FAQItem
            question="24시간 내에 연락이 없으면?"
            answer="전화(1670-0000) 또는 카톡으로 연락주세요. 우리는 절대 연락 끊기지 않습니다!"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 세그먼트 카드 컴포넌트
 */
interface SegmentCardProps {
  id: string;
  title: string;
  description: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}

function SegmentCard({
  id,
  title,
  description,
  subtitle,
  selected,
  onClick,
}: SegmentCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-6 rounded-lg border-2 transition duration-200 ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-lg font-semibold text-blue-600 mb-1">{description}</p>
      <p className="text-sm text-gray-600">{subtitle}</p>
      {selected && (
        <div className="mt-3 text-blue-600 font-semibold">
          ✅ 선택됨
        </div>
      )}
    </button>
  );
}

/**
 * FAQ 아이템 컴포넌트
 */
interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-semibold text-gray-900">{question}</span>
        <span className={`text-2xl transition ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {open && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-gray-700">{answer}</p>
        </div>
      )}
    </div>
  );
}
