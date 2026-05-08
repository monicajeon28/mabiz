'use client';

import { FiFilter } from 'react-icons/fi';
import type { CustomersContextType } from './lib/customers-hooks';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '활성' },
  { value: 'REFUNDED', label: '환불' },
  { value: 'CANCELED', label: '취소' },
  { value: 'INACTIVE', label: '미활성' },
];

interface Props {
  state: CustomersContextType;
  dispatch: (action: any) => void;
}

export default function CustomersFilters({ state, dispatch }: Props) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 border-b">
      <FiFilter className="text-gray-600" />

      <select
        value={state.filter.status || ''}
        onChange={(e) =>
          dispatch({
            type: 'SET_FILTER',
            payload: { filter: { ...state.filter, status: e.target.value || undefined } },
          })
        }
        className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">모든 상태</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={state.filter.sortBy || 'createdAt'}
        onChange={(e) =>
          dispatch({
            type: 'SET_FILTER',
            payload: { ...state.filter, sortBy: e.target.value },
          })
        }
        className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="createdAt">생성일</option>
        <option value="name">이름</option>
        <option value="totalAmount">매출액</option>
      </select>

      {state.filter.status && (
        <button
          onClick={() =>
            dispatch({
              type: 'SET_FILTER',
              payload: { ...state.filter, status: undefined },
            })
          }
          className="text-sm text-blue-600 hover:underline"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
