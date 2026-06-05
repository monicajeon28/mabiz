"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

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

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "복사됨!" : "복사"}
          </button>
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
