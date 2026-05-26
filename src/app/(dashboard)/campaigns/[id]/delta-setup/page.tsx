'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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
  // 저장 후 리다이렉트 (P1: setTimeout cleanup 추가)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (state.error || !state.isSaving) return;

    const timeoutId = setTimeout(() => {
      if (!state.error) {
        router.push(`/campaigns/${campaignId}`);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [state.error, state.isSaving, campaignId, router]);

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

  // Animation variants for Step transitions (P1 1-2)
  const stepVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 페이지 레이아웃
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">렌탈 SMS 마법사</h1>
        <p className="text-gray-600">
          고객의 여행 상품 구매 후 4일에 걸쳐 렌탈 서비스를 자동으로 추천하세요.
        </p>
      </motion.div>

      {/* 진행도 표시 with smooth color transition (P1 4) */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((step) => (
          <motion.div
            key={step}
            className={`flex-1 h-2 rounded-full ${
              step <= state.currentStep
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}
            animate={{
              backgroundColor: step <= state.currentStep ? '#2563eb' : '#e5e7eb',
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      <motion.p
        className="text-sm text-gray-600 text-center"
        key={state.currentStep}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        Step {state.currentStep}/4
      </motion.p>

      {/* Step 컴포넌트 with AnimatePresence (P1 1-2) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.currentStep}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
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
        </motion.div>
      </AnimatePresence>

      {/* 에러 메시지 with error state visualization (P1 7) */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-red-50 border-2 border-red-300 rounded-lg p-4 animate-pulse"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-sm text-red-800">⚠️ {state.error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 네비게이션 버튼 with hover/active states (P1 8-9) */}
      <motion.div
        className="flex gap-3 justify-between pt-6 border-t"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handlePrev}
            disabled={state.currentStep === 1}
            variant="outline"
            className="px-6 transition-all duration-200 disabled:opacity-50"
          >
            이전
          </Button>
        </motion.div>

        <div className="flex gap-3">
          {state.currentStep < 4 && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={handleNext}
                disabled={!isStepValid(state.currentStep) || state.isSaving}
                className="px-6 bg-blue-600 hover:bg-blue-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
                title={!isStepValid(state.currentStep) ? "모든 필수 필드를 입력하세요" : ""}
              >
                다음
              </Button>
            </motion.div>
          )}

          {state.currentStep === 4 && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={handleSave}
                disabled={state.isSaving}
                className="px-8 bg-green-600 hover:bg-green-700 transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-50"
              >
                {state.isSaving ? '저장 중...' : '저장'}
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
