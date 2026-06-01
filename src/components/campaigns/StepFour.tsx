'use client';

import { Button } from '@/components/ui/button';
import { Clock, RotateCw } from 'lucide-react';

interface StepFourProps {
  formData: {
    sendAt: string;
    repeatRule: string;
  };
  onBack: () => void;
  onNext: () => void;
  onChange: (field: string, value: string) => void;
  loading: boolean;
}

const REPEAT_RULES = [
  { value: 'ONCE', label: '일회만 발송', description: '지정한 시간에 한 번만 발송합니다' },
  { value: 'WEEKLY_MON', label: '매주 월요일', description: '매주 월요일 같은 시간에 발송합니다' },
  { value: 'WEEKLY_WED', label: '매주 수요일', description: '매주 수요일 같은 시간에 발송합니다' },
  { value: 'WEEKLY_FRI', label: '매주 금요일', description: '매주 금요일 같은 시간에 발송합니다' },
  { value: 'MONTHLY_1', label: '매월 1일', description: '매월 1일 같은 시간에 발송합니다' },
  { value: 'MONTHLY_15', label: '매월 15일', description: '매월 15일 같은 시간에 발송합니다' },
];

export default function StepFour({
  formData,
  onBack,
  onNext,
  onChange,
  loading,
}: StepFourProps) {
  const isValid = formData.sendAt.trim().length > 0;

  // 예약 시간을 쉽게 읽을 수 있는 형식으로 변환
  const formatSendAt = (dateStr: string) => {
    if (!dateStr) return '미설정';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRepeatLabel = (rule: string) => {
    if (!rule || rule === 'ONCE') return '일회 발송';
    const found = REPEAT_RULES.find((r) => r.value === rule);
    return found ? found.label : '일회 발송';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">4단계: 발송 일정</h2>
        <p className="text-sm text-gray-600 mt-1">
          발송 시간을 선택하고, 필요하면 반복 규칙을 설정하세요.
        </p>
      </div>

      <div className="space-y-4">
        {/* 발송 시간 선택 */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            발송 시간 (필수)
          </label>
          <input
            type="datetime-local"
            value={formData.sendAt}
            onChange={(e) => onChange('sendAt', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {formData.sendAt && (
            <p className="text-sm text-gray-600 mt-2">
              📅 {formatSendAt(formData.sendAt)}에 발송됩니다
            </p>
          )}
        </div>

        {/* 반복 규칙 선택 */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            반복 규칙 (선택)
          </label>
          <div className="space-y-2">
            {REPEAT_RULES.map((rule) => (
              <label
                key={rule.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                  formData.repeatRule === rule.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="repeatRule"
                  value={rule.value}
                  checked={formData.repeatRule === rule.value}
                  onChange={(e) => onChange('repeatRule', e.target.value)}
                  className="w-4 h-4 mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{rule.label}</p>
                  <p className="text-sm text-gray-600">{rule.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 발송 일정 요약 */}
        {isValid && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900">
              발송 일정 요약
            </p>
            <div className="text-sm text-blue-800 space-y-1">
              <p>📅 {formatSendAt(formData.sendAt)}</p>
              <p>🔄 {getRepeatLabel(formData.repeatRule)}</p>
            </div>
          </div>
        )}

        {!isValid && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">발송 시간을 선택해주세요.</p>
          </div>
        )}
      </div>

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
