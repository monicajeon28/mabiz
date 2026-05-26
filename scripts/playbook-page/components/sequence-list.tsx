"use client";

import { useEffect, useState } from "react";
import { Edit2, Eye, BarChart3, Send, Pause, Play, Trash2, Plus } from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
import useSWR from "swr";
import { SmsSequenceTemplateDTO, SequenceStatus } from "@/lib/types/sequence";

interface SequenceListProps {
  organizationId?: string;
  onSelectSequence?: (id: string) => void;
  onEditSequence?: (id: string) => void;
  onViewAnalytics?: (id: string) => void;
  onDeploySequence?: (id: string) => void;
  onCreateNew?: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatusBadge({ status }: { status: SequenceStatus }) {
  const styles: Record<SequenceStatus, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    ARCHIVED: "bg-gray-300 text-gray-600",
  };

  const labels: Record<SequenceStatus, string> = {
    DRAFT: "초안",
    ACTIVE: "활성",
    PAUSED: "일시중지",
    ARCHIVED: "보관",
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SequenceList({
  organizationId,
  onSelectSequence,
  onEditSequence,
  onViewAnalytics,
  onDeploySequence,
  onCreateNew,
}: SequenceListProps) {
  const [sequences, setSequences] = useState<SmsSequenceTemplateDTO[]>([]);
  const { data, isLoading, error, mutate } = useSWR("/api/tools/day0-3-sequences", fetcher);

  useEffect(() => {
    if (data?.sequences) {
      setSequences(data.sequences);
    }
  }, [data]);

  const handlePauseResume = async (id: string, currentStatus: SequenceStatus) => {
    try {
      const newStatus = currentStatus === "PAUSED" ? "ACTIVE" : "PAUSED";
      const response = await fetch(`/api/tools/day0-3-sequences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update sequence");

      showSuccess(`시퀀스가 ${newStatus === "ACTIVE" ? "활성화" : "일시중지"}되었습니다.`);
      mutate();
    } catch (err) {
      showError("시퀀스 업데이트 실패");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/tools/day0-3-sequences/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete sequence");

      showSuccess("시퀀스가 삭제되었습니다.");
      mutate();
    } catch (err) {
      showError("시퀀스 삭제 실패");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">시퀀스를 불러올 수 없습니다.</p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-6">시퀀스가 없습니다.</p>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 시퀀스 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Day 0-3 시퀀스</h3>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새로 만들기
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">시퀀스명</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">상태</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">심리학 렌즈</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">발송/열람/클릭</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sequences.map((seq) => (
              <tr key={seq.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{seq.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={seq.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {seq.psychologyLens ? `렌즈 ${seq.psychologyLens.substring(1)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {seq.totalSent} / {seq.totalOpened} / {seq.totalClicked}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onViewAnalytics?.(seq.id)}
                      className="p-2 text-gray-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="분석 보기"
                      aria-label="분석 보기"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditSequence?.(seq.id)}
                      className="p-2 text-gray-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="편집"
                      aria-label="편집"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectSequence?.(seq.id)}
                      className="p-2 text-gray-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="미리보기"
                      aria-label="미리보기"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {seq.status !== "ACTIVE" ? (
                      <button
                        onClick={() => onDeploySequence?.(seq.id)}
                        className="p-2 text-gray-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="배포"
                        aria-label="배포"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePauseResume(seq.id, seq.status)}
                        className="p-2 text-gray-600 hover:bg-yellow-100 rounded-lg transition-colors"
                        title="일시중지"
                        aria-label="일시중지"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {seq.status === "PAUSED" && (
                      <button
                        onClick={() => handlePauseResume(seq.id, seq.status)}
                        className="p-2 text-gray-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="재개"
                        aria-label="재개"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(seq.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="삭제"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
