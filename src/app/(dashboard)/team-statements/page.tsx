"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

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

/**
 * L5 (적합성/자기투영): 팀원 역할별 기대 성과 매칭
 * 신입대리점장: 500-1000만원 / 3년차: 2000-3000만원 / 팀장: 3000-5000만원
 */
const MEMBER_ROLE_EXPECTATIONS: Record<string, { min: number; max: number; label: string }> = {
  JUNIOR_OWNER: { min: 5000000, max: 10000000, label: "신입대리점장 (월 500-1000만원)" },
  SENIOR_OWNER: { min: 20000000, max: 30000000, label: "3년차 대리점장 (월 2000-3000만원)" },
  TEAM_LEAD: { min: 30000000, max: 50000000, label: "팀장 (월 3000-5000만원)" },
};

/**
 * L10 (Immediate Closing) + CRM 자동분류: 정산 건강도
 * 정상(Green): 정산 완료 또는 3일 이내 / 주의(Yellow): 3-7일 지연 / 위험(Red): 7일+ 지연
 */
const STATEMENT_HEALTH: Record<string, { label: string; class: string; riskFlag: string }> = {
  HEALTHY: { label: "정상", class: "bg-green-100 text-green-700", riskFlag: "NONE" },
  WARNING: { label: "주의", class: "bg-yellow-100 text-yellow-700", riskFlag: "DELAYED_3_7DAYS" },
  CRITICAL: { label: "위험", class: "bg-red-100 text-red-700", riskFlag: "DELAYED_7PLUS_DAYS" },
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료",
  APPROVED: "승인",
  PENDING: "처리중",
};

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

/**
 * L5: 팀원의 현재 성과가 기대값 대비 어디에 위치하는지 판정
 * 반환: "정상", "잠재력 있음", "주의" 등
 */
function getL5Status(amount: number, memberRole?: string): string {
  const expectation = MEMBER_ROLE_EXPECTATIONS[memberRole ?? "JUNIOR_OWNER"];
  const mid = (expectation.min + expectation.max) / 2;

  if (amount >= expectation.max) return "목표 초과달성";
  if (amount >= mid) return "목표 달성";
  if (amount >= expectation.min) return "정상 진행";
  return "보조 필요";
}

/**
 * L10 + CRM 자동분류: 정산 건강도 판정 (Risk Flag 자동 생성)
 * 로직: 정산 상태 + 지연일수 기반
 */
function getStatementHealth(status: string, daysOverdue: number = 0): { health: keyof typeof STATEMENT_HEALTH; smsDay: number | null } {
  if (status === "COMPLETED" || status === "APPROVED") {
    return { health: "HEALTHY", smsDay: 0 }; // Day 0: 축하 SMS
  }
  if (daysOverdue >= 7) {
    return { health: "CRITICAL", smsDay: 3 }; // Day 3: 미결재 알림
  }
  if (daysOverdue >= 3) {
    return { health: "WARNING", smsDay: 1 }; // Day 1: 자동 재촉 SMS
  }
  return { health: "HEALTHY", smsDay: null };
}

/**
 * Day 0-3 SMS 시퀀스 메타데이터 (CRM 자동화용 JSON)
 * L1 절약액 + L6 긴박감 + Grant Cardone 팔로우업
 */
function generateSmsSequenceMetadata(
  statementId: string,
  status: string,
  amount: number,
  daysOverdue: number,
  memberName: string
) {
  const { health, smsDay } = getStatementHealth(status, daysOverdue);
  const messages: Record<number, { template: string; urgency: string; psychLens: string }> = {
    0: {
      template: `${memberName}님 정산이 완료되었습니다! 이번 달 순수령액 ${formatAmount(amount)} 예정입니다. 팀 수익 공유로 함께 성장하세요!`,
      urgency: "축하",
      psychLens: "L1_SAVINGS_HIGHLIGHT + SOCIAL_PROOF",
    },
    1: {
      template: `${memberName}님, 정산이 아직 미결재 상태입니다. 팀장님의 빠른 승인을 요청해주세요. (${daysOverdue}일 지연)`,
      urgency: "재촉",
      psychLens: "L6_TIMING_LOSS_AVERSION + URGENCY",
    },
    3: {
      template: `[긴급] ${memberName}님 정산 ${daysOverdue}일 지연 중. 팀장님께 즉시 연락주세요. 정산 미결재는 팀 협력을 해칩니다.`,
      urgency: "긴급",
      psychLens: "L6_FOMO + L10_IMMEDIATE_CLOSING + GRANT_CARDONE_DEAL_KILLER",
    },
  };

  return {
    statementId,
    health,
    riskFlag: STATEMENT_HEALTH[health].riskFlag,
    smsSchedule: smsDay !== null ? [{ day: smsDay, message: messages[smsDay] }] : [],
    metrics: {
      completionRate: status === "COMPLETED" || status === "APPROVED" ? 100 : 0,
      delayDays: daysOverdue,
      isRiskyTeamMember: health !== "HEALTHY",
    },
  };
}

export default function TeamStatementsPage() {
  const session = useSession();
  const [statements, setStatements] = useState<TeamStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string>("JUNIOR_OWNER");

  // 현재 사용자의 role 확인
  const userRole = session.role;
  const isOwner = userRole === 'OWNER';

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch("/api/my/team-statements", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setStatements(data.statements ?? []);
          // 첫 번째 정산에서 팀원 역할 감지 (데이터에 포함된 경우)
          if (data.statements?.[0]?.memberRole) {
            setMemberRole(data.statements[0].memberRole);
          }
        } else {
          setError(data.message ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
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

  // L5: 현재 팀원이 어느 카테고리에 속하는지 표시
  const expectation = MEMBER_ROLE_EXPECTATIONS[memberRole];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header: 제목 + L5 당신의 상황 매칭 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">팀 정산</h1>
        <p className="text-sm text-gray-500 mb-4">대리점장 전용 — 팀 전체 정산 현황입니다.</p>

        {/* L5: 당신의 상황 섹션 (자기투영) */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-blue-900 mb-2">📊 당신의 기대 성과</p>
          <p className="text-sm text-blue-800">
            {MEMBER_ROLE_EXPECTATIONS[memberRole].label}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            현재 정산액을 이 기준과 비교하여 팀의 성장을 추적하세요.
          </p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && statements.length === 0 && (
        <div className={`text-center py-16 rounded-lg border-2 border-dashed ${
          isOwner
            ? 'bg-gray-50 text-gray-500 border-gray-300'
            : 'bg-yellow-50 text-yellow-700 border-yellow-300'
        }`}>
          {isOwner ? (
            <>
              <p className="font-medium mb-2">팀 정산 내역이 없습니다</p>
              <p className="text-sm text-gray-600">
                팀원들의 정산 내역이 생기면 여기에 표시됩니다.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2">🔒 대리점장(OWNER) 전용 페이지</p>
              <p className="text-sm">
                이 페이지는 대리점장만 접근할 수 있습니다.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                현재 역할: {userRole || '미확인'}
              </p>
            </>
          )}
        </div>
      )}

      {!loading && !error && statements.length > 0 && (
        <>
          {/* 정산 현황 대시보드 (성과 메트릭) */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 font-medium mb-1">정산 완료율</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(
                  (statements.filter((s) => s.status === "COMPLETED" || s.status === "APPROVED")
                    .length /
                    statements.length) *
                    100
                )}
                %
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
                {formatAmount(statements.reduce((sum, s) => sum + s.teamNetAmount, 0))}
              </p>
            </div>
          </div>

          {/* 정산 상세 테이블 (L10: 즉시조치 버튼 포함) */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">정산기간</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">정산 건강도</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">팀 순수령액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">지급일</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">L5 진행도</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">즉시조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((s) => {
                  const health = getStatementHealth(s.status, s.daysOverdue ?? 0).health;
                  const l5Status = getL5Status(s.teamNetAmount, s.memberRole);
                  const smsData = generateSmsSequenceMetadata(
                    s.id,
                    s.status,
                    s.teamNetAmount,
                    s.daysOverdue ?? 0,
                    s.memberName ?? "팀원"
                  );

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        health === "CRITICAL" ? "bg-red-50" : health === "WARNING" ? "bg-yellow-50" : ""
                      }`}
                      data-psych-lens={`L5:${l5Status}+L10:${health}`}
                      data-crm-meta={JSON.stringify(smsData)}
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_CLASS[s.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                          aria-label={`상태: ${STATUS_LABEL[s.status] ?? s.status}`}
                        >
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATEMENT_HEALTH[health].class
                          }`}
                          title={`Risk Flag: ${STATEMENT_HEALTH[health].riskFlag}`}
                        >
                          {STATEMENT_HEALTH[health].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatAmount(s.teamNetAmount)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {formatDate(s.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <span
                          className={`inline-block px-2 py-1 rounded ${
                            l5Status.includes("초과") || l5Status.includes("달성")
                              ? "bg-green-100 text-green-700"
                              : l5Status.includes("정상")
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {l5Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center space-x-1">
                        {health === "CRITICAL" && (
                          <button
                            className="inline-block px-2 py-1 bg-red-600 text-white text-xs rounded font-medium hover:bg-red-700 transition"
                            onClick={() => {
                              alert(
                                `[L10 Immediate Closing]\n${smsData.smsSchedule[0]?.message.template || "긴급 미결재 알림"}\n\nCRM: ${smsData.riskFlag}`
                              );
                            }}
                            aria-label="긴급 즉시 승인"
                          >
                            긴급
                          </button>
                        )}
                        {health === "WARNING" && (
                          <button
                            className="inline-block px-2 py-1 bg-yellow-600 text-white text-xs rounded font-medium hover:bg-yellow-700 transition"
                            onClick={() => {
                              alert(
                                `[L6 Loss Aversion]\n${smsData.smsSchedule[0]?.message.template || "지연 알림"}\n\nCRM: ${smsData.riskFlag}`
                              );
                            }}
                            aria-label="재촉 알림"
                          >
                            재촉
                          </button>
                        )}
                        {health === "HEALTHY" && s.status === "PENDING" && (
                          <button
                            className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 transition"
                            onClick={() => {
                              alert(`[L1 Savings]\n정산 완료 축하 SMS 발송 준비\n\nCRM: ${smsData.riskFlag}`);
                            }}
                            aria-label="축하 메시지"
                          >
                            축하
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CRM 자동분류 설명 */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">📌 CRM 자동분류 및 SMS 자동화</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>
                ✅ <strong>정상(Green)</strong> → Day 0: 축하 SMS (L1 절약액) + SOCIAL_PROOF
              </li>
              <li>
                ⚠️ <strong>주의(Yellow)</strong> → Day 1: 자동 재촉 SMS (L6 손실회피) + 긴박감
              </li>
              <li>
                🔴 <strong>위험(Red)</strong> → Day 3: 긴급 미결재 알림 (L10 즉시 클로징) + Grant
                Cardone Deal Killer
              </li>
              <li>
                📊 각 팀원의 성과는 L5 (자기투영) 기대값과 비교하여 "정상 진행" / "보조 필요" 판정
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
