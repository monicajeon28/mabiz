"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Check,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { AffiliateSalesResponse } from "@/lib/affiliate/types";
import { useToast } from "@/lib/api/use-toast";

type Sale = {
  id: string;
  organizationId: string;
  affiliateCode: string;
  affiliateUserId?: string;
  productName: string;
  saleAmount: number;
  commissionAmount: number;
  status: string;
  customerPhone?: string;
  createdAt: string;
  updatedAt: string;
  agentDisplayName?: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  PENDING: {
    label: "대기",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: "◉",
  },
  PENDING_APPROVAL: {
    label: "승인대기",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: "⏳",
  },
  APPROVED: {
    label: "승인",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: "✓",
  },
  CONFIRMED: {
    label: "확정",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: "★",
  },
  REJECTED: {
    label: "거절",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: "✕",
  },
};

export default function SalesConfirmationPage() {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const totalPages = Math.ceil(total / 50);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
    });
    if (status && status !== "ALL") params.set("status", status);
    if (search) params.set("search", search);

    fetch(`/api/affiliate/sales-confirmation?${params}`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.ok && d.data) {
          setSales(d.data);
          setTotal(d.total || 0);
        } else {
          setSales([]);
          setTotal(0);
          toast({
            title: "로드 실패",
            description: d.error || "판매 내역을 불러올 수 없습니다.",
            variant: "destructive",
          });
        }
      })
      .catch((err) => {
        setSales([]);
        setTotal(0);
        toast({
          title: "네트워크 오류",
          description: err.message,
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [page, status, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      load();
    }, 300);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sales.map((s) => s.id)));
    }
  };

  const handleApprove = async (saleId: string, action: "approve" | "reject") => {
    if (
      action === "reject" &&
      !rejectionReason.trim() &&
      detailSale?.id === saleId
    ) {
      toast({
        title: "거절 사유 필수",
        description: "거절 사유를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);
    try {
      const body = {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        ...(action === "approve" && approvalNote && { approverNote: approvalNote }),
        ...(action === "reject" && { rejectionReason }),
      };

      const r = await fetch(`/api/affiliate/sales-confirmation/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast({
          title: "처리 실패",
          description: d.error || "요청을 처리할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: action === "approve" ? "승인 완료" : "거절 완료",
        description: `판매 실적이 ${action === "approve" ? "승인" : "거절"}되었습니다.`,
      });

      setDetailSale(null);
      setApprovalNote("");
      setRejectionReason("");
      load();
    } catch (err) {
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "요청 실패",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "선택 필요",
        description: "승인할 항목을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `${selectedIds.size}개 항목을 승인하시겠습니까?`
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      const r = await fetch(`/api/affiliate/sales-confirmation/batch-approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast({
          title: "일괄 승인 실패",
          description: d.error || "요청을 처리할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "일괄 승인 완료",
        description: `${d.updated}개 항목이 승인되었습니다.`,
      });

      setSelectedIds(new Set());
      load();
    } catch (err) {
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "요청 실패",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING_APPROVAL;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">판매 확인 허브</h1>
        <p className="text-sm text-gray-500 mt-1">
          세일즈 실적을 검토하고 승인/거절하세요
        </p>
      </div>

      {/* 필터 + 검색 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex gap-3 flex-wrap">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">전체 상태</option>
          <option value="PENDING">대기</option>
          <option value="PENDING_APPROVAL">승인대기</option>
          <option value="APPROVED">승인</option>
          <option value="CONFIRMED">확정</option>
          <option value="REJECTED">거절</option>
        </select>

        <input
          type="text"
          placeholder="고객명, 전화번호, 상품명 검색..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-900 font-medium">
            {selectedIds.size}개 선택됨
          </span>
          <button
            onClick={handleBatchApprove}
            disabled={approving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {approving && <Loader2 className="w-4 h-4 animate-spin" />}
            일괄 승인
          </button>
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">판매 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        sales.length > 0 && selectedIds.size === sales.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    상품
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    고객
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    판매액
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    세일즈
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    상태
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    작성일
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => {
                  const cfg = STATUS_CONFIG[sale.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sale.id)}
                          onChange={() => toggleSelect(sale.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 truncate">
                        {sale.productName}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {sale.customerPhone || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {sale.saleAmount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {sale.agentDisplayName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-sm font-medium ${cfg.bgColor} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {new Date(sale.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setDetailSale(sale);
                            setApprovalNote("");
                            setRejectionReason("");
                          }}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="상세 보기"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">총 {total.toLocaleString()}건</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-2 text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 상세 모달 */}
      {detailSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                판매 확인 - {detailSale.productName}
              </h2>
              <button
                onClick={() => setDetailSale(null)}
                className="text-gray-600 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      제휴 코드
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {detailSale.affiliateCode}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      고객 연락처
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {detailSale.customerPhone || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 판매 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  판매 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      상품명
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {detailSale.productName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      판매액
                    </label>
                    <p className="text-sm font-bold text-gray-900">
                      {detailSale.saleAmount.toLocaleString()}원
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      수수료
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {detailSale.commissionAmount.toLocaleString()}원
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      현재 상태
                    </label>
                    <p className="text-sm">
                      <span
                        className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS_CONFIG[detailSale.status]?.bgColor} ${STATUS_CONFIG[detailSale.status]?.color}`}
                      >
                        {STATUS_CONFIG[detailSale.status]?.label || detailSale.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 타임스탬프 */}
              <div className="text-sm text-gray-500">
                <p>작성: {new Date(detailSale.createdAt).toLocaleString("ko-KR")}</p>
                <p>수정: {new Date(detailSale.updatedAt).toLocaleString("ko-KR")}</p>
              </div>

              {/* 승인 폼 */}
              {(detailSale.status === "PENDING" ||
                detailSale.status === "PENDING_APPROVAL") && (
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    승인/거절
                  </h3>

                  <div>
                    <label className="text-sm text-gray-600 font-medium block mb-2">
                      승인 코멘트 (선택)
                    </label>
                    <textarea
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="승인 시 작성할 코멘트..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 font-medium block mb-2">
                      거절 사유 (거절 시 필수)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="거절 사유를 상세히 입력해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => handleApprove(detailSale.id, "approve")}
                      disabled={approving}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {approving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      승인
                    </button>
                    <button
                      onClick={() => handleApprove(detailSale.id, "reject")}
                      disabled={approving}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {approving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      거절
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
