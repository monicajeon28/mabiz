"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, CheckCircle, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, DollarSign, Clock,
  Users, Send, ChevronDown, ChevronUp, LayoutList, Building2,
} from "lucide-react";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type MemberStatement = {
  agentId: number;
  name: string;
  role: string; // BRANCH_MANAGER | SALES_AGENT | PRESALES_AGENT
  payslipId: number | null;
  guarantorId: number | null;
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

type TeamGroup = {
  managerId: number | null;
  managerName: string;
  teamTotal: number;
  members: MemberStatement[];
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
    teams?: TeamGroup[];
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
  BRANCH_MANAGER: "지사장",
  SALES_AGENT:    "대리점장",
  PRESALES_AGENT: "마케터",
  // 구버전 fallback
  OWNER: "지사장",
  AGENT: "대리점장",
  FREE_SALES: "마케터",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  BRANCH_MANAGER: "bg-purple-100 text-purple-700",
  SALES_AGENT:    "bg-blue-100 text-blue-700",
  PRESALES_AGENT: "bg-green-100 text-green-700",
  OWNER:          "bg-purple-100 text-purple-700",
  AGENT:          "bg-blue-100 text-blue-700",
  FREE_SALES:     "bg-green-100 text-green-700",
};

const ROLE_ROW_COLORS: Record<string, string> = {
  BRANCH_MANAGER: "bg-purple-50/30",
  SALES_AGENT:    "bg-blue-50/30",
  PRESALES_AGENT: "bg-green-50/30",
  OWNER:          "bg-purple-50/30",
  AGENT:          "bg-blue-50/30",
  FREE_SALES:     "bg-green-50/30",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "승인 완료", color: "bg-blue-100 text-blue-700" },
  SENT:     { label: "지급 완료", color: "bg-green-100 text-green-700" },
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
  try { return new Date(dateStr).toLocaleDateString("ko-KR"); }
  catch { return dateStr; }
}

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

function SummaryCard({ title, value, sub, icon: Icon, iconColor }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; iconColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-start gap-4">
      <div className={`p-3 rounded-lg ${iconColor} bg-opacity-10 shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <p className="text-3xl font-bold text-navy-900 mt-1">{value}</p>
        {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── 확인 모달 ────────────────────────────────────────────────────────────────

function ConfirmModal({ modal, onClose, onConfirm, submitting, actionError }: {
  modal: ModalState; onClose: () => void; onConfirm: () => void;
  submitting: boolean; actionError: string | null;
}) {
  if (!modal.open) return null;
  const isApprove = modal.action === "approve";
  const [y, m] = modal.yearMonth.split("-");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-navy-900">
            {isApprove ? "정산 승인 확인" : "정산서 발송 확인"}
          </h3>
        </div>
        <div className="px-6 py-6 space-y-5">
          <p className="text-base text-gray-700">
            <span className="font-semibold text-navy-900">{modal.memberName}</span> 님의{" "}
            {y}년 {parseInt(m, 10)}월 정산을 {isApprove ? "승인" : "발송"}하시겠습니까?
          </p>
          <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-base">
            <div className="flex justify-between">
              <span className="text-gray-600">실지급액</span>
              <span className="font-bold text-navy-900">{formatKRW(modal.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">원천징수 (3.3%)</span>
              <span className="text-gray-700">-{formatKRW(modal.withholdingAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3 mt-3">
              <span className="text-gray-600">예정 지급일</span>
              <span className="font-semibold text-navy-900">{formatDate(modal.expectedPaymentDate)}</span>
            </div>
          </div>
        </div>
        {actionError && (
          <div className="px-6 pb-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /><span>{actionError}</span>
            </div>
          </div>
        )}
        <div className="px-6 py-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-6 py-3 rounded-lg text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 min-h-[48px]">
            취소
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting}
            className={`px-6 py-3 rounded-lg text-base font-medium transition-colors disabled:opacity-50 min-h-[48px] ${isApprove ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
            {submitting ? "처리 중..." : isApprove ? "승인 확인" : "발송 확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 멤버 행 ──────────────────────────────────────────────────────────────────

function MemberRow({ member, onAction }: {
  member: MemberStatement;
  onAction: (m: MemberStatement, a: ConfirmAction) => void;
}) {
  const rowBg = ROLE_ROW_COLORS[member.role] ?? "";
  const st = STATUS_LABELS[member.status] ?? { label: member.status, color: "bg-gray-100 text-gray-500" };
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
      <td className="px-5 py-4 font-medium text-navy-900 whitespace-nowrap text-base">{member.name}</td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${ROLE_BADGE_COLORS[member.role] ?? "bg-gray-100 text-gray-600"}`}>
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </td>
      <td className="px-4 py-4 text-center">
        {member.hasIdCard ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-red-400 mx-auto" />}
      </td>
      <td className="px-4 py-4 text-center">
        {member.hasBankBook ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-red-400 mx-auto" />}
      </td>
      <td className="px-5 py-4 text-gray-700 whitespace-nowrap text-base">{member.bankName ?? "—"}</td>
      <td className="px-5 py-4 text-gray-700 font-mono text-sm whitespace-nowrap">{member.bankAccount ?? "—"}</td>
      <td className="px-5 py-4 text-right text-gray-700 whitespace-nowrap text-base">{formatKRW(member.baseCommission)}</td>
      <td className="px-5 py-4 text-right whitespace-nowrap text-base">
        {member.deduction > 0 ? <span className="text-red-500 font-medium">-{formatKRW(member.deduction)}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-5 py-4 text-right text-gray-600 whitespace-nowrap text-sm">-{formatKRW(member.withholdingAmount)}</td>
      <td className="px-5 py-4 text-right font-bold text-navy-900 whitespace-nowrap text-base">{formatKRW(member.netAmount)}</td>
      <td className="px-5 py-4 text-center text-gray-600 whitespace-nowrap text-sm">{formatDate(member.expectedPaymentDate)}</td>
      <td className="px-5 py-4 text-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
      </td>
      <td className="px-5 py-4 text-center whitespace-nowrap">
        <ActionButton member={member} onAction={onAction} />
      </td>
    </tr>
  );
}

// ─── 테이블 헤더 ──────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="text-left px-5 py-4 font-semibold text-gray-700 text-sm">이름</th>
        <th className="text-left px-5 py-4 font-semibold text-gray-700 text-sm">역할</th>
        <th className="text-center px-4 py-4 font-semibold text-gray-700 text-sm">신분증</th>
        <th className="text-center px-4 py-4 font-semibold text-gray-700 text-sm">통장사본</th>
        <th className="text-left px-5 py-4 font-semibold text-gray-700 text-sm">은행</th>
        <th className="text-left px-5 py-4 font-semibold text-gray-700 text-sm">계좌번호</th>
        <th className="text-right px-5 py-4 font-semibold text-gray-700 text-sm">커미션</th>
        <th className="text-right px-5 py-4 font-semibold text-gray-700 text-sm">환수금</th>
        <th className="text-right px-5 py-4 font-semibold text-gray-700 text-sm">원천징수</th>
        <th className="text-right px-5 py-4 font-semibold text-gray-700 text-sm">실지급액</th>
        <th className="text-center px-5 py-4 font-semibold text-gray-700 text-sm">예정 지급일</th>
        <th className="text-center px-5 py-4 font-semibold text-gray-700 text-sm">상태</th>
        <th className="text-center px-5 py-4 font-semibold text-gray-700 text-sm">액션</th>
      </tr>
    </thead>
  );
}

// ─── 팀별 accordion 뷰 ────────────────────────────────────────────────────────

function TeamAccordionView({ teams, onAction }: {
  teams: TeamGroup[];
  onAction: (m: MemberStatement, a: ConfirmAction) => void;
}) {
  const [openIds, setOpenIds] = useState<Set<number | null>>(
    new Set(teams.map((t) => t.managerId)) // 기본 전체 펼침
  );

  function toggle(id: number | null) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  if (teams.length === 0) return (
    <div className="text-center py-20 text-gray-500">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">정산 데이터가 없습니다.</p>
      <p className="text-sm mt-1">기간 또는 역할 필터를 변경해 보세요.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const isOpen = openIds.has(team.managerId);
        const pendingCount = team.members.filter((m) => m.status === "PENDING").length;
        return (
          <div key={team.managerId ?? "unassigned"}
            className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* 팀 헤더 — 클릭으로 토글 */}
            <button
              type="button"
              onClick={() => toggle(team.managerId)}
              className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Building2 className="w-6 h-6 text-purple-500 shrink-0" />
                <div className="text-left">
                  <p className="font-bold text-navy-900 text-lg">
                    {team.managerId ? `${team.managerName} 대리점` : "미배정"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {team.members.length}명
                    {pendingCount > 0 && (
                      <span className="ml-2 text-yellow-600 font-medium">승인대기 {pendingCount}건</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                {/* 팀 총 정산액 — 50대도 한눈에 */}
                <div className="text-right">
                  <p className="text-sm text-gray-600">팀 총 실지급액</p>
                  <p className="text-2xl font-bold text-teal-700 mt-1">{formatKRW(team.teamTotal)}</p>
                </div>
                {isOpen
                  ? <ChevronUp className="w-6 h-6 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-6 h-6 text-gray-400 shrink-0" />}
              </div>
            </button>

            {/* 멤버 테이블 */}
            {isOpen && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <TableHeader />
                  <tbody className="divide-y divide-gray-100">
                    {team.members.map((m) => (
                      <MemberRow key={m.agentId} member={m} onAction={onAction} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 목록 뷰 (기존 플랫 테이블) ──────────────────────────────────────────────

function ListView({ members, onAction, page, totalPages, pagination, onPageChange }: {
  members: MemberStatement[];
  onAction: (m: MemberStatement, a: ConfirmAction) => void;
  page: number; totalPages: number;
  pagination: Pagination | null;
  onPageChange: (p: number) => void;
}) {
  if (members.length === 0) return (
    <div className="text-center py-20 text-gray-500">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">정산 데이터가 없습니다.</p>
      <p className="text-sm mt-1">기간 또는 역할 필터를 변경해 보세요.</p>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <TableHeader />
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => <MemberRow key={m.agentId} member={m} onAction={onAction} />)}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-base text-gray-700">총 {pagination?.total.toLocaleString()}건</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2.5 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors min-h-[40px] min-w-[40px]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-base text-gray-700 font-medium">{page} / {totalPages}</span>
            <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2.5 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors min-h-[40px] min-w-[40px]">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TeamStatementsPage() {
  const [period, setPeriod]       = useState<string>(getCurrentYearMonth());
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage]           = useState<number>(1);
  const [viewMode, setViewMode]   = useState<"team" | "list">("team");

  const [members, setMembers]     = useState<MemberStatement[]>([]);
  const [teams, setTeams]         = useState<TeamGroup[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [forbidden, setForbidden] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({
    open: false, payslipId: null, action: null,
    memberName: "", yearMonth: "", netAmount: 0,
    withholdingAmount: 0, expectedPaymentDate: "",
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const ymOptions = buildYearMonthOptions();

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setIsNetworkError(false);

    const params = new URLSearchParams({ period, role: roleFilter, page: String(page), limit: "50" });

    fetch(`/api/statements/team?${params.toString()}`, { signal: controller.signal, credentials: "include" })
      .then((r) => {
        if (r.status === 403 || r.status === 401) { setForbidden(true); throw new Error("forbidden"); }
        if (!r.ok) { setIsNetworkError(true); throw new Error(`HTTP ${r.status}`); }
        return r.json() as Promise<ApiResponse>;
      })
      .then((d) => {
        if (d.ok) {
          setMembers(d.data.members ?? []);
          setTeams(d.data.teams ?? []);
          setSummary(d.data.summary ?? null);
          setPagination(d.data.pagination ?? null);
          setError(null);
        } else {
          setError(d.error ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && (e.name === "AbortError" || e.message === "forbidden")) return;
        setIsNetworkError(true);
        setError(e instanceof Error ? e.message : "정산 정보를 불러올 수 없습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [period, roleFilter, page]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  function openModal(member: MemberStatement, action: ConfirmAction) {
    if (!member.payslipId) return;
    setModal({ open: true, payslipId: member.payslipId, action, memberName: member.name,
      yearMonth: member.yearMonth, netAmount: member.netAmount,
      withholdingAmount: member.withholdingAmount, expectedPaymentDate: member.expectedPaymentDate });
  }

  function closeModal() {
    if (submitting) return;
    setModal((prev) => ({ ...prev, open: false }));
    setActionError(null);
  }

  async function handleConfirm() {
    if (!modal.payslipId || !modal.action) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/statements/${modal.payslipId}/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ action: modal.action }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) { setActionError(json.error ?? "처리에 실패했습니다."); }
      else { closeModal(); load(); }
    } catch { setActionError("네트워크 오류가 발생했습니다."); }
    finally { setSubmitting(false); }
  }

  if (forbidden) return (
    <div className="p-6 max-w-2xl mx-auto text-center mt-20">
      <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-navy-900 mb-2">접근 권한 없음</h2>
      <p className="text-gray-500 text-sm">팀 정산 관리 페이지는 본사 또는 지사장만 접근할 수 있습니다.</p>
    </div>
  );

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <>
      <ConfirmModal modal={modal} onClose={closeModal} onConfirm={handleConfirm}
        submitting={submitting} actionError={actionError} />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-navy-900">팀 정산 관리</h1>
            </div>
            <p className="text-base text-gray-600">지사장·대리점장·마케터 월별 커미션 정산 현황</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button type="button" onClick={() => setViewMode("team")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${viewMode === "team" ? "bg-white text-navy-900 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
                <Building2 className="w-5 h-5" />팀별
              </button>
              <button type="button" onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${viewMode === "list" ? "bg-white text-navy-900 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
                <LayoutList className="w-5 h-5" />목록
              </button>
            </div>

            {/* 기간 선택 */}
            <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20 min-h-[44px]">
              {ymOptions.map((ym) => <option key={ym} value={ym}>{ym}</option>)}
            </select>

            {/* 역할 필터 */}
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20 min-h-[44px]">
              <option value="all">전체 역할</option>
              <option value="BRANCH_MANAGER">지사장</option>
              <option value="SALES_AGENT">대리점장</option>
              <option value="PRESALES_AGENT">마케터</option>
            </select>
          </div>
        </div>

        {/* ── 에러 배너 ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              {isNetworkError && (
                <button type="button" onClick={load}
                  className="ml-3 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors whitespace-nowrap shrink-0 min-h-[40px]">
                  ↺ 다시 시도
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 요약 카드 ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="총 지급 예정액" value={formatKRW(summary.totalPayout)} icon={DollarSign} iconColor="text-teal-600" />
            <SummaryCard title="서류 미제출" value={`${summary.missingDocCount}명`} sub="신분증 또는 통장사본 누락" icon={AlertTriangle} iconColor="text-orange-500" />
            <SummaryCard title="승인 대기" value={`${summary.pendingCount}건`} icon={Clock} iconColor="text-yellow-500" />
            <SummaryCard title="지급 완료" value={`${summary.paidCount}건`} icon={Users} iconColor="text-green-600" />
          </div>
        ) : null}

        {/* ── 서류 미제출 경고 ──────────────────────────────────────────────── */}
        {!loading && summary && summary.missingDocCount > 0 && (
          <div className="flex items-start gap-4 p-5 bg-orange-50 border border-orange-200 rounded-xl text-base">
            <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-orange-700">
              <span className="font-semibold">{summary.missingDocCount}명</span>의 서류가 미제출되어 승인이 불가합니다.
            </p>
          </div>
        )}

        {/* ── 콘텐츠 ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : viewMode === "team" ? (
          <TeamAccordionView teams={teams} onAction={openModal} />
        ) : (
          <ListView members={members} onAction={openModal} page={page}
            totalPages={totalPages} pagination={pagination}
            onPageChange={setPage} />
        )}
      </div>
    </>
  );
}

// ─── 액션 버튼 ────────────────────────────────────────────────────────────────

function ActionButton({ member, onAction }: {
  member: MemberStatement;
  onAction: (m: MemberStatement, a: ConfirmAction) => void;
}) {
  if (member.status === "SENT") return (
    <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-green-600 bg-green-50 min-h-[40px]">
      <CheckCircle className="w-5 h-5" />지급완료
    </span>
  );
  if (member.status === "APPROVED") return (
    <button type="button" onClick={() => onAction(member, "send")}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors min-h-[40px]">
      <Send className="w-5 h-5" />정산서 발송
    </button>
  );
  if (member.canApprove) return (
    <button type="button" onClick={() => onAction(member, "approve")}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors min-h-[40px]">
      <CheckCircle className="w-5 h-5" />승인
    </button>
  );
  return (
    <span title="신분증 및 통장사본이 필요합니다"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 bg-gray-100 cursor-not-allowed min-h-[40px]">
      <XCircle className="w-5 h-5" />서류확인 필요
    </span>
  );
}
