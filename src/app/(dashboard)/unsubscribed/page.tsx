'use client';

import { useEffect, useState } from 'react';
import { Search, Trash2, AlertCircle } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/lib/api/use-toast';

interface UnsubscribedItem {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
  createdBy: string;
}

interface Stats {
  ok: boolean;
  total: number;
  thisMonth: number;
  thisWeek: number;
  percentage: string;
}

interface ListResponse {
  ok: boolean;
  items: UnsubscribedItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function UnsubscribedPage() {
  const { role } = useSession();
  const { toast } = useToast();

  // 권한 확인: AGENT 역할은 접근 불가
  const canView = role === 'OWNER' || role === 'GLOBAL_ADMIN' || role === 'AGENT';
  const canDelete = role === 'OWNER' || role === 'GLOBAL_ADMIN';

  const [items, setItems] = useState<UnsubscribedItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const LIMIT = 20;

  // 목록 조회
  useEffect(() => {
    const fetchItems = async () => {
      if (!canView) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
        });

        if (search) {
          params.set('search', search);
        }

        const res = await fetch(`/api/unsubscribed?${params.toString()}`);
        const data: ListResponse = await res.json();

        if (data.ok) {
          setItems(data.items);
          setTotal(data.total);
          setPages(data.pages);
        } else {
          toast({
            title: '목록 조회 실패',
            description: '목록 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Failed to fetch unsubscribed:', err);
        toast({
          title: '목록 조회 실패',
          description: '목록 조회에 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [page, search, canView, toast]);

  // 통계 조회
  useEffect(() => {
    const fetchStats = async () => {
      if (!canView) return;

      try {
        const res = await fetch('/api/unsubscribed/stats');
        const data: Stats = await res.json();
        if (data.ok) {
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
  }, [canView]);

  // 거부 해제 (삭제)
  const handleDelete = async (id: string, phone: string) => {
    if (!canDelete) {
      toast({
        title: '권한 없음',
        description: '권한이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`${phone} 고객의 수신거부를 해제하시겠습니까?`)) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/unsubscribed/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: '성공',
          description: '수신거부가 해제되었습니다.',
          variant: 'success',
        });
        setItems(items.filter(item => item.id !== id));
        setTotal(total - 1);
      } else {
        toast({
          title: '해제 실패',
          description: '해제에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast({
        title: '해제 실패',
        description: '해제에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  // 접근 불가
  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <AlertCircle className="w-12 h-12 text-red-600 mb-4 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">접근 불가</h1>
          <p className="text-gray-600">수신거부 관리 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">수신거부 관리</h1>
          <p className="text-gray-600">
            수신거부 고객 목록을 관리합니다.{!canDelete && ' (조회 전용)'}
          </p>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">총 거부</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">이번달</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.thisMonth}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ({stats.percentage}%)
                  </p>
                </div>
                <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">이번주</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.thisWeek}</p>
                </div>
                <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 검색 및 필터 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="전화 검색"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 목록 테이블 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
              <p>로드 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">수신거부된 고객이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <p className="text-sm font-semibold text-gray-700">연락처</p>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <p className="text-sm font-semibold text-gray-700">이름</p>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <p className="text-sm font-semibold text-gray-700">등록일</p>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <p className="text-sm font-semibold text-gray-700">등록자</p>
                      </th>
                      {canDelete && (
                        <th className="px-6 py-3 text-center">
                          <p className="text-sm font-semibold text-gray-700">작업</p>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {item.phone}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {item.name || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {new Date(item.createdAt).toLocaleDateString(
                              'ko-KR',
                              {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              }
                            )}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {item.createdBy === 'SELF'
                              ? '자가등록'
                              : item.createdBy}
                          </p>
                        </td>
                        {canDelete && (
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDelete(item.id, item.phone)}
                              disabled={deleting === item.id}
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {deleting === item.id ? '삭제중...' : '삭제'}
                              </span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {items.length > 0 && (
                    <>
                      <span className="font-medium">
                        {(page - 1) * LIMIT + 1}-
                        {Math.min(page * LIMIT, total)}
                      </span>
                      {' / '}
                      <span className="font-medium">{total}</span>
                    </>
                  )}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>

                  {/* 페이지 번호 */}
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const pageNum =
                      Math.max(1, page - Math.floor(5 / 2)) + i;
                    if (pageNum > pages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          pageNum === page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage(Math.min(pages, page + 1))}
                    disabled={page === pages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 권한 안내 */}
        {!canDelete && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              관리자만 수신거부를 해제할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

