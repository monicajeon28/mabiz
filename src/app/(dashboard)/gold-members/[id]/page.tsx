"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Star, Loader2, CheckCircle, PauseCircle, XCircle } from "lucide-react";

type Consultation = {
  id: string;
  content: string;
  authorId: string;
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
  ACTIVE:    "유지",
  SUSPENDED: "정지",
  CANCELLED: "해지",
};

export default function GoldMemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [member, setMember]         = useState<GoldMemberDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // 납부 관리
  const [payUpdating, setPayUpdating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // 상담 내역
  const [consultContent, setConsultContent] = useState("");
  const [consultSaving, setConsultSaving]   = useState(false);
  const [consultError, setConsultError]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/gold-members/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMember(d.member);
        else setError(d.error ?? "불러오기 실패");
      })
      .catch(() => setError("서버 오류"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePayPlus = async () => {
    if (!member) return;
    setPayUpdating(true);
    try {
      const res = await fetch(`/api/gold-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidCount: member.paidCount + 1 }),
      });
      const data = await res.json();
      if (data.ok) setMember((prev) => prev ? { ...prev, paidCount: prev.paidCount + 1 } : prev);
    } finally {
      setPayUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(newStatus);
    try {
      const res = await fetch(`/api/gold-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) setMember((prev) => prev ? { ...prev, status: newStatus } : prev);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>{error || "회원을 찾을 수 없습니다."}</p>
        <button onClick={() => router.push("/gold-members")} className="mt-4 text-sm text-blue-600 hover:underline">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const progressPct = member.totalPayments > 0
    ? Math.min(100, Math.round((member.paidCount / member.totalPayments) * 100))
    : 0;

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
        <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
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
            <dd className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
              {member.memo}
            </dd>
          </div>
        )}
      </div>

      {/* 납부 관리 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">납부 및 상태 관리</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePayPlus}
            disabled={payUpdating}
            className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50"
          >
            {payUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
            납부 완료 +1
          </button>

          <button
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={member.status === "ACTIVE" || statusUpdating !== null}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              member.status === "ACTIVE"
                ? "border-green-400 bg-green-50 text-green-700 cursor-default"
                : "border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
            } disabled:opacity-50`}
          >
            {statusUpdating === "ACTIVE" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            유지(ACTIVE)
          </button>

          <button
            onClick={() => handleStatusChange("SUSPENDED")}
            disabled={member.status === "SUSPENDED" || statusUpdating !== null}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              member.status === "SUSPENDED"
                ? "border-yellow-400 bg-yellow-50 text-yellow-700 cursor-default"
                : "border-gray-200 text-gray-600 hover:border-yellow-400 hover:text-yellow-700"
            } disabled:opacity-50`}
          >
            {statusUpdating === "SUSPENDED" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
            정지(SUSPENDED)
          </button>

          <button
            onClick={() => handleStatusChange("CANCELLED")}
            disabled={member.status === "CANCELLED" || statusUpdating !== null}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              member.status === "CANCELLED"
                ? "border-red-400 bg-red-50 text-red-600 cursor-default"
                : "border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600"
            } disabled:opacity-50`}
          >
            {statusUpdating === "CANCELLED" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            해지(CANCELLED)
          </button>
        </div>
      </div>

      {/* 상담내역 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">상담내역</h2>

        {/* 새 상담 입력 */}
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
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 resize-none mb-2"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={consultSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {consultSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              저장
            </button>
          </div>
        </form>

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
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
