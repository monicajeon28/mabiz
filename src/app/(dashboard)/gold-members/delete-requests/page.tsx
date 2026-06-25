"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, AlertTriangle, CheckCircle, XCircle, Loader2, Clock, RefreshCw,
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { useSession } from "@/hooks/useSession";

// API 응답 타입 (route.ts GET 반환 구조와 일치)
type DeleteRequestGoldMember = {
  id: string;
  name: string;
  memberCode: string;
  courseType: string;
  status: string;
  organizationId: string;
};

type DeleteRequest = {
  id: string;
  goldMemberId: string;
  goldMember: DeleteRequestGoldMember;
  requesterId: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type ApiListResponse = {
  ok: boolean;
  total?: number;
  page?: number;
  totalPages?: number;
  requests?: DeleteRequest[];
  error?: string;
};

type ApiActionResponse = {
  ok: boolean;
  error?: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:  "대기 중",
  APPROVED: "승인됨",
  REJECTED: "거부됨",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:  "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
};

const COURSE_LABEL: Record<string, string> = {
  A: "A코스", B: "B코스", C: "C코스", HEALTH: "건강",
};

export default function DeleteRequestsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { role, isAdmin: sessionIsAdmin } = useSession();
  const isAdmin = sessionIsAdmin || role === "GLOBAL_ADMIN";

  const [requests, setRequests]       = useState<DeleteRequest[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [processing, setProcessing]   = useState<string | null>(null); // requestId being processed

  const totalPages = Math.ceil(total / 20);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/gold-members/delete-requests?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiListResponse>;
      })
      .then((d) => {
        if (d.ok) {
          setRequests(d.requests ?? []);
          setTotal(d.total ?? 0);
        } else {
          setError(d.error ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // 관리자가 아니면 접근 차단
  useEffect(() => {
    if (!isAdmin) {
      router.replace("/gold-members");
    }
  }, [isAdmin, router]);

  const handleAction = useCallback(async (requestId: string, action: "approve" | "reject", memberName: string) => {
    const label = action === "approve" ? "승인" : "거부";
    const confirmMsg = action === "approve"
      ? `"${memberName}" 회원 삭제 요청을 승인합니다.\n회원 데이터가 삭제됩니다. 계속하시겠습니까?`
      : `"${memberName}" 회원 삭제 요청을 거부합니다. 계속하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setProcessing(requestId);
    try {
      const res = await fetch(`/api/gold-members/delete-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as ApiActionResponse;
      if (!data.ok) throw new Error(data.error ?? `${label} 실패`);

      toast({
        title: `삭제 요청 ${label} 완료`,
        description: `"${memberName}" 회원 삭제 요청을 ${label}했습니다.`,
        variant: "success",
      });
      // 목록 새로 고침
      load();
    } catch (err) {
      toast({
        title: `${label} 실패`,
        description: err instanceof Error ? err.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  }, [toast, load]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-700 mb-4 min-h-[48px] px-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h1 className="text-xl font-bold text-gray-900">골드회원 삭제 요청 관리</h1>
        </div>
        <p className="text-base text-gray-500">
          지사장이 요청한 골드회원 삭제를 승인하거나 거부합니다.
        </p>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-2 mb-5">
        {([
          { val: "PENDING",  label: "대기 중" },
          { val: "APPROVED", label: "승인됨" },
          { val: "REJECTED", label: "거부됨" },
          { val: "",         label: "전체" },
        ] as const).map(({ val, label }) => (
          <button
            key={val}
            onClick={() => { setStatusFilter(val); setPage(1); }}
            className={`px-4 min-h-[44px] text-base font-medium rounded-lg transition-colors ${
              statusFilter === val
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}

        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-4 min-h-[44px] text-base text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          새로 고침
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-base rounded-xl border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base">
            {statusFilter === "PENDING" ? "처리 대기 중인 삭제 요청이 없습니다." : "삭제 요청이 없습니다."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-base text-gray-500 mb-3">총 {total.toLocaleString()}건</p>
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* 회원 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">
                        {req.goldMember.name}
                      </span>
                      <span className="text-base text-gray-500 font-mono">
                        {req.goldMember.memberCode}
                      </span>
                      <span className="px-2 py-0.5 text-sm rounded-full bg-gray-100 text-gray-600">
                        {COURSE_LABEL[req.goldMember.courseType] ?? req.goldMember.courseType}
                      </span>
                      <span className={`px-2 py-0.5 text-sm font-medium rounded-full ${STATUS_BADGE[req.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                    </div>

                    {/* 삭제 사유 */}
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-500">삭제 사유: </span>
                      <span className="text-base text-gray-700">
                        {req.reason ?? "(사유 없음)"}
                      </span>
                    </div>

                    {/* 요청 시각 */}
                    <div className="text-sm text-gray-400">
                      요청일시: {new Date(req.createdAt).toLocaleString("ko-KR")}
                      {req.reviewedAt && (
                        <span className="ml-3">
                          처리일시: {new Date(req.reviewedAt).toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼 (PENDING만) */}
                  {req.status === "PENDING" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAction(req.id, "reject", req.goldMember.name)}
                        disabled={processing === req.id}
                        className="flex items-center gap-1.5 px-4 min-h-[48px] text-base font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {processing === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        거부
                      </button>
                      <button
                        onClick={() => handleAction(req.id, "approve", req.goldMember.name)}
                        disabled={processing === req.id}
                        className="flex items-center gap-1.5 px-4 min-h-[48px] text-base font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        {processing === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        승인 (삭제)
                      </button>
                    </div>
                  )}

                  {/* 처리 완료 상태 표시 */}
                  {req.status !== "PENDING" && (
                    <div className={`flex items-center gap-1.5 text-base font-medium flex-shrink-0 ${
                      req.status === "APPROVED" ? "text-green-600" : "text-gray-500"
                    }`}>
                      {req.status === "APPROVED" ? (
                        <><CheckCircle className="w-4 h-4" /> 승인 완료</>
                      ) : (
                        <><XCircle className="w-4 h-4" /> 거부됨</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 min-h-[48px] text-base text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-30 transition-colors"
              >
                이전
              </button>
              <span className="text-base text-gray-600">{page} / {totalPages} 페이지</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 min-h-[48px] text-base text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-30 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
