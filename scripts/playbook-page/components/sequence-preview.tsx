"use client";

import { useEffect, useState } from "react";
import { Copy, Share2, ChevronRight, Clock, Zap } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";
import useSWR from "swr";
import { SequenceDetails, DayDetail, PASONA_STAGES } from "@/lib/types/sequence";

interface SequencePreviewProps {
  sequenceId: string;
  onBack: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDelay(minutes: number): string {
  if (minutes === 0) return "즉시";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (days > 0) return `Day ${days}`;
  return `${hours}시간`;
}

export function SequencePreview({ sequenceId, onBack }: SequencePreviewProps) {
  const [copyTip, setCopyTip] = useState<number | null>(null);
  const { data, isLoading } = useSWR(`/api/tools/day0-3-sequences/${sequenceId}`, fetcher);

  const sequence: SequenceDetails | undefined = data?.sequence;

  const handleCopyMessage = (message: string, day: number) => {
    navigator.clipboard.writeText(message);
    showSuccess(`Day ${day} 메시지가 복사되었습니다.`);
    setCopyTip(day);
    setTimeout(() => setCopyTip(null), 2000);
  };

  const handleShareSequence = () => {
    const text = `Day 0-3 시퀀스: ${sequence?.name}\n\n${sequence?.days
      ?.map(
        (d, i) =>
          `Day ${d.day} (${formatDelay(d.delay)}): ${d.message}`
      )
      .join("\n\n")}`;
    navigator.clipboard.writeText(text);
    showSuccess("시퀀스가 클립보드에 복사되었습니다.");
  };

  if (isLoading) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  if (!sequence) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">시퀀스를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{sequence.name}</h2>
          {sequence.description && (
            <p className="text-gray-600 mt-2">{sequence.description}</p>
          )}
        </div>
        <button
          onClick={handleShareSequence}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="공유"
        >
          <Share2 className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 mb-1">발송 수</div>
          <div className="text-2xl font-bold text-blue-900">{sequence.totalSent}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="text-xs font-medium text-green-600 mb-1">열람</div>
          <div className="text-2xl font-bold text-green-900">{sequence.totalOpened}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="text-xs font-medium text-purple-600 mb-1">클릭</div>
          <div className="text-2xl font-bold text-purple-900">{sequence.totalClicked}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="text-xs font-medium text-orange-600 mb-1">전환</div>
          <div className="text-2xl font-bold text-orange-900">{sequence.totalConverted}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">시퀀스 타임라인</h3>

        {sequence.days && sequence.days.length > 0 && (
          <div className="space-y-3">
            {sequence.days.map((day: DayDetail, idx: number) => (
              <div key={day.day} className="relative">
                {/* Connector Line */}
                {idx < sequence.days!.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-12 bg-gradient-to-b from-blue-300 to-gray-300" />
                )}

                {/* Day Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
                  <div className="flex gap-4">
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                        {day.day}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          Day {day.day} - {PASONA_STAGES[day.day]?.name || "Unknown"}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {PASONA_STAGES[day.day]?.stage}
                        </span>
                      </div>

                      {/* Timing */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Clock className="w-4 h-4" />
                        <span>{formatDelay(day.delay)} 후 발송</span>
                      </div>

                      {/* Psychology */}
                      {day.lens && (
                        <div className="flex items-center gap-2 text-sm text-purple-600 mb-3">
                          <Zap className="w-4 h-4" />
                          <span>{day.lens}</span>
                        </div>
                      )}

                      {/* Message Preview */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                          {day.message}
                        </p>
                      </div>

                      {/* Performance Indicators */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">오픈율</div>
                          <div className="font-semibold text-gray-900">
                            {day.expectedOpenRate}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">클릭율</div>
                          <div className="font-semibold text-gray-900">
                            {day.expectedClickRate}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Framework</div>
                          <div className="font-semibold text-gray-900 text-xs">
                            {day.framework}
                          </div>
                        </div>
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopyMessage(day.message, day.day)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        {copyTip === day.day ? "복사됨!" : "메시지 복사"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants Summary */}
      {sequence.days && sequence.days.some((d) => d.variants && d.variants.length > 1) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-3">A/B 테스트 변형</h3>
          <div className="space-y-2 text-sm text-blue-800">
            {sequence.days.map((day) => (
              day.variants && day.variants.length > 1 && (
                <div key={day.day}>
                  <span className="font-medium">Day {day.day}:</span> {day.variants.length}개 변형
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex gap-3 sticky bottom-0 bg-white py-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
