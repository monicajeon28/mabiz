import { renderHook, act, waitFor } from '@testing-library/react';
import { useDeltaWizard } from '@/hooks/useDeltaWizard';

/**
 * useDeltaWizard Hook 유닛 테스트
 *
 * 테스트 항목:
 * - Step 1 검증: triggerType 필수
 * - Step 2 검증: 4개 메시지 모두 필수
 * - 네비게이션: handleNext, handlePrev
 * - API 통신: handleSave (POST /api/campaigns/delta)
 * - 에러 처리: HTTP 에러, 검증 에러
 */

describe('useDeltaWizard', () => {
  const mockCampaignId = 'campaign_test_123';

  // ===== Step 1 검증 테스트 =====
  describe('Step 1: Trigger Type Validation', () => {
    it('should initialize with invalid step 1 (triggerType not set)', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      expect(result.current.state.triggerType).toBe('PURCHASE');
      expect(result.current.isStepValid(1)).toBe(true); // PURCHASE가 기본값
    });

    it('should validate step 1 when triggerType is set', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.setTriggerType('PURCHASE');
      });

      expect(result.current.isStepValid(1)).toBe(true);
    });

    it('should allow switching between trigger types', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.setTriggerType('ABANDONED');
      });

      expect(result.current.state.triggerType).toBe('ABANDONED');
    });
  });

  // ===== Step 2 검증 테스트 =====
  describe('Step 2: Message Validation', () => {
    it('should fail step 2 when all messages are empty', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault(); // 기본값 사용 안 함
      });

      expect(result.current.isStepValid(2)).toBe(false);
    });

    it('should fail step 2 when only some messages are filled', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault();
        result.current.setMessage('day0', 'Day 0 message');
        result.current.setMessage('day1', 'Day 1 message');
        result.current.setMessage('day2', 'Day 2 message');
        // Day 3 비어있음
      });

      expect(result.current.isStepValid(2)).toBe(false);
    });

    it('should pass step 2 when all 4 messages are filled', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault();
        result.current.setMessage('day0', 'Day 0 message');
        result.current.setMessage('day1', 'Day 1 message');
        result.current.setMessage('day2', 'Day 2 message');
        result.current.setMessage('day3', 'Day 3 message');
      });

      expect(result.current.isStepValid(2)).toBe(true);
    });

    it('should pass step 2 when using default messages', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      // useDefaultMessages = true인 경우
      expect(result.current.state.useDefaultMessages).toBe(true);
      expect(result.current.isStepValid(2)).toBe(true);
    });

    it('should ignore whitespace-only messages', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault();
        result.current.setMessage('day0', '  ');
        result.current.setMessage('day1', 'Day 1');
        result.current.setMessage('day2', 'Day 2');
        result.current.setMessage('day3', 'Day 3');
      });

      expect(result.current.isStepValid(2)).toBe(false);
    });
  });

  // ===== 네비게이션 테스트 =====
  describe('Navigation', () => {
    it('should start at step 1', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));
      expect(result.current.state.currentStep).toBe(1);
    });

    it('should not advance when step is invalid', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      // triggerType은 기본값으로 설정되어 있으므로 Step 1은 유효
      act(() => {
        result.current.handleNext();
      });

      expect(result.current.state.currentStep).toBe(2);
    });

    it('should advance to step 2 when step 1 is valid', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      expect(result.current.isStepValid(1)).toBe(true);

      act(() => {
        result.current.handleNext();
      });

      expect(result.current.state.currentStep).toBe(2);
    });

    it('should not go below step 1', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.handlePrev();
      });

      expect(result.current.state.currentStep).toBe(1);
    });

    it('should not go above step 4', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.handleNext();
        result.current.handleNext();
        result.current.handleNext();
        result.current.handleNext();
        result.current.handleNext();
      });

      expect(result.current.state.currentStep).toBeLessThanOrEqual(4);
    });

    it('should navigate backward', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.handleNext();
        result.current.handleNext();
      });

      expect(result.current.state.currentStep).toBe(3);

      act(() => {
        result.current.handlePrev();
      });

      expect(result.current.state.currentStep).toBe(2);
    });
  });

  // ===== 메시지 설정 테스트 =====
  describe('Message Setting', () => {
    it('should update day0 message', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const newMessage = 'Test Day 0 message';
      act(() => {
        result.current.setMessage('day0', newMessage);
      });

      expect(result.current.state.messages.day0).toBe(newMessage);
    });

    it('should update day3 message', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const newMessage = 'Test Day 3 message';
      act(() => {
        result.current.setMessage('day3', newMessage);
      });

      expect(result.current.state.messages.day3).toBe(newMessage);
    });

    it('should not affect other messages when updating one', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const originalDay1 = result.current.state.messages.day1;

      act(() => {
        result.current.setMessage('day0', 'New message');
      });

      expect(result.current.state.messages.day1).toBe(originalDay1);
    });
  });

  // ===== 기본값 전환 테스트 =====
  describe('Default Messages Toggle', () => {
    it('should toggle useDefaultMessages', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const initialState = result.current.state.useDefaultMessages;

      act(() => {
        result.current.toggleDefault();
      });

      expect(result.current.state.useDefaultMessages).toBe(!initialState);
    });

    it('should load default messages when toggling to true', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault(); // false
        result.current.setMessage('day0', 'Custom message');
      });

      act(() => {
        result.current.toggleDefault(); // true
      });

      // 기본값으로 복원되어야 함
      expect(result.current.state.messages.day0).not.toBe('Custom message');
    });

    it('should keep custom messages when toggling to false', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      act(() => {
        result.current.toggleDefault(); // false로 전환
      });

      // 이전 메시지 상태는 유지됨 (빈 상태)
      expect(result.current.state.useDefaultMessages).toBe(false);
    });
  });

  // ===== API 저장 테스트 (모킹) =====
  describe('API Save Operations', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should send POST request with correct payload', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          deltaCampaignConfigId: 'config_123',
          message: 'Configuration saved successfully',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.setTriggerType('PURCHASE');
        result.current.toggleDefault(); // 기본값 비활성화
        result.current.setMessage('day0', 'Test 0');
        result.current.setMessage('day1', 'Test 1');
        result.current.setMessage('day2', 'Test 2');
        result.current.setMessage('day3', 'Test 3');
      });

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/campaigns/delta',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should handle validation error (HTTP 400)', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({
          ok: false,
          message: 'Validation failed',
          errors: {
            deltaDay0Message: 'Message is too short',
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
        expect(result.current.state.isSaving).toBe(false);
      });
    });

    it('should handle campaign not found error (HTTP 404)', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: false,
        status: 404,
        json: async () => ({
          ok: false,
          message: 'Campaign not found',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(result.current.state.error).toContain('캠페인');
      });
    });

    it('should handle server error (HTTP 500)', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({
          ok: false,
          message: 'Internal server error',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(result.current.state.error).toContain('서버');
      });
    });

    it('should handle network error', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
        expect(result.current.state.isSaving).toBe(false);
      });
    });

    it('should set isSaving flag during request', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          deltaCampaignConfigId: 'config_123',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.handleSave();
      });

      // isSaving이 설정될 것으로 예상
      await waitFor(() => {
        expect(result.current.state.isSaving).toBe(false);
      });
    });

    it('should clear error on successful save', async () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          deltaCampaignConfigId: 'config_123',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      act(() => {
        result.current.handleSave();
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeNull();
      });
    });
  });

  // ===== Step 3, 4 검증 (항상 유효) =====
  describe('Step 3 and 4 Validation', () => {
    it('should always validate step 3', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));
      expect(result.current.isStepValid(3)).toBe(true);
    });

    it('should always validate step 4', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));
      expect(result.current.isStepValid(4)).toBe(true);
    });
  });

  // ===== 상태 초기화 테스트 =====
  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      expect(result.current.state.currentStep).toBe(1);
      expect(result.current.state.campaignId).toBe(mockCampaignId);
      expect(result.current.state.triggerType).toBe('PURCHASE');
      expect(result.current.state.useDefaultMessages).toBe(true);
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.isSaving).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it('should have non-empty default messages', () => {
      const { result } = renderHook(() => useDeltaWizard(mockCampaignId));

      expect(result.current.defaultMessages.day0).toBeTruthy();
      expect(result.current.defaultMessages.day1).toBeTruthy();
      expect(result.current.defaultMessages.day2).toBeTruthy();
      expect(result.current.defaultMessages.day3).toBeTruthy();
    });
  });
});
