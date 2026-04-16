"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Phone, BookOpen, User, Copy, Check, Loader2, Upload, FileText } from "lucide-react";

type Template = { id: string; category: string; title: string; content: string; triggerOffset: number | null };
type Playbook  = { id: string; type: string; title: string; content: string; priority: number };

type FeedbackResult = {
  score: number; grade: string; summary: string;
  strengths: string[]; improvements: string[];
  convictionScore: number; nextAction: string; followUpSms: string;
  details: Record<string, { score: number; comment: string }>;
  personaType?: string;
  personaConfidence?: number;
  objectionTypes?: string[];
};

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
  const [mainTab,  setMainTab]   = useState<"sms" | "playbook" | "call-feedback">("sms");
  const [smsTab,   setSmsTab]    = useState("CARE_VIP");
  const [pbTab,    setPbTab]     = useState("REJECTION");

  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [playbooks,  setPlaybooks]  = useState<Playbook[]>([]);
  const [copied,     setCopied]     = useState<string | null>(null);

  // 콜 피드백
  const [callText,    setCallText]   = useState("");
  const [analyzing,   setAnalyzing]  = useState(false);
  const [feedback,    setFeedback]   = useState<FeedbackResult | null>(null);
  const [feedbackErr, setFeedbackErr] = useState("");
  const [converted,   setConverted]  = useState<boolean | null>(null);
  const [productType, setProductType] = useState<'GOLD' | 'GENERAL'>('GOLD');

  useEffect(() => {
    fetch("/api/tools/sms-templates")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTemplates(d.templates); });
    fetch("/api/tools/playbook")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPlaybooks(d.items); });
  }, []);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

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
    setAnalyzing(false);
  };

  const filteredTemplates = templates.filter((t) => t.category === smsTab);
  const filteredPlaybooks  = playbooks.filter((p) => p.type === pbTab);

  const scoreColor = (s: number) =>
    s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-navy-900 mb-5">영업 도구함</h1>

      {/* 메인 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {[
          { key: "sms",           label: "📱 문자 템플릿" },
          { key: "playbook",      label: "📖 세일즈 플레이북" },
          { key: "call-feedback", label: "📞 콜 피드백 AI" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key as typeof mainTab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mainTab === t.key ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SMS 템플릿 */}
      {mainTab === "sms" && (
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
                        <span className="text-xs px-2 py-0.5 bg-navy-100 text-navy-900 rounded-full">
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
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">템플릿이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 세일즈 플레이북 */}
      {mainTab === "playbook" && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {PLAYBOOK_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setPbTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  pbTab === t.key
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                }`}
              >
                {t.label} ({playbooks.filter((p) => p.type === t.key).length})
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredPlaybooks
              .sort((a, b) => a.priority - b.priority)
              .map((pb) => (
                <div key={pb.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">{pb.title}</h3>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
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
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            {filteredPlaybooks.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">항목이 없습니다.</p>
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
              <p className="text-xs text-gray-400">{callText.length.toLocaleString()} / 20,000자</p>
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
                  <p className="text-gray-400 text-xs mt-1">/ 100점</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{feedback.grade}등급</p>
                  <p className="text-gray-300 text-sm mt-1">{feedback.summary}</p>
                  <p className="text-gold-300 text-sm mt-2">확신척도 {feedback.convictionScore}/10</p>
                  {feedback.personaType && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
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
                        <span className="text-gray-400 text-xs">신뢰도 {feedback.personaConfidence}%</span>
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
                        <p className="text-xs text-gray-400 mt-1">{d.comment}</p>
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
                    {copied === "followup" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
