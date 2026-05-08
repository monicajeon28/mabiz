'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { logger } from '@/lib/logger';
import { showError } from '@/components/ui/Toast';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';

type MemberStatus = 'active' | 'paused' | 'cancelled';

interface GoldMember {
  id: string;
  name: string;
  phone: string;
  tier: number; // 33000 | 66000 | 99000
  startDate: string;
  daysSinceStart: number;
  paymentCount: number;
  status: MemberStatus;
  referredBy: string | null;
  memo: string | null;
}

function TierBadge({ tier }: { tier: number }) {
  if (tier >= 99000) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
        플래티넘 99만
      </span>
    );
  }
  if (tier >= 66000) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
        골드 66만
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
      실버 33만
    </span>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const map: Record<MemberStatus, { label: string; className: string }> = {
    active:    { label: '활성',    className: 'bg-green-100 text-green-700' },
    paused:    { label: '일시중지', className: 'bg-yellow-100 text-yellow-700' },
    cancelled: { label: '해지',    className: 'bg-red-100 text-red-700' },
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
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PartnerGoldMembersPage() {
  const params = useParams();
  const partnerId = params?.partnerId as string;

  const [members, setMembers] = useState<GoldMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/gold-members');
      const data = await res.json();
      if (data.ok) {
        setMembers(data.members ?? []);
        setTotal(data.total ?? 0);
      } else {
        showError(data.message || '골드회원 데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      logger.error('[PartnerGoldMembers] 조회 오류', { err, partnerId });
      showError('서버 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members.filter(
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
          <h1 className="text-2xl font-bold text-white">골드회원 관리</h1>
          <p className="text-white/60 text-sm mt-0.5">담당 골드회원 {total}명</p>
        </div>
      </div>

      {/* 검색 + 새로고침 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름 또는 연락처 검색"
            className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
        <button
          onClick={fetchMembers}
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
                {['이름', '연락처', '티어', '가입일', '경과일수', '납입회차', '상태'].map((h) => (
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-white/40">
                    {searchTerm ? '검색 결과가 없습니다' : '담당 골드회원이 없습니다'}
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                      {member.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 whitespace-nowrap">
                      {member.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TierBadge tier={member.tier} />
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">
                      {new Date(member.startDate).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 text-center whitespace-nowrap">
                      {member.daysSinceStart}일
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-semibold text-center whitespace-nowrap">
                      {member.paymentCount}회
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={member.status} />
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
