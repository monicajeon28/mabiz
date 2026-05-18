"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface CallFeedbackProps {
  category: string;
  phase: number;
  segment: string;
}

const DIFFICULTIES = [
  "고객 반응이 좋지 않았어요",
  "복잡해서 놓친 부분이 있어요",
  "시간이 부족했어요",
  "기타",
];

const CALL_OUTCOMES = ["interested", "not_interested", "not_reached"];

export function CallFeedback({ category, phase, segment }: CallFeedbackProps) {
  const { toast } = useToast();
  const [effectiveness, setEffectiveness] = useState<number>(0);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [improvements, setImprovements] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callOutcome, setCallOutcome] = useState("interested");
  const [submitting, setSubmitting] = useState(false);

  const handleDifficultyToggle = (difficulty: string) => {
    setDifficulties((prev) =>
      prev.includes(difficulty)
        ? prev.filter((d) => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (effectiveness === 0) {
      toast({
        title: "오류",
        description: "효과 평가를 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/call-scripts/${category}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          segment,
          effectiveness,
          difficulties,
          improvements,
          callDuration: callDuration ? parseInt(callDuration) : 0,
          callOutcome,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit feedback");

      toast({
        title: "성공",
        description: "피드백이 저장되었습니다",
      });

      // 폼 초기화
      setEffectiveness(0);
      setDifficulties([]);
      setImprovements("");
      setCallDuration("");
      setCallOutcome("interested");
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast({
        title: "오류",
        description: "피드백 저장 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">💬 콜 후 피드백</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 효과 평가 */}
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-2">
            효과 평가 ⭐
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setEffectiveness(star)}
                className={`text-2xl transition-transform ${
                  star <= effectiveness ? "scale-110" : "opacity-40 hover:scale-110"
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          {effectiveness > 0 && (
            <p className="text-xs text-gray-600 mt-1">{effectiveness}점 선택됨</p>
          )}
        </div>

        {/* 통화 결과 */}
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-2">
            통화 결과
          </label>
          <select
            value={callOutcome}
            onChange={(e) => setCallOutcome(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="interested">관심 표시</option>
            <option value="not_interested">관심 없음</option>
            <option value="not_reached">연결 안 됨</option>
          </select>
        </div>

        {/* 통화 시간 */}
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-2">
            통화 시간 (초)
          </label>
          <input
            type="number"
            value={callDuration}
            onChange={(e) => setCallDuration(e.target.value)}
            placeholder="예: 720"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 어려웠던 부분 */}
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-2">
            어려웠던 부분 (선택)
          </label>
          <div className="space-y-1">
            {DIFFICULTIES.map((option) => (
              <label key={option} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={difficulties.includes(option)}
                  onChange={() => handleDifficultyToggle(option)}
                  className="rounded"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 개선 의견 */}
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-2">
            개선 의견 (선택)
          </label>
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="자유롭게 의견을 작성해주세요..."
            rows={2}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "제출 중..." : "피드백 제출"}
        </button>
      </form>
    </div>
  );
}
