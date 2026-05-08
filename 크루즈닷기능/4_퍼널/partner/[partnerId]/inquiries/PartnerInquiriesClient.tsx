'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { csrfFetch } from '@/lib/csrf-client';
import { logger } from '@/lib/logger';
import { FiSearch, FiX, FiPhone, FiUser } from 'react-icons/fi';

const PAGE_SIZE = 20;

interface LastCall {
  result: string;
  calledAt: string;
  nextContactAt: string | null;
}

interface Inquiry {
  id: number;
  productCode: string;
  productName: string;
  cruiseLine: string;
  name: string;
  phone: string;
  status: string;
  message: string | null;
  managerId: number | null;
  agentId: number | null;
  lastCall: LastCall | null;
  createdAt: string;
}

interface CallLog {
  id: number;
  calledAt: string;
  result: string;
  memo: string | null;
  nextContactAt: string | null;
}

const STATUS_OPTIONS = [
  { value: 'pending',          label: '대기중',   color: 'bg-yellow-100 text-yellow-800' },
  { value: 'unavailable',      label: '부재중',   color: 'bg-orange-100 text-orange-800' },
  { value: 'passport_waiting', label: '여권대기', color: 'bg-blue-100 text-blue-800' },
  { value: 'confirmed',        label: '구매확정', color: 'bg-green-100 text-green-800' },
  { value: 'refund',           label: '환불',     color: 'bg-red-100 text-red-800' },
];

const CALL_RESULT_OPTIONS = [
  { value: 'no_answer',        label: '부재중',  icon: '🔴', color: 'bg-red-600 hover:bg-red-700' },
  { value: 'three_day_absent', label: '3일부재', icon: '🟠', color: 'bg-orange-600 hover:bg-orange-700' },
  { value: 'sms_sent',         label: '문자보냄', icon: '🟡', color: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'managing',         label: '관리중',  icon: '🔵', color: 'bg-blue-600 hover:bg-blue-700' },
  { value: 'payment_done',     label: '결제완료', icon: '🟢', color: 'bg-green-600 hover:bg-green-700' },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color ?? 'bg-gray-100 text-gray-800';
}
function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}
function getCallResultLabel(result: string) {
  return CALL_RESULT_OPTIONS.find(r => r.value === result)?.label ?? result;
}
function getCallResultIcon(result: string) {
  return CALL_RESULT_OPTIONS.find(r => r.value === result)?.icon ?? '📞';
}

export default function PartnerInquiriesClient({ partnerId }: { partnerId: string }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // 콜 패널
  const [callInquiry, setCallInquiry] = useState<Inquiry | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLogsLoading, setCallLogsLoading] = useState(false);
  const [callResult, setCallResult] = useState('');
  const [callMemo, setCallMemo] = useState('');
  const [callNextDate, setCallNextDate] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  const loadInquiries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/partner/inquiries?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setInquiries(data.inquiries ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (error) {
      logger.error('[PartnerInquiries] 로드 실패', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchTerm]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearchTerm(val); setPage(1); }, 500);
  };

  const changeFilter = (status: string) => { setStatusFilter(status); setPage(1); };

  // 콜 패널 열기
  const openCallPanel = async (inquiry: Inquiry) => {
    setCallInquiry(inquiry);
    setCallResult(''); setCallMemo(''); setCallNextDate('');
    try {
      setCallLogsLoading(true);
      // 파트너는 어드민 콜로그 API 대신 shared API 사용 (추후 별도 파트너 API 추가 가능)
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/call-logs`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setCallLogs(data.logs ?? []);
    } catch (error) {
      logger.error('[PartnerCallPanel] 로드 실패', error);
    } finally {
      setCallLogsLoading(false);
    }
  };

  const handleSaveCallLog = async () => {
    if (!callInquiry || !callResult) { showError('전화 결과를 선택해주세요.'); return; }
    if (callMemo.length > 500) { showError('메모는 500자 이하로 입력해주세요.'); return; }
    try {
      setSavingCall(true);
      const res = await csrfFetch(`/api/admin/inquiries/${callInquiry.id}/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ result: callResult, memo: callMemo || null, nextContactAt: callNextDate || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '저장 실패');
      showSuccess('콜 기록이 저장되었습니다.');
      setCallResult(''); setCallMemo(''); setCallNextDate('');
      await Promise.all([
        loadInquiries(),
        (async () => {
          const r2 = await fetch(`/api/admin/inquiries/${callInquiry.id}/call-logs`, { credentials: 'include' });
          const d2 = await r2.json();
          if (d2.ok) setCallLogs(d2.logs ?? []);
        })(),
      ]);
    } catch (error) {
      showError(error instanceof Error ? error.message : '저장 중 오류');
    } finally {
      setSavingCall(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 담당 구매 문의</h1>
        <span className="text-sm text-gray-500">총 {total}건</span>
      </div>

      {/* 검색 + 필터 */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="이름, 연락처, 상품명 검색..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearchTerm(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FiX size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ value: 'all', label: '전체' }, ...STATUS_OPTIONS].map(opt => (
            <button key={opt.value} onClick={() => changeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 문의 카드 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto" />
          <p className="mt-3 text-gray-400 text-sm">로딩 중...</p>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">담당 문의가 없습니다.</p>
          <p className="text-sm">내 링크를 통해 들어온 문의가 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(inquiry => (
            <div key={inquiry.id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 상품명 */}
                  <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{inquiry.productName}</p>
                  <p className="text-xs text-gray-400 mb-2">{inquiry.cruiseLine} · {inquiry.productCode}</p>

                  {/* 고객 정보 */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1">
                      <FiUser size={13} className="text-gray-400" />
                      <span className="font-bold text-gray-900 text-sm">{inquiry.name}</span>
                    </div>
                    <a href={`tel:${inquiry.phone}`}
                      className="flex items-center gap-1 text-blue-600 font-semibold text-sm hover:underline">
                      <FiPhone size={13} />
                      {inquiry.phone}
                    </a>
                  </div>

                  {/* 최근 콜 */}
                  {inquiry.lastCall && (
                    <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg inline-flex items-center gap-1.5">
                      {getCallResultIcon(inquiry.lastCall.result)}
                      {getCallResultLabel(inquiry.lastCall.result)} ·
                      {new Date(inquiry.lastCall.calledAt).toLocaleDateString('ko-KR')}
                      {inquiry.lastCall.nextContactAt && (
                        <span className="text-blue-500 ml-1">
                          → 재연락 {new Date(inquiry.lastCall.nextContactAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* 상태 뱃지 */}
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${getStatusStyle(inquiry.status)}`}>
                    {getStatusLabel(inquiry.status)}
                  </span>
                  {/* 문의일 */}
                  <span className="text-xs text-gray-400">
                    {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                  {/* 콜 기록 버튼 */}
                  <button onClick={() => openCallPanel(inquiry)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold">
                    📞 콜 기록
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-3 py-2 rounded-xl border text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">
            ← 이전
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
            className="px-3 py-2 rounded-xl border text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">
            다음 →
          </button>
        </div>
      )}

      {/* 콜 기록 패널 */}
      {callInquiry && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCallInquiry(null)} />
          <div className="w-full max-w-sm bg-white flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="px-4 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">📞 콜 기록</p>
                <p className="text-sm text-gray-500">{callInquiry.name} · {callInquiry.phone}</p>
              </div>
              <button onClick={() => setCallInquiry(null)} className="p-2 hover:bg-gray-200 rounded-lg">
                <FiX size={18} />
              </button>
            </div>

            <div className="px-4 py-4 border-b space-y-3">
              <p className="text-sm font-semibold text-gray-700">전화 결과</p>
              <div className="grid grid-cols-2 gap-2">
                {CALL_RESULT_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setCallResult(opt.value)}
                    className={`py-2.5 px-3 rounded-xl text-white font-semibold text-xs text-left ${opt.color} ${
                      callResult === opt.value ? 'ring-2 ring-offset-1 ring-white scale-[1.03]' : 'opacity-75'
                    }`}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              <textarea value={callMemo} onChange={(e) => setCallMemo(e.target.value)}
                placeholder="메모 (선택, 최대 500자)" maxLength={500} rows={2}
                className="w-full px-3 py-2 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500"
              />
              <input type="date" value={callNextDate} onChange={(e) => setCallNextDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="다음 연락 예정일" />
              <button onClick={handleSaveCallLog} disabled={savingCall || !callResult}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {savingCall ? '저장 중...' : '기록 저장'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">기록 타임라인</p>
              {callLogsLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm">로딩 중...</div>
              ) : callLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">콜 기록이 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map(log => (
                    <div key={log.id} className="flex gap-3">
                      <span className="text-lg flex-shrink-0">{getCallResultIcon(log.result)}</span>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3">
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-sm">{getCallResultLabel(log.result)}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.calledAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        {log.memo && <p className="text-sm text-gray-600">{log.memo}</p>}
                        {log.nextContactAt && (
                          <p className="text-xs text-blue-500 mt-1">
                            📅 {new Date(log.nextContactAt).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
