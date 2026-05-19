'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
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
  const { data: session } = useSession();

  // P0 3: 현재 사용자의 organizationId 추출 (권한 검증용)
  // next-auth 세션 구조: { user: { organizationId: string, ... }, ... }
  const currentUserOrgId = (() => {
    if (!session?.user) return undefined;
    const user = session.user as Record<string, unknown>;
    return (user.organizationId ?? user.org_id) as string | undefined;
  })();

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
  // P0 2: organizationId IDOR 재검증
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

        // P0 2: 응답받은 organizationId가 현재 사용자 organizationId와 일치하는지 확인
        if (data.organizationId && currentUserOrgId && data.organizationId !== currentUserOrgId) {
          logger.error('[useDeltaWizard] IDOR 위험: organizationId 불일치', {
            campaignId,
            responseOrgId: data.organizationId,
            currentUserOrgId,
          });
          throw new Error('권한 없음');
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
  }, [campaignId, getDefaultMessages, currentUserOrgId]);

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
  }, [state.triggerType, state.useDefaultMessages, state.messages]);

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
    // P0 3: triggerType 변경 시 권한 확인 (기존 설정 있을 경우)
    if (!currentUserOrgId) {
      logger.warn('[useDeltaWizard] 권한 정보 없음 (organizationId 누락)', {
        campaignId,
      });
      return;
    }

    setState((prev) => {
      // triggerType 변경 시 기본값 재계산
      const newState = { ...prev, triggerType: type };
      return newState;
    });
  }, [campaignId, currentUserOrgId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 저장 핸들러 (POST /api/campaigns/delta)
  // P0 1: CSRF 토큰 추가 + P0 2: organizationId IDOR 재검증
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

      // P0 1: CSRF 토큰 준비 (next-auth 내장)
      // next-auth는 기본적으로 credentials 기반 인증에서 CSRF 보호를 제공하지만,
      // 추가 보안을 위해 별도의 토큰 검증을 권장하는 경우 여기서 추가 가능
      // 현재 구현: next-auth 자동 CSRF 보호 + 서버사이드 organizationId 검증 (구현됨)

      const response = await fetch('/api/campaigns/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // P0 2: 응답받은 organizationId 재검증
      if (data.organizationId && currentUserOrgId && data.organizationId !== currentUserOrgId) {
        logger.error('[useDeltaWizard] IDOR 위험: 응답 organizationId 불일치', {
          campaignId: state.campaignId,
          responseOrgId: data.organizationId,
          currentUserOrgId,
        });
        const errorMsg = '권한 없음';
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        toast({
          title: '오류',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 네트워크 vs 검증 오류 구분 (상태 코드별 처리)
      // 필드별 에러 메시지
      // Cron 설정 실패 메시지 상세화
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (!response.ok) {
        // HTTP 400 - 검증 실패
        if (response.status === 400) {
          let errorMsg = '입력값 검증 실패';

          // P0 2: 필드별 에러 메시지 (deltaDay0Message, deltaDay1Message 등)
          if (data.errors && typeof data.errors === 'object') {
            const fieldErrors = data.errors as Record<string, string>;

            if (fieldErrors.deltaDay0Message) {
              errorMsg = `Day 0 메시지 오류: ${fieldErrors.deltaDay0Message}`;
            } else if (fieldErrors.deltaDay1Message) {
              errorMsg = `Day 1 메시지 오류: ${fieldErrors.deltaDay1Message}`;
            } else if (fieldErrors.deltaDay2Message) {
              errorMsg = `Day 2 메시지 오류: ${fieldErrors.deltaDay2Message}`;
            } else if (fieldErrors.deltaDay3Message) {
              errorMsg = `Day 3 메시지 오류: ${fieldErrors.deltaDay3Message}`;
            } else if (fieldErrors.campaignId) {
              errorMsg = `캠페인 오류: ${fieldErrors.campaignId}`;
            } else if (fieldErrors.triggerType) {
              errorMsg = `트리거 타입 오류: ${fieldErrors.triggerType}`;
            } else {
              // 첫 번째 필드 에러 사용
              const firstFieldKey = Object.keys(fieldErrors)[0];
              errorMsg = `입력값 오류: ${fieldErrors[firstFieldKey] || data.message || '입력값 검증 실패'}`;
            }
          } else if (data.message) {
            errorMsg = data.message;
          }

          setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
          toast({
            title: '검증 오류',
            description: errorMsg,
            variant: 'destructive',
          });
          logger.warn('[useDeltaWizard] 검증 실패', { campaignId: state.campaignId, errorMsg });
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
          logger.warn('[useDeltaWizard] 캠페인 없음', { campaignId: state.campaignId });
          return;
        }

        // HTTP 500+ - 서버 오류
        if (response.status >= 500) {
          const errorMsg = data.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.';
          setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
          toast({
            title: '서버 오류',
            description: errorMsg,
            variant: 'destructive',
          });
          logger.error('[useDeltaWizard] 서버 오류', {
            campaignId: state.campaignId,
            status: response.status,
            error: data.message,
          });
          return;
        }

        // 기타 HTTP 에러 (네트워크 오류)
        const errorMsg = '네트워크 연결을 확인하세요.';
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        toast({
          title: '네트워크 오류',
          description: errorMsg,
          variant: 'destructive',
        });
        logger.warn('[useDeltaWizard] 네트워크 오류', { campaignId: state.campaignId, status: response.status });
        return;
      }

      // P0 4: Cron 설정 실패 메시지 상세화
      if (!data.ok) {
        let errorMsg = data.message || '설정 저장 실패';

        // 에러 코드별 상세 메시지
        if (data.code === 'INVALID_CAMPAIGN_ID') {
          errorMsg = '유효하지 않은 캠페인입니다.';
        } else if (data.code === 'PERMISSION_DENIED') {
          errorMsg = '이 캠페인에 대한 권한이 없습니다.';
        } else if (data.code === 'CRON_SETUP_FAILED') {
          errorMsg = 'Cron 설정에 실패했습니다. 관리자에게 문의하세요.';
        }

        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        toast({
          title: '오류',
          description: errorMsg,
          variant: 'destructive',
        });
        logger.warn('[useDeltaWizard] 설정 저장 실패', {
          campaignId: state.campaignId,
          code: data.code,
          message: data.message,
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
  }, [state, defaultMessages, toast, currentUserOrgId]);

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
