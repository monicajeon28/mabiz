'use client';

import { FiAlertTriangle } from 'react-icons/fi';

interface Props {
  isOpen: boolean;
  customerName: string;
  isBulk?: boolean;
  count?: number;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CustomerDeleteConfirm({
  isOpen,
  customerName,
  isBulk = false,
  count = 1,
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Icon + Message */}
        <div className="flex flex-col items-center p-6">
          <div className="p-3 bg-red-100 rounded-full mb-4">
            <FiAlertTriangle size={32} className="text-red-600" />
          </div>

          <h2 className="text-xl font-bold mb-2">
            {isBulk ? `${count}명의 고객을 삭제하시겠습니까?` : `${customerName}을(를) 삭제하시겠습니까?`}
          </h2>

          <p className="text-gray-600 text-center text-sm mb-4">
            {isBulk
              ? '선택된 모든 고객이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.'
              : '이 고객이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-gray-50 border-t">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
