'use client';

import { FiTrash2, FiDownload } from 'react-icons/fi';
import type { CustomersContextType } from './lib/customers-hooks';

interface Props {
  selectedCount: number;
  state: CustomersContextType;
  dispatch: (action: any) => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
}

export default function CustomersBulkActions({
  selectedCount,
  state,
  dispatch,
  onBulkDelete,
  onBulkExport,
}: Props) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 bg-blue-50 border-b border-blue-200">
      <div className="text-sm font-medium text-blue-900">
        {selectedCount}명 선택됨
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBulkExport}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <FiDownload size={16} />
          내보내기
        </button>

        <button
          onClick={onBulkDelete}
          className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          <FiTrash2 size={16} />
          삭제
        </button>

        <button
          onClick={() => dispatch({ type: 'DESELECT_ALL' })}
          className="px-3 py-2 border rounded-lg hover:bg-gray-100 text-sm"
        >
          선택해제
        </button>
      </div>
    </div>
  );
}
