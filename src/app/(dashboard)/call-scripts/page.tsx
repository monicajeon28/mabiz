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

type DbScript = {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: number;
  scriptTab: string;
  customerSegment: string | null;
  pasonaStage: string | null;
  psychology: string | null;
};

export default function CallScriptsPage() {
  const [category, setCategory] = useState<string>("healthcare");
  const [segment, setSegment] = useState<string>("신혼부부 (30-35세)");
  const [phase, setPhase] = useState<string>("1");
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbScripts, setDbScripts] = useState<DbScript[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbTypeFilter, setDbTypeFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 스크립트 데이터 로드 (Mock 카테고리 전용)
  useEffect(() => {
    if (category === 'rose_db') return;
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

  // DB 스크립트 로드
  useEffect(() => {
    if (category !== 'rose_db') return;
    const fetchDb = async () => {
      setDbLoading(true);
      try {
        const params = new URLSearchParams();
        if (segment && segment !== 'GENERAL') params.set('segment', segment);
        params.set('tab', 'CALL_SCRIPT');
        const res = await fetch(`/api/call-scripts/playbooks?${params}`);
        const data = await res.json();
        if (data.ok) setDbScripts(data.scripts || []);
      } catch {
        // silent
      } finally {
        setDbLoading(false);
      }
    };
    fetchDb();
  }, [category, segment]);

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
          {category === 'rose_db' ? (
            // DB 스크립트 뷰
            <div className="space-y-3">
              {/* 타입 필터 */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {['ALL','OPENING','NEEDS','REJECTION','RECONTACT','CLOSING','PERSONA','SUCCESS_CASE','FORBIDDEN'].map(t => (
                    <button
                      key={t}
                      onClick={() => setDbTypeFilter(t)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        dbTypeFilter === t
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t === 'ALL' ? '전체' : t}
                    </button>
                  ))}
                </div>
              </div>
              {/* 스크립트 카드 목록 */}
              {dbLoading ? (
                <div className="text-center py-12 text-gray-500 text-sm">로드 중...</div>
              ) : (
                dbScripts
                  .filter(s => dbTypeFilter === 'ALL' || s.type === dbTypeFilter)
                  .map(s => (
                    <div key={s.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">{s.type}</span>
                              {s.pasonaStage && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">PASONA: {s.pasonaStage}</span>
                              )}
                              {s.psychology && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{s.psychology}</span>
                              )}
                            </div>
                            <p className="font-semibold text-sm text-gray-900">{s.title}</p>
                          </div>
                          <span className="text-gray-400 text-xs mt-1 shrink-0">{expandedId === s.id ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {expandedId === s.id && (
                        <div className="border-t border-gray-100 p-4">
                          <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {s.content}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(s.content)}
                            className="mt-2 px-3 py-1.5 bg-rose-500 text-white text-xs font-medium rounded-lg hover:bg-rose-600 transition-colors"
                          >
                            복사
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
              {!dbLoading && dbScripts.filter(s => dbTypeFilter === 'ALL' || s.type === dbTypeFilter).length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">스크립트가 없습니다.</div>
              )}
            </div>
          ) : (
            // 기존 Mock 스크립트 뷰 (변경 없이 그대로)
            loading ? (
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
            ) : null
          )}
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
