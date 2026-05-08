'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { logger } from '@/lib/logger';
import { showError } from '@/components/ui/Toast';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { maskPhoneSimple } from '@/lib/privacy/masking';

type InquiryStatus = 'pending' | 'contacted' | 'converted';

interface GoldInquiry {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  status: InquiryStatus;
  callLogCount: number;
  hasPassportNumber: boolean;
  createdAt: string;
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  const map: Record<InquiryStatus, { label: string; className: string }> = {
    pending:   { label: '대기중',   className: 'bg-gray-600/40 text-gray-300' },
    contacted: { label: '연락완료', className: 'bg-blue-600/40 text-blue-300' },
    converted: { label: '전환완료', className: 'bg-green-600/40 text-green-300' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-white/10 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',       label: '전체' },
  { value: 'pending',   label: '대기중' },
  { value: 'contacted', label: '연락완료' },
  { value: 'converted', label: '전환완료' },
];

export default function PartnerGoldInquiriesPage() {
  const params = useParams();
  const partnerId = params?.partnerId as string;

  const [inquiries, setInquiries] = useState<GoldInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [total, setTotal] = useState(0);

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/gold-inquiries?${params}`);
      const data = await res.json();
      if (data.ok) {
        setInquiries(data.inquiries ?? []);
        setTotal(data.total ?? 0);
      } else {
        showError(data.message || '골드회원 문의 데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      logger.error('[PartnerGoldInquiries] 조회 오류', { err, partnerId });
      showError('서버 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, partnerId]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const filtered = inquiries.filter(
    (m) =>
      !searchTerm ||
      m.name.includes(searchTerm) ||
      m.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">골드회원 문의</h1>
          <p className="text-white/60 text-sm mt-0.5">총 {total}건</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름 또는 연락처 검색"
            className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-white/20 rounded-xl px-3 py-2 text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-navy text-white">
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={fetchInquiries}
          className="inline-flex items-center gap-2 border border-white/20 rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
        >
          <FiRefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                {['이름', '연락처', '문의 내용', '통화이력', '상태', '신청일'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-white/40">
                    {searchTerm ? '검색 결과가 없습니다' : '골드회원 문의가 없습니다'}
                  </td>
                </tr>
              ) : (
                filtered.map((inq) => (
                  <tr key={inq.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                      {inq.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 whitespace-nowrap">
                      {inq.phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60 max-w-xs truncate">
                      {inq.message ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 text-center whitespace-nowrap">
                      {inq.callLogCount}건
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={inq.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">
                      {new Date(inq.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
