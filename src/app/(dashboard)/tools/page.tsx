"use client";

import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Phone, BookOpen, User, Copy, Check, Loader2, Upload, FileText, BookMarked, ExternalLink,
  Zap, TrendingUp, Users, Search, Filter, Star, Clock, AlertCircle
} from "lucide-react";

// 동적 import: 초기 로드에서 제외
const CompressorModal = lazy(() => import("@/components/ui/CompressorModal").then(mod => ({ default: mod.CompressorModal })));
const QaLibrary = lazy(() => import("@/components/tools/QaLibrary").then(mod => ({ default: mod.QaLibrary })));
import { SkeletonCard, SkeletonTrainingCard, SkeletonRecommendationCard } from "./components/SkeletonLoader";

type Template = { id: string; category: string; title: string; content: string; triggerOffset: number | null };
type Playbook  = { id: string; type: string; title: string; content: string; priority: number; customerSegment?: string };
type ProductTraining = { id: string; category: string; title: string; description: string; icon: string; content: string; lastViewed?: string };
type ToolRecommendation = { toolId: string; title: string; category: string; reason: string; relevance: number };

type FeedbackResult = {
  score: number; grade: string; summary: string;
  strengths: string[]; improvements: string[];
  convictionScore: number; nextAction: string; followUpSms: string;
  details: Record<string, { score: number; comment: string }>;
  personaType?: string;
  personaConfidence?: number;
  objectionTypes?: string[];
};

const PRODUCT_CATEGORIES = [
  { key: "ALL",            label: "전체", icon: "🎯" },
  { key: "BUSAN",          label: "부산출도착", icon: "⚓" },
  { key: "JAPAN",          label: "일본크루즈", icon: "🗾" },
  { key: "SOUTHEAST_ASIA", label: "동남아크루즈", icon: "🌴" },
  { key: "MEDITERRANEAN",  label: "지중해크루즈", icon: "🏛️" },
  { key: "ALASKA",         label: "알래스카크루즈", icon: "🧊" },
  { key: "CRUISE_SERVICE", label: "선내서비스", icon: "🛳️" },
];

const CALL_SCRIPT_PERSONAS = [
  { key: "PRICE_SENSITIVE",      label: "저가민감", icon: "💰" },
  { key: "FILIAL_DUTY",          label: "효도여행", icon: "👨‍👩‍👧" },
  { key: "NEWLYWEDS",            label: "신혼부부", icon: "💑" },
  { key: "SINGLE_ADVENTURE",     label: "혼자여행", icon: "🧳" },
  { key: "REPURCHASE",           label: "재구매", icon: "🔄" },
];

const TEMPLATE_TABS = [
  { key: "CARE_VIP",      label: "VIP 케어" },
  { key: "SEQUENCE",      label: "시퀀스" },
  { key: "LIVE_BROADCAST", label: "라이브" },
];

const PLAYBOOK_TABS = [
  { key: "REJECTION",    label: "거절대응" },
  { key: "RECONTACT",    label: "재접촉" },
  { key: "CLOSING",      label: "클로징" },
  { key: "PERSONA",      label: "페르소나" },
  { key: "SUCCESS_CASE", label: "성공사례" },
  { key: "FORBIDDEN",    label: "금지어" },
  { key: "OPENING",      label: "오프닝" },
  { key: "NEEDS",        label: "니즈발굴" },
];

export default function ToolsPage() {
  const searchParams = useSearchParams();
  const [showCompressor, setShowCompressor] = useState(false);
  const [mainTab,  setMainTab]   = useState<"dashboard" | "training" | "scripts" | "playbook" | "feedback" | "qa" | "call-feedback" | "call-playbook" | "sms-templates">("dashboard");

  const [productCategory, setProductCategory] = useState("ALL");
  const [scriptPersona,   setScriptPersona]   = useState("PRICE_SENSITIVE");
  const [smsTab,         setSmsTab]          = useState("CARE_VIP");
  const [pbTab,          setPbTab]           = useState("REJECTION");

  const [searchQuery,    setSearchQuery]    = useState("");
  const [recommendations, setRecommendations] = useState<ToolRecommendation[]>([]);

  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [playbooks,  setPlaybooks]  = useState<Playbook[]>([]);
  const [training,   setTraining]   = useState<ProductTraining[]>([]);
  const [copied,     setCopied]     = useState<string | null>(null);

  // 로딩 상태
  const [isLoading, setIsLoading]   = useState(true);

  // 콜 피드백
  const [callText,    setCallText]   = useState("");
  const [analyzing,   setAnalyzing]  = useState(false);
  const [feedback,    setFeedback]   = useState<FeedbackResult | null>(null);
  const [feedbackErr, setFeedbackErr] = useState("");
  const [converted,   setConverted]  = useState<boolean | null>(null);
  const [productType, setProductType] = useState<'GOLD' | 'GENERAL'>('GOLD');

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "qa") {
      setMainTab("qa");
    }
  }, [searchParams]);

  useEffect(() => {
    setIsLoading(true);
    // 모든 도구 데이터 로드 (병렬)
    Promise.all([
      fetch("/api/tools/sms-templates")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setTemplates(d.templates); })
        .catch(() => {}),
      fetch("/api/tools/playbook")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setPlaybooks(d.items); })
        .catch(() => {}),
      fetch("/api/tools/product-training")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setTraining(d.items); })
        .catch(() => {}),
      fetch("/api/tools/recommended")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setRecommendations(d.recommendations); })
        .catch(() => {}),
    ]).finally(() => setIsLoading(false));
  }, []);

  // 도구 조회 기록 (마지막 본 도구 추적)
  const trackToolView = async (toolId: string) => {
    try {
      await fetch("/api/tools/viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId }),
      });
    } catch {}
  };

  const copy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCallText(ev.target?.result as string); };
    reader.readAsText(file, "utf-8");
  };

  const analyze = async () => {
    if (!callText.trim()) return;
    setAnalyzing(true);
    setFeedback(null);
    setFeedbackErr("");
    try {
      const res  = await fetch("/api/tools/call-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: callText, converted: converted ?? false, productType }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(data.result);
      } else {
        setFeedbackErr(data.message ?? "분석 실패");
      }
    } catch {
      setFeedbackErr("네트워크 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredTemplates = useMemo(() => templates.filter((t) => t.category === smsTab), [templates, smsTab]);

  const filteredPlaybooks = useMemo(() => playbooks.filter((p) => p.type === pbTab), [playbooks, pbTab]);

  const filteredTraining = useMemo(() => {
    let result = training.filter((t) =>
      productCategory === "ALL" || t.category === productCategory
    );
    if (searchQuery) {
      result = result.filter((t) =>
        t.title.includes(searchQuery) || t.description.includes(searchQuery)
      );
    }
    return result;
  }, [training, productCategory, searchQuery]);

  const filteredScripts = useMemo(() =>
    playbooks
      .filter((p) => p.type === scriptPersona || p.customerSegment === scriptPersona)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5),
    [playbooks, scriptPersona]
  );

  const scoreColor = useCallback((s: number) =>
    s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-600" : "text-red-500",
    []
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 + 추천 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">영업 도구함</h1>
        <p className="text-sm text-gray-600">고객 상태별 맞춤 콘텐츠 추천 + 심리학 렌즈 기반 자동화</p>
      </div>

      {/* 만능 압축기 */}
      <button
        onClick={() => setShowCompressor(true)}
        className="flex items-center gap-3 w-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl px-4 py-3.5 hover:from-blue-100 hover:to-blue-200 transition-colors text-left mb-6"
      >
        <span className="text-2xl">🗜️</span>
        <div className="flex-1">
          <p className="font-semibold text-sm text-gray-900">만능 압축기</p>
          <p className="text-sm text-gray-600">이미지·PDF·WebP·음성 파일 압축</p>
        </div>
        <div className="text-sm font-medium text-blue-600">바로가기 →</div>
      </button>

      {showCompressor && (
        <Suspense fallback={<div className="text-center py-8">로딩 중...</div>}>
          <CompressorModal isOpen={showCompressor} onClose={() => setShowCompressor(false)} />
        </Suspense>
      )}

      {/* 메인 탭 - 50대 친화형 대형 버튼 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { key: "dashboard",      label: "대시보드", icon: "📊", desc: "추천 도구" },
          { key: "training",       label: "상품교육", icon: "📚", desc: "5가지 상품" },
          { key: "scripts",        label: "콜스크립트", icon: "🎤", desc: "페르소나별" },
          { key: "playbook",       label: "플레이북", icon: "📖", desc: "8가지 상황" },
          { key: "call-feedback",  label: "콜분석", icon: "🔊", desc: "AI 피드백" },
          { key: "sms-templates",  label: "SMS템플릿", icon: "📱", desc: "문자 템플릿" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key as typeof mainTab)}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              mainTab === t.key
                ? "bg-navy-900 border-navy-900 text-white shadow-lg"
                : "bg-white border-gray-200 text-gray-900 hover:border-navy-900 hover:bg-navy-50"
            }`}
          >
            <div className="text-2xl mb-1">{t.icon}</div>
            <p className="font-bold text-sm">{t.label}</p>
            <p className={`text-xs ${mainTab === t.key ? "text-navy-200" : "text-gray-500"}`}>{t.desc}</p>
          </button>
        ))}
      </div>

      {/* 추천 도구 (대시보드 + 다른 탭) */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-amber-900">🎯 AI 추천</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <SkeletonRecommendationCard />
              <SkeletonRecommendationCard />
              <SkeletonRecommendationCard />
            </>
          ) : recommendations.length > 0 ? (
            recommendations.slice(0, 3).map((rec) => (
              <button
                key={rec.toolId}
                onClick={() => {
                  setMainTab(rec.category as any);
                  trackToolView(rec.toolId);
                }}
                className="bg-white p-3 rounded-lg text-left border border-amber-100 hover:border-amber-300 hover:shadow transition-all"
              >
                <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                <p className="text-xs text-gray-600 mt-1">{rec.reason}</p>
                <div className="mt-2 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-600 font-medium">{rec.relevance}% 관련도</span>
                </div>
              </button>
            ))
          ) : null}
        </div>
      </div>

      {/* 대시보드 - 최근 본 도구 + 인기 도구 */}
      {mainTab === "dashboard" && (
        <div className="space-y-6">
          {/* 빠른 접근 */}
          <div>
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-navy-900" />
              자주 쓰는 도구
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.slice(0, 2).map((rec) => (
                <button
                  key={rec.toolId}
                  onClick={() => {
                    setMainTab(rec.category as any);
                    trackToolView(rec.toolId);
                  }}
                  className="bg-white p-4 rounded-xl border-2 border-gray-200 hover:border-navy-900 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{rec.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{rec.reason}</p>
                    </div>
                    <div className="text-right text-xs font-medium text-navy-900 bg-navy-50 px-2 py-1 rounded">
                      {rec.relevance}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 탐색 */}
          <div>
            <h2 className="font-bold text-gray-900 mb-3">도구 탐색</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { icon: "📚", label: "상품교육", tab: "training" as const, href: null },
                { icon: "🎤", label: "콜스크립트", tab: "scripts" as const, href: null },
                { icon: "📖", label: "플레이북", tab: "playbook" as const, href: null },
                { icon: "📱", label: "SMS템플릿", tab: "sms-templates" as const, href: null },
                { icon: "❓", label: "Q&A", tab: "qa" as const, href: null },
                { icon: "🔊", label: "콜분석", tab: "call-feedback" as const, href: null },
                { icon: "🔍", label: "키워드검색량", tab: null, href: "/tools/keyword-volume" },
              ].map((cat) =>
                cat.href ? (
                  <Link
                    key={cat.label}
                    href={cat.href}
                    className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-center block"
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                    <p className="text-xs text-blue-500 mt-0.5">네이버/구글</p>
                  </Link>
                ) : (
                  <button
                    key={cat.label}
                    onClick={() => setMainTab(cat.tab!)}
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-navy-900 hover:bg-navy-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                  </button>
                )
              )}
            </div>
          </div>

          {/* 팁 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 text-sm">💡 팁: 위 탭에서 도구를 선택하면 AI가 다음에 필요할 만한 도구를 추천합니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상품 교육 */}
      {mainTab === "training" && (
        <div className="space-y-4">
          {/* 상품 필터 */}
          <div className="flex gap-2 flex-wrap">
            {PRODUCT_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setProductCategory(cat.key)}
                className={`px-3 py-1.5 text-sm rounded-full border-2 transition-colors font-medium ${
                  productCategory === cat.key
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="상품명, 기능 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-navy-900"
            />
          </div>

          {/* 상품 교육 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              <>
                <SkeletonTrainingCard />
                <SkeletonTrainingCard />
                <SkeletonTrainingCard />
                <SkeletonTrainingCard />
              </>
            ) : (
              filteredTraining.map((item) => (
                <div
                  key={item.id}
                  onClick={() => trackToolView(item.id)}
                  className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-navy-900 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      {item.lastViewed && (
                        <p className="text-xs text-gray-500 mt-0.5">마지막 본 시간: {item.lastViewed}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                  <button
                    onClick={() => copy(item.id, item.content)}
                    className="w-full py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors flex items-center justify-center gap-2"
                  >
                    {copied === item.id ? (
                      <>
                        <Check className="w-4 h-4" /> 복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> 자료 복사
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {filteredTraining.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>상품교육 자료를 준비 중입니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 콜 스크립트 */}
      {mainTab === "scripts" && (
        <div className="space-y-4">
          {/* 페르소나 필터 */}
          <div className="flex gap-2 flex-wrap">
            {CALL_SCRIPT_PERSONAS.map((persona) => (
              <button
                key={persona.key}
                onClick={() => setScriptPersona(persona.key)}
                className={`px-3 py-1.5 text-sm rounded-full border-2 transition-colors font-medium ${
                  scriptPersona === persona.key
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                }`}
              >
                {persona.icon} {persona.label}
              </button>
            ))}
          </div>

          {/* 스크립트 카드 */}
          <div className="space-y-3">
            {filteredScripts.map((script) => (
              <div key={script.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-navy-900 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{script.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{CALL_SCRIPT_PERSONAS.find(p => p.key === scriptPersona)?.label ?? "스크립트"}</p>
                  </div>
                  <button
                    onClick={() => copy(script.id, script.content)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {copied === script.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 p-3 rounded-lg max-h-24 overflow-hidden">
                  {script.content}
                </pre>
              </div>
            ))}
          </div>

          {filteredScripts.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <p>{CALL_SCRIPT_PERSONAS.find(p => p.key === scriptPersona)?.label} 스크립트를 준비 중입니다.</p>
              <p className="mt-1">플레이북에서 다른 유형을 확인해보세요.</p>
            </div>
          )}

          {/* 전체 플레이북으로 이동 */}
          <button
            onClick={() => setMainTab("playbook")}
            className="w-full py-3 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            전체 플레이북 보기 ({playbooks.length}개)
          </button>
        </div>
      )}

      {/* SMS 템플릿 */}
      {mainTab === "sms-templates" && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {TEMPLATE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setSmsTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  smsTab === t.key
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                }`}
              >
                {t.label} ({templates.filter((t2) => t2.category === t.key).length})
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredTemplates.map((tpl) => (
              <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">{tpl.title}</h3>
                      {tpl.triggerOffset !== null && (
                        <span className="text-sm px-2 py-0.5 bg-navy-100 text-navy-900 rounded-full">
                          {tpl.triggerOffset < 0 ? `D${tpl.triggerOffset}` : tpl.triggerOffset === 0 ? "D-day" : `D+${tpl.triggerOffset}`}
                        </span>
                      )}
                    </div>
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-hidden">
                      {tpl.content}
                    </pre>
                  </div>
                  <button
                    onClick={() => copy(tpl.id, tpl.content)}
                    className="p-2 hover:bg-gray-100 rounded-lg shrink-0"
                    title="복사"
                  >
                    {copied === tpl.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-center text-gray-600 py-8 text-sm">템플릿이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 세일즈 플레이북 */}
      {mainTab === "playbook" && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {PLAYBOOK_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPbTab(t.key)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    pbTab === t.key
                      ? "bg-navy-900 text-white border-navy-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                  }`}
                >
                  {t.label} ({playbooks.filter((p) => p.type === t.key).length})
                </button>
              ))}
            </div>
            <button
              onClick={() => window.open('/tools/playbook-viewer', '_blank', 'width=1400,height=900')}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors whitespace-nowrap"
              title="새 창에서 전체 플레이북 뷰어 열기"
            >
              <BookMarked className="w-4 h-4" />
              전체 플레이북 ↗
            </button>
          </div>

          <div className="space-y-3">
            {filteredPlaybooks
              .sort((a, b) => a.priority - b.priority)
              .slice(0, 5)
              .map((pb) => (
                <div key={pb.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">{pb.title}</h3>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed line-clamp-3">
                        {pb.content}
                      </pre>
                    </div>
                    <button
                      onClick={() => copy(pb.id, pb.content)}
                      className="p-2 hover:bg-gray-100 rounded-lg shrink-0"
                    >
                      {copied === pb.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            {filteredPlaybooks.length > 5 && (
              <button
                onClick={() => window.open('/tools/playbook-viewer', '_blank', 'width=1400,height=900')}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                모두 보기 ({filteredPlaybooks.length}개)
              </button>
            )}
            {filteredPlaybooks.length === 0 && (
              <p className="text-center text-gray-600 py-8 text-sm">항목이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 콜 피드백 AI */}
      {mainTab === "call-feedback" && (
        <div className="space-y-4">
          {/* 입력 영역 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">통화 내용 입력</h3>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm cursor-pointer hover:bg-gray-200">
                <Upload className="w-4 h-4 text-gray-500" />
                TXT 파일 업로드
                <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {/* 상품 유형 */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setProductType('GOLD')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${productType === 'GOLD' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 text-gray-600'}`}>
                ⭐ 골드 멤버십
              </button>
              <button onClick={() => setProductType('GENERAL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${productType === 'GENERAL' ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600'}`}>
                🚢 일반 크루즈
              </button>
            </div>
            {/* 성약 여부 */}
            <div className="flex gap-2 mb-3">
              <span className="text-sm text-gray-500 self-center">성약:</span>
              <button onClick={() => setConverted(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${converted === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600'}`}>
                ✅ 성공
              </button>
              <button onClick={() => setConverted(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${converted === false ? 'bg-red-400 text-white border-red-400' : 'border-gray-200 text-gray-600'}`}>
                ❌ 미성약
              </button>
            </div>
            <textarea
              value={callText}
              onChange={(e) => setCallText(e.target.value)}
              placeholder="통화 녹취 텍스트를 붙여넣거나 TXT 파일을 업로드하세요..."
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">{callText.length.toLocaleString()} / 20,000자</p>
              <button
                onClick={analyze}
                disabled={analyzing || !callText.trim()}
                className="flex items-center gap-2 bg-navy-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
              >
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
                ) : (
                  <><Phone className="w-4 h-4" /> AI 분석 시작</>
                )}
              </button>
            </div>
          </div>

          {feedbackErr && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{feedbackErr}</p>
          )}

          {/* 결과 */}
          {feedback && (
            <div className="space-y-3">
              {/* 종합 점수 */}
              <div className="bg-navy-900 text-white rounded-xl p-5 flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-5xl font-black ${
                    feedback.score >= 80 ? "text-green-400" : feedback.score >= 60 ? "text-yellow-400" : "text-red-400"
                  }`}>{feedback.score}</p>
                  <p className="text-gray-600 text-sm mt-1">/ 100점</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{feedback.grade}등급</p>
                  <p className="text-gray-300 text-sm mt-1">{feedback.summary}</p>
                  <p className="text-gold-300 text-sm mt-2">확신척도 {feedback.convictionScore}/10</p>
                  {feedback.personaType && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        feedback.personaType === 'FILIAL_DUTY'       ? 'bg-purple-600 text-white' :
                        feedback.personaType === 'NEWLYWEDS'         ? 'bg-pink-500 text-white' :
                        feedback.personaType === 'SINGLE_ADVENTURE'  ? 'bg-sky-500 text-white' :
                        feedback.personaType === 'RETIRED_LEISURE'   ? 'bg-green-500 text-white' :
                        feedback.personaType === 'PRICE_SENSITIVE'   ? 'bg-orange-500 text-white' :
                                                                       'bg-gray-500 text-white'
                      }`}>
                        {feedback.personaType === 'FILIAL_DUTY'      ? '👨‍👩‍👧 효도 여행' :
                         feedback.personaType === 'NEWLYWEDS'        ? '💑 신혼부부' :
                         feedback.personaType === 'SINGLE_ADVENTURE' ? '🧳 혼자 여행' :
                         feedback.personaType === 'RETIRED_LEISURE'  ? '🌿 은퇴 여유' :
                         feedback.personaType === 'PRICE_SENSITIVE'  ? '💰 가격 민감' :
                         feedback.personaType}
                      </span>
                      {feedback.personaConfidence !== undefined && (
                        <span className="text-gray-600 text-sm">신뢰도 {feedback.personaConfidence}%</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 단계별 점수 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">단계별 평가</h4>
                <div className="space-y-3">
                  {Object.entries({
                    opening: "오프닝",
                    needsDiscovery: "니즈발굴",
                    objectionHandling: "거절대응",
                    closing: "클로징",
                    emotionalTouch: "감정터치",
                  }).map(([key, label]) => {
                    const d = feedback.details[key];
                    if (!d) return null;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{label}</span>
                          <span className={`font-bold ${scoreColor(d.score)}`}>{d.score}점</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${d.score >= 80 ? "bg-green-400" : d.score >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: `${d.score}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{d.comment}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 잘한 점 / 개선점 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="font-semibold text-green-800 mb-2">✅ 잘한 점</h4>
                  <ul className="space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-700">• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="font-semibold text-red-800 mb-2">💡 개선할 점</h4>
                  <ul className="space-y-1">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-red-700">• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 다음 액션 + 추천 문자 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">다음 액션</h4>
                <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{feedback.nextAction}</p>
                <h4 className="font-semibold text-gray-900 mt-3 mb-2">추천 후속 문자</h4>
                <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700 flex-1">{feedback.followUpSms}</p>
                  <button onClick={() => copy("followup", feedback.followUpSms)} className="p-1.5 hover:bg-gray-200 rounded-lg shrink-0">
                    {copied === "followup" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 콜 플레이북 */}
      {mainTab === "call-playbook" && (
        <div className="space-y-6">
          {/* 헤더 + 새창 열기 */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-navy-900">콜 플레이북 라이브러리</h2>
              <p className="text-sm text-gray-600">신민형 5단계 + 모니카 욕망 증폭 원칙</p>
            </div>
            <a
              href="/tools/playbook-viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2 font-medium whitespace-nowrap"
            >
              새창 열기 <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* 팁 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              💡 <strong>팁:</strong> "새창 열기"를 클릭하여 전체 화면 모드에서 모든 스크립트를 탐색하세요. Phase, 고객 세그먼트, 심리학 이론별로 필터링할 수 있습니다.
            </p>
          </div>

          {/* 스크린샷/소개 */}
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <BookOpen className="w-12 h-12 text-navy-900 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-navy-900 mb-2">
              {playbooks.filter(p => p.type !== "OPENING").length || "60+"}개의 검증된 콜 스크립트
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              신민형 5단계 통합 스크립트 + 모니카 욕망 증폭 원칙 + 심리학 이론(손실회피, 사회적증거, 내러티브, 희소성, 약속의일관성)을 모두 포함한 최고품질 플레이북 라이브러리.
            </p>
          </div>
        </div>
      )}

      {/* Q&A 라이브러리 */}
      {mainTab === "qa" && (
        <Suspense fallback={<div className="text-center py-8">Q&A 라이브러리 로딩 중...</div>}>
          <div className="space-y-4">
            <QaLibrary />
          </div>
        </Suspense>
      )}
    </div>
  );
}
