'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare, Mail, CheckCircle } from 'lucide-react';

interface StepTwoProps {
  formData: { sendSms: boolean; sendEmail: boolean };
  onBack: () => void;
  onNext: () => void;
  onChange: (field: string, value: boolean) => void;
  loading: boolean;
}

export default function StepTwo({
  formData,
  onBack,
  onNext,
  onChange,
  loading,
}: StepTwoProps) {
  const isValid = formData.sendSms || formData.sendEmail;

  const channels = [
    {
      id: 'sms',
      label: 'SMS 발송',
      icon: MessageSquare,
      description: '고객에게 문자 메시지를 발송합니다 (한글 최대 90자)',
      key: 'sendSms',
    },
    {
      id: 'email',
      label: '이메일 발송',
      icon: Mail,
      description: '고객에게 이메일을 발송합니다 (제목 + 본문)',
      key: 'sendEmail',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">2단계: 발송 채널 선택</h2>
        <p className="text-sm text-gray-600 mt-1">최소 하나 이상의 채널을 선택하세요.</p>
      </div>

      <div className="space-y-3">
        {channels.map((channel) => {
          const IconComponent = channel.icon;
          const isSelected = formData[channel.key as keyof typeof formData];

          return (
            <label
              key={channel.id}
              className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center mt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onChange(channel.key, e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5 text-gray-600" />
                  <p className="font-medium text-gray-900">{channel.label}</p>
                  {isSelected && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                </div>
                <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
              </div>
            </label>
          );
        })}
      </div>

      {!isValid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            최소 하나 이상의 발송 채널을 선택해주세요.
          </p>
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
