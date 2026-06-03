'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CallSituation,
  CALL_SITUATIONS,
  CALL_SITUATION_ORDER,
  suggestCallSituations,
  type CallSituationScript,
} from '@/lib/playbook/call-situations';
import type { LensType } from '@/lib/types/lens';

interface Contact {
  id: string;
  name: string;
  lens?: LensType | null;
  callStage?: string | null;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
}

export default function PlaybookPage() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contactId');

  const [contact, setContact] = useState<Contact | null>(null);
  const [selectedSituation, setSelectedSituation] = useState<CallSituation | null>(null);
  const [script, setScript] = useState<CallSituationScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendedSituations, setRecommendedSituations] = useState<CallSituation[]>([]);

  // 연락처 정보 로드
  useEffect(() => {
    const fetchContact = async () => {
      if (!contactId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/contacts/${contactId}`);
        if (!res.ok) throw new Error('연락처를 불러올 수 없습니다');

        const data = await res.json();
        setContact({
          id: data.id,
          name: data.name,
          lens: data.lens || null,
          callStage: data.callStage || null,
          sentiment: data.sentiment || null,
        });

        // 렌즈 기반 추천 상황 계산
        const effectiveLens = data.lens || 'L10';
        const recommended = suggestCallSituations(effectiveLens, data.callStage);

        // Sentiment 기반 우선순위 조정
        let sorted = [...recommended];
        if (data.sentiment === 'NEGATIVE') {
          const complaintIdx = sorted.indexOf('COMPLAINT');
          if (complaintIdx > 0) {
            sorted.splice(complaintIdx, 1);
            sorted.unshift('COMPLAINT');
          }
        }

        setRecommendedSituations(sorted);

        // 첫 번째 추천 상황 자동 선택
        if (sorted.length > 0) {
          const firstSituation = sorted[0];
          selectSituation(firstSituation);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [contactId]);

  // 상황 선택 핸들러
  const selectSituation = (situation: CallSituation) => {
    setSelectedSituation(situation);
    const situationScript = CALL_SITUATIONS[situation];
    if (situationScript) {
      setScript(situationScript);

      // ToolClickTracker API 호출 (선택)
      if (contactId) {
        fetch('/api/analytics/tool-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId,
            toolName: 'playbook',
            situation,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {
          // 실패해도 무시
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-700 font-medium">플레이북 로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📞 콜 플레이북</h1>
          {contact && (
            <div className="flex items-center gap-4 mt-4 bg-white rounded-lg p-4 shadow">
              <div>
                <p className="text-lg font-semibold text-gray-900">{contact.name}</p>
                <div className="flex gap-3 text-sm text-gray-600 mt-1">
                  {contact.lens && (
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {contact.lens}
                    </span>
                  )}
                  {contact.callStage && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                      {contact.callStage}
                    </span>
                  )}
                  {contact.sentiment && (
                    <span
                      className={`px-3 py-1 rounded-full ${
                        contact.sentiment === 'NEGATIVE'
                          ? 'bg-red-100 text-red-700'
                          : contact.sentiment === 'POSITIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {contact.sentiment}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {!contact && !contactId && (
            <p className="text-gray-600">
              URL에 <code className="bg-gray-200 px-2 py-1 rounded">?contactId=...</code>{' '}
              파라미터를 추가하면 고객별 추천 스크립트를 확인할 수 있습니다.
            </p>
          )}
          {error && (
            <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* 추천 섹션 */}
        {recommendedSituations.length > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4">📌 이 고객에게 추천</h2>
            <div className="space-y-3">
              {recommendedSituations.slice(0, 3).map((situation, index) => {
                const situationScript = CALL_SITUATIONS[situation];
                const isSelected = selectedSituation === situation;
                return (
                  <button
                    key={situation}
                    onClick={() => selectSituation(situation)}
                    className={`w-full text-left p-4 rounded-lg transition transform hover:scale-105 ${
                      isSelected
                        ? 'bg-white text-blue-600 shadow-lg ring-2 ring-white'
                        : index === 0
                          ? 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                          : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{situationScript.emoji}</span>
                      <div className="flex-1">
                        <div className={`font-semibold ${isSelected ? 'text-blue-600' : ''}`}>
                          {situationScript.label}
                          {index === 0 && (
                            <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                              최우선
                            </span>
                          )}
                        </div>
                        <div className="text-sm opacity-75 mt-1">
                          {situationScript.openingLines[0].text}
                        </div>
                      </div>
                      <span
                        className={`text-lg ${
                          isSelected ? 'text-blue-600' : 'text-white/60'
                        }`}
                      >
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 모든 상황 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
              <h3 className="font-bold text-lg mb-4 text-gray-900">📖 모든 상황</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {CALL_SITUATION_ORDER.map((situation) => {
                  const situationScript = CALL_SITUATIONS[situation];
                  const isRecommended = recommendedSituations.includes(situation);
                  const isSelected = selectedSituation === situation;

                  return (
                    <button
                      key={situation}
                      onClick={() => selectSituation(situation)}
                      className={`w-full text-left p-3 rounded transition ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md'
                          : isRecommended
                            ? 'bg-blue-50 border-2 border-blue-400 hover:bg-blue-100'
                            : 'bg-gray-50 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-2xl mb-1">{situationScript.emoji}</div>
                      <div className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {situationScript.label}
                      </div>
                      <div className={`text-xs mt-1 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                        렌즈: {situationScript.primaryLens}
                      </div>
                      {situationScript.tier === 'CORE' && (
                        <div className={`text-xs mt-1 font-semibold ${isSelected ? 'text-yellow-200' : 'text-orange-600'}`}>
                          필수
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 오른쪽: 스크립트 상세 */}
          <div className="lg:col-span-2">
            {script ? (
              <div className="bg-white rounded-lg shadow-lg p-8">
                {/* 스크립트 헤더 */}
                <div className="mb-6 pb-6 border-b-2 border-gray-200">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl">{script.emoji}</span>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">{script.label}</h2>
                      <div className="flex gap-2 mt-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                          주렌즈: {script.primaryLens}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            script.tier === 'CORE'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {script.tier === 'CORE' ? '필수' : '성장'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 오프닝 라인 */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🎤 오프닝 라인</h3>
                  <div className="space-y-4">
                    {script.openingLines.map((line, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500"
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-2xl font-bold text-blue-600 flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-semibold text-gray-900 mb-2">{line.text}</p>
                            <div className="bg-white rounded px-3 py-2 mb-2">
                              <p className="text-sm font-semibold text-blue-700 mb-1">
                                🧠 심리학: {line.lensLabel}
                              </p>
                              <p className="text-sm text-gray-700">{line.rationale}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 핵심 이의 대응 */}
                <div className="mb-8 p-6 bg-red-50 rounded-lg border-2 border-red-200">
                  <h3 className="text-lg font-bold text-red-700 mb-3">⚡ 핵심 이의 대응</h3>
                  <p className="text-gray-900 text-base leading-relaxed">{script.rebuttal}</p>
                </div>

                {/* 퍼널 단계 */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Russell Brunson 퍼널 단계</h3>
                  <div className="flex flex-wrap gap-2">
                    {script.funnelSteps.map((step) => (
                      <span
                        key={step}
                        className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full font-semibold text-sm"
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 팁 */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                  <h3 className="font-bold text-yellow-900 mb-2">💡 팁</h3>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>
                      • <strong>오프닝 라인은 순서대로</strong> 고객 반응을 보며 사용하세요.
                    </li>
                    <li>
                      • 첫 라인이 먹히지 않으면 다음 라인으로 넘어가세요 (A/B 테스트).
                    </li>
                    <li>
                      • 핵심 이의 대응은 고객의 반박에 대한 최종 무기입니다.
                    </li>
                    <li>
                      • 퍼널 단계를 의식하며 진행하면 클로징 확률이 40% 이상 높아집니다.
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <p className="text-gray-600 text-lg">상황을 선택하면 스크립트가 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
