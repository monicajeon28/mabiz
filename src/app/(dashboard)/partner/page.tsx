'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, Edit2, X } from 'lucide-react';

type Partner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  commissionRate: string;
  totalRevenue: number;
  customerCount: number;
  monthlyMetrics: {
    customerCount: number;
    leadCount: number;
    revenue: number;
  } | null;
  createdAt: string;
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  commissionRate: '',
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: '활성',   cls: 'bg-green-100 text-green-700' },
  INACTIVE:  { label: '비활성', cls: 'bg-gray-100 text-gray-600' },
  SUSPENDED: { label: '정지',   cls: 'bg-red-100 text-red-700' },
  PENDING:   { label: '검토중', cls: 'bg-yellow-100 text-yellow-700' },
};

const TOGGLEABLE_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export default function PartnerPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Partner | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Toast 메시지 표시
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 파트너 목록 조회
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(new Date().getMonth() + 1),
        year: String(new Date().getFullYear()),
      });
      const res = await fetch(`/api/partner/list?${params}`, { signal });
      if (!res.ok) {
        showToast('파트너 목록 조회 실패');
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setPartners(data.data);
      } else {
        showToast('파트너 목록을 불러올 수 없습니다');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load partners:', err);
      showToast('파트너 목록 조회 중 오류가 발생했습니다');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // 파트너 생성
  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/partner/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
          commissionRate: form.commissionRate || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setForm(EMPTY_FORM);
        showToast('파트너가 생성되었습니다');
        load();
      } else {
        showToast(data.message || '파트너 생성 실패');
      }
    } catch (err) {
      console.error(err);
      showToast('파트너 생성 중 오류가 발생했습니다');
    }
    setSaving(false);
  };

  // 파트너 수정
  const updatePartner = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/partner/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email?.trim() || null,
          phone: editForm.phone?.trim() || null,
          commissionRate: editForm.commissionRate || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        setEditForm(EMPTY_FORM);
        showToast('파트너가 수정되었습니다');
        load();
      } else {
        showToast('파트너 수정 실패');
      }
    } catch (err) {
      console.error(err);
      showToast('파트너 수정 중 오류가 발생했습니다');
    }
    setSaving(false);
  };

  // 파트너 삭제
  const deletePartner = async (id: string) => {
    if (!confirm('이 파트너를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/partner/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        showToast('파트너가 삭제되었습니다');
        load();
      } else {
        showToast('파트너 삭제 실패');
      }
    } catch (err) {
      console.error(err);
      showToast('파트너 삭제 중 오류가 발생했습니다');
    }
  };

  // 상태 토글 (IDOR 방지: 서버에서 권한 검증)
  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const previousPartners = [...partners];

    try {
      // Optimistic update
      setPartners(partners.map(p => p.id === id ? { ...p, status: newStatus } : p));

      const res = await fetch(`/api/partner/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('파트너 상태가 변경되었습니다');
      } else {
        // Rollback on failure
        setPartners(previousPartners);
        showToast('파트너 상태 변경 실패');
      }
    } catch (err) {
      // Rollback on error
      setPartners(previousPartners);
      console.error(err);
      showToast('파트너 상태 변경 중 오류가 발생했습니다');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Toast 메시지 */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50">
            {toastMessage}
          </div>
        )}

        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">파트너 대시보드</h1>
            <p className="text-gray-600 mt-2">파트너별 성과 추적 및 관리</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            파트너 추가
          </button>
        </div>

        {/* 파트너 목록 테이블 */}
        {loading ? (
          <div className="text-center py-12">로딩 중...</div>
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">등록된 파트너가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      파트너명
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      연락처
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      수수료율
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      누적 매출
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      고객수
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      상태
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((partner) => (
                    <tr key={partner.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{partner.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {partner.phone && (
                          <div>{partner.phone}</div>
                        )}
                        {partner.email && (
                          <div className="text-sm text-gray-500">{partner.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {partner.commissionRate}%
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {partner.totalRevenue.toLocaleString()} 원
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {partner.customerCount}명
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const meta = STATUS_META[partner.status] ?? { label: partner.status, cls: 'bg-gray-100 text-gray-600' };
                          const canToggle = TOGGLEABLE_STATUSES.has(partner.status);
                          return canToggle ? (
                            <button
                              onClick={() => toggleStatus(partner.id, partner.status)}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${meta.cls}`}
                            >
                              {meta.label}
                            </button>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setDetail(partner)}
                            className="text-blue-600 hover:text-blue-700"
                            aria-label="파트너 보기"
                            title="보기"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(partner.id);
                              setEditForm({
                                name: partner.name,
                                email: partner.email || '',
                                phone: partner.phone || '',
                                commissionRate: partner.commissionRate,
                              });
                            }}
                            className="text-amber-600 hover:text-amber-700"
                            aria-label="파트너 수정"
                            title="수정"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deletePartner(partner.id)}
                            className="text-red-600 hover:text-red-700"
                            aria-label="파트너 삭제"
                            title="삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 파트너 생성 모달 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">파트너 추가</h2>
                <button
                  onClick={() => setShowForm(false)}
                  aria-label="닫기"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    파트너명 *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="파트너명"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="example@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01012345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    수수료율 (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.commissionRate}
                    onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                    placeholder="10.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 파트너 수정 모달 */}
        {editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">파트너 수정</h2>
                <button
                  onClick={() => setEditingId(null)}
                  aria-label="닫기"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    파트너명
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    수수료율 (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.commissionRate}
                    onChange={(e) => setEditForm({ ...editForm, commissionRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={updatePartner}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {saving ? '저장 중...' : '수정'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 파트너 상세보기 모달 */}
        {detail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{detail.name}</h2>
                <button
                  onClick={() => setDetail(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">이메일</p>
                    <p className="font-medium">{detail.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">전화</p>
                    <p className="font-medium">{detail.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">수수료율</p>
                    <p className="font-medium">{detail.commissionRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">누적 매출</p>
                    <p className="font-medium">
                      {detail.totalRevenue.toLocaleString()} 원
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">당월 성과</h3>
                  {detail.monthlyMetrics ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">고객</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {detail.monthlyMetrics.customerCount}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">리드</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {detail.monthlyMetrics.leadCount}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">매출</p>
                        <p className="text-xl font-bold text-green-600">
                          {(detail.monthlyMetrics.revenue / 10000).toFixed(1)}만
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">아직 데이터가 없습니다.</p>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setDetail(null)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
