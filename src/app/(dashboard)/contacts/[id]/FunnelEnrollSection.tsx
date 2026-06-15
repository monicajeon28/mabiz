"use client";

import { useMemo } from "react";
import { GitBranch } from "lucide-react";

type Funnel = { id: string; name: string; funnelType?: string };
type VipSequence = { id: string; funnelId: string; status: string; startDate: string };

export interface FunnelEnrollProps {
  funnels: Funnel[];
  enrolledSequences: VipSequence[];
  selectedFunnelId: string;
  setSelectedFunnelId: (id: string) => void;
  enrollStartDate: string;
  setEnrollStartDate: (d: string) => void;
  enrollSendNow: boolean;
  setEnrollSendNow: (v: boolean) => void;
  enrolling: boolean;
  enrollError: string;
  funnelError?: string;
  onEnroll: () => Promise<void>;
}

export default function FunnelEnrollSection({
  funnels,
  enrolledSequences,
  selectedFunnelId,
  setSelectedFunnelId,
  enrollStartDate,
  setEnrollStartDate,
  enrollSendNow,
  setEnrollSendNow,
  enrolling,
  enrollError,
  funnelError,
  onEnroll,
}: FunnelEnrollProps) {
  const enrolledFunnelIds = useMemo(
    () => new Set(enrolledSequences.map((s) => s.funnelId)),
    [enrolledSequences]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-blue-500" />
        자동 메시지 직접 등록
      </h3>
      <p className="text-xs text-gray-400 mb-3">그룹 없이 자동 메시지에 바로 등록합니다</p>

      <div className="space-y-3">
        {funnelError && <p className="text-xs text-red-500 mb-2">{funnelError}</p>}
        {!funnelError && funnels.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">
            등록 가능한 자동 메시지이 없습니다.<br />관리자에게 자동 메시지 생성을 요청하세요.
          </p>
        )}

        <select
          value={selectedFunnelId}
          onChange={(e) => setSelectedFunnelId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">자동 메시지 선택</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id} disabled={enrolledFunnelIds.has(f.id)}>
              {f.name}{enrolledFunnelIds.has(f.id) ? " (이미 등록됨)" : ""}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={enrollStartDate}
          onChange={(e) => setEnrollStartDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="시작일 (비우면 오늘)"
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enrollSendNow}
            onChange={(e) => setEnrollSendNow(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm text-gray-700">즉시 첫 메시지 발송</span>
        </label>

        {enrollError && <p className="text-xs text-red-500">{enrollError}</p>}

        <button
          onClick={onEnroll}
          disabled={!selectedFunnelId || enrolling}
          className="w-full py-2.5 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-navy-800"
        >
          {enrolling ? "등록 중..." : "자동 메시지 등록"}
        </button>
      </div>

      {enrolledSequences.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">등록된 자동 메시지</p>
          <div className="space-y-1.5">
            {enrolledSequences.map((seq) => {
              const funnel = funnels.find((f) => f.id === seq.funnelId);
              return (
                <div key={seq.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-gray-700">{funnel?.name ?? seq.funnelId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    seq.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {seq.status === "ACTIVE" ? "진행중" : seq.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}