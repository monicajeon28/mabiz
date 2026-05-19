'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/lib/api/use-toast';
import deltaSequence from '@/data/delta_sms_sequence.json';
import { logger } from '@/lib/logger';

/**
 * Delta SMS Wizard 상태 인터페이스
 */
export interface WizardState {
  currentStep: number;
  campaignId: string;
  triggerType: 'PURCHASE' | 'ABANDONED';
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  useDefaultMessages: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Default messages 타입
 */
export interface DefaultMessages {
  day0: string;
  day1: string;
  day2: string;
  day3: string;
}

/**
 * useDeltaWizard Hook
 * 렌탈 SMS 마법사의 상태 관리 및 API 통신 담당
 *
 * @param campaignId - 캠페인 ID
 * @returns {
 *   state: WizardState,
 *   defaultMessages: DefaultMessages,
 *   isStepValid: (step: number) => boolean,
 *   handleNext: () => void,
 *   handlePrev: () => void,
 *   toggleDefault: () => void,
 *   setMessage: (day: 'day0' | 'day1' | 'day2' | 'day3', content: string) => void,
 *   handleSave: () => Promise<void>,
 *   setTriggerType: (type: 'PURCHASE' | 'ABANDONED') => void,
 * }
 */
export function useDeltaWizard(campaignId: string) {
  const { toast } = useToast();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. State 초기화
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    campaignId,
    triggerType: 'PURCHASE',
    messages: {
      day0: '',
      day1: '',
      day2: '',
      day3: '',
    },
    useDefaultMessages: true,
    isLoading: false,
    isSaving: false,
    error: null,
  });

  // Default messages 계산 (triggerType 기반)
  const getDefaultMessages = useCallback((): DefaultMessages => {
    const triggerConfig = deltaSequence.triggers[state.triggerType];
    return {
      day0: triggerConfig.days[0].message,
      day1: triggerConfig.days[1].message,
      day2: triggerConfig.days[2].message,
      day3: triggerConfig.days[3].message,
    };
  }, [state.triggerType]);

  const defaultMessages = getDefaultMessages();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 초기 로드 (GET /api/campaigns/[id]/delta)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const loadExistingConfig = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await fetch(`/api/campaigns/${campaignId}/delta`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          // 404는 첫 설정이므로 기본값으로 초기화
          if (response.status === 404) {
            const defaultMsgs = getDefaultMessages();
            setState((prev) => ({
              ...prev,
              isLoading: false,
              messages: defaultMsgs,
              useDefaultMessages: true,
              error: null,
            }));
            return;
          }

          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.message || '설정 로드 실패');
        }

        // 기존 설정이 있으면 로드
        const loadedMessages: DefaultMessages = {
          day0: data.schedule[0]?.message || '',
          day1: data.schedule[1]?.message || '',
          day2: data.schedule[2]?.message || '',
          day3: data.schedule[3]?.message || '',
        };

        setState((prev) => ({
          ...prev,
          isLoading: false,
          triggerType: data.triggerType || 'PURCHASE',
          messages: loadedMessages,
          useDefaultMessages: false, // 기존 설정이 있으면 커스텀 모드
          error: null,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
        console.error('[useDeltaWizard] 로드 실패:', errorMsg);
        logger.warn('[useDeltaWizard] 초기 설정 로드 실패', { campaignId, error: errorMsg });

        // 에러 발생 시 기본값으로 초기화
        const defaultMsgs = getDefaultMessages();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          messages: defaultMsgs,
          useDefaultMessages: true,
          error: null,
        }));
      }
    };

    loadExistingConfig();
  }, [campaignId, getDefaultMessages]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Step 검증 로직
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const isStepValid = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        // Step 1: triggerType 필수
        return !!state.triggerType;
      case 2:
        // Step 2: 모든 메시지 필수 (useDefaultMessages 또는 직접입력)
        if (state.useDefaultMessages) {
          return true; // 기본값 사용 시 자동 완료
        }
        // 직접입력 모드: day0-3 모두 필수
        return (
          !!state.messages.day0.trim() &&
          !!state.messages.day1.trim() &&
          !!state.messages.day2.trim() &&
          !!state.messages.day3.trim()
        );
      case 3:
      case 4:
        return true; // 리뷰/스케줄 단계는 검증 불필요
      default:
        return false;
    }
  }, [state]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 네비게이션 핸들러
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleNext = useCallback(() => {
    if (isStepValid(state.currentStep)) {
      setState((prev) => ({
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, 4),
      }));
    }
  }, [state.currentStep, isStepValid]);

  const handlePrev = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 상태 업데이트 핸들러
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const toggleDefault = useCallback(() => {
    setState((prev) => {
      const newUseDefault = !prev.useDefaultMessages;

      // 기본값으로 전환 시 메시지 초기화
      if (newUseDefault) {
        const defaultMsgs = getDefaultMessages();
        return {
          ...prev,
          useDefaultMessages: newUseDefault,
          messages: defaultMsgs,
        };
      }

      return { ...prev, useDefaultMessages: newUseDefault };
    });
  }, [getDefaultMessages]);

  const setMessage = useCallback(
    (day: 'day0' | 'day1' | 'day2' | 'day3', content: string) => {
      setState((prev) => ({
        ...prev,
        messages: {
          ...prev.messages,
          [day]: content,
        },
      }));
    },
    []
  );

  const setTriggerType = useCallback((type: 'PURCHASE' | 'ABANDONED') => {
    setState((prev) => {
      // triggerType 변경 시 기본값 재계산
      const newState = { ...prev, triggerType: type };
      return newState;
    });
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 저장 핸들러 (POST /api/campaigns/delta)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSave = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      // 전송할 메시지 준비
      const messagesToSend = state.useDefaultMessages
        ? defaultMessages
        : state.messages;

      const payload = {
        campaignId: state.campaignId,
        triggerType: state.triggerType,
        deltaDay0Message: messagesToSend.day0,
        deltaDay1Message: messagesToSend.day1,
        deltaDay2Message: messagesToSend.day2,
        deltaDay3Message: messagesToSend.day3,
      };

      const response = await fetch('/api/campaigns/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 에러 처리 (네트워크/검증/서버 구분)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (!response.ok) {
        // HTTP 400 - 검증 실패
        if (response.status === 400) {
          const errorMsg = data.message || data.errors?.[Object.keys(data.errors)[0]] || '입력값 검증 실패';
          setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
          toast({
            title: '검증 오류',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }

        // HTTP 404 - 캠페인 없음
        if (response.status === 404) {
          const errorMsg = data.message || '캠페인을 찾을 수 없습니다.';
          setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
          toast({
            title: '오류',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }

        // 기타 HTTP 에러 (500 등)
        const errorMsg = data.message || `서버 오류 (${response.status})`;
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        toast({
          title: '서버 오류',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }

      if (!data.ok) {
        const errorMsg = data.message || '설정 저장 실패';
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        toast({
          title: '오류',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 성공 처리
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: null,
      }));

      toast({
        title: '성공',
        description: '렌탈 SMS 설정이 저장되었습니다.',
        variant: 'success',
      });

      logger.log('[useDeltaWizard] 설정 저장 성공', {
        campaignId: state.campaignId,
        triggerType: state.triggerType,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[useDeltaWizard] 저장 실패:', errorMsg);
      logger.error('[useDeltaWizard] 설정 저장 오류', { campaignId: state.campaignId, error: errorMsg });

      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: errorMsg,
      }));

      toast({
        title: '오류',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  }, [state, defaultMessages, toast]);

  return {
    state,
    defaultMessages,
    isStepValid,
    handleNext,
    handlePrev,
    toggleDefault,
    setMessage,
    setTriggerType,
    handleSave,
  };
}
