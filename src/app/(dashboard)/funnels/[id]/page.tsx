"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, Eye, EyeOff,
  ChevronUp, ChevronDown, MessageSquare, Zap, Link2, Check, Wand2
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
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!name.trim()) { setSaveMsg("퍼널 이름을 입력하세요."); return; }
    setSaving(true);
    setSaveMsg("");

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
    setSaving(false);
    if (data.ok) {
      setSaveMsg("✅ 저장됐습니다!");
      setTimeout(() => setSaveMsg(""), 2500);
    } else {
      setSaveMsg("❌ 저장 실패");
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
    setStages((prev) => [...prev, EMPTY_STAGE(prev.length)]);
    setExpandedIdx(stages.length);
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
    <div className="min-h-screen bg-gray-50">
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
                      📱 {stage.messageContent.slice(0, 40)}...
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

                  {/* 트리거 설정 */}
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>

                  {/* 메시지 작성 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">SMS 메시지</label>
                      <button
                        onClick={() => setPreviewIdx(isPreview ? null : idx)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                      >
                        {isPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {isPreview ? "편집" : "미리보기"}
                      </button>
                    </div>

                    {isPreview ? (
                      /* 미리보기 */
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs text-green-600 font-medium mb-2">📱 실제 발송 미리보기 (예시 고객: 김민준)</p>
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {(stage.messageContent || "(메시지 없음)")
                              .replace(/\[고객명\]/g, "김민준")
                              .replace(/\[이름\]/g,   "김민준")
                              .replace(/\[출발일\]/g, "2025.09.15")
                              .replace(/\[링크\]/g,   "https://cruisedot.co.kr")}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-right">
                          {stage.messageContent.length}자 (90자 초과 시 장문 요금)
                        </p>
                      </div>
                    ) : (
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
                          <p className={`text-xs ${stage.messageContent.length > 90 ? "text-orange-500" : "text-gray-400"}`}>
                            {stage.messageContent.length}자
                            {stage.messageContent.length > 90 ? " (장문 SMS)" : " (단문)"}
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
                            navigator.clipboard.writeText(stage.linkUrl);
                            setCopiedLink(idx);
                            setTimeout(() => setCopiedLink(null), 2000);
                          }}
                          className="px-2 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          {copiedLink === idx
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Link2 className="w-4 h-4 text-gray-400" />}
                        </button>
                      )}
                    </div>
                    {/* 뉴스 링크 빠른 선택 */}
                    <NewsLinkPicker onSelect={(url) => updateStage(idx, "linkUrl", url)} />
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
    </div>
  );
}

// ── 뉴스 링크 빠른 선택 패널 ─────────────────────────────────────────
function NewsLinkPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [open,  setOpen]  = useState(false);
  const [links, setLinks] = useState<{ id: string; title: string; url: string }[]>([]);

  const load = () => {
    if (links.length > 0) return;
    fetch('/api/tools/news-links').then(r => r.json())
      .then(d => { if (d.ok) setLinks(d.links ?? []); });
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); load(); }}
        className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
      >
        <Zap className="w-3 h-3" />
        {open ? '뉴스 링크 닫기' : '크루즈닷 뉴스에서 선택'}
      </button>
      {open && (
        <div className="mt-2 border rounded-xl bg-gray-50 max-h-40 overflow-y-auto">
          {links.length === 0 ? (
            <p className="text-xs text-gray-400 p-3">동기화된 뉴스가 없습니다</p>
          ) : (
            links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { onSelect(l.url); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white border-b last:border-0 truncate"
              >
                📰 {l.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
