'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDeltaWizard } from '@/hooks/useDeltaWizard';
import TriggerSelector from '@/components/delta-setup/TriggerSelector';
import MessageSelector from '@/components/delta-setup/MessageSelector';
import { Button } from '@/components/ui/button';

/**
 * Delta SMS 마법사 페이지
 * URL: /campaigns/[id]/delta-setup
 *
 * 4개 단계:
 * Step 1: 트리거 선택 (PURCHASE / ABANDONED)
 * Step 2: 메시지 내용 (기본값 / 직접입력)
 * Step 3: 메시지 미리보기
 * Step 4: 발송 스케줄 시각화
 */
export default function DeltaSetupPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const {
    state,
    defaultMessages,
    isStepValid,
    handleNext,
    handlePrev,
    toggleDefault,
    setMessage,
    setTriggerType,
    handleSave,
  } = useDeltaWizard(campaignId);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 저장 후 리다이렉트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSaveAndClose = async () => {
    await handleSave();

    // 성공 시 (state.error가 없으면) 페이지 이동
    if (!state.error) {
      // 약간의 딜레이 후 이동 (toast 표시 시간)
      setTimeout(() => {
        router.push(`/campaigns/${campaignId}`);
      }, 1500);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 로딩 스켈레톤
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (state.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
            <div className="space-y-3">
              <div className="h-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 페이지 레이아웃
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">렌탈 SMS 마법사</h1>
        <p className="text-gray-600">
          고객의 여행 상품 구매 후 4일에 걸쳐 렌탈 서비스를 자동으로 추천하세요.
        </p>
      </div>

      {/* 진행도 표시 */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`flex-1 h-2 rounded-full transition ${
              step <= state.currentStep
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-gray-600 text-center">
        Step {state.currentStep}/4
      </p>

      {/* Step 컴포넌트 조건부 렌더링 */}
      {state.currentStep === 1 && (
        <TriggerSelector
          value={state.triggerType}
          onChange={setTriggerType}
        />
      )}

      {state.currentStep === 2 && (
        <MessageSelector
          triggerType={state.triggerType}
          useDefault={state.useDefaultMessages}
          onToggleDefault={toggleDefault}
          messages={state.messages}
          onMessageChange={setMessage}
          defaultMessages={defaultMessages}
        />
      )}

      {state.currentStep === 3 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Step 3: 메시지 미리보기</h2>
            <p className="text-sm text-gray-600 mt-1">저장 전 메시지 내용을 확인하세요.</p>
          </div>

          <div className="space-y-4">
            {[
              { day: 0, label: '📲 Day 0: 구매 직후' },
              { day: 1, label: '📤 Day 1: +1일' },
              { day: 2, label: '⏰ Day 2: +2일' },
              { day: 3, label: '🚨 Day 3: +3일' },
            ].map(({ day, label }) => {
              const dayKey = `day${day}` as 'day0' | 'day1' | 'day2' | 'day3';
              const content = state.useDefaultMessages
                ? defaultMessages[dayKey]
                : state.messages[dayKey];

              return (
                <div key={dayKey} className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">{label}</h3>
                  <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 break-words">
                    {content}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {content.length}자 ({content.length <= 90 ? 'SMS' : 'LMS'})
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              ✓ 메시지 내용을 확인했습니다. "다음 단계"를 클릭하여 계속하세요.
            </p>
          </div>
        </div>
      )}

      {state.currentStep === 4 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Step 4: 발송 스케줄</h2>
            <p className="text-sm text-gray-600 mt-1">자동 발송 일정을 확인하세요.</p>
          </div>

          <div className="space-y-3">
            {[
              { day: 0, icon: '📲', time: '09:00', trigger: 'PURCHASE' },
              { day: 1, icon: '📤', time: '09:00', days: '+1' },
              { day: 2, icon: '⏰', time: '09:00', days: '+2' },
              { day: 3, icon: '🚨', time: '09:00', days: '+3' },
            ].map(({ day, icon, time }) => (
              <div
                key={day}
                className="flex items-center gap-4 border rounded-lg p-4 bg-blue-50 border-blue-200"
              >
                <div className="text-2xl">{icon}</div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Day {day}</p>
                  <p className="text-sm text-gray-600">
                    {state.triggerType === 'PURCHASE'
                      ? '구매 직후'
                      : day === 0
                      ? '이탈 감지 직후'
                      : `이탈 감지 후 ${day}일`}
                    {' '}
                    <span className="text-blue-700 font-medium">{time}</span>에 발송
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">설정 완료 준비됨</h3>
            <p className="text-sm text-green-800">
              모든 단계를 완료했습니다. "저장"을 클릭하면 렌탈 SMS 자동화가 활성화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">⚠️ {state.error}</p>
        </div>
      )}

      {/* 네비게이션 버튼 */}
      <div className="flex gap-3 justify-between pt-6 border-t">
        <Button
          onClick={handlePrev}
          disabled={state.currentStep === 1}
          variant="outline"
          className="px-6"
        >
          이전
        </Button>

        <div className="flex gap-3">
          {state.currentStep < 4 && (
            <Button
              onClick={handleNext}
              disabled={!isStepValid(state.currentStep) || state.isSaving}
              className="px-6 bg-blue-600 hover:bg-blue-700"
            >
              다음
            </Button>
          )}

          {state.currentStep === 4 && (
            <Button
              onClick={handleSaveAndClose}
              disabled={state.isSaving}
              className="px-8 bg-green-600 hover:bg-green-700"
            >
              {state.isSaving ? '저장 중...' : '저장'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
