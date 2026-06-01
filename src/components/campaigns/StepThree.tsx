'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Mail } from 'lucide-react';

interface StepThreeProps {
  formData: {
    sendSms: boolean;
    smsBody: string;
    sendEmail: boolean;
    emailSubject: string;
    emailBody: string;
  };
  onBack: () => void;
  onNext: () => void;
  onChange: (field: string, value: string) => void;
  loading: boolean;
}

export default function StepThree({
  formData,
  onBack,
  onNext,
  onChange,
  loading,
}: StepThreeProps) {
  const [tab, setTab] = useState<'sms' | 'email'>(formData.sendSms ? 'sms' : 'email');

  // 검증: 선택된 채널의 메시지가 입력되었는지 확인
  const isSmsValid = !formData.sendSms || formData.smsBody.trim().length > 0;
  const isEmailValid =
    !formData.sendEmail ||
    (formData.emailSubject.trim().length > 0 && formData.emailBody.trim().length > 0);

  const isValid = isSmsValid && isEmailValid;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">3단계: 메시지 작성</h2>
        <p className="text-sm text-gray-600 mt-1">각 채널별 메시지 내용을 입력하세요.</p>
      </div>

      {/* 탭 선택 */}
      <div className="flex gap-2 border-b border-gray-200">
        {formData.sendSms && (
          <button
            onClick={() => setTab('sms')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              tab === 'sms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            문자 메시지
          </button>
        )}
        {formData.sendEmail && (
          <button
            onClick={() => setTab('email')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              tab === 'email'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            이메일
          </button>
        )}
      </div>

      {/* SMS 탭 */}
      {tab === 'sms' && formData.sendSms && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">메시지 본문</label>
            <textarea
              value={formData.smsBody}
              onChange={(e) => onChange('smsBody', e.target.value.slice(0, 90))}
              placeholder="문자 메시지를 입력하세요 (한글 최대 90자)"
              maxLength={90}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono text-sm"
            />
            <div className="flex justify-between mt-1">
              <p className="text-sm text-gray-500">
                {formData.smsBody.length}/90자
              </p>
              {formData.smsBody.length > 80 && (
                <p className="text-sm text-orange-600">
                  {Math.ceil((formData.smsBody.length * 2) / 45)}건 발송 예정
                </p>
              )}
            </div>
          </div>

          {!isSmsValid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">메시지 본문을 입력해주세요.</p>
            </div>
          )}
        </div>
      )}

      {/* 이메일 탭 */}
      {tab === 'email' && formData.sendEmail && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">제목</label>
            <input
              type="text"
              value={formData.emailSubject}
              onChange={(e) => onChange('emailSubject', e.target.value)}
              placeholder="예: 5월 특별 할인 안내"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.emailSubject.length}/100자
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">본문</label>
            <textarea
              value={formData.emailBody}
              onChange={(e) => onChange('emailBody', e.target.value)}
              placeholder="이메일 본문을 입력하세요 (HTML 텍스트 지원)"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.emailBody.length}자
            </p>
          </div>

          {!isEmailValid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                제목과 본문을 모두 입력해주세요.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 py-2"
          disabled={loading}
        >
          이전
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid || loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          다음 단계
        </Button>
      </div>
    </div>
  );
}
