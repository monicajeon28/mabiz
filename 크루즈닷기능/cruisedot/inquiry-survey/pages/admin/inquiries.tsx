'use client';

import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiSearch, FiUser, FiPhone, FiTrash2 } from 'react-icons/fi';

interface Inquiry {
  id: number;
  productCode: string;
  productName: string;
  cruiseLine: string;
  shipName: string;
  nights: number;
  days: number;
  name: string;
  phone: string;
  passportNumber: string | null;
  message: string | null;
  status: string;
  userId: number | null;
  userName: string | null;
  userPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, [statusFilter]);

  const loadInquiries = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/admin/inquiries'
        : `/api/admin/inquiries?status=${statusFilter}`;
      
      const response = await fetch(url, {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.ok) {
        setInquiries(data.inquiries || []);
      }
    } catch (error) {
      console.error('Failed to load inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (inquiryId: number, newStatus: string) => {
    try {
      setChangingStatusId(inquiryId);
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '상태 변경에 실패했습니다.');
      }

      // 목록 새로고침
      loadInquiries();
    } catch (error) {
      console.error('Failed to change status:', error);
      alert(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
    } finally {
      setChangingStatusId(null);
    }
  };

  const handleConfirmPurchase = async (inquiryId: number) => {
    if (!startDate) {
      alert('여행 시작일을 입력해주세요.');
      return;
    }

    if (!confirm('구매를 확정하시겠습니까? 크루즈닷AI가 자동으로 활성화됩니다.')) {
      return;
    }

    try {
      setIsConfirming(true);
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startDate }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '구매 확정 처리에 실패했습니다.');
      }

      alert(data.message || '구매 확정 처리 완료.');
      if (data.isRePurchase) {
        alert('재구매로 체크되었습니다!');
      }
      
      setSelectedInquiry(null);
      setStartDate('');
      loadInquiries();
    } catch (error) {
      console.error('Failed to confirm purchase:', error);
      alert(error instanceof Error ? error.message : '구매 확정 처리 중 오류가 발생했습니다.');
    } finally {
      setIsConfirming(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unavailable':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'passport_waiting':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'refund':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'unavailable':
        return '부재중';
      case 'passport_waiting':
        return '여권대기';
      case 'confirmed':
        return '구매확정';
      case 'refund':
        return '환불';
      default:
        return status;
    }
  };

  const statusOptions = [
    { value: 'pending', label: '대기중' },
    { value: 'unavailable', label: '부재중' },
    { value: 'passport_waiting', label: '여권대기' },
    { value: 'confirmed', label: '구매확정' },
    { value: 'refund', label: '환불' },
  ];

  const filteredInquiries = inquiries.filter(inquiry => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inquiry.name.toLowerCase().includes(term) ||
        inquiry.phone.includes(term) ||
        inquiry.productName.toLowerCase().includes(term) ||
        inquiry.productCode.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredInquiries.map(inquiry => inquiry.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 개별 선택/해제
  const handleSelectInquiry = (inquiryId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, inquiryId]);
    } else {
      setSelectedIds(selectedIds.filter(id => id !== inquiryId));
    }
  };

  // 개별 삭제
  const handleDelete = async (inquiryId: number) => {
    if (!confirm('정말 이 문의를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      alert('문의가 삭제되었습니다.');
      setSelectedIds(selectedIds.filter(id => id !== inquiryId));
      loadInquiries();
    } catch (error) {
      console.error('Failed to delete inquiry:', error);
      alert(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('삭제할 문의를 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedIds.length}개의 문의를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setIsBulkDeleting(true);
      const response = await fetch('/api/admin/inquiries/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inquiryIds: selectedIds }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '일괄 삭제에 실패했습니다.');
      }

      alert(data.message || `${selectedIds.length}개의 문의가 삭제되었습니다.`);
      setSelectedIds([]);
      loadInquiries();
    } catch (error) {
      console.error('Failed to bulk delete inquiries:', error);
      alert(error instanceof Error ? error.message : '일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">구매 문의 관리</h1>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="이름, 연락처, 상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <FiTrash2 />
                {isBulkDeleting ? '삭제 중...' : `선택 삭제 (${selectedIds.length})`}
              </button>
            )}
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대기중
            </button>
            <button
              onClick={() => setStatusFilter('unavailable')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'unavailable'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              부재중
            </button>
            <button
              onClick={() => setStatusFilter('passport_waiting')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'passport_waiting'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              여권대기
            </button>
            <button
              onClick={() => setStatusFilter('confirmed')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'confirmed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              구매확정
            </button>
            <button
              onClick={() => setStatusFilter('refund')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === 'refund'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              환불
            </button>
          </div>
        </div>
      </div>

      {/* 문의 목록 */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            문의 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredInquiries.length && filteredInquiries.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상품명 / 상태</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">고객 정보</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">문의일</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(inquiry.id)}
                          onChange={(e) => handleSelectInquiry(inquiry.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleDelete(inquiry.id)}
                          disabled={isDeleting}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900 mb-2">{inquiry.productName}</div>
                      <div className="text-sm text-gray-500 mb-2">
                        {inquiry.cruiseLine} · {inquiry.shipName} · {inquiry.nights}박 {inquiry.days}일
                      </div>
                      <div className="text-xs text-gray-400 mb-3">코드: {inquiry.productCode}</div>
                      
                      {/* 상태 변경 드롭다운 */}
                      <div className="relative inline-block">
                        <select
                          value={inquiry.status}
                          onChange={(e) => handleStatusChange(inquiry.id, e.target.value)}
                          disabled={changingStatusId === inquiry.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusColor(inquiry.status)} ${
                            changingStatusId === inquiry.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FiUser className="text-gray-400" size={16} />
                          <span className="font-bold text-lg text-gray-900">{inquiry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiPhone className="text-gray-400" size={16} />
                          <a 
                            href={`tel:${inquiry.phone}`}
                            className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {inquiry.phone}
                          </a>
                        </div>
                        {inquiry.passportNumber && (
                          <div className="text-sm text-gray-600 mt-2">
                            여권번호: {inquiry.passportNumber}
                          </div>
                        )}
                        {inquiry.message && (
                          <div className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                            {inquiry.message}
                          </div>
                        )}
                        {inquiry.userName && (
                          <div className="text-xs text-blue-600 mt-2 pt-2 border-t border-gray-200">
                            연결된 사용자: {inquiry.userName} ({inquiry.userPhone})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      <div>{new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(inquiry.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {inquiry.status !== 'confirmed' && inquiry.status !== 'refund' && (
                        <button
                          onClick={() => setSelectedInquiry(inquiry)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <FiCheckCircle />
                          구매 확정
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 구매 확정 모달 */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">구매 확정</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">상품명</label>
                <p className="text-gray-900">{selectedInquiry.productName}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">고객 정보</label>
                <p className="text-gray-900">{selectedInquiry.name} ({selectedInquiry.phone})</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  여행 시작일 <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  여행 종료일은 자동으로 계산됩니다 ({selectedInquiry.days}일)
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedInquiry(null);
                  setStartDate('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleConfirmPurchase(selectedInquiry.id)}
                disabled={isConfirming || !startDate}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConfirming ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    처리 중...
                  </>
                ) : (
                  <>
                    <FiCheckCircle />
                    구매 확정
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

