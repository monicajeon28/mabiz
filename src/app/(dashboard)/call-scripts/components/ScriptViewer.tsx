"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle, Save } from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

interface ScriptViewerProps {
  category: string;
  segment: string;
  phase: string;
  phaseName: string;
  estimatedTime: string;
  content: string;
  psychologyPrinciples: string[];
  pasonaPhase: string;
  tips: string[];
}

export function ScriptViewer({
  category,
  segment,
  phase,
  phaseName,
  estimatedTime,
  content,
  psychologyPrinciples,
  pasonaPhase,
  tips,
}: ScriptViewerProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToDrive = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/call-scripts/backup-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          phase,
          phaseName,
          content,
          psychologyPrinciples,
          pasonaPhase,
          tips,
        }),
      });

      if (!res.ok) throw new Error("Failed to save to Drive");

      const data = await res.json();
      toast({
        title: "Google Drive 저장 완료",
        description: `${segment} > Phase ${phase} 스크립트가 저장되었습니다.`,
        variant: "success",
      });
    } catch (err) {
      logger.error("Error saving to Drive:", { error: err instanceof Error ? err.message : String(err) });
      toast({
        title: "저장 실패",
        description: "Google Drive 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzeWithChatGPT = () => {
    const prompt = `다음 콜 스크립트를 분석해주세요:\n\n세그먼트: ${segment}\nPhase: ${phase} - ${phaseName}\n\n스크립트:\n${content}\n\n심리학 원리: ${psychologyPrinciples.join(", ")}\nPASONA 단계: ${pasonaPhase}\n\n다음을 분석해주세요:\n1. 스크립트의 강점\n2. 개선할 점\n3. 고객 반응 예상\n4. 추가 제안`;
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`https://chatgpt.com/?q=${encodedPrompt}`, "_blank");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      {/* 헤더 */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Phase {phase}</h2>
            <p className="text-base font-medium text-gray-700 mt-0.5">{phaseName}</p>
            <p className="text-sm text-gray-600 mt-1">예상 시간: {estimatedTime}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAnalyzeWithChatGPT}
              className="px-3 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 flex items-center gap-2 transition-colors"
              title="ChatGPT에서 이 스크립트를 분석합니다"
            >
              <MessageCircle size={16} />
              분석
            </button>
            <button
              onClick={handleSaveToDrive}
              disabled={saving}
              className="px-3 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 flex items-center gap-2 transition-colors disabled:opacity-50"
              title="Google Drive에 저장합니다"
            >
              <Save size={16} />
              {saving ? "저장중..." : "저장"}
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>
        </div>

        {/* 배지 */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">
            PASONA: {pasonaPhase}
          </span>
          {psychologyPrinciples.slice(0, 2).map((principle) => (
            <span
              key={principle}
              className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              {principle}
            </span>
          ))}
          {psychologyPrinciples.length > 2 && (
            <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
              +{psychologyPrinciples.length - 2}개
            </span>
          )}
        </div>
      </div>

      {/* 스크립트 내용 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">스크립트</h3>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
            {content}
          </div>
        </div>
      </div>

      {/* 팁 */}
      {tips && tips.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm text-gray-900 mb-2">💡 팁</h3>
          <ul className="space-y-1">
            {tips.map((tip, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex gap-2">
                <span className="text-gray-600">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 심리학 분석 */}
      <div className="border-t pt-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-2">🧠 심리학 원리</h3>
        <div className="space-y-2">
          {psychologyPrinciples.map((principle) => (
            <div key={principle} className="text-sm text-gray-700">
              <span className="font-medium">{principle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
