'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Ship, Search, Download, FileSpreadsheet, ArrowLeft, Users, RefreshCw, Loader2 } from 'lucide-react';
import { showError } from '@/components/ui/Toast';

interface TripItem {
  tripId: number;
  productCode: string;
  shipName: string;
  cruiseName: string | null;
  departureDate: string;
  reservationCount: number;
  travelerCount: number;
}

interface ApisTraveler {
  travelerId: number;
  reservationId: number;
  pnrNumber: string | null;
  roomNumber: number | null;
  cabinType: string | null;
  engSurname: string | null;
  engGivenName: string | null;
  korName: string | null;
  gender: string | null;
  birthDate: string | null;
  nationality: string | null;
  passportNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  phone: string | null;
  companionGroupId: number | null;
  roomingGroupId: number | null;
  airlineName: string | null;
  agentName: string | null;
  notes: string | null;
  passportDriveUrl: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('ko-KR'); } catch { return '-'; }
}

export default function ApisPage() {
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [travelers, setTravelers] = useState<ApisTraveler[]>([]);
  const [loadingTravelers, setLoadingTravelers] = useState(false);

  const loadTrips = useCallback(async (q: string) => {
    setLoadingTrips(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/passport/admin/apis-trips?${params}`);
      const data = await res.json();
      if (data.ok) setTrips(data.trips ?? []);
      else showError('여행 목록을 불러오지 못했습니다.');
    } catch { showError('네트워크 오류'); }
    finally { setLoadingTrips(false); }
  }, []);

  useEffect(() => { loadTrips(''); }, [loadTrips]);

  const selectTrip = async (trip: TripItem) => {
    setSelectedTrip(trip);
    setLoadingTravelers(true);
    setTravelers([]);
    try {
      const res = await fetch(`/api/passport/admin/apis-by-trip?tripId=${trip.tripId}`);
      const data = await res.json();
      if (data.ok) setTravelers(data.travelers ?? []);
      else showError('APIS 데이터를 불러오지 못했습니다.');
    } catch { showError('네트워크 오류'); }
    finally { setLoadingTravelers(false); }
  };

  const downloadExcel = () => {
    if (!selectedTrip) return;
    window.open(`/api/passport/admin/apis-excel?tripId=${selectedTrip.tripId}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/passport" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            여행별 APIS 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">여행을 선택하면 탑승객 APIS(승객정보)를 확인하고 엑셀로 다운로드합니다</p>
        </div>
        <button
          onClick={() => loadTrips(search)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌측: 여행 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadTrips(search)}
              placeholder="선박명·크루즈명·상품코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {loadingTrips ? (
              <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : trips.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Ship className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                여행이 없습니다
              </div>
            ) : (
              trips.map(trip => (
                <button
                  key={trip.tripId}
                  onClick={() => selectTrip(trip)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedTrip?.tripId === trip.tripId ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Ship className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-sm text-gray-900 truncate">{trip.shipName || '선박미정'}</span>
                  </div>
                  {trip.cruiseName && <p className="text-xs text-gray-500 truncate mb-1">{trip.cruiseName}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{fmtDate(trip.departureDate)} 출발</span>
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{trip.travelerCount}명</span>
                  </div>
                  {trip.productCode && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{trip.productCode}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우측: APIS 테이블 */}
        <div className="lg:col-span-2">
          {!selectedTrip ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white border border-dashed border-gray-300 rounded-xl">
              <FileSpreadsheet className="w-10 h-10 mb-3 text-gray-300" />
              <p className="text-sm">왼쪽에서 여행을 선택하세요</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900">{selectedTrip.shipName}</h2>
                  <p className="text-xs text-gray-500">{fmtDate(selectedTrip.departureDate)} 출발 · 탑승객 {travelers.length}명</p>
                </div>
                <button
                  onClick={downloadExcel}
                  disabled={travelers.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  엑셀 다운로드
                </button>
              </div>

              {loadingTravelers ? (
                <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : travelers.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  아직 제출된 탑승객 APIS 정보가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">PNR</th>
                        <th className="px-2 py-2 text-left font-medium">방</th>
                        <th className="px-2 py-2 text-left font-medium">성명</th>
                        <th className="px-2 py-2 text-left font-medium">영문</th>
                        <th className="px-2 py-2 text-left font-medium">성별</th>
                        <th className="px-2 py-2 text-left font-medium">생년월일</th>
                        <th className="px-2 py-2 text-left font-medium">국적</th>
                        <th className="px-2 py-2 text-left font-medium">여권번호</th>
                        <th className="px-2 py-2 text-left font-medium">만료일</th>
                        <th className="px-2 py-2 text-left font-medium">연락처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {travelers.map(t => (
                        <tr key={t.travelerId} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-gray-600">{t.pnrNumber ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.roomNumber ?? '-'}</td>
                          <td className="px-2 py-2 font-medium text-gray-900">{t.korName ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{[t.engSurname, t.engGivenName].filter(Boolean).join(' ') || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.gender ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.birthDate ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.nationality ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.passportNo ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.expiryDate ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.phone ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
