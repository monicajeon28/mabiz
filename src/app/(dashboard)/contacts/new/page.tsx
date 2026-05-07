"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";

export default function NewContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    type: "LEAD",
    cruiseInterest: "",
    budgetRange: "",
    adminMemo: "",
  });
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // 그룹 추가 팝업
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupAdding, setGroupAdding] = useState(false);
  const [groupAddError, setGroupAddError] = useState("");
  const groupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((data) => {
      if (data.ok) setGroups(data.groups ?? []);
    });
  }, []);

  const handleAddGroup = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    const name = newGroupName.trim();
    if (!name) { setGroupAddError("그룹 이름을 입력해주세요."); return; }
    setGroupAdding(true);
    setGroupAddError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data.ok) { setGroupAddError(data.error ?? "그룹 생성 실패"); return; }
      const created = data.group;
      setGroups((prev) => [...prev, { id: created.id, name: created.name, funnelId: created.funnelId ?? null }]);
      setSelectedGroupId(created.id);
      setNewGroupName("");
      setGroupModalOpen(false);
    } catch {
      setGroupAddError("서버 오류가 발생했습니다.");
    } finally {
      setGroupAdding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, groupIds: selectedGroupId ? [selectedGroupId] : undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/contacts/${data.contact.id}`);
      } else {
        setError(data.message ?? "저장 실패. 다시 시도해주세요.");
      }
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-navy-900">새 고객 추가</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-1234-5678"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@email.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 고객 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">고객 유형</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="LEAD">잠재고객</option>
              <option value="CUSTOMER">구매완료</option>
            </select>
          </div>

          {/* 관심 크루즈 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관심 크루즈</label>
            <select
              value={form.cruiseInterest}
              onChange={(e) => setForm({ ...form, cruiseInterest: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="">선택 안함</option>
              <option value="지중해">지중해</option>
              <option value="카리브해">카리브해</option>
              <option value="알래스카">알래스카</option>
              <option value="북유럽">북유럽</option>
              <option value="동남아">동남아</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 예산 구간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예산 구간</label>
            <select
              value={form.budgetRange}
              onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="">선택 안함</option>
              <option value="ECONOMY">100만원 이하</option>
              <option value="STANDARD">100~300만원</option>
              <option value="PREMIUM">300만원 이상</option>
            </select>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={form.adminMemo}
              onChange={(e) => setForm({ ...form, adminMemo: e.target.value })}
              placeholder="고객 관련 메모..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 resize-none"
            />
          </div>

          {/* 그룹 배정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">그룹 배정</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-500"
            >
              <option value="">그룹 미지정</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.funnelId ? "🔄" : ""}
                </option>
              ))}
            </select>
            {selectedGroupId && <p className="text-xs text-gray-400 mt-1">🔄 퍼널 연결 시 등록 즉시 자동 문자 발송</p>}
            <button
              type="button"
              onClick={() => { setGroupModalOpen(true); setGroupAddError(""); setTimeout(() => groupInputRef.current?.focus(), 50); }}
              className="mt-2 flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              그룹 추가
            </button>
          </div>

          {/* 그룹 추가 팝업 */}
          {groupModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setGroupModalOpen(false)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900">새 그룹 추가</h3>
                  <button type="button" onClick={() => setGroupModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    ref={groupInputRef}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddGroup(e as unknown as React.FormEvent); } }}
                    placeholder="그룹 이름 입력"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                  />
                  {groupAddError && <p className="text-xs text-red-500">{groupAddError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setGroupModalOpen(false)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      disabled={groupAdding}
                      className="flex-1 py-2.5 bg-navy-900 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {groupAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      그룹 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-navy-900 text-white py-3 rounded-xl font-medium hover:bg-navy-700 transition-colors disabled:opacity-50"
        >
          {loading ? "저장 중..." : "고객 추가하기"}
        </button>
      </form>
    </div>
  );
}
