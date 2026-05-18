'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, MessageSquare, Mail, Clock } from 'lucide-react';

interface StepFiveProps {
  formData: {
    title: string;
    groupId: string;
    sendSms: boolean;
    smsBody: string;
    sendEmail: boolean;
    emailSubject: string;
    emailBody: string;
    sendAt: string;
    repeatRule: string;
  };
  groupName: string;
  memberCount: number;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function StepFive({
  formData,
  groupName,
  memberCount,
  onBack,
  onSubmit,
  loading,
}: StepFiveProps) {
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
    const rules: Record<string, string> = {
      ONCE: '일회만 발송',
      WEEKLY_MON: '매주 월요일',
      WEEKLY_WED: '매주 수요일',
      WEEKLY_FRI: '매주 금요일',
      MONTHLY_1: '매월 1일',
      MONTHLY_15: '매월 15일',
    };
    return rules[rule] || '일회만 발송';
  };

  const channelCount = (formData.sendSms ? 1 : 0) + (formData.sendEmail ? 1 : 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">5단계: 검토 및 생성</h2>
        <p className="text-sm text-gray-600 mt-1">모든 설정을 확인하고 캠페인을 생성하세요.</p>
      </div>

      {/* 요약 카드 */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6 space-y-4">
        {/* 기본 정보 */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-700 font-medium">캠페인명</p>
              <p className="text-sm font-semibold text-gray-900">{formData.title}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-700 font-medium">타겟 그룹</p>
              <p className="text-sm font-semibold text-gray-900">
                {groupName} <span className="text-blue-600">({memberCount}명)</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-700 font-medium">발송 채널</p>
              <div className="flex gap-3 mt-1">
                {formData.sendSms && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs font-medium text-gray-700">
                    <MessageSquare className="w-3 h-3" />
                    SMS
                  </div>
                )}
                {formData.sendEmail && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs font-medium text-gray-700">
                    <Mail className="w-3 h-3" />
                    이메일
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-700 font-medium">발송 일정</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatSendAt(formData.sendAt)}
              </p>
              {formData.repeatRule && formData.repeatRule !== 'ONCE' && (
                <p className="text-xs text-blue-600 mt-1">
                  🔄 {getRepeatLabel(formData.repeatRule)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 미리보기 */}
      <div className="space-y-4">
        {formData.sendSms && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                SMS 미리보기
              </p>
            </div>
            <div className="p-4 bg-white">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 font-mono text-sm text-gray-900 whitespace-pre-wrap break-words">
                {formData.smsBody}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {formData.smsBody.length}자 ({Math.ceil((formData.smsBody.length * 2) / 45)}건)
              </p>
            </div>
          </div>
        )}

        {formData.sendEmail && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                이메일 미리보기
              </p>
            </div>
            <div className="p-4 bg-white space-y-2">
              <div>
                <p className="text-xs text-gray-600 font-medium">제목</p>
                <p className="text-sm font-semibold text-gray-900 break-words">
                  {formData.emailSubject}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">본문</p>
                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {formData.emailBody}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 경고 메시지 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">생성 후 수정 불가</p>
          <p className="text-xs mt-1">
            캠페인 생성 후에는 메시지 내용을 수정할 수 없습니다. 확인 후 생성해주세요.
          </p>
        </div>
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
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {loading ? '생성 중...' : '캠페인 생성'}
        </Button>
      </div>
    </div>
  );
}
