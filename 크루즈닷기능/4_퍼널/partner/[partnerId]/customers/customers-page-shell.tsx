'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import {
  listCustomers,
  bulkDeleteCustomers,
  type Customer,
  type CustomerFilter,
} from './lib/customers-api';
import {
  useCustomersFilter,
  useCustomersPagination,
  useCustomersMetrics,
  type CustomersContextType,
} from './lib/customers-hooks';
import CustomersHeader from './customers-header';
import CustomersFilters from './customers-filters';
import CustomersTable from './customers-table';
import CustomersPagination from './customers-pagination';
import CustomersBulkActions from './customers-bulk-actions';
import CustomerDetailModal from './customer-detail-modal';
import CustomerDeleteConfirm from './customer-delete-confirm';

// Context 타입 정의
interface CustomersContextValue {
  state: CustomersContextType;
  dispatch: (action: CustomersAction) => void;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function useCustomersContext() {
  const context = useContext(CustomersContext);
  if (!context) {
    throw new Error('useCustomersContext must be used within CustomersPageShell');
  }
  return context;
}

// Reducer 정의
// P3-5: 페이로드 구조 통일 (모든 action이 일관된 구조 사용)
type CustomersAction =
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_CUSTOMERS'; payload: { customers: Customer[]; total: number } }
  | { type: 'SET_FILTER'; payload: { filter: CustomerFilter } }
  | { type: 'SET_PAGE'; payload: { page: number } }
  | { type: 'SET_PAGE_SIZE'; payload: { pageSize: number } }
  | { type: 'TOGGLE_SELECT'; payload: { id: number } }
  | { type: 'SELECT_ALL_VISIBLE'; payload: { ids: number[] } }
  | { type: 'DESELECT_ALL' }
  | { type: 'REMOVE_CUSTOMER'; payload: { id: number } }
  | { type: 'DESELECT_CUSTOMER'; payload: { leadId: number } }
  | { type: 'UNDO_REMOVE'; payload: { customer: Customer } }
  | { type: 'SET_TOTAL_COUNT'; payload: { totalCount: number } }
  | { type: 'BULK_REMOVE_CUSTOMERS'; payload: { leadIds: number[] } }
  | { type: 'UNDO_BULK_REMOVE'; payload: { customers: Customer[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_DELETE_CONFIRM'; payload: { isOpen: boolean; customerId?: number; isBulk?: boolean; count?: number } };

const initialState: CustomersContextType = {
  customers: [],
  selectedIds: [],
  filter: {},
  page: 1,
  pageSize: 20,
  isLoading: false,
  totalCount: 0,
};

function customersReducer(
  state: CustomersContextType,
  action: CustomersAction
): CustomersContextType {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload.isLoading };

    case 'SET_CUSTOMERS':
      return {
        ...state,
        customers: action.payload.customers,
        totalCount: action.payload.total,
      };

    case 'SET_FILTER':
      return { ...state, filter: action.payload.filter, page: 1 };

    case 'SET_PAGE':
      return { ...state, page: action.payload.page };

    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload.pageSize, page: 1 };

    case 'TOGGLE_SELECT': {
      const ids = state.selectedIds.includes(action.payload.id)
        ? state.selectedIds.filter(id => id !== action.payload.id)
        : [...state.selectedIds, action.payload.id];
      return { ...state, selectedIds: ids };
    }

    case 'SELECT_ALL_VISIBLE':
      return { ...state, selectedIds: action.payload.ids };

    case 'DESELECT_ALL':
      return { ...state, selectedIds: [] };

    case 'REMOVE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.filter(c => c.id !== action.payload.id),
      };

    case 'DESELECT_CUSTOMER':
      return {
        ...state,
        selectedIds: state.selectedIds.filter(id => id !== action.payload.leadId)
      };

    case 'UNDO_REMOVE':
      return {
        ...state,
        customers: [...state.customers, action.payload.customer]
      };

    case 'SET_TOTAL_COUNT':
      return {
        ...state,
        totalCount: action.payload.totalCount
      };

    case 'BULK_REMOVE_CUSTOMERS':
      return {
        ...state,
        customers: state.customers.filter(c => !action.payload.leadIds.includes(c.id))
      };

    case 'UNDO_BULK_REMOVE':
      return {
        ...state,
        customers: [...state.customers, ...action.payload.customers]
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedIds: []
      };

    default:
      return state;
  }
}

interface CustomersPageShellProps {
  initialCustomers: Customer[];
  initialTotal: number;
}

// P2-5: deleteConfirm useReducer (부분 업데이트 안전성)
// P3-1: Discriminated Union 패턴으로 타입 안전성 강화
// isBulk와 customerId를 동시에 잘못 설정할 수 없도록 타입으로 보장
type DeleteConfirmState =
  | { isOpen: false }
  | { isOpen: true; isBulk: false; customerId: number; isLoading: boolean }
  | { isOpen: true; isBulk: true; count: number; isLoading: boolean };

const deleteConfirmInitial: DeleteConfirmState = {
  isOpen: false,
};

type DeleteConfirmAction =
  | { type: 'OPEN_SINGLE'; payload: number }
  | { type: 'OPEN_BULK'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLOSE' };

function deleteConfirmReducer(
  state: DeleteConfirmState,
  action: DeleteConfirmAction
): DeleteConfirmState {
  switch (action.type) {
    case 'OPEN_SINGLE':
      return {
        isOpen: true,
        customerId: action.payload,
        isBulk: false,
        isLoading: false,
      };
    case 'OPEN_BULK':
      return {
        isOpen: true,
        isBulk: true,
        count: action.payload,
        isLoading: false,
      };
    case 'SET_LOADING':
      if (!state.isOpen) return state;
      return { ...state, isLoading: action.payload };
    case 'CLOSE':
      return deleteConfirmInitial;
    default:
      return state;
  }
}

export default function CustomersPageShell({
  initialCustomers,
  initialTotal,
}: CustomersPageShellProps) {
  const params = useParams() as { partnerId: string };
  const [state, dispatch] = useReducer(customersReducer, {
    ...initialState,
    customers: initialCustomers,
    totalCount: initialTotal,
  });

  // Modal 상태
  const [modalCustomerId, setModalCustomerId] = useState<number | null>(null);
  const [deleteConfirm, dispatchDeleteConfirm] = useReducer(deleteConfirmReducer, deleteConfirmInitial);

  // 필터된 고객 목록
  const filteredCustomers = useCustomersFilter(state.customers, state.filter);

  // 페이지네이션
  const paginated = useCustomersPagination(
    filteredCustomers,
    state.page,
    state.pageSize
  );

  // 메트릭
  const metrics = useCustomersMetrics(state.customers);

  // P2-4: 선택된 고객 조회 최적화 (O(n²) → O(1))
  const customersMap = useMemo(() => {
    const map = new Map<number, Customer>();
    state.customers.forEach(c => map.set(c.id, c));
    return map;
  }, [state.customers]);

  // P3-6: 명시적 reduce 패턴으로 undefined 필터링 명확화
  const selectedCustomers = useMemo(() => {
    return state.selectedIds.reduce<Customer[]>((acc, id) => {
      const customer = customersMap.get(id);
      if (customer) acc.push(customer);
      return acc;
    }, []);
  }, [state.selectedIds, customersMap]);

  // 핸들러들
  const handleAddCustomer = useCallback(() => {
    showError('고객 추가 기능은 아직 준비 중입니다');
  }, []);

  const handleViewDetail = useCallback((customerId: number) => {
    setModalCustomerId(customerId);
  }, []);

  const handleDeleteConfirm = useCallback((customerId: number) => {
    dispatchDeleteConfirm({ type: 'OPEN_SINGLE', payload: customerId });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (state.selectedIds.length === 0) {
      showError('선택된 고객이 없습니다');
      return;
    }
    dispatchDeleteConfirm({ type: 'OPEN_BULK', payload: state.selectedIds.length });
  }, [state.selectedIds.length]);

  const handleConfirmDelete = useCallback(async () => {
    // P2-2: closure에서 현재 상태 직접 캡처
    const current = deleteConfirm;

    // P1-2: 선택된 ID들의 스냅샷 캡처 (API 호출 중 선택 변경 방지)
    const idsToDelete = [...state.selectedIds];

    dispatchDeleteConfirm({ type: 'SET_LOADING', payload: true });

    try {
      if (current.isOpen === false) {
        dispatchDeleteConfirm({ type: 'CLOSE' });
        return;
      }

      if (current.isBulk && idsToDelete.length > 0) {
        // P1-2: 스냅샷 ID로 API 호출
        const result = await bulkDeleteCustomers(params.partnerId, idsToDelete);

        // P1-2: 스냅샷 ID들만 삭제 (나중에 선택한 건 무시)
        idsToDelete.forEach(id => {
          dispatch({ type: 'REMOVE_CUSTOMER', payload: { id } });
        });
        dispatch({ type: 'DESELECT_ALL' });

        // P1-3: 응답 형태 정규화 (deleted.count 사용)
        const deletedCount = result.deleted?.count ?? idsToDelete.length;

        showSuccess(`${deletedCount}명의 고객이 삭제되었습니다`);
      } else if (!current.isBulk && current.customerId) {
        // 개별 삭제 로직 (WO-CRM-03에서 구현)
        logger.debug('[handleConfirmDelete] 개별 삭제', { customerId: current.customerId });
        dispatch({ type: 'REMOVE_CUSTOMER', payload: { id: current.customerId } });
        showSuccess('고객이 삭제되었습니다');
      }

      dispatchDeleteConfirm({ type: 'CLOSE' });
    } catch (error) {
      logger.error('[handleConfirmDelete]', error);
      showError('삭제 실패. 다시 시도하세요');
      dispatchDeleteConfirm({ type: 'SET_LOADING', payload: false });
    }
  }, [deleteConfirm, state.selectedIds, params.partnerId]);

  const handleBulkExport = useCallback(() => {
    if (state.selectedIds.length === 0) {
      showError('선택된 고객이 없습니다');
      return;
    }
    // P2-9: 기능 미구현 명확화
    showError('내보내기 기능은 다음 버전에서 제공됩니다');
  }, [state.selectedIds.length]);

  const modalCustomer = state.customers.find(c => c.id === modalCustomerId) || null;

  return (
    <CustomersContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-full bg-white rounded-lg">
        {/* 헤더 */}
        <CustomersHeader
          state={state}
          dispatch={dispatch}
          onAddCustomer={handleAddCustomer}
        />

        {/* 필터 */}
        <CustomersFilters state={state} dispatch={dispatch} />

        {/* 다중 선택 액션 바 */}
        {state.selectedIds.length > 0 && (
          <CustomersBulkActions
            selectedCount={state.selectedIds.length}
            state={state}
            dispatch={dispatch}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
          />
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          <CustomersTable
            customers={paginated}
            selectedIds={state.selectedIds}
            state={state}
            dispatch={dispatch}
            onSelectToggle={(id: number) =>
              dispatch({ type: 'TOGGLE_SELECT', payload: { id } })
            }
            onViewDetail={handleViewDetail}
            onDelete={handleDeleteConfirm}
          />
        </div>

        {/* 페이지네이션 */}
        <CustomersPagination
          state={state}
          dispatch={dispatch}
          totalPages={Math.ceil(filteredCustomers.length / state.pageSize)}
        />

        {/* 상세 모달 */}
        <CustomerDetailModal
          isOpen={modalCustomerId !== null}
          customer={modalCustomer}
          customers={state.customers}
          state={state}
          dispatch={dispatch}
          onClose={() => setModalCustomerId(null)}
        />

        {/* 삭제 확인 다이얼로그 */}
        <CustomerDeleteConfirm
          isOpen={deleteConfirm.isOpen}
          customerName={
            deleteConfirm.isOpen && !deleteConfirm.isBulk && 'customerId' in deleteConfirm
              ? state.customers.find(c => c.id === deleteConfirm.customerId)?.name ||
                '알 수 없는 고객'
              : ''
          }
          isBulk={deleteConfirm.isOpen ? deleteConfirm.isBulk : false}
          count={deleteConfirm.isOpen && deleteConfirm.isBulk ? deleteConfirm.count : 0}
          isLoading={deleteConfirm.isOpen ? deleteConfirm.isLoading : false}
          onConfirm={handleConfirmDelete}
          onCancel={() => dispatchDeleteConfirm({ type: 'CLOSE' })}
        />
      </div>
    </CustomersContext.Provider>
  );
}
