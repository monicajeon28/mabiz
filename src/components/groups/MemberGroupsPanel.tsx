"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, X } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type MemberGroupRow = {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
};

// 색상 선택지 (생성 시)
const COLOR_PRESETS = [
  "#16A34A", // 초록
  "#2563EB", // 파랑
  "#9333EA", // 보라
  "#DC2626", // 빨강
  "#EA580C", // 주황
  "#0891B2", // 청록
  "#6B7280", // 회색
];

// ─── 회원 그룹 생성 모달 ────────────────────────────────────────────────────────
function CreateMemberGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("그룹 이름을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/members/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        onCreated();
        onClose();
      } else {
        setErr(data.error ?? "그룹 생성에 실패했습니다.");
      }
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">회원 그룹 만들기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹 이름 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="예: VIP 회원, 신규 가입"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}`}
                  className={`w-9 h-9 rounded-full border-2 transition ${
                    color === c ? "border-gray-800 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 회원 그룹 패널 (GLOBAL_ADMIN 전용) ─────────────────────────────────────────
export function MemberGroupsPanel() {
  const router = useRouter();
  const [groups, setGroups] = useState<MemberGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/members/groups");
      const data = (await res.json()) as { ok: boolean; groups?: MemberGroupRow[] };
      if (data.ok) {
        setGroups(data.groups ?? []);
      } else {
        showError("회원 그룹을 불러올 수 없습니다.");
      }
    } catch (err) {
      logger.error("[MemberGroupsPanel] loadGroups", { err });
      showError("회원 그룹을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  return (
    <>
      {showCreate && (
        <CreateMemberGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void loadGroups();
          }}
        />
      )}

      <div className="flex flex-col h-full space-y-3">
        {/* 안내 */}
        <div>
          <p className="text-base text-gray-600 leading-relaxed">
            크루즈닷 가입 회원을 분류하는 그룹입니다. 회원을 그룹에 배정하려면{" "}
            <button
              onClick={() => router.push("/members")}
              className="font-bold text-green-700 underline hover:text-green-900"
            >
              회원 관리
            </button>
            에서 회원을 선택해 배정합니다. 랜딩·자동문자에 쓰는 연락처 그룹과는 분리되어 있습니다.
          </p>
        </div>

        {/* 상단 버튼바 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            회원 그룹 만들기
          </button>
          <span className="text-sm text-gray-500">총 {groups.length.toLocaleString()}개</span>
        </div>

        {/* 테이블 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex-1 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-3 py-3 text-center text-gray-500 font-medium">NO</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">그룹명</th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">소속 회원</th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">생성일</th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
                      불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-16 text-center text-gray-400">
                    회원 그룹이 없습니다.
                  </td>
                </tr>
              ) : (
                groups.map((g, idx) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-center text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: g.color || "#6B7280" }}
                        />
                        <span className="font-semibold text-gray-800">{g.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        {g.memberCount.toLocaleString()}명
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 text-xs">
                      {new Date(g.createdAt)
                        .toLocaleDateString("ko-KR")
                        .replace(/\./g, ".")
                        .trim()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => router.push("/members")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                      >
                        <Users className="w-3 h-3" />
                        회원 배정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
