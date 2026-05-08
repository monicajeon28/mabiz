'use client';

import { logger } from '@/lib/logger';
import { showError } from '@/components/ui/Toast';
import { csrfFetch } from '@/lib/csrf-client';
import type { CustomersContextType } from './customers-hooks';

/**
 * Safe delete: selectedIds에서 제거 → API delete → 인접 행 자동선택 로직 없음
 * 대신 customer가 실제 삭제됐음을 UI에 명확히 표시
 *
 * P0-1 구현: Delete 후 상태 동기화 버그 방지
 * 1. UI에서 먼저 제거 (낙관적 업데이트)
 * 2. API 삭제
 * 3. 성공 시 totalCount 감소
 * 4. 실패 시 Undo
 */
export async function safeDeleteCustomer(
  leadId: number,
  partnerId: string,
  context: {
    state: CustomersContextType;
    dispatch: (action: any) => void;
  }
) {
  const { state, dispatch } = context;

  // Step 1: Undo용 고객 객체를 낙관적 업데이트 이전에 미리 캡처
  const customerToUndo = state.customers.find(c => c.id === leadId);

  // Step 2: UI에서 먼저 제거 (낙관적 업데이트)
  dispatch({
    type: 'REMOVE_CUSTOMER',
    payload: leadId
  });

  // Step 3: API 삭제
  try {
    const res = await csrfFetch(
      `/api/partner/${partnerId}/customers/${leadId}`,
      { method: 'DELETE' }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Delete failed');
    }

    // Step 4: 성공 후 totalCount 감소 (최종 상태 확정)
    dispatch({
      type: 'SET_TOTAL_COUNT',
      payload: { totalCount: Math.max(0, state.totalCount - 1) }
    });

    // selectedIds에서 leadId 제거 (이미 위에서 했으므로 중복 방지)
    if (state.selectedIds.includes(leadId)) {
      dispatch({
        type: 'DESELECT_CUSTOMER',
        payload: { leadId }
      });
    }

    logger.debug('[safeDeleteCustomer] Success', { leadId, partnerId });
    return { ok: true };
  } catch (error) {
    // Step 5: 실패 시 Undo (dispatch 이전에 캡처한 customerToUndo 사용)
    if (customerToUndo) {
      dispatch({
        type: 'UNDO_REMOVE',
        payload: customerToUndo
      });
    }

    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[safeDeleteCustomer]', { leadId, error: msg });
    showError(`고객 삭제 실패: ${msg}`);
    return { ok: false, error };
  }
}

/**
 * Bulk delete: 여러 건 한 번에 처리
 *
 * P0-3 구현: TOCTOU (Time-of-Check-Time-of-Use) 버그 방지
 * - 서버에서 모든 leadId 존재 확인 후 일괄 삭제
 * - 부분 삭제 방지 (all or nothing)
 */
export async function bulkDeleteCustomers(
  selectedIds: number[],
  partnerId: string,
  context: {
    state: CustomersContextType;
    dispatch: (action: any) => void;
  }
) {
  const { state, dispatch } = context;

  if (selectedIds.length === 0) {
    showError('선택된 고객이 없습니다');
    return { ok: false };
  }

  // Step 1: 낙관적 업데이트 (모두 제거)
  dispatch({
    type: 'BULK_REMOVE_CUSTOMERS',
    payload: { leadIds: selectedIds }
  });

  // Step 2: API 삭제
  try {
    const res = await csrfFetch(`/api/partner/${partnerId}/customers/bulk-delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerIds: selectedIds })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Bulk delete failed');
    }

    const { deleted } = await res.json();

    // Step 3: 실제 삭제된 건수만 totalCount에서 감소
    dispatch({
      type: 'SET_TOTAL_COUNT',
      payload: { totalCount: Math.max(0, state.totalCount - deleted.length) }
    });

    // selectedIds 초기화
    dispatch({
      type: 'CLEAR_SELECTION'
    });

    logger.debug('[bulkDeleteCustomers] Success', {
      selectedIds,
      deletedCount: deleted.length
    });

    return { ok: true, deleted: deleted.length };
  } catch (error) {
    // Step 4: 실패 시 Undo
    const customersToRestore = selectedIds
      .map(id => state.customers.find(c => c.id === id))
      .filter(Boolean);

    dispatch({
      type: 'UNDO_BULK_REMOVE',
      payload: { customers: customersToRestore }
    });

    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[bulkDeleteCustomers]', { selectedIds, error: msg });
    showError(`고객 삭제 실패: ${msg}`);
    return { ok: false };
  }
}
