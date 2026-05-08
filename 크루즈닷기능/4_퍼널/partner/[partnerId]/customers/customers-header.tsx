'use client';

import { FiSearch, FiPlus } from 'react-icons/fi';
import type { CustomersContextType } from './lib/customers-hooks';

interface Props {
  state: CustomersContextType;
  dispatch: (action: any) => void;
  onAddCustomer: () => void;
}

export default function CustomersHeader({
  state,
  dispatch,
  onAddCustomer,
}: Props) {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="고객명 또는 전화번호 검색"
          value={state.filter.search || ''}
          onChange={(e) =>
            dispatch({
              type: 'SET_FILTER',
              payload: { filter: { ...state.filter, search: e.target.value } },
            })
          }
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      <button
        onClick={onAddCustomer}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <FiPlus size={18} />
        고객 추가
      </button>
    </div>
  );
}
