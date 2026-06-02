"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Clock,
  Users,
  Send,
} from "lucide-react";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type MemberStatement = {
  agentId: number;
  name: string;
  role: string; // AGENT | OWNER | FREE_SALES
  payslipId: number | null;
  yearMonth: string;
  baseCommission: number;
  deduction: number;
  withholdingAmount: number;
  netAmount: number;
  expectedPaymentDate: string;
  status: string; // PENDING | APPROVED | SENT
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  hasIdCard: boolean;
  hasBankBook: boolean;
  canApprove: boolean;
};

type Summary = {
  totalPayout: number;
  missingDocCount: number;
  pendingCount: number;
  paidCount: number;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ApiResponse = {
  ok: boolean;
  period: string;
  data: {
    members: MemberStatement[];
    summary: Summary;
    pagination: Pagination;
  };
  error?: string;
};

type ConfirmAction = "approve" | "send";

type ModalState = {
  open: boolean;
  payslipId: number | null;
  action: ConfirmAction | null;
  memberName: string;
  yearMonth: string;
  netAmount: number;
  withholdingAmount: number;
  expectedPaymentDate: string;
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER: "대리점장",
  AGENT: "판매원",
  FREE_SALES: "프리세일즈",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  AGENT: "bg-blue-100 text-blue-700",
  FREE_SALES: "bg-green-100 text-green-700",
};

const ROLE_ROW_COLORS: Record<string, string> = {
  OWNER: "bg-purple-50/30",
  AGENT: "bg-blue-50/30",
  FREE_SALES: "bg-green-50/30",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "승인 완료", color: "bg-blue-100 text-blue-700" },
  SENT: { label: "지급 완료", color: "bg-green-100 text-green-700" },
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildYearMonthOptions(): string[] {
  const opts: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return opts;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === "여행별") return "여행별";
  try {
    return new Date(dateStr).toLocaleDateString("ko-KR");
  } catch {
    return dateStr;
  }
}

// ─── 요약 카드 ─────────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  sub,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className={`p-2 rounded-lg ${iconColor} bg-opacity-10 shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-navy-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── 확인 모달 ─────────────────────────────────────────────────────────────────

function ConfirmModal({
  modal,
  onClose,
  onConfirm,
  submitting,
}: {
  modal: ModalState;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  if (!modal.open) return null;

  const isApprove = modal.action === "approve";
  const title = isApprove ? "정산 승인 확인" : "정산서 발송 확인";
  const actionLabel = isApprove ? "승인 확인" : "발송 확인";
  const actionBtnClass = isApprove
    ? "bg-blue-600 hover:bg-blue-700 text-white"
    : "bg-green-600 hover:bg-green-700 text-white";

  const [y, m] = modal.yearMonth.split("-");
  const periodLabel = `${y}년 ${parseInt(m, 10)}월`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-navy-900">{title}</h3>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-navy-900">{modal.memberName}</span> 님의{" "}
            {periodLabel} 정산을{" "}
            {isApprove ? "승인" : "발송"}하시겠습니까?
          </p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">실지급액</span>
              <span className="font-bold text-navy-900">{formatKRW(modal.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">원천징수 (3.3%)</span>
              <span className="text-gray-600">-{formatKRW(modal.withholdingAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-500">예정 지급일</span>
              <span className="font-semibold text-navy-900">
                {formatDate(modal.expectedPaymentDate)}
              </span>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${actionBtnClass}`}
          >
            {submitting ? "처리 중..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TeamStatementsPage() {
  const [period, setPeriod] = useState<string>(getCurrentYearMonth());
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  const [members, setMembers] = useState<MemberStatement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<boolean>(false);

  const [modal, setModal] = useState<ModalState>({
    open: false,
    payslipId: null,
    action: null,
    memberName: "",
    yearMonth: "",
    netAmount: 0,
    withholdingAmount: 0,
    expectedPaymentDate: "",
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const ymOptions = buildYearMonthOptions();

  // ── 데이터 조회 ────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      period,
      role: roleFilter,
      page: String(page),
      limit: "20",
    });

    fetch(`/api/statements/team?${params.toString()}`, {
      signal: controller.signal,
      credentials: "include",
    })
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setForbidden(true);
          throw new Error("forbidden");
        }
        if (!r.ok) throw new Error(`서버 오류 (HTTP ${r.status})`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((d) => {
        if (d.ok) {
          setMembers(d.data.members ?? []);
          setSummary(d.data.summary ?? null);
          setPagination(d.data.pagination ?? null);
          setError(null);
        } else {
          setError(d.error ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && (e.name === "AbortError" || e.message === "forbidden")) return;
        setError(
          e instanceof Error ? e.message : "데이터를 불러올 수 없습니다."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [period, roleFilter, page]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // 필터 변경 시 페이지 초기화
  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    setPage(1);
  };
  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    setPage(1);
  };

  // ── 승인/발송 처리 ──────────────────────────────────────────────────────────

  function openModal(member: MemberStatement, action: ConfirmAction) {
    if (!member.payslipId) return;
    setModal({
      open: true,
      payslipId: member.payslipId,
      action,
      memberName: member.name,
      yearMonth: member.yearMonth,
      netAmount: member.netAmount,
      withholdingAmount: member.withholdingAmount,
      expectedPaymentDate: member.expectedPaymentDate,
    });
  }

  function closeModal() {
    if (submitting) return;
    setModal((prev) => ({ ...prev, open: false }));
  }

  async function handleConfirm() {
    if (!modal.payslipId || !modal.action) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/statements/${modal.payslipId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: modal.action }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "처리에 실패했습니다.");
      } else {
        closeModal();
        load(); // 목록 새로고침
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────────────

  // 권한 없음
  if (forbidden) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center mt-20">
        <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-navy-900 mb-2">접근 권한 없음</h2>
        <p className="text-gray-500 text-sm">
          팀 정산 관리 페이지는 본사(GLOBAL_ADMIN) 또는 대리점장(OWNER)만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <>
      <ConfirmModal
        modal={modal}
        onClose={closeModal}
        onConfirm={handleConfirm}
        submitting={submitting}
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-teal-600" />
              <h1 className="text-xl font-bold text-navy-900">팀 정산 관리</h1>
            </div>
            <p className="text-sm text-gray-500">
              판매원·대리점장·프리세일즈 월별 커미션 정산 현황
            </p>
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 기간 선택 */}
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            >
              {ymOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {ym}
                </option>
              ))}
            </select>

            {/* 역할 필터 */}
            <select
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            >
              <option value="all">전체 역할</option>
              <option value="AGENT">판매원</option>
              <option value="OWNER">대리점장</option>
              <option value="FREE_SALES">프리세일즈</option>
            </select>
          </div>
        </div>

        {/* ── 에러 배너 ────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── 요약 카드 4개 ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="총 지급 예정액"
              value={formatKRW(summary.totalPayout)}
              icon={DollarSign}
              iconColor="text-teal-600"
            />
            <SummaryCard
              title="서류 미제출"
              value={`${summary.missingDocCount}명`}
              sub="신분증 또는 통장사본 누락"
              icon={AlertTriangle}
              iconColor="text-orange-500"
            />
            <SummaryCard
              title="승인 대기"
              value={`${summary.pendingCount}건`}
              icon={Clock}
              iconColor="text-yellow-500"
            />
            <SummaryCard
              title="지급 완료"
              value={`${summary.paidCount}건`}
              icon={Users}
              iconColor="text-green-600"
            />
          </div>
        ) : null}

        {/* ── 서류 미제출 경고 배너 ──────────────────────────────────────── */}
        {!loading && summary && summary.missingDocCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm">
            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
            <p className="text-orange-700">
              <span className="font-semibold">{summary.missingDocCount}명</span>의 서류가 미제출되어
              승인이 불가합니다. 신분증 및 통장사본을 확인해 주세요.
            </p>
          </div>
        )}

        {/* ── 테이블 ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">정산 데이터가 없습니다.</p>
            <p className="text-sm mt-1">기간 또는 역할 필터를 변경해 보세요.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">역할</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">신분증</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">통장사본</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">은행</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">계좌번호</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">커미션</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">환수금</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">원천징수</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">실지급액</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">예정 지급일</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">상태</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((member) => {
                    const rowBg = ROLE_ROW_COLORS[member.role] ?? "";
                    const st =
                      STATUS_LABELS[member.status] ?? {
                        label: member.status,
                        color: "bg-gray-100 text-gray-500",
                      };

                    return (
                      <tr key={member.agentId} className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
                        {/* 이름 */}
                        <td className="px-4 py-3 font-medium text-navy-900 whitespace-nowrap">
                          {member.name}
                        </td>

                        {/* 역할 뱃지 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              ROLE_BADGE_COLORS[member.role] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {ROLE_LABELS[member.role] ?? member.role}
                          </span>
                        </td>

                        {/* 신분증 */}
                        <td className="px-3 py-3 text-center">
                          {member.hasIdCard ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          )}
                        </td>

                        {/* 통장사본 */}
                        <td className="px-3 py-3 text-center">
                          {member.hasBankBook ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          )}
                        </td>

                        {/* 은행 */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {member.bankName ?? "—"}
                        </td>

                        {/* 계좌번호 */}
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                          {member.bankAccount ?? "—"}
                        </td>

                        {/* 커미션 */}
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                          {formatKRW(member.baseCommission)}
                        </td>

                        {/* 환수금액 */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {member.deduction > 0 ? (
                            <span className="text-red-500 font-medium">
                              -{formatKRW(member.deduction)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* 원천징수 */}
                        <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap text-xs">
                          -{formatKRW(member.withholdingAmount)}
                        </td>

                        {/* 실지급액 */}
                        <td className="px-4 py-3 text-right font-bold text-navy-900 whitespace-nowrap">
                          {formatKRW(member.netAmount)}
                        </td>

                        {/* 예정 지급일 */}
                        <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap text-xs">
                          {member.role === "FREE_SALES"
                            ? "여행별"
                            : formatDate(member.expectedPaymentDate)}
                        </td>

                        {/* 상태 뱃지 */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}
                          >
                            {st.label}
                          </span>
                        </td>

                        {/* 액션 버튼 */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <ActionButton member={member} onAction={openModal} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── 페이지네이션 ───────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">
                  총 {pagination?.total.toLocaleString()}건
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── 액션 버튼 (분리 컴포넌트) ────────────────────────────────────────────────

function ActionButton({
  member,
  onAction,
}: {
  member: MemberStatement;
  onAction: (member: MemberStatement, action: ConfirmAction) => void;
}) {
  if (member.status === "SENT") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-green-600 bg-green-50">
        <CheckCircle className="w-3.5 h-3.5" />
        지급완료
      </span>
    );
  }

  if (member.status === "APPROVED") {
    return (
      <button
        type="button"
        onClick={() => onAction(member, "send")}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        정산서 발송
      </button>
    );
  }

  // PENDING
  if (member.canApprove) {
    return (
      <button
        type="button"
        onClick={() => onAction(member, "approve")}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        승인
      </button>
    );
  }

  return (
    <span
      title="신분증 및 통장사본이 필요합니다"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
    >
      <XCircle className="w-3.5 h-3.5" />
      서류확인 필요
    </span>
  );
}
