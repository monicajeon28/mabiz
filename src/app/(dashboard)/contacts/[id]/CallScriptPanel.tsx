"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, BookOpen, Zap } from "lucide-react";

interface ScriptPhase {
  segment: string;
  phase: number;
  versionId: string;
  versionName: string;
  phaseName: string;
  phaseDuration: number;
  pasona: string[];
  spin: string[];
  psychologyLenses: string[];
  script: string;
  objectives: string[];
  keyMessages: string[];
  silencePoints: number[];
  customerEngagement: string;
  tips: string[];
}

interface ContactInfo {
  age?: number;
  maritalStatus?: string;
  childrenCount?: number;
}

interface CallScriptPanelProps {
  contact: ContactInfo;
  isExpanded?: boolean;
  onPhaseChange?: (phase: number) => void;
}

// 세그먼트 자동 감지 (Track B: A/B/C/D)
function detectSegmentTrackB(contact: ContactInfo): string {
  // A: 신혼부부 (26-35세, 결혼 1년 이내)
  // B: 자녀 육아 가정 (35-50세, 자녀 있음)
  // C: 중년 독립 (40-55세, 자녀 독립)
  // D: 시니어 (55세 이상)

  if (contact.age) {
    if (contact.maritalStatus === "MARRIED" && contact.age >= 26 && contact.age <= 35) {
      return "A"; // 신혼부부
    }
    if (contact.childrenCount && contact.childrenCount > 0 && contact.age >= 35 && contact.age <= 50) {
      return "B"; // 자녀 육아
    }
    if (contact.age >= 40 && contact.age <= 55 && (!contact.childrenCount || contact.childrenCount === 0)) {
      return "C"; // 중년 독립
    }
    if (contact.age >= 55) {
      return "D"; // 시니어
    }
  }

  // 기본값
  return "B";
}

const PHASE_LABELS = [
  { number: 0, name: "오프닝", duration: 60 },
  { number: 1, name: "세그먼트 판별", duration: 60 },
  { number: 2, name: "욕망 탐색", duration: 60 },
  { number: 3, name: "고통 증폭", duration: 60 },
  { number: 4, name: "솔루션", duration: 60 },
  { number: 5, name: "이의처리", duration: 300 },
  { number: 6, name: "클로징", duration: 180 },
];

export default function CallScriptPanel({ contact, isExpanded = true, onPhaseChange }: CallScriptPanelProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [script, setScript] = useState<ScriptPhase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segment = detectSegmentTrackB(contact);

  useEffect(() => {
    fetchScript(segment, currentPhase);
  }, [segment, currentPhase]);

  async function fetchScript(seg: string, phase: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/call-scripts/track-b?segment=${seg}&phase=${phase}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("스크립트 로드 실패");
      const data = await response.json();
      if (data.ok) {
        setScript(data.script);
        onPhaseChange?.(phase);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  const handlePhaseChange = (phase: number) => {
    setCurrentPhase(phase);
  };

  if (!script && !loading && !error) {
    return null;
  }

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 mb-6">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-100 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-blue-900">콜 스크립트 가이드</h3>
            <p className="text-sm text-blue-600">
              Segment {segment} • {script?.versionName || "로딩 중..."}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-blue-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-600" />
        )}
      </div>

      {/* 콘텐츠 */}
      {expanded && (
        <div className="border-t border-blue-200 p-4 space-y-4">
          {/* 단계 네비게이션 */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {PHASE_LABELS.map((phase) => (
              <button
                key={phase.number}
                onClick={() => handlePhaseChange(phase.number)}
                className={`flex-shrink-0 px-3 py-2 rounded text-sm font-medium transition whitespace-nowrap ${
                  currentPhase === phase.number
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"
                }`}
              >
                {phase.number + 1}. {phase.name}
              </button>
            ))}
          </div>

          {/* 로딩 상태 */}
          {loading && (
            <div className="text-center text-sm text-gray-500 py-4">
              스크립트 로드 중...
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* 스크립트 콘텐츠 */}
          {script && (
            <div className="space-y-4">
              {/* 메타정보 */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 pb-3 border-b border-blue-200">
                <div>
                  <span className="font-semibold text-gray-700">단계:</span> {script.phaseName}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">소요시간:</span> {Math.ceil(script.phaseDuration / 60)}분
                </div>
                <div>
                  <span className="font-semibold text-gray-700">고객 반응도:</span> {script.customerEngagement}
                </div>
              </div>

              {/* 심리학 렌즈 */}
              <div className="flex flex-wrap gap-2">
                {script?.psychologyLenses?.map((lens) => (
                  <span key={lens} className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                    <Zap className="w-3 h-3" />
                    {lens}
                  </span>
                ))}
              </div>

              {/* 프레임워크 (PASONA/SPIN) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-blue-200">
                  <div className="font-semibold text-blue-700">PASONA</div>
                  <div className="text-gray-600">{script?.pasona?.join(" → ")}</div>
                </div>
                <div className="bg-white p-2 rounded border border-blue-200">
                  <div className="font-semibold text-blue-700">SPIN</div>
                  <div className="text-gray-600">{script?.spin?.join(" → ")}</div>
                </div>
              </div>

              {/* 핵심 메시지 */}
              {script?.keyMessages?.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                  <div className="font-semibold text-yellow-900 text-sm mb-2">🎯 핵심 메시지</div>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {script?.keyMessages?.map((msg, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-yellow-600">•</span>
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 스크립트 본문 */}
              <div className="bg-white border border-gray-300 rounded p-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-mono">
                  {script.script}
                </div>
              </div>

              {/* 목표 */}
              {script?.objectives?.length > 0 && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <div className="font-semibold text-green-900 text-sm mb-2">✓ 단계 목표</div>
                  <ul className="text-sm text-green-800 space-y-1">
                    {script?.objectives?.map((obj, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-green-600">→</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 팁 */}
              {script?.tips?.length > 0 && (
                <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
                  <div className="font-semibold text-indigo-900 text-sm mb-2">💡 실전 팁</div>
                  <ul className="text-sm text-indigo-800 space-y-1">
                    {script?.tips?.map((tip, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-indigo-600">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 침묵 포인트 */}
              {script?.silencePoints?.length > 0 && (
                <div className="bg-orange-50 p-3 rounded border border-orange-200">
                  <div className="font-semibold text-orange-900 text-sm mb-2">⏸️ 침묵 포인트</div>
                  <p className="text-sm text-orange-800">
                    {script?.silencePoints?.map(p => `${p}번 위치`).join(", ")}에서 고객의 답변을 기다리세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
