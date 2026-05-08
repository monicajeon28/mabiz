'use client';

import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import type { Customer } from './lib/customers-api';
import type { CustomersContextType } from './lib/customers-hooks';

interface Props {
  isOpen: boolean;
  customer: Customer | null;
  customers: Customer[];
  state: CustomersContextType;
  dispatch: (action: any) => void;
  onClose: () => void;
}

export default function CustomerDetailModal({
  isOpen,
  customer,
  customers,
  state,
  dispatch,
  onClose,
}: Props) {
  // 고객이 삭제되면 자동으로 모달 닫기
  useEffect(() => {
    if (customer && !customers.find(c => c.id === customer.id)) {
      onClose();
    }
  }, [customer, customers, onClose]);

  if (!isOpen || !customer) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">{customer.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">연락처</label>
              <p className="text-lg font-medium">{customer.phone}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">이메일</label>
              <p className="text-lg font-medium">{customer.email || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">상태</label>
              <p className="text-lg font-medium">{customer.status}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">매출액</label>
              <p className="text-lg font-medium">
                {new Intl.NumberFormat('ko-KR', {
                  style: 'currency',
                  currency: 'KRW',
                  minimumFractionDigits: 0,
                }).format(customer.totalAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">거래건수</label>
              <p className="text-lg font-medium">{customer.saleCount}건</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">마지막 거래일</label>
              <p className="text-lg font-medium">
                {customer.lastSaleAt
                  ? new Date(customer.lastSaleAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">가입일</label>
              <p className="text-lg font-medium">
                {new Date(customer.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
            {customer.leadScore !== undefined && (
              <div>
                <label className="text-sm text-gray-600">리드 점수</label>
                <p className="text-lg font-medium">{customer.leadScore}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
