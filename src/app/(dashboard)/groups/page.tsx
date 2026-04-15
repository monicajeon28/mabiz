"use client";

import { useState, useEffect } from "react";
import { Plus, Users, GitBranch, Settings, ArrowRight } from "lucide-react";

type Group = {
  id: string; name: string; description: string | null;
  color: string | null; funnelId: string | null; funnelName: string | null;
  _count: { members: number };
};
type Funnel = { id: string; name: string };

export default function GroupsPage() {
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ name: "", description: "", color: "#6B7280", funnelId: "" });
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 일괄 발송 상태
  const [blastGroupId,  setBlastGroupId]  = useState<string | null>(null);
  const [blastMsg,      setBlastMsg]      = useState("");
  const [blastPreview,  setBlastPreview]  = useState<{ willSend: number; isOverLimit: boolean; overLimitMsg: string | null } | null>(null);
  const [blasting,      setBlasting]      = useState(false);
  const [blastResult,   setBlastResult]   = useState<{ sentCount: number; blockedCount: number; failedCount: number } | null>(null);
  const [checkingBlast, setCheckingBlast] = useState(false);
  const [blastError,    setBlastError]    = useState<string | null>(null);

  const openBlast = (groupId: string) => {
    setBlastGroupId(groupId);
    setBlastMsg("");
    setBlastPreview(null);
    setBlastResult(null);
    setBlastError(null);
  };

  const checkBlast = async () => {
    if (!blastGroupId || !blastMsg.trim() || checkingBlast) return;
    setCheckingBlast(true);
    setBlastError(null);
    try {
      const res  = await fetch(`/api/groups/${blastGroupId}/blast`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: blastMsg, dryRun: true }),
      });
      const data = await res.json();
      if (data.ok) setBlastPreview(data);
      else setBlastError(data.error ?? "대상 확인에 실패했습니다.");
    } catch {
      setBlastError("네트워크 오류가 발생했습니다.");
    } finally {
      setCheckingBlast(false);
    }
  };

  const sendBlast = async () => {
    if (!blastGroupId || !blastMsg.trim() || blasting) return;
    setBlasting(true);
    try {
      const res  = await fetch(`/api/groups/${blastGroupId}/blast`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: blastMsg, dryRun: false }),
      });
      const data = await res.json();
      if (data.ok) {
        setBlastResult({ sentCount: data.sentCount, blockedCount: data.blockedCount, failedCount: data.failedCount });
        setBlastPreview(null);
      }
    } finally {
      setBlasting(false); // 에러 시에도 반드시 해제
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/funnels").then((r) => r.json()),
    ]).then(([g, f]) => {
      if (g.ok)  setGroups(g.groups);
      if (f.ok)  setFunnels(f.funnels);
    }).finally(() => setLoading(false));
  }, []);

  const createGroup = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const res  = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        form.name,
          description: form.description || null,
          color:       form.color,
          funnelId:    form.funnelId || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const funnelName = funnels.find((f) => f.id === form.funnelId)?.name ?? null;
        setGroups((prev) => [...prev, { ...data.group, funnelName, _count: { members: 0 } }]);
        setShowNew(false);
        setForm({ name: "", description: "", color: "#6B7280", funnelId: "" });
      } else {
        setFormError(data.error ?? "그룹 생성에 실패했습니다.");
      }
    } catch {
      setFormError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const COLOR_OPTIONS = [
    "#1E2D4E", "#C9A84C", "#10B981", "#3B82F6",
    "#8B5CF6", "#EF4444", "#F59E0B", "#6B7280",
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy-900">고객 그룹</h1>
          <p className="text-sm text-gray-500 mt-0.5">그룹 → 퍼널 연결로 자동 문자 발송</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700"
        >
          <Plus className="w-4 h-4" /> 새 그룹
        </button>
      </div>

      {/* 흐름 설명 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium text-blue-800 mb-2">📌 그룹 + 퍼널 자동화 흐름</p>
        <div className="flex items-center gap-2 text-xs text-blue-700 flex-wrap">
          <span className="bg-blue-100 px-2 py-1 rounded">고객 그룹 배정</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="bg-blue-100 px-2 py-1 rounded">연결된 퍼널 자동 시작</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="bg-blue-100 px-2 py-1 rounded">자동 문자 발송</span>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          랜딩페이지 신청 시에도 그룹 자동 배정 → 퍼널 즉시 시작
        </p>
      </div>

      {/* 새 그룹 폼 */}
      {showNew && (
        <div className="bg-white border border-gold-300 rounded-xl p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">새 그룹 만들기</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">그룹 이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 지중해 관심 고객"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="이 그룹에 대한 간단한 설명"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>

            {/* 색상 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* 퍼널 연결 — 핵심 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연결할 퍼널 <span className="text-xs text-gray-400 ml-1">(그룹 배정 시 자동 시작)</span>
              </label>
              <select
                value={form.funnelId}
                onChange={(e) => setForm({ ...form, funnelId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
              >
                <option value="">퍼널 없음 (수동 발송만)</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {form.funnelId && (
                <p className="text-xs text-green-600 mt-1">
                  ✅ 이 그룹에 고객 배정 시 즉시 퍼널 시작
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 mt-3">{formError}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={createGroup}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "그룹 만들기"}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 그룹 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">그룹이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">+ 새 그룹 버튼으로 만들어보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                {/* 색상 원 */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: group.color ?? "#6B7280" }}
                >
                  {group.name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    <span className="text-xs text-gray-400">{group._count.members}명</span>
                  </div>
                  {group.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{group.description}</p>
                  )}

                  {/* 연결된 퍼널 표시 */}
                  {group.funnelId ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      <GitBranch className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">
                        퍼널 연결됨: {group.funnelName}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-xs text-gray-400">퍼널 없음</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openBlast(group.id)}
                    className="px-3 py-1.5 bg-gold-50 border border-gold-300 text-gold-700 rounded-lg text-xs font-medium hover:bg-gold-100"
                    title="그룹 전체에 즉시 문자 발송"
                  >
                    📢 발송
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* 일괄 발송 패널 */}
              {blastGroupId === group.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {blastResult ? (
                    <div className="bg-green-50 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-green-800">✅ 발송 완료</p>
                      <p className="text-green-700 mt-1">
                        성공 {blastResult.sentCount}명 · 차단 {blastResult.blockedCount}명
                        {blastResult.failedCount > 0 && ` · 실패 ${blastResult.failedCount}명`}
                      </p>
                      <button onClick={() => setBlastGroupId(null)} className="text-xs text-gray-500 mt-2 underline">닫기</button>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={blastMsg}
                        onChange={(e) => { setBlastMsg(e.target.value); setBlastPreview(null); }}
                        placeholder={"크루즈닷 입니다 😊\n[고객명]님, 이번 주 특가 소식이에요!\n→ cruisedot.co.kr"}
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 resize-none"
                      />
                      <p className="text-xs text-gray-400">[고객명] 자동 치환됩니다</p>

                      {blastError && (
                        <p className="text-sm text-red-600">{blastError}</p>
                      )}

                      {blastPreview && (
                        <div className="bg-blue-50 rounded-lg p-3 text-sm">
                          <p className="font-medium text-blue-800">발송 예정: {blastPreview.willSend}명</p>
                          {blastPreview.isOverLimit && (
                            <p className="text-xs text-orange-600 mt-1">⚠️ {blastPreview.overLimitMsg}</p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {!blastPreview ? (
                          <button
                            onClick={checkBlast}
                            disabled={!blastMsg.trim() || checkingBlast}
                            className="flex-1 border border-blue-300 text-blue-700 py-1.5 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
                          >
                            {checkingBlast ? "확인 중..." : "대상 확인"}
                          </button>
                        ) : (
                          <button
                            onClick={sendBlast}
                            disabled={blasting}
                            className="flex-1 bg-navy-900 text-white py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {blasting ? "발송 중..." : `${blastPreview.willSend}명에게 발송`}
                          </button>
                        )}
                        <button
                          onClick={() => setBlastGroupId(null)}
                          className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
