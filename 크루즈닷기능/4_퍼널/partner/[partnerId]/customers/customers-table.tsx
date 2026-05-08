'use client';

import { FiTrash2, FiEye } from 'react-icons/fi';
import type { Customer } from './lib/customers-api';
import type { CustomersContextType } from './lib/customers-hooks';

interface Props {
  customers: Customer[];
  selectedIds: number[];
  state: CustomersContextType;
  dispatch: (action: any) => void;
  onSelectToggle: (id: number) => void;
  onViewDetail: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function CustomersTable({
  customers,
  selectedIds,
  dispatch,
  onSelectToggle,
  onViewDetail,
  onDelete,
}: Props) {
  const selectedSet = new Set(selectedIds);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'REFUNDED':
        return 'bg-orange-100 text-orange-800';
      case 'CANCELED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={
                  customers.length > 0 &&
                  customers.every(c => selectedSet.has(c.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    dispatch({
                      type: 'SELECT_ALL_VISIBLE',
                      payload: { ids: customers.map(c => c.id) },
                    });
                  } else {
                    dispatch({ type: 'DESELECT_ALL' });
                  }
                }}
                className="w-4 h-4"
              />
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">고객명</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">연락처</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">상태</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">매출액</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">건수</th>
            <th className="px-4 py-3 text-center text-sm font-semibold">액션</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                고객이 없습니다
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr key={customer.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(customer.id)}
                    onChange={() => onSelectToggle(customer.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3 text-sm">{customer.name}</td>
                <td className="px-4 py-3 text-sm">{customer.phone}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                      customer.status
                    )}`}
                  >
                    {customer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {formatAmount(customer.totalAmount)}
                </td>
                <td className="px-4 py-3 text-sm">{customer.saleCount}건</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onViewDetail(customer.id)}
                      className="p-1 hover:bg-blue-100 rounded"
                      title="상세보기"
                    >
                      <FiEye size={16} className="text-blue-600" />
                    </button>
                    <button
                      onClick={() => onDelete(customer.id)}
                      className="p-1 hover:bg-red-100 rounded"
                      title="삭제"
                    >
                      <FiTrash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
