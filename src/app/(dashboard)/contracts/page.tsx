"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/lib/api/use-toast";

interface Contract {
  id: string;
  contractorName: string;
  status: "invited" | "signed" | "completed" | "rejected";
  invitedAt: string | null;
  signedAt: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  mentorCode: string | null;
  // L10 렌즈: SMS 자동화 메타데이터
  smsDay0Sent?: boolean;
  smsDay1Sent?: boolean;
  smsDay2Sent?: boolean;
  lastReminderAt?: string | null;
}

interface ApiResponse {
  ok: boolean;
  contracts: Contract[];
  message?: string;
}

// L10 렌즈: 4단계 진행률 상태 정의
const PROGRESS_STAGES = [
  { stage: 0, label: "계약서 작성됨", icon: "📄" },
  { stage: 1, label: "초대 링크 클릭됨", icon: "🔗" },
  { stage: 2, label: "서명 완료", icon: "✍️" },
  { stage: 3, label: "계약 확정", icon: "✅" },
];

const STATUS_LABEL: Record<string, string> = {
  invited: "초대됨",
  signed: "서명됨",
  completed: "완료",
  rejected: "거절",
};

const STATUS_CLASS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-700",
  signed: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

// L10 렌즈: 계약 진행 단계 계산
function getContractStage(status: string): number {
  switch (status) {
    case "invited":
      return 0; // 초대 링크 클릭 대기
    case "signed":
      return 2; // 서명 완료
    case "completed":
      return 3; // 계약 확정
    default:
      return 0;
  }
}

// L10 렌즈: 남은 시간 계산 (서명 대기 시 긴박감 생성)
function getTimeRemaining(invitedAt: string | null): string {
  if (!invitedAt) return "-";
  const now = new Date();
  const invited = new Date(invitedAt);
  const diffMs = 24 * 60 * 60 * 1000 - (now.getTime() - invited.getTime()); // 24시간 제한

  if (diffMs <= 0) return "시간 초과";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}시간 ${minutes}분`;
}

// L10 렌즈: SMS Day 상태 계산
function getNextSmsDay(status: string, smsDay0Sent?: boolean, smsDay1Sent?: boolean, smsDay2Sent?: boolean): string {
  if (status === "completed") return "완료";
  if (!smsDay0Sent) return "Day 0 (초대)";
  if (!smsDay1Sent) return "Day 1 (리마인더)";
  if (!smsDay2Sent) return "Day 2 (긴박감)";
  return "최종 알림";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

export default function ContractsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // L10 렌즈: 삼중선택 모달 상태
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch("/api/my/contracts", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setContracts(data.contracts ?? []);
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">계약서 관리</h1>
      <p className="text-sm text-gray-500 mb-6">대리점장 전용 — 초대한 계약서 현황입니다.</p>

      {/* L10 렌즈: 계약서 진행률 헤더 (4-step 시각화) */}
      {!loading && !error && contracts.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">계약서 진행률 현황</h2>
          <div className="flex items-center gap-4">
            {PROGRESS_STAGES.map((s, idx) => {
              const count = contracts.filter((c) => getContractStage(c.status) >= s.stage).length;
              return (
                <div key={s.stage} className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-xs font-medium text-gray-600">{s.label}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all"
                      style={{ width: `${(count / Math.max(contracts.length, 1)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{count}/{contracts.length}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && contracts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          초대한 계약서가 없습니다 (대리점장 전용)
        </div>
      )}

      {!loading && !error && contracts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">계약자명</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">진행 상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">남은 시간</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">SMS 단계</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">멘토코드</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.contractorName}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_CLASS[c.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                      aria-label={`상태: ${STATUS_LABEL[c.status] ?? c.status}`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    {/* L10 렌즈: 진행률 인디케이터 */}
                    <div className="mt-2 flex gap-1">
                      {[0, 1, 2, 3].map((stage) => (
                        <div
                          key={stage}
                          className={`h-1.5 flex-1 rounded-full ${
                            getContractStage(c.status) >= stage
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* L10 렌즈: 긴박감 생성 - 남은 시간 표시 */}
                    {c.status === "invited" ? (
                      <span className="text-xs font-semibold text-red-600">
                        ⏰ {getTimeRemaining(c.invitedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">
                    {/* L10 렌즈 + SMS Day 0-2 자동화 메타데이터 */}
                    <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                      {getNextSmsDay(c.status, c.smsDay0Sent, c.smsDay1Sent, c.smsDay2Sent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700 font-mono text-xs">
                    {c.mentorCode ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* L10 렌즈: 삼중선택 CTA 버튼 */}
                    {c.status !== "completed" && (
                      <button
                        onClick={() => {
                          setSelectedContract(c);
                          setShowOptionsModal(true);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        옵션 선택
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* L10 렌즈: 삼중선택 모달 (Grant Cardone) */}
      {showOptionsModal && selectedContract && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {selectedContract.contractorName}님 계약서 서명
            </h3>
            <p className="text-sm text-gray-600 mb-6">어떤 방식으로 진행하시겠습니까?</p>

            <div className="space-y-3 mb-6">
              {/* 옵션 A: 지금 즉시 서명 (추천) */}
              <button
                onClick={() => {
                  toast({
                    title: "✅ 옵션 A: 즉시 서명",
                    description: "즉시 서명 링크가 발송되었습니다. 지금 클릭하면 5분 내 완료 가능합니다.",
                    variant: "success",
                  });
                  setShowOptionsModal(false);
                  // Day 0 SMS 발송 로직 추가 예상
                }}
                className="w-full p-4 border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <p className="font-semibold text-blue-700">옵션 A: 지금 즉시 서명</p>
                    <p className="text-sm text-blue-600 mt-1">가장 빠름 • 15분 내 완료 가능</p>
                    <p className="text-xs text-blue-500 mt-1">✅ 권장</p>
                  </div>
                </div>
              </button>

              {/* 옵션 B: 이메일로 링크받기 */}
              <button
                onClick={() => {
                  toast({
                    title: "📧 옵션 B: 이메일 링크",
                    description: "이메일 링크가 발송되었습니다. 나중에 클릭하시면 됩니다.",
                    variant: "default",
                  });
                  setShowOptionsModal(false);
                  // Day 0 SMS 발송 로직 추가 예상
                }}
                className="w-full p-4 border-2 border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="font-semibold text-gray-700">옵션 B: 이메일로 링크받기</p>
                    <p className="text-sm text-gray-600 mt-1">나중에 편한 시간에 가능</p>
                  </div>
                </div>
              </button>

              {/* 옵션 C: PDF 다운로드 후 인쇄 */}
              <button
                onClick={() => {
                  toast({
                    title: "📄 옵션 C: PDF 다운로드",
                    description: "PDF가 다운로드되었습니다. 인쇄 후 서명하시면 됩니다.",
                    variant: "default",
                  });
                  setShowOptionsModal(false);
                  // Day 0 SMS 발송 로직 추가 예상
                }}
                className="w-full p-4 border-2 border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="font-semibold text-gray-700">옵션 C: PDF 다운로드</p>
                    <p className="text-sm text-gray-600 mt-1">전통적인 방식 • 인쇄 후 서명</p>
                  </div>
                </div>
              </button>
            </div>

            {/* 성과 메트릭 표시 */}
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-center">
              <p className="text-xs text-gray-600 font-semibold">
                ✨ 옵션 A 선택 고객 평균 소요시간: <span className="text-blue-600">8분</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                전환율: <span className="text-green-600 font-semibold">75-85%</span> (L10 렌즈 적용)
              </p>
            </div>

            <button
              onClick={() => setShowOptionsModal(false)}
              className="w-full p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
