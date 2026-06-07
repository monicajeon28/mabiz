"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, Eye, EyeOff,
  ChevronUp, ChevronDown, MessageSquare, Zap, Link2, Check, Wand2, Users
} from "lucide-react";
import { showError } from "@/components/ui/Toast";

type Stage = {
  id?:            string;
  order:          number;
  name:           string;
  triggerType:    "DAYS_AFTER" | "DDAY";
  triggerOffset:  number;
  channel:        string;
  messageContent: string;
  linkUrl:        string;
};

const VARS = ["[고객명]", "[이름]", "[출발일]", "[링크]"];

const CHANNEL_OPTIONS = [
  { value: "SMS",   label: "SMS",    icon: "\u{1F4F1}", color: "bg-green-100 text-green-700" },
  { value: "EMAIL", label: "\uC774\uBA54\uC77C", icon: "\u{1F4E7}", color: "bg-blue-100 text-blue-700" },
  { value: "KAKAO", label: "\uCE74\uCE74\uC624", icon: "\u{1F4AC}", color: "bg-yellow-100 text-yellow-700" },
] as const;

const channelInfo = (ch: string) => CHANNEL_OPTIONS.find((c) => c.value === ch) || CHANNEL_OPTIONS[0];

const triggerLabel = (s: Stage) => {
  if (s.triggerType === "DDAY") {
    if (s.triggerOffset < 0)  return `D${s.triggerOffset}`;
    if (s.triggerOffset === 0) return "D-day";
    return `D+${s.triggerOffset}`;
  }
  return s.triggerOffset === 0 ? "등록 즉시" : `등록 후 ${s.triggerOffset}일`;
};

const EMPTY_STAGE = (order: number): Stage => ({
  order, name: "", triggerType: "DAYS_AFTER", triggerOffset: order,
  channel: "SMS", messageContent: "", linkUrl: "",
});

export default function FunnelEditPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [isActive,    setIsActive]    = useState(true);
  const [stages,      setStages]      = useState<Stage[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");
  const [expandedIdx,   setExpandedIdx]   = useState<number | null>(null);
  const [previewIdx,    setPreviewIdx]    = useState<number | null>(null);
  const [shortlinking,  setShortlinking]  = useState<number | null>(null); // 숏링크 생성 중인 stage idx
  const [copiedLink,    setCopiedLink]    = useState<number | null>(null);
  const [showEnroll,    setShowEnroll]    = useState(false);

  // 긴 URL → 자동 숏링크 생성 후 linkUrl에 적용
  const makeShortLink = async (idx: number, rawUrl: string) => {
    if (!rawUrl.trim()) return;
    // 이미 숏링크면 스킵
    if (rawUrl.includes('/l/')) { showError('이미 숏링크입니다'); return; }
    setShortlinking(idx);
    try {
      const res = await fetch('/api/links', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetUrl: rawUrl, title: stages[idx]?.name || '퍼널 링크' }),
      });
      const d = await res.json() as { ok: boolean; shortUrl?: string };
      if (!d.ok || !d.shortUrl) throw new Error();
      updateStage(idx, 'linkUrl', d.shortUrl);
    } catch { showError('숏링크 생성 실패'); }
    finally { setShortlinking(null); }
  };

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/funnels/${id}`);
      const data = await res.json();
      if (data.ok) {
        setName(data.funnel.name ?? "");
        setDescription(data.funnel.description ?? "");
        setIsActive(data.funnel.isActive ?? true);
        setStages(
          (data.funnel.stages ?? []).map((s: Stage) => ({
            ...s,
            messageContent: s.messageContent ?? "",
            linkUrl:        s.linkUrl        ?? "",
          }))
        );
      }
    } catch {
      // 네트워크 오류 등 — 로딩 스피너가 무한히 유지되는 것을 방지
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!name.trim()) { setSaveMsg("퍼널 이름을 입력하세요."); return; }
    setSaving(true);
    setSaveMsg("");

    try {
      // 1. 퍼널 기본 정보
      await fetch(`/api/funnels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isActive }),
      });

      // 2. 스테이지 전체 저장
      const res  = await fetch(`/api/funnels/${id}/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: stages.map((s, i) => ({ ...s, order: i })) }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMsg("✅ 저장됐습니다!");
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        setSaveMsg("❌ 저장 실패");
      }
    } catch {
      // 네트워크 오류 등 — 저장 버튼이 영구 비활성화되는 것을 방지
      setSaveMsg("❌ 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const updateStage = (idx: number, key: keyof Stage, value: string | number) => {
    setStages((prev) => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  };

  const insertVar = (idx: number, v: string) => {
    setStages((prev) => prev.map((s, i) =>
      i === idx ? { ...s, messageContent: s.messageContent + v } : s
    ));
  };

  const addStage = () => {
    setStages((prev) => {
      const next = [...prev, EMPTY_STAGE(prev.length)];
      setExpandedIdx(next.length - 1);
      return next;
    });
  };

  const removeStage = (idx: number) => {
    setStages((prev) => prev.filter((_, i) => i !== idx));
    setExpandedIdx(null);
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= stages.length) return;
    setStages((prev) => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  };

  if (loading) return <div className="h-screen bg-gray-50 animate-pulse" />;

  const completedCount = stages.filter((s) => s.messageContent.trim()).length;
  const totalCount     = stages.length;

  return (
    <div className={`min-h-screen bg-gray-50 ${showEnroll ? 'overflow-hidden' : ''}`}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="퍼널 이름"
            className="w-full text-base font-bold bg-transparent outline-none text-navy-900 truncate"
          />
          <p className="text-xs text-gray-400 mt-0.5">
            {completedCount}/{totalCount} 스테이지 메시지 작성됨
            {completedCount < totalCount && (
              <span className="text-orange-500 ml-1">— 미작성 시 발송 스킵됨</span>
            )}
          </p>
        </div>
        {/* 활성/비활성 토글 */}
        <button
          onClick={() => setIsActive(!isActive)}
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {isActive ? "✅ 활성" : "비활성"}
        </button>
        {saveMsg && (
          <span className={`text-xs font-medium ${saveMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
            {saveMsg}
          </span>
        )}
        <button
          onClick={() => setShowEnroll(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800"
        >
          <Users className="w-4 h-4" />
          고객 등록
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {/* 설명 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="퍼널 설명 (선택)"
            className="w-full text-sm text-gray-600 bg-transparent outline-none"
          />
        </div>

        {/* 사용 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <p className="font-semibold mb-1">⚡ 퍼널 동작 방식</p>
          <p>• <strong>DAYS_AFTER</strong>: 그룹 배정 후 N일째 발송</p>
          <p>• <strong>D-day</strong>: 출발일 기준 D-N에 발송 (고객 출발일 필수)</p>
          <p>• 치환변수: [고객명] [이름] [출발일] → 실제 값으로 자동 변환</p>
          <p>• 메시지 미작성 스테이지는 <span className="text-red-600 font-bold">자동으로 건너뜁니다</span></p>
        </div>

        {/* 스테이지 목록 */}
        {stages.map((stage, idx) => {
          const isOpen    = expandedIdx === idx;
          const hasMsgContent = stage.messageContent.trim().length > 0;
          const isPreview = previewIdx === idx;

          return (
            <div
              key={idx}
              className={`bg-white border rounded-xl overflow-hidden transition-all ${
                hasMsgContent ? "border-gray-200" : "border-orange-200"
              }`}
            >
              {/* 스테이지 헤더 */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => setExpandedIdx(isOpen ? null : idx)}
              >
                {/* 순서 이동 */}
                <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => moveStage(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveStage(idx, 1)}
                    disabled={idx === stages.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* 트리거 뱃지 */}
                <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${
                  stage.triggerType === "DDAY"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {triggerLabel(stage)}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {stage.name || <span className="text-gray-400">스테이지 이름 없음</span>}
                  </p>
                  {hasMsgContent ? (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {channelInfo(stage.channel).icon} {stage.messageContent.slice(0, 40)}...
                    </p>
                  ) : (
                    <p className="text-xs text-orange-500 mt-0.5 font-medium">⚠️ 메시지 미작성</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <MessageSquare className={`w-4 h-4 ${hasMsgContent ? "text-green-400" : "text-gray-200"}`} />
                  <button
                    onClick={() => removeStage(idx)}
                    className="p-1 text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 스테이지 편집 폼 */}
              {isOpen && (
                <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                  {/* 이름 */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">스테이지 이름</label>
                    <input
                      value={stage.name}
                      onChange={(e) => updateStage(idx, "name", e.target.value)}
                      placeholder="예: D-90 브이로그 공유"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  {/* 트리거 설정 + 채널 선택 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">트리거 유형</label>
                      <select
                        value={stage.triggerType}
                        onChange={(e) => updateStage(idx, "triggerType", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none"
                      >
                        <option value="DAYS_AFTER">등록 후 N일</option>
                        <option value="DDAY">D-day 기준</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">
                        {stage.triggerType === "DDAY" ? "D± 숫자 (음수=출발 전)" : "등록 후 일수"}
                      </label>
                      <input
                        type="number"
                        value={stage.triggerOffset}
                        onChange={(e) => updateStage(idx, "triggerOffset", parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">발송 채널</label>
                      <select
                        value={stage.channel}
                        onChange={(e) => updateStage(idx, "channel", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none"
                      >
                        {CHANNEL_OPTIONS.map((ch) => (
                          <option key={ch.value} value={ch.value}>
                            {ch.icon} {ch.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 메시지 작성 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">
                        {channelInfo(stage.channel).icon} {channelInfo(stage.channel).label} 메시지
                      </label>
                      <button
                        onClick={() => setPreviewIdx(isPreview ? null : idx)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                      >
                        {isPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {isPreview ? "편집" : "미리보기"}
                      </button>
                    </div>

                    {isPreview ? (() => {
                      // useMemo 제거 — 루프 안 Hook 호출은 Rules of Hooks 위반
                      const previewText = (stage.messageContent || "(메시지 없음)")
                        .replace(/\[고객명\]/g, "김민준")
                        .replace(/\[이름\]/g,   "김민준")
                        .replace(/\[출발일\]/g, "2025.09.15")
                        .replace(/\[링크\]/g,   "https://cruisedot.co.kr");
                      return (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-sm text-green-600 font-medium mb-2">{channelInfo(stage.channel).icon} {channelInfo(stage.channel).label} 미리보기 (예시 고객: 김민준)</p>
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {previewText}
                          </p>
                        </div>
                        <p className="text-sm text-gray-400 mt-2 text-right">
                          {stage.messageContent.length}자 (90자 초과 시 장문 요금)
                        </p>
                      </div>
                      );
                    })() : (
                      /* 편집 */
                      <>
                        {/* 치환변수 칩 */}
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {VARS.map((v) => (
                            <button
                              key={v}
                              onClick={() => insertVar(idx, v)}
                              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100"
                            >
                              <Zap className="w-2.5 h-2.5" /> {v}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={stage.messageContent}
                          onChange={(e) => updateStage(idx, "messageContent", e.target.value)}
                          placeholder="예: [고객명]님, 안녕하세요! 크루즈닷입니다.&#10;출발이 90일 앞으로 다가왔어요. 🚢&#10;지금 브이로그로 설레는 여행을 미리 체험해보세요!"
                          rows={5}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold-500"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${stage.channel === "SMS" && stage.messageContent.length > 90 ? "text-orange-500" : "text-gray-400"}`}>
                            {stage.messageContent.length}자
                            {stage.channel === "SMS"
                              ? stage.messageContent.length > 90 ? " (장문 SMS)" : " (단문)"
                              : stage.channel === "EMAIL" ? " (이메일)" : " (카카오)"}
                          </p>
                          <p className="text-xs text-gray-400">미리보기 버튼으로 확인 권장</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 링크 URL — 자동 숏링크 */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> [링크] 치환 URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={stage.linkUrl}
                        onChange={(e) => updateStage(idx, "linkUrl", e.target.value)}
                        placeholder="https://... 길어도 OK — 숏링크 자동변환 가능"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      {/* 숏링크 변환 버튼 */}
                      <button
                        type="button"
                        onClick={() => makeShortLink(idx, stage.linkUrl)}
                        disabled={!stage.linkUrl || shortlinking === idx}
                        title="긴 URL → 숏링크 자동 변환"
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-40 whitespace-nowrap hover:bg-blue-700"
                      >
                        {shortlinking === idx
                          ? <span className="animate-spin">⏳</span>
                          : <Wand2 className="w-3.5 h-3.5" />}
                        숏링크
                      </button>
                      {/* 복사 버튼 */}
                      {stage.linkUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(stage.linkUrl).catch(() => {
                                showError('클립보드 복사 실패');
                              });
                              setCopiedLink(idx);
                              setTimeout(() => setCopiedLink(null), 2000);
                            } else {
                              showError('브라우저에서 지원하지 않습니다');
                            }
                          }}
                          className="px-2 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          {copiedLink === idx
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Link2 className="w-4 h-4 text-gray-400" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 스테이지 추가 버튼 */}
        <button
          onClick={addStage}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> 스테이지 추가
        </button>

        {/* 하단 저장 */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-navy-900 text-white py-3 rounded-xl font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "저장 중..." : "전체 저장"}
        </button>
      </div>

      {showEnroll && (
        <EnrollModal
          funnelId={id}
          onClose={() => setShowEnroll(false)}
          onDone={() => load()}
        />
      )}
    </div>
  );
}

// ── 뉴스 링크 빠른 선택 패널 ─────────────────────────────────────────

// ── 고객 퍼널 등록 모달 ─────────────────────────────────────────────
function EnrollModal({
  funnelId,
  onClose,
  onDone,
}: {
  funnelId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'contact' | 'group'>('contact');
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string; type: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [sendNow, setSendNow] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 그룹 일괄 등록
  const [groups, setGroups] = useState<{ id: string; name: string; _count: { members: number } }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [enrollResult, setEnrollResult] = useState<{ enrolled: number; skipped: number } | null>(null);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json())
      .then(d => { if (d.ok) setGroups(d.groups ?? []); })
      .catch(() => {});
  }, []);

  const handleGroupEnroll = async () => {
    if (!selectedGroup) return;
    setEnrolling(true);
    setError('');
    setEnrollResult(null);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/enroll-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroup, startDate: startDate || undefined }),
      });
      const d = await res.json() as { ok: boolean; enrolled?: number; skipped?: number; message?: string };
      if (d.ok) {
        setEnrollResult({ enrolled: d.enrolled ?? 0, skipped: d.skipped ?? 0 });
        onDone();
      } else {
        setError(d.message ?? '그룹 등록 실패');
        showError(d.message ?? '그룹 등록 실패');
      }
    } catch {
      setError('그룹 등록 중 오류가 발생했습니다');
      showError('그룹 등록 중 오류가 발생했습니다');
    } finally {
      setEnrolling(false);
    }
  };

  // timerRef cleanup (메모리 누수 방지)
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // 고객 검색 (디바운스 300ms)
  const search = (val: string) => {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setContacts([]); return; }
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts?q=${encodeURIComponent(val)}&limit=10`);
      const d = await res.json() as { ok: boolean; contacts?: { id: string; name: string; phone: string; type: string }[] };
      if (d.ok) setContacts(d.contacts ?? []);
    }, 300);
  };

  const handleEnroll = async () => {
    if (!selected) return;
    setEnrolling(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`/api/funnels/${funnelId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selected.id,
          startDate: startDate || undefined,
          sendNow,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const d = await res.json() as { ok: boolean; message?: string; alreadyEnrolled?: boolean };
      if (d.ok) {
        onDone();
        onClose();
      } else {
        const msg = d.alreadyEnrolled
          ? '이미 이 퍼널에 등록된 고객입니다. 다시 등록하시겠습니까?'
          : d.message ?? '등록 실패';
        setError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? '요청 시간 초과'
        : '등록 중 오류가 발생했습니다';
      setError(msg);
      showError(msg);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">퍼널 등록</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {/* 등록 방식 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('contact')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${mode === 'contact' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              개인 등록
            </button>
            <button onClick={() => setMode('group')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${mode === 'group' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              그룹 일괄 등록
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* 그룹 일괄 등록 탭 */}
          {mode === 'group' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">수신 그룹 선택</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">그룹 선택...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">시작일 (선택 — 기본: 오늘)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm" />
              </div>
              {enrollResult && (
                <div className="p-3 bg-green-50 rounded-xl text-sm text-green-700">
                  ✅ {enrollResult.enrolled}명 등록 완료
                  {enrollResult.skipped > 0 && ` (이미 등록된 ${enrollResult.skipped}명 건너뜀)`}
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={handleGroupEnroll} disabled={!selectedGroup || enrolling}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
                {enrolling ? '등록 중...' : `그룹 일괄 등록 시작`}
              </button>
            </div>
          )}
          {/* 개인 등록 탭 */}
          {mode === 'contact' && (
          <div className="contents">
          {/* 고객 검색 */}
          {!selected ? (
            <div>
              <label htmlFor="contact-search" className="block text-xs font-medium text-gray-600 mb-1.5">고객 검색</label>
              <input
                id="contact-search"
                value={q}
                onChange={e => search(e.target.value)}
                placeholder="이름 또는 전화번호"
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {contacts.length > 0 && (
                <div className="mt-2 border rounded-xl overflow-hidden">
                  {contacts.map(c => (
                    <button key={c.id} onClick={() => { setSelected(c); setQ(''); setContacts([]); }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b last:border-0">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">{c.phone.substring(0, 4)}****</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-blue-800">{selected.name}</span>
              <button onClick={() => setSelected(null)} className="text-blue-400 hover:text-blue-600 text-xs">변경</button>
            </div>
          )}

          {/* 시작일 (선택) */}
          <div>
            <label htmlFor="start-date" className="block text-xs font-medium text-gray-600 mb-1.5">
              시작일 <span className="text-gray-400">(비우면 오늘)</span>
            </label>
            <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 즉시 발송 토글 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input id="send-now" type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <span className="text-sm text-gray-700">등록 즉시 첫 메시지 발송</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleEnroll} disabled={!selected || enrolling}
            className="w-full py-3 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {enrolling ? '등록 중...' : '퍼널 등록'}
          </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
