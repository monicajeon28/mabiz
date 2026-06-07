'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, RefreshCw, Users, FileText } from 'lucide-react';

interface Traveler {
  id: number;
  korName: string | null;
  engSurname: string | null;
  engGivenName: string | null;
}

interface Trip {
  id: number;
  departureDate: string | null;
  productCode: string;
  product: {
    cruiseLine: string | null;
    shipName: string | null;
    packageName: string | null;
  };
}

interface ReservationUser {
  id: number;
  name: string | null;
  phone: string | null;
}

interface Reservation {
  id: number;
  totalPeople: number;
  passportStatus: string;
  pnrStatus: string;
  createdAt: string | null;
  user: ReservationUser;
  trip: Trip | null;
  travelers: Traveler[];
}

const PNR_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기 중',
  CONFIRMED: '확인 완료',
};
const PNR_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
};

const PASSPORT_STATUS_LABEL: Record<string, string> = {
  PENDING: '미완료',
  CONFIRMED: '완료',
};
const PASSPORT_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-red-100 text-red-800',
  CONFIRMED: 'bg-green-100 text-green-800',
};

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function PnrPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filterPnr, setFilterPnr] = useState('');
  const [filterPassport, setFilterPassport] = useState('');

  const fetchList = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pnr/partner/list', { credentials: 'include', signal });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `오류 (${res.status})`);
        return;
      }
      const data = await res.json();
      setReservations(data.reservations ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const filtered = reservations.filter((r) => {
    const qLower = q.toLowerCase();
    const matchQ =
      !q ||
      String(r.id).includes(q) ||
      (r.user.name ?? '').toLowerCase().includes(qLower) ||
      (r.user.phone ?? '').includes(q) ||
      (r.trip?.product.shipName ?? '').toLowerCase().includes(qLower);
    const matchPnr = !filterPnr || r.pnrStatus === filterPnr;
    const matchPassport = !filterPassport || r.passportStatus === filterPassport;
    return matchQ && matchPnr && matchPassport;
  });

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예약 관리 (PNR)</h1>
          <p className="text-sm text-gray-500 mt-1">크루즈 여행 예약번호 및 여권 현황을 관리합니다.</p>
        </div>
        <Link
          href="/pnr/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          새 예약 등록
        </Link>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예약번호·고객명·전화번호·선박명 검색"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <select
          value={filterPnr}
          onChange={(e) => setFilterPnr(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">PNR 상태 전체</option>
          <option value="PENDING">대기 중</option>
          <option value="CONFIRMED">확인 완료</option>
        </select>

        <select
          value={filterPassport}
          onChange={(e) => setFilterPassport(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">여권 상태 전체</option>
          <option value="PENDING">미완료</option>
          <option value="CONFIRMED">완료</option>
        </select>

        <button
          onClick={() => fetchList()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
            <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            예약 목록 불러오는 중...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-500 text-sm gap-3">
            <span>{error}</span>
            <button
              onClick={() => fetchList()}
              className="px-3 py-1 text-xs bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
            <FileText size={36} className="text-gray-300" />
            {q || filterPnr || filterPassport ? (
              <span>검색 결과가 없습니다.</span>
            ) : (
              <>
                <span>등록된 예약이 없습니다.</span>
                <Link href="/pnr/new" className="text-blue-600 hover:underline text-xs">
                  첫 예약 등록하기 →
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">예약번호</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">고객명</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">여행상품</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">출발일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">인원</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">PNR 상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">여권 상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/passport?reservationId=${r.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-700 font-medium">#{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.user.name ?? '-'}</div>
                      {r.user.phone && (
                        <div className="text-xs text-gray-400">{r.user.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {r.trip?.product.shipName ?? r.trip?.product.packageName ?? '-'}
                      </div>
                      {r.trip?.product.cruiseLine && (
                        <div className="text-xs text-gray-400">{r.trip.product.cruiseLine}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(r.trip?.departureDate ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Users size={13} className="text-gray-400" />
                        {r.totalPeople}명
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PNR_STATUS_CLASS[r.pnrStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                        {PNR_STATUS_LABEL[r.pnrStatus] ?? r.pnrStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PASSPORT_STATUS_CLASS[r.passportStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                        {PASSPORT_STATUS_LABEL[r.passportStatus] ?? r.passportStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              총 {filtered.length}건{reservations.length !== filtered.length && ` (전체 ${reservations.length}건 중 필터됨)`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
