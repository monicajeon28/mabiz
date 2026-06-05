'use client';

// 고객 휴지통(삭제 DB) 페이지
// - 삭제된 고객을 복구하거나 영구삭제(관리자 전용)합니다.
// - 연동 API:
//   GET  /api/contacts/trash?q=&page=&limit=
//   POST /api/contacts/trash/restore  { ids:string[] }
//   POST /api/contacts/trash/purge    { ids:string[] }
//   GET  /api/auth/me  → role 로 GLOBAL_ADMIN 판단

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowLeft,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { ToastContainer, useToast } from '@/components/ui/Toast';

// 휴지통 항목 타입 (API 응답 스펙)
type TrashContact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  deletedAt?: string | null;
  deletedByName?: string | null;
  orgName?: string | null;
};

type RestoreConflict = { id: string; name: string; phone: string };

const PAGE_LIMIT = 20;

// 날짜 포맷 유틸
function fmtDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return '-';
  }
}

export default function TrashPage() {
  // 토스트 렌더링 (대시보드 레이아웃에 전역 컨테이너가 없어 페이지 내에서 마운트)
  const { toasts, removeToast } = useToast();

  // 목록/상태
  const [contacts, setContacts] = useState<TrashContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // 검색
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 로딩/에러
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 액션 진행 상태
  const [acting, setActing] = useState(false);

  // 권한 (영구삭제 버튼 노출 여부)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  // 중복으로 복구 실패한 항목
  const [conflicts, setConflicts] = useState<RestoreConflict[]>([]);

  // 목록 조회
  const fetchTrash = useCallback(
    async (opts?: { page?: number; q?: string }) => {
      const targetPage = opts?.page ?? page;
      const targetQ = opts?.q ?? q;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: targetQ,
          page: String(targetPage),
          limit: String(PAGE_LIMIT),
        });
        const res = await fetch(`/api/contacts/trash?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || '휴지통 목록을 불러오지 못했습니다.');
        }
        setContacts(Array.isArray(data.contacts) ? data.contacts : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        setPage(typeof data.page === 'number' ? data.page : targetPage);
        // 페이지/검색이 바뀌면 선택 초기화
        setSelectedIds(new Set());
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
        setError(msg);
        setContacts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page, q],
  );

  // 권한 조회
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data?.ok) {
        setIsGlobalAdmin(data.role === 'GLOBAL_ADMIN');
      }
    } catch {
      // 권한 조회 실패 시 영구삭제 버튼 숨김 유지
      setIsGlobalAdmin(false);
    }
  }, []);

  // 최초 로드
  useEffect(() => {
    fetchMe();
    fetchTrash({ page: 1, q: '' });
    // 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 검색 실행
  const handleSearch = () => {
    const next = searchInput.trim();
    setQ(next);
    setPage(1);
    fetchTrash({ page: 1, q: next });
  };

  // 새로고침
  const handleRefresh = () => {
    fetchTrash({ page, q });
  };

  // 페이지 이동
  const goToPage = (next: number) => {
    if (next < 1) return;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    if (next > maxPage) return;
    setPage(next);
    fetchTrash({ page: next, q });
  };

  // 단건 선택 토글
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 전체 선택 토글
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  // 복구
  const handleRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showError('복구할 고객을 선택해 주세요.');
      return;
    }
    setActing(true);
    setConflicts([]);
    try {
      const res = await fetch('/api/contacts/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || '복구에 실패했습니다.');
      }
      const restored = typeof data.restored === 'number' ? data.restored : 0;
      const conf: RestoreConflict[] = Array.isArray(data.conflicts) ? data.conflicts : [];

      if (restored > 0) {
        showSuccess(`${restored}건의 고객을 복구했습니다.`);
      }
      if (conf.length > 0) {
        setConflicts(conf);
        showError(`전화번호 중복으로 ${conf.length}건 복구 실패(이미 활성 고객 존재)`);
      } else if (restored === 0) {
        showError('복구된 고객이 없습니다.');
      }
      // 목록 갱신
      await fetchTrash({ page, q });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '복구 중 오류가 발생했습니다.';
      showError(msg);
    } finally {
      setActing(false);
    }
  };

  // 영구삭제 (관리자 전용)
  const handlePurge = async (ids: string[]) => {
    if (ids.length === 0) {
      showError('영구삭제할 고객을 선택해 주세요.');
      return;
    }
    const confirmed = window.confirm(
      `선택한 ${ids.length}건을 영구삭제합니다.\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`,
    );
    if (!confirmed) return;

    setActing(true);
    try {
      const res = await fetch('/api/contacts/trash/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || '영구삭제에 실패했습니다.');
      }
      const purged = typeof data.purged === 'number' ? data.purged : 0;
      showSuccess(`${purged}건을 영구삭제했습니다.`);
      await fetchTrash({ page, q });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '영구삭제 중 오류가 발생했습니다.';
      showError(msg);
    } finally {
      setActing(false);
    }
  };

  const selectedCount = selectedIds.size;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 토스트 컨테이너 (페이지 내 마운트) */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          고객 목록으로 돌아가기
        </Link>
        <div className="flex items-center gap-2">
          <Trash2 className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">삭제 DB (휴지통)</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          삭제된 고객을 복구하거나 영구삭제합니다.
        </p>
      </div>

      {/* 검색 + 새로고침 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="고객명 또는 전화번호 검색"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          검색
        </button>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm text-gray-600">
          {selectedCount > 0 ? (
            <span className="font-medium text-gray-900">{selectedCount}건 선택됨</span>
          ) : (
            <span>전체 {total}건</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestore}
            disabled={acting || selectedCount === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            선택 복구
          </button>
          {isGlobalAdmin && (
            <button
              onClick={() => handlePurge(Array.from(selectedIds))}
              disabled={acting || selectedCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              선택 영구삭제
            </button>
          )}
        </div>
      </div>

      {/* 복구 충돌 경고 */}
      {conflicts.length > 0 && (
        <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            전화번호 중복으로 {conflicts.length}건 복구 실패 (이미 활성 고객 존재)
          </div>
          <ul className="list-disc list-inside text-yellow-700">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.name} ({c.phone})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 목록 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
            >
              다시 시도
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">불러오는 중...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Trash2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">휴지통이 비어 있습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="w-10 px-3 py-3 text-left">
                    <button onClick={toggleAll} aria-label="전체 선택" className="align-middle">
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left font-medium">고객명</th>
                  <th className="px-3 py-3 text-left font-medium">전화</th>
                  <th className="px-3 py-3 text-left font-medium">이메일</th>
                  <th className="px-3 py-3 text-left font-medium">삭제일시</th>
                  <th className="px-3 py-3 text-left font-medium">삭제자</th>
                  <th className="px-3 py-3 text-left font-medium">조직</th>
                  <th className="px-3 py-3 text-right font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <tr key={c.id} className={checked ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleOne(c.id)}
                          aria-label={`${c.name} 선택`}
                          className="align-middle"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-3 py-3 text-gray-700">{c.phone}</td>
                      <td className="px-3 py-3 text-gray-600">{c.email || '-'}</td>
                      <td className="px-3 py-3 text-gray-600">{fmtDate(c.deletedAt)}</td>
                      <td className="px-3 py-3 text-gray-600">{c.deletedByName || '-'}</td>
                      <td className="px-3 py-3 text-gray-600">{c.orgName || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={async () => {
                            // 단건 복구
                            setSelectedIds(new Set([c.id]));
                            // 선택 상태 반영 후 복구 호출
                            const ids = [c.id];
                            setActing(true);
                            setConflicts([]);
                            try {
                              const res = await fetch('/api/contacts/trash/restore', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids }),
                              });
                              const data = await res.json();
                              if (!res.ok || !data?.ok) {
                                throw new Error(data?.error || '복구에 실패했습니다.');
                              }
                              const restored = typeof data.restored === 'number' ? data.restored : 0;
                              const conf: RestoreConflict[] = Array.isArray(data.conflicts)
                                ? data.conflicts
                                : [];
                              if (restored > 0) showSuccess(`${c.name} 복구 완료`);
                              if (conf.length > 0) {
                                setConflicts(conf);
                                showError(
                                  `전화번호 중복으로 복구 실패(이미 활성 고객 존재): ${c.name}`,
                                );
                              }
                              await fetchTrash({ page, q });
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : '복구 중 오류가 발생했습니다.';
                              showError(msg);
                            } finally {
                              setActing(false);
                            }
                          }}
                          disabled={acting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-200 text-green-700 text-xs rounded-lg hover:bg-green-50 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          복구
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {!loading && !error && total > PAGE_LIMIT && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {maxPage}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= maxPage}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
