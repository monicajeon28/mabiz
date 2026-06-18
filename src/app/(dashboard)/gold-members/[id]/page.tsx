"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { ArrowLeft, Star, Loader2, CheckCircle, PauseCircle, XCircle, Trash2, Clock, UserCheck } from "lucide-react";

type Consultation = {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
};

type DeleteRequest = {
  id: string;
  goldMemberId: string;
  requesterId: string;
  reason: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  reviewerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type GoldMemberDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  memberCode: string;
  courseType: string;
  joinDate: string;
  paymentDay: number | null;
  totalPayments: number;
  paidCount: number;
  maxPaymentCount: number | null; // B2 수정
  agentId: number | null;         // B2 수정
  agentName: string | null;
  managerId: number | null;
  status: string;
  memo: string | null;
  consultations: Consultation[];
  createdAt: string;
};

const COURSE_LABEL: Record<string, string> = { A: "A코스", B: "B코스", C: "C코스", HEALTH: "건강" };

const COURSE_BADGE: Record<string, string> = {
  A: "bg-blue-100 text-blue-700",
  B: "bg-purple-100 text-purple-700",
  C: "bg-indigo-100 text-indigo-700",
  HEALTH: "bg-emerald-100 text-emerald-700",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  SUSPENDED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    "유지 중",
  SUSPENDED: "일시정지",
  CANCELLED: "해지됨",
};

export default function GoldMemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const abortControllerRef = useRef<AbortController | null>(null);

  // 세션에서 역할/ID 즉시 읽기 (layout의 SessionProvider가 서버에서 주입)
  const { role: userRole, userId, isAdmin: sessionIsAdmin } = useSession();

  const [member, setMember]         = useState<GoldMemberDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [actionError, setActionError] = useState("");

  // 상태 관리
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // 상담 내역
  const [consultContent, setConsultContent] = useState("");
  const [consultSaving, setConsultSaving]   = useState(false);
  const [consultError, setConsultError]     = useState("");

  // 삭제 요청
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deleteReqLoading, setDeleteReqLoading]         = useState(false);
  const [showDeleteModal, setShowDeleteModal]           = useState(false);
  const [deleteReason, setDeleteReason]                 = useState("");
  const [deleteReqError, setDeleteReqError]             = useState("");
  const [reviewProcessing, setReviewProcessing]         = useState<string | null>(null); // 'approve' | 'reject'

  const load = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    fetch(`/api/gold-members/${id}`, {
      signal: abortControllerRef.current.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMember(d.member);
        else setLoadError(d.error ?? "불러오기 실패");
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoadError("서버 오류");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 삭제 요청 현황 조회
  const loadDeleteRequests = useCallback(() => {
    fetch(`/api/gold-members/delete-requests?goldMemberId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.requests)) {
          const pending = d.requests.find((r: DeleteRequest) => r.status === "PENDING") ?? null;
          setPendingDeleteRequest(pending);
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (userRole && userRole !== "AGENT" && userRole !== "FREE_SALES") {
      loadDeleteRequests();
    }
  }, [loadDeleteRequests, userRole]);

  // B3 수정: PATCH 응답의 member로 상태 갱신
  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(newStatus);
    setActionError("");
    try {
      const res = await fetch(`/api/gold-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        // B3 수정: 서버 응답값으로 갱신
        if (data.member) {
          setMember(data.member as GoldMemberDetail);
        } else {
          setMember((prev) => prev ? { ...prev, status: newStatus } : prev);
        }
      } else {
        setActionError(data.error ?? "상태 업데이트 실패");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "서버 오류");
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsultError("");
    if (!consultContent.trim()) {
      setConsultError("내용을 입력해주세요.");
      return;
    }
    setConsultSaving(true);
    try {
      const res = await fetch(`/api/gold-members/${id}/consultation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: consultContent }),
      });
      const data = await res.json();
      if (data.ok) {
        setConsultContent("");
        load();
      } else {
        setConsultError(data.error ?? "저장 실패");
      }
    } catch {
      setConsultError("서버 오류");
    } finally {
      setConsultSaving(false);
    }
  };

  // 삭제 요청 제출 (OWNER, GLOBAL_ADMIN)
  const handleDeleteRequest = async () => {
    setDeleteReqError("");
    setDeleteReqLoading(true);
    try {
      const res = await fetch("/api/gold-members/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goldMemberId: id, reason: deleteReason.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowDeleteModal(false);
        setDeleteReason("");
        loadDeleteRequests();
      } else {
        setDeleteReqError(data.error ?? "요청 실패");
      }
    } catch {
      setDeleteReqError("서버 오류");
    } finally {
      setDeleteReqLoading(false);
    }
  };

  // 삭제 요청 승인/거부 (GLOBAL_ADMIN)
  const handleReview = async (requestId: string, action: "approve" | "reject") => {
    setReviewProcessing(action);
    try {
      const res = await fetch(`/api/gold-members/delete-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        if (action === "approve") {
          // 회원이 소프트삭제됐으므로 목록으로 이동
          router.push("/gold-members");
        } else {
          loadDeleteRequests();
        }
      } else {
        setActionError(data.error ?? "처리 실패");
      }
    } catch {
      setActionError("서버 오류");
    } finally {
      setReviewProcessing(null);
    }
  };

  // 세션 또는 멤버 데이터 로딩 중 — 스켈레톤으로 깜빡임 방지
  if (loading || userRole === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-5" />
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-3">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
          <div className="h-4 w-36 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (loadError || !member) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>{loadError || "회원을 찾을 수 없습니다."}</p>
        <button onClick={() => router.push("/gold-members")} className="mt-4 text-sm text-blue-600 hover:underline">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const progressPct = member.totalPayments > 0
    ? Math.min(100, Math.round((member.paidCount / member.totalPayments) * 100))
    : 0;

  const isOwner       = userRole === "OWNER";
  const isGlobalAdmin = sessionIsAdmin || userRole === "GLOBAL_ADMIN";
  const canRequestDelete = isOwner || isGlobalAdmin;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.push("/gold-members")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        골드회원 목록
      </button>

      {/* 삭제 요청 대기 배지 */}
      {pendingDeleteRequest && (
        <div className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <span className="text-sm font-medium text-orange-700">삭제 요청 대기 중</span>
            {pendingDeleteRequest.reason && (
              <span className="text-sm text-orange-600">— {pendingDeleteRequest.reason}</span>
            )}
          </div>
          {/* GLOBAL_ADMIN: 승인/거부 버튼 */}
          {isGlobalAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => handleReview(pendingDeleteRequest.id, "approve")}
                disabled={reviewProcessing !== null}
                className="flex items-center gap-1.5 min-h-[48px] px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {reviewProcessing === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                승인 (삭제)
              </button>
              <button
                onClick={() => handleReview(pendingDeleteRequest.id, "reject")}
                disabled={reviewProcessing !== null}
                className="flex items-center gap-1.5 min-h-[48px] px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {reviewProcessing === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                거부
              </button>
            </div>
          )}
        </div>
      )}

      {/* 상단 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COURSE_BADGE[member.courseType] ?? "bg-gray-100 text-gray-500"}`}>
                  {COURSE_LABEL[member.courseType] ?? member.courseType}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[member.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABEL[member.status] ?? member.status}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">회원코드</p>
            <p className="font-mono text-base font-bold text-gray-800 tracking-widest">{member.memberCode}</p>
          </div>
        </div>
      </div>

      {/* 정보 섹션 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-700 mb-4">기본 정보</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">전화번호</dt>
            <dd className="text-sm text-gray-900 font-mono">{member.phone}</dd>
          </div>
          {member.email && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">이메일</dt>
              <dd className="text-sm text-gray-900">{member.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">가입날짜</dt>
            <dd className="text-sm text-gray-900">{member.joinDate.slice(0, 10)}</dd>
          </div>
          {member.paymentDay && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">매월 납부 예정일</dt>
              <dd className="text-sm text-gray-900">매월 {member.paymentDay}일</dd>
            </div>
          )}
          {/* 담당 판매원 표시 */}
          <div>
            <dt className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              담당 판매원
            </dt>
            <dd className="text-sm text-gray-900">
              {member.agentId ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                  {member.agentName ?? `담당자 #${member.agentId}`}
                </span>
              ) : (
                <span className="text-gray-400">미배정</span>
              )}
            </dd>
          </div>
          {/* 최대 납입 회차 (B2 수정) */}
          {member.maxPaymentCount !== null && member.maxPaymentCount !== undefined && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">최대 납입 회차</dt>
              <dd className="text-sm text-gray-900">{member.maxPaymentCount}회</dd>
            </div>
          )}
        </dl>

        {/* 납부 현황 */}
        <div className="mt-4">
          {member.courseType === "HEALTH" ? (
            <>
              <dt className="text-xs text-gray-400 mb-1.5">납부현황 <span className="text-emerald-500">(의무납입 없음 · 월 27,000원)</span></dt>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-emerald-600">{member.paidCount}회</span>
                <span className="text-sm text-gray-400">납부 완료</span>
              </div>
            </>
          ) : (
            <>
              <dt className="text-xs text-gray-400 mb-1.5">
                의무납입 현황
                {member.totalPayments > 0 && member.paidCount >= member.totalPayments && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">의무납입 완료</span>
                )}
              </dt>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      member.totalPayments > 0 && member.paidCount >= member.totalPayments
                        ? "bg-green-500"
                        : "bg-yellow-400"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  {member.paidCount}
                  {member.totalPayments > 0 ? ` / ${member.totalPayments}회` : "회"}
                  {member.totalPayments > 0 && (
                    <span className="text-gray-400 ml-1">({progressPct}%)</span>
                  )}
                </span>
              </div>
              {member.totalPayments > 0 && member.paidCount < member.totalPayments && (
                <p className="mt-1 text-xs text-orange-500">
                  남은 의무납입: {member.totalPayments - member.paidCount}회
                </p>
              )}
            </>
          )}
        </div>

        {member.memo && (
          <div className="mt-4">
            <dt className="text-xs text-gray-400 mb-1">메모</dt>
            <dd className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
              {member.memo}
            </dd>
          </div>
        )}
      </div>

      {/* 상태 관리 — OWNER·GLOBAL_ADMIN만 표시 */}
      {(isGlobalAdmin || isOwner) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-2">상태 관리</h2>
          <p className="text-xs text-gray-400 mb-4">납부 회차는 매월 납부일마다 자동으로 증가합니다.</p>
          {actionError && (
            <div className="mb-3 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
              {actionError}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={member.status === "ACTIVE" || statusUpdating !== null}
              className={`flex items-center gap-1.5 min-h-[48px] px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                member.status === "ACTIVE"
                  ? "border-green-400 bg-green-50 text-green-700 cursor-default"
                  : "border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
              } disabled:opacity-50`}
            >
              {statusUpdating === "ACTIVE" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              유지 중
            </button>

            <button
              onClick={() => handleStatusChange("SUSPENDED")}
              disabled={member.status === "SUSPENDED" || statusUpdating !== null}
              className={`flex items-center gap-1.5 min-h-[48px] px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                member.status === "SUSPENDED"
                  ? "border-yellow-400 bg-yellow-50 text-yellow-700 cursor-default"
                  : "border-gray-200 text-gray-600 hover:border-yellow-400 hover:text-yellow-700"
              } disabled:opacity-50`}
            >
              {statusUpdating === "SUSPENDED" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
              일시정지
            </button>

            <button
              onClick={() => handleStatusChange("CANCELLED")}
              disabled={member.status === "CANCELLED" || statusUpdating !== null}
              className={`flex items-center gap-1.5 min-h-[48px] px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                member.status === "CANCELLED"
                  ? "border-red-400 bg-red-50 text-red-600 cursor-default"
                  : "border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600"
              } disabled:opacity-50`}
            >
              {statusUpdating === "CANCELLED" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              해지
            </button>
          </div>
        </div>
      )}

      {/* 상담내역 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-700 mb-4">상담내역</h2>

        {/* 새 상담 입력 — AGENT는 본인 담당 고객만 작성 가능 */}
        {(userRole !== "AGENT" || (userId !== undefined && member.agentId === parseInt(userId, 10))) && (
        <form onSubmit={handleConsultSubmit} className="mb-5">
          {consultError && (
            <div className="mb-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
              {consultError}
            </div>
          )}
          <textarea
            value={consultContent}
            onChange={(e) => setConsultContent(e.target.value)}
            rows={3}
            placeholder="상담 내용을 입력하세요..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 resize-none mb-2 leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={consultSaving}
              className="flex items-center gap-1.5 min-h-[48px] px-5 py-2 bg-navy-900 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {consultSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              저장
            </button>
          </div>
        </form>
        )}

        {/* 기존 상담 목록 */}
        {member.consultations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">상담내역이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {member.consultations.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-lg px-4 py-3 bg-gray-50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleString("ko-KR", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 요청 섹션 (OWNER + GLOBAL_ADMIN, 아직 PENDING 없을 때) */}
      {canRequestDelete && !pendingDeleteRequest && (
        <div className="bg-white border border-red-100 rounded-xl p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            회원 삭제 요청
          </h2>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            {isGlobalAdmin
              ? "관리자는 즉시 삭제 요청을 승인하거나 삭제 요청을 등록할 수 있습니다."
              : "삭제 요청을 등록하면 관리자가 검토 후 처리합니다. 직접 삭제는 불가합니다."}
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 min-h-[48px] px-5 py-2 border-2 border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            삭제 요청하기
          </button>
        </div>
      )}

      {/* 삭제 요청 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              삭제 요청
            </h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              <span className="font-semibold text-gray-800">{member.name}</span> 회원에 대한 삭제를 요청합니다.
              관리자 승인 후 처리됩니다.
            </p>

            {deleteReqError && (
              <div className="mb-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {deleteReqError}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              삭제 사유 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              placeholder="삭제 사유를 입력하세요..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300/40 resize-none mb-5 leading-relaxed"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteReason(""); setDeleteReqError(""); }}
                disabled={deleteReqLoading}
                className="min-h-[48px] px-5 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={deleteReqLoading}
                className="flex items-center gap-1.5 min-h-[48px] px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteReqLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                요청 제출
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
