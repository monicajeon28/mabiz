"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/lib/api/use-toast";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface TeamStatement {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  teamNetAmount: number;
  paidAt: string | null;
  teamMemberId?: string;
  memberName?: string;
  memberRole?: string;
  daysOverdue?: number;
}

interface ApiResponse {
  ok: boolean;
  statements: TeamStatement[];
  message?: string;
}

const MEMBER_ROLE_EXPECTATIONS: Record<string, { min: number; max: number; label: string }> = {
  JUNIOR_OWNER: { min: 5000000, max: 10000000, label: "신입대리점장 (월 500-1000만원)" },
  SENIOR_OWNER: { min: 20000000, max: 30000000, label: "3년차 대리점장 (월 2000-3000만원)" },
  TEAM_LEAD:    { min: 30000000, max: 50000000, label: "팀장 (월 3000-5000만원)" },
};

const STATEMENT_HEALTH: Record<string, { label: string; class: string; riskFlag: string }> = {
  HEALTHY:  { label: "정상", class: "bg-green-100 text-green-700",  riskFlag: "NONE" },
  WARNING:  { label: "주의", class: "bg-yellow-100 text-yellow-700", riskFlag: "DELAYED_3_7DAYS" },
  CRITICAL: { label: "위험", class: "bg-red-100 text-red-700",      riskFlag: "DELAYED_7PLUS_DAYS" },
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료",
  APPROVED:  "승인",
  PENDING:   "처리중",
};

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  APPROVED:  "bg-blue-100 text-blue-700",
  PENDING:   "bg-yellow-100 text-yellow-700",
};

const PAGE_SIZE = 10;

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function getL5Status(amount: number, memberRole?: string): string {
  const exp = MEMBER_ROLE_EXPECTATIONS[memberRole ?? "JUNIOR_OWNER"];
  const mid = (exp.min + exp.max) / 2;
  if (amount >= exp.max) return "목표 초과달성";
  if (amount >= mid)     return "목표 달성";
  if (amount >= exp.min) return "정상 진행";
  return "보조 필요";
}

function getStatementHealth(status: string, daysOverdue = 0): { health: keyof typeof STATEMENT_HEALTH; smsDay: number | null } {
  if (status === "COMPLETED" || status === "APPROVED") return { health: "HEALTHY",  smsDay: 0 };
  if (daysOverdue >= 7)  return { health: "CRITICAL", smsDay: 3 };
  if (daysOverdue >= 3)  return { health: "WARNING",  smsDay: 1 };
  return { health: "HEALTHY", smsDay: null };
}

function buildSmsMessage(type: "urgent" | "remind" | "congratulate", memberName: string, amount: number, daysOverdue: number): string {
  const name = memberName || "팀원";
  if (type === "urgent")
    return `[긴급] ${name}님 정산 ${daysOverdue}일 지연 중. 팀장님께 즉시 연락주세요. 정산 미결재는 팀 협력을 해칩니다.`;
  if (type === "remind")
    return `${name}님, 정산이 아직 미결재 상태입니다. 팀장님의 빠른 승인을 요청해주세요. (${daysOverdue}일 지연)`;
  return `${name}님 정산이 완료되었습니다! 이번 달 순수령액 ${formatAmount(amount)} 예정입니다. 팀 수익 공유로 함께 성장하세요!`;
}

export default function TeamStatementsPage() {
  const session = useSession();
  const { toast } = useToast();
  const [statements, setStatements]   = useState<TeamStatement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [memberRole, setMemberRole]   = useState<string>("JUNIOR_OWNER");

  // 필터 상태
  const [yearMonth, setYearMonth]     = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage]               = useState(1);

  const userRole = session.role;
  const isOwner  = userRole === "OWNER";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch("/api/my/team-statements", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setStatements(data.statements ?? []);
          if (data.statements?.[0]?.memberRole) {
            setMemberRole(data.statements[0].memberRole);
          }
        } else {
          setError(data.message ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          setError("요청 시간 초과 - 다시 시도해주세요.");
        } else {
          setError("네트워크 오류가 발생했습니다.");
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
  }, []);

  // 필터 적용 (클라이언트 사이드)
  const filtered = useMemo(() => {
    return statements.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (yearMonth) {
        const period = s.periodStart.slice(0, 7); // "2026-05"
        if (!period.startsWith(yearMonth)) return false;
      }
      return true;
    });
  }, [statements, statusFilter, yearMonth]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 필터 변경 시 1페이지로 리셋
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleYearMonth    = (v: string) => { setYearMonth(v); setPage(1); };

  const handleNotify = async (
    type: "urgent" | "remind" | "congratulate",
    s: TeamStatement
  ) => {
    const msg = buildSmsMessage(type, s.memberName ?? "팀원", s.teamNetAmount, s.daysOverdue ?? 0);
    try {
      await navigator.clipboard.writeText(msg);
      toast({ title: "클립보드에 복사됨", description: `${s.memberName ?? "팀원"}에게 발송할 메시지를 복사했습니다.`, duration: 3000 });
    } catch {
      toast({ title: "메시지 내용", description: msg, duration: 5000 });
    }
  };

  const expectation = MEMBER_ROLE_EXPECTATIONS[memberRole];

  // 연/월 선택지 (statements에서 추출)
  const availableMonths = useMemo(() => {
    const months = new Set(statements.map((s) => s.periodStart.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [statements]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">팀 정산</h1>
        <p className="text-sm text-gray-500">대리점장 전용 — 팀 전체 정산 현황입니다.</p>
      </div>

      {/* L5: 기대 성과 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-blue-900 mb-1">📊 당신의 기대 성과</p>
        <p className="text-sm text-blue-800">{expectation.label}</p>
        <p className="text-xs text-blue-700 mt-1">현재 정산액을 이 기준과 비교하여 팀의 성장을 추적하세요.</p>
      </div>

      {loading && <div className="text-center py-12 text-gray-500">불러오는 중...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {!loading && !error && statements.length === 0 && (
        <div className={`text-center py-16 rounded-lg border-2 border-dashed ${
          isOwner ? "bg-gray-50 text-gray-500 border-gray-300" : "bg-yellow-50 text-yellow-700 border-yellow-300"
        }`}>
          {isOwner ? (
            <>
              <p className="font-medium mb-2">팀 정산 내역이 없습니다</p>
              <p className="text-sm text-gray-600">팀원들의 정산 내역이 생기면 여기에 표시됩니다.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2">🔒 대리점장(OWNER) 전용 페이지</p>
              <p className="text-sm">이 페이지는 대리점장만 접근할 수 있습니다.</p>
              <p className="text-xs text-yellow-600 mt-2">현재 역할: {userRole || "미확인"}</p>
            </>
          )}
        </div>
      )}

      {!loading && !error && statements.length > 0 && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 font-medium mb-1">정산 완료율</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(
                  (statements.filter((s) => s.status === "COMPLETED" || s.status === "APPROVED").length / statements.length) * 100
                )}%
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 font-medium mb-1">위험 팀원 수</p>
              <p className="text-xl font-bold text-red-600">
                {statements.filter((s) => getStatementHealth(s.status, s.daysOverdue ?? 0).health === "CRITICAL").length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 font-medium mb-1">총 팀 정산액</p>
              <p className="text-lg font-bold text-gray-900">
                {formatAmount(filtered.reduce((sum, s) => sum + s.teamNetAmount, 0))}
              </p>
            </div>
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* 기간 필터 */}
            <select
              value={yearMonth}
              onChange={(e) => handleYearMonth(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 기간</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m.replace("-", "년 ")}월</option>
              ))}
            </select>

            {/* 상태 필터 */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {[
                { key: "ALL",       label: "전체" },
                { key: "PENDING",   label: "처리중" },
                { key: "APPROVED",  label: "승인" },
                { key: "COMPLETED", label: "완료" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-sm text-gray-400 ml-auto">
              {filtered.length}건 / 전체 {statements.length}건
            </span>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">정산기간</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">건강도</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">팀 순수령액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">지급일</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">L5 진행도</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">즉시조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      조건에 맞는 정산 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginated.map((s) => {
                    const health   = getStatementHealth(s.status, s.daysOverdue ?? 0).health;
                    const l5Status = getL5Status(s.teamNetAmount, s.memberRole);

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          health === "CRITICAL" ? "bg-red-50" : health === "WARNING" ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-700">
                          {formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}
                          {s.memberName && (
                            <div className="text-xs text-gray-400">{s.memberName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATEMENT_HEALTH[health].class}`}
                            title={`Risk Flag: ${STATEMENT_HEALTH[health].riskFlag}`}
                          >
                            {STATEMENT_HEALTH[health].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatAmount(s.teamNetAmount)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{formatDate(s.paidAt)}</td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className={`inline-block px-2 py-1 rounded ${
                            l5Status.includes("초과") || l5Status.includes("달성")
                              ? "bg-green-100 text-green-700"
                              : l5Status.includes("정상")
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {l5Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center space-x-1">
                          {health === "CRITICAL" && (
                            <button
                              className="inline-block px-2 py-1 bg-red-600 text-white text-xs rounded font-medium hover:bg-red-700 transition"
                              onClick={() => handleNotify("urgent", s)}
                              title="긴급 메시지 클립보드 복사"
                            >
                              긴급
                            </button>
                          )}
                          {health === "WARNING" && (
                            <button
                              className="inline-block px-2 py-1 bg-yellow-600 text-white text-xs rounded font-medium hover:bg-yellow-700 transition"
                              onClick={() => handleNotify("remind", s)}
                              title="재촉 메시지 클립보드 복사"
                            >
                              재촉
                            </button>
                          )}
                          {health === "HEALTHY" && s.status !== "COMPLETED" && s.status !== "APPROVED" && (
                            <button
                              className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 transition"
                              onClick={() => handleNotify("congratulate", s)}
                              title="축하 메시지 클립보드 복사"
                            >
                              축하
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        page === p
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* CRM 안내 */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">📌 CRM 자동분류 및 SMS 자동화</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>✅ <strong>정상(Green)</strong> → Day 0: 축하 SMS (L1 절약액) + SOCIAL_PROOF</li>
              <li>⚠️ <strong>주의(Yellow)</strong> → Day 1: 자동 재촉 SMS (L6 손실회피) + 긴박감</li>
              <li>🔴 <strong>위험(Red)</strong> → Day 3: 긴급 미결재 알림 (L10 즉시 클로징) + Grant Cardone Deal Killer</li>
              <li>💡 즉시조치 버튼은 메시지를 클립보드에 복사합니다.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
