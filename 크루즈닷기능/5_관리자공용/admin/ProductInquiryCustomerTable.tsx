'use client';

import { useState } from 'react';
import { FiFileText, FiTrash2 } from 'react-icons/fi';
import CustomerNoteModal from '@/components/admin/CustomerNoteModal';
import LeadNoteModal from '@/components/admin/LeadNoteModal';
import { showError, showSuccess } from '@/components/ui/Toast';

type AffiliateOwnership = {
  ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
  ownerName: string | null;
  ownerNickname: string | null;
};

interface ProductInquiryCustomer {
  id: number;
  name: string | null;
  phone: string | null;
  createdAt: string;
  cruiseName: string | null; // 가장 최신 여행의 cruiseName 또는 metadata.productName
  affiliateOwnership?: AffiliateOwnership | null;
  userId?: number | null; // CustomerNoteModal을 위한 userId
  leadId?: number | null; // AffiliateLead ID (상세기록용)
}

interface Props {
  customers: ProductInquiryCustomer[];
  onRefresh?: () => void;
}

// Google Apps Script URL - 상세기록 업데이트용
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVYYHKLyNfXwO3fSX19jmb7hF3Bh2oyay7lrlw3mJx42eL9kQANxhwxLrQyzbEj29x/exec';

export default function ProductInquiryCustomerTable({ customers, onRefresh }: Props) {
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [leadNoteModalOpen, setLeadNoteModalOpen] = useState(false);
  const [selectedCustomerForNote, setSelectedCustomerForNote] = useState<{ id: number; name: string | null; phone: string | null; cruiseName: string | null } | null>(null);
  const [selectedLeadForNote, setSelectedLeadForNote] = useState<{ id: number; name: string | null; phone: string | null; cruiseName: string | null } | null>(null);

  // 선택된 항목 관리
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 담당자 이름 표시 함수 (간소화)
  const renderOwnerName = (ownership?: AffiliateOwnership | null) => {
    if (!ownership) {
      return <span className="text-gray-400">담당자 없음</span>;
    }

    const name = ownership.ownerNickname || ownership.ownerName || '미지정';
    const role = ownership.ownerType === 'BRANCH_MANAGER' ? '대리점장' :
      ownership.ownerType === 'SALES_AGENT' ? '판매원' :
        '본사';

    return (
      <span className="text-sm text-gray-900">
        {name} ({role})
      </span>
    );
  };

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  // 상세기록 버튼 클릭 핸들러
  const handleNoteClick = (customer: ProductInquiryCustomer) => {
    if (customer.userId) {
      // User ID가 있으면 CustomerNoteModal 사용
      setSelectedCustomerForNote({
        id: customer.userId,
        name: customer.name,
        phone: customer.phone,
        cruiseName: customer.cruiseName
      });
      setNoteModalOpen(true);
    } else if (customer.leadId) {
      // Lead ID만 있으면 LeadNoteModal 사용
      setSelectedLeadForNote({
        id: customer.leadId,
        name: customer.name,
        phone: customer.phone,
        cruiseName: customer.cruiseName
      });
      setLeadNoteModalOpen(true);
    } else {
      alert('고객 ID가 없어 기록을 열 수 없습니다.');
    }
  };

  // Google 스프레드시트에 상세기록 업데이트
  const updateGoogleSheet = async (customerInfo: { name: string | null; phone: string | null; cruiseName: string | null }, note: string) => {
    console.log('[ProductInquiryCustomerTable] updateGoogleSheet 호출됨:', { customerInfo, note });

    if (!GOOGLE_SCRIPT_URL) {
      console.error('[ProductInquiryCustomerTable] GOOGLE_SCRIPT_URL이 없습니다');
      return;
    }

    if (!customerInfo.phone) {
      console.error('[ProductInquiryCustomerTable] 고객 연락처가 없어서 스프레드시트 업데이트 불가');
      return;
    }

    try {
      const timestamp = new Date().toLocaleString('ko-KR');
      const formData = new FormData();
      formData.append('action', 'updateNote'); // 상세기록 업데이트 액션
      formData.append('timestamp', timestamp);
      formData.append('name', customerInfo.name || '');
      formData.append('phone', customerInfo.phone || '');
      formData.append('productName', customerInfo.cruiseName || '');
      formData.append('note', note);

      console.log('[ProductInquiryCustomerTable] 전송 데이터:', {
        action: 'updateNote',
        timestamp,
        name: customerInfo.name,
        phone: customerInfo.phone,
        productName: customerInfo.cruiseName,
        note
      });

      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(GOOGLE_SCRIPT_URL, formData);
        console.log('[ProductInquiryCustomerTable] sendBeacon 전송 결과:', sent);
      } else {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: formData,
          mode: 'no-cors',
          keepalive: true
        });
        console.log('[ProductInquiryCustomerTable] fetch 전송 완료');
      }
      console.log('[ProductInquiryCustomerTable] Google 스프레드시트 상세기록 업데이트 전송 완료');
    } catch (error) {
      console.error('[ProductInquiryCustomerTable] Google 스프레드시트 업데이트 실패:', error);
    }
  };

  // 체크박스 전체 선택/해제
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // leadId가 있는 항목만 선택 가능 (삭제 API가 leadId 기준이므로)
      const allIds = customers
        .filter(c => c.leadId)
        .map(c => c.leadId as number);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  // 개별 체크박스 선택/해제
  const handleSelectOne = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, leadId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== leadId));
    }
  };

  // 선택 삭제 핸들러
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`${selectedIds.length}명의 고객을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch('/api/admin/affiliate/leads', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || '삭제에 실패했습니다.');
      }

      showSuccess(json.message || '삭제되었습니다.');
      setSelectedIds([]);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      showError(error.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* 툴바 (선택 시 표시) */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 px-6 py-3 flex items-center justify-between border-b border-blue-100">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.length}명 선택됨
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FiTrash2 size={16} />
            {isDeleting ? '삭제 중...' : '선택 삭제'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <tr>
              <th className="px-6 py-4 w-12 text-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={customers.length > 0 && selectedIds.length === customers.filter(c => c.leadId).length}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-4 text-left font-semibold">신청 날짜</th>
              <th className="px-6 py-4 text-left font-semibold">관심 상품</th>
              <th className="px-6 py-4 text-left font-semibold">고객 이름</th>
              <th className="px-6 py-4 text-left font-semibold">연락처</th>
              <th className="px-6 py-4 text-left font-semibold">담당자</th>
              <th className="px-6 py-4 text-left font-semibold">상세 기록</th>
            </tr>
          </thead>
          <tbody className="text-brand-neutral">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                  전화상담 고객이 없습니다.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className={`border-b border-gray-200 hover:bg-gray-50 ${selectedIds.includes(customer.leadId || 0) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 text-center">
                    {customer.leadId && (
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(customer.leadId)}
                        onChange={(e) => handleSelectOne(customer.leadId!, e.target.checked)}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {formatDate(customer.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {customer.cruiseName || '상담 예정'}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {customer.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {customer.phone || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {renderOwnerName(customer.affiliateOwnership)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleNoteClick(customer)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="기록 보기"
                    >
                      <FiFileText size={16} />
                      기록 보기
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 고객 기록 모달 (User ID 있는 경우) */}
      {selectedCustomerForNote && (
        <CustomerNoteModal
          customerId={selectedCustomerForNote.id}
          customerName={selectedCustomerForNote.name}
          isOpen={noteModalOpen}
          onClose={() => {
            setNoteModalOpen(false);
            setSelectedCustomerForNote(null);
          }}
          onNoteAdded={(note?: string) => {
            // Google 스프레드시트에 상세기록 업데이트
            if (note && selectedCustomerForNote) {
              updateGoogleSheet(selectedCustomerForNote, note);
            }
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Lead 기록 모달 (Lead ID만 있는 경우) */}
      {selectedLeadForNote && (
        <LeadNoteModal
          leadId={selectedLeadForNote.id}
          customerName={selectedLeadForNote.name}
          isOpen={leadNoteModalOpen}
          onClose={() => {
            setLeadNoteModalOpen(false);
            setSelectedLeadForNote(null);
          }}
          onNoteAdded={(note?: string) => {
            // Google 스프레드시트에 상세기록 업데이트
            if (note && selectedLeadForNote) {
              updateGoogleSheet(selectedLeadForNote, note);
            }
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}
    </div>
  );
}
