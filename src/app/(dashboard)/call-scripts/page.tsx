"use client";

import { useState, useEffect } from "react";
import { CategorySelector } from "./components/CategorySelector";
import { SegmentSelector } from "./components/SegmentSelector";
import { ScriptPhaseNav } from "./components/ScriptPhaseNav";
import { ScriptViewer } from "./components/ScriptViewer";
import { SMSSequencePreview } from "./components/SMSSequencePreview";
import { CallFeedback } from "./components/CallFeedback";

type Script = {
  id: string;
  category: string;
  segment: string;
  phase: string;
  phaseName: string;
  estimatedTime: string;
  content: string;
  psychologyPrinciples: string[];
  pasonaPhase: string;
  tips: string[];
};

export default function CallScriptsPage() {
  const [category, setCategory] = useState<string>("healthcare");
  const [segment, setSegment] = useState<string>("신혼부부 (30-35세)");
  const [phase, setPhase] = useState<string>("1");
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 스크립트 데이터 로드
  useEffect(() => {
    const fetchScript = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/call-scripts/${category}/${encodeURIComponent(segment)}/${phase}`
        );
        if (!res.ok) throw new Error("Failed to fetch script");
        const data = await res.json();
        if (data.ok) {
          setScript(data.script);
        }
      } catch (err) {
        console.error("Error fetching script:", err);
        setError("스크립트를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchScript();
  }, [category, segment, phase]);

  // 카테고리 변경 시 세그먼트 초기화
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setPhase("1");
  };

  const handleSegmentChange = (newSegment: string) => {
    setSegment(newSegment);
    setPhase("1");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">콜 스크립트</h1>
        <p className="text-gray-600 text-sm md:text-base mt-1">
          영업 전화 전에 확인하고, 피드백으로 개선하세요. 각 단계별 심리학 원리와 PASONA 프레임워크가 적용된 스크립트입니다.
        </p>
      </div>

      {/* 3컬럼 레이아웃 (PC) / 탭 기반 (모바일) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* 좌측: 카테고리/세그먼트/페이즈 선택 */}
        <aside className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <CategorySelector selected={category} onSelect={handleCategoryChange} />
            <div className="mt-4 pt-4 border-t">
              <SegmentSelector
                category={category}
                selected={segment}
                onSelect={handleSegmentChange}
              />
            </div>
          </div>

          {/* Phase 네비게이션 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">스크립트 단계</h3>
            <ScriptPhaseNav selected={phase} onSelect={setPhase} />
          </div>
        </aside>

        {/* 중앙: 스크립트 뷰어 */}
        <main className="md:col-span-1">
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 text-sm mt-3">스크립트를 로드 중입니다...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg border border-red-200 p-6 text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : script ? (
            <ScriptViewer
              category={category}
              segment={segment}
              phase={phase}
              phaseName={script.phaseName}
              estimatedTime={script.estimatedTime}
              content={script.content}
              psychologyPrinciples={script.psychologyPrinciples}
              pasonaPhase={script.pasonaPhase}
              tips={script.tips}
            />
          ) : null}
        </main>

        {/* 우측: SMS 시퀀스 + 피드백 */}
        <aside className="md:col-span-1 space-y-4">
          <SMSSequencePreview category={category} segment={segment} />
          <CallFeedback category={category} phase={parseInt(phase)} segment={segment} />
        </aside>
      </div>
    </div>
  );
}
