'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDeltaWizard } from '@/hooks/useDeltaWizard';
import TriggerSelector from '@/components/delta-setup/TriggerSelector';
import MessageSelector from '@/components/delta-setup/MessageSelector';
import MessagePreview from '@/components/delta-setup/MessagePreview';
import ScheduleVisualizer from '@/components/delta-setup/ScheduleVisualizer';
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
        <MessagePreview
          messages={
            state.useDefaultMessages ? defaultMessages : state.messages
          }
        />
      )}

      {state.currentStep === 4 && (
        <ScheduleVisualizer triggerType={state.triggerType} />
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
              title={!isStepValid(state.currentStep) ? "모든 필수 필드를 입력하세요" : ""}
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
