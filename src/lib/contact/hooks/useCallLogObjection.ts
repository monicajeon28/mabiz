import { useState, useCallback } from 'react';
import { getObjectionData, getAllObjectionIds } from '@/lib/objections/validation';

interface CallLogObjectionData {
  objectionId?: string;
  customerReaction?: 'positive' | 'neutral' | 'negative';
  recovered?: boolean;
  recoveryTime?: number;
}

interface UseCallLogObjectionOptions {
  contactId: string;
  callLogId?: string;
}

export function useCallLogObjection(options: UseCallLogObjectionOptions) {
  const { contactId, callLogId } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이의 목록 가져오기 (정적, 매번 새로 생성하지 않도록)
  const objectionIds = getAllObjectionIds();

  // 선택된 이의의 상세 정보 가져오기
  const getSelectedObjectionData = useCallback((objectionId: string) => {
    return getObjectionData(objectionId);
  }, []);

  // CallLog에 이의 데이터 저장
  const saveObjectionData = useCallback(
    async (data: CallLogObjectionData) => {
      if (!callLogId) {
        setError('CallLog ID가 필요합니다');
        return { success: false };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/contacts/${contactId}/call-logs?logId=${callLogId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.errors?.[0] || '저장 실패');
        }

        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류 발생';
        setError(errorMsg);
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [contactId, callLogId]
  );

  // 이의 처리 결과 기록 (shorthand)
  const recordObjectionHandling = useCallback(
    async (objectionId: string, recovered: boolean, recoveryTime?: number) => {
      return saveObjectionData({
        objectionId,
        recovered,
        recoveryTime: recoveryTime || undefined,
        customerReaction: recovered ? 'positive' : 'neutral',
      });
    },
    [saveObjectionData]
  );

  return {
    objectionIds,
    getSelectedObjectionData,
    saveObjectionData,
    recordObjectionHandling,
    isLoading,
    error,
  };
}
