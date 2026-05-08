'use client';

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import type { CustomersContextType } from './lib/customers-hooks';

interface Props {
  state: CustomersContextType;
  dispatch: (action: any) => void;
  totalPages: number;
}

export default function CustomersPagination({
  state,
  dispatch,
  totalPages,
}: Props) {
  return (
    <div className="flex items-center justify-between p-4 border-t bg-gray-50">
      <div className="text-sm text-gray-600">
        전체 {state.totalCount}명 중 {(state.page - 1) * state.pageSize + 1}-
        {Math.min(state.page * state.pageSize, state.totalCount)}명 표시
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'SET_PAGE', payload: { page: state.page - 1 } })}
          disabled={state.page === 1}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          <FiChevronLeft size={18} />
        </button>

        <span className="px-4 py-2 border rounded">
          {state.page} / {totalPages}
        </span>

        <button
          onClick={() => dispatch({ type: 'SET_PAGE', payload: { page: state.page + 1 } })}
          disabled={state.page >= totalPages}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          <FiChevronRight size={18} />
        </button>

        <select
          value={state.pageSize}
          onChange={(e) =>
            dispatch({ type: 'SET_PAGE_SIZE', payload: { pageSize: Number(e.target.value) } })
          }
          className="px-3 py-1 border rounded focus:outline-none"
        >
          <option value={10}>10개</option>
          <option value={20}>20개</option>
          <option value={50}>50개</option>
          <option value={100}>100개</option>
        </select>
      </div>
    </div>
  );
}
