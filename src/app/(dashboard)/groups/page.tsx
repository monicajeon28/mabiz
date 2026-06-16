"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Network,
  Plus,
  X,
} from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { GroupForm } from "@/components/groups/GroupForm";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
type FunnelSmsChip = { id: string; title: string };

type GroupRow = {
  id: string;
  seq: string;
  name: string;
  category: string | null;
  parentGroupId: string | null;
  memberCount: number;
  funnelSmsIds: string[];
  funnelSmsChips?: FunnelSmsChip[];
  createdAt: string;
  children?: GroupRow[];
};

type PageSize = 10 | 50 | 100;

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function buildEmbedScript(seq: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.mabiz.kr";
  return `<!-- include form -->
<form action="${origin}/api/public/group-join" onsubmit="return step_submit(this);">
  <input type="hidden" name="seq" value="${seq}"/>
  <input type="hidden" name="result_url" value=""/><!--신청후 이동할 url-->
  <input type="text" name="nm" placeholder="이름 입력"/>
  <input type="text" name="hp" placeholder="휴대폰번호 입력"/>
  <input type="text" name="em" placeholder="이메일 입력"/>
  <input type="submit" value="신청하기"/>
</form>
<script>function step_submit(frm){if(frm.nm.value==""){alert("이름이 없습니다");return false;}var regExp=/^01([0|1|6|7|8|9]?)-?([0-9]{3,4})-?([0-9]{4})$/;if(!regExp.test(frm.hp.value)){alert('잘못된 휴대폰 번호입니다. 숫자, -를 포함한 숫자만 입력하세요.');return false;}return true;}<\/script>
<!-- //include form -->`;
}

// ─── 연결한 퍼널문자 칩 (최대 2개 + '+N') ─────────────────────────────────────
function FunnelSmsChips({
  chips,
  fallbackCount,
}: {
  chips: FunnelSmsChip[] | undefined;
  fallbackCount: number;
}) {
  // title 매핑이 있는 칩 우선 표시
  if (chips && chips.length > 0) {
    const visible = chips.slice(0, 2);
    const rest = chips.length - visible.length;
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {visible.map((chip) => (
          <a
            key={chip.id}
            href={`/sms-logs?tab=funnel&funnelSmsId=${encodeURIComponent(chip.id)}`}
            title={chip.title}
            className="inline-flex max-w-[120px] items-center truncate rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <span className="truncate">{chip.title}</span>
          </a>
        ))}
        {rest > 0 && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
            +{rest}
          </span>
        )}
      </span>
    );
  }
  // 칩 매핑이 없으나 연결 id는 존재 → 개수 폴백
  if (fallbackCount > 0) {
    return <span className="text-gray-600 text-xs">{fallbackCount}개</span>;
  }
  return <span className="text-gray-400 text-xs">—</span>;
}

// ─── 스크립트 모달 ─────────────────────────────────────────────────────────────
function ScriptModal({ seq, onClose }: { seq: string; onClose: () => void }) {
  const script = buildEmbedScript(seq);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">스크립트</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <textarea
            readOnly
            value={script}
            rows={4}
            className="w-full font-mono text-xs border border-gray-200 rounded-lg p-3 bg-gray-50 resize-none focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Copy className="w-4 h-4" />
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 그룹 만들기 모달 ──────────────────────────────────────────────────────────
function CreateGroupModal({
  csrfToken,
  onClose,
  onCreated,
}: {
  csrfToken: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("그룹명을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ name: name.trim(), category: category.trim() || null }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        onCreated();
        onClose();
      } else {
        setErr(data.message ?? "그룹 생성에 실패했습니다.");
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
          <h2 className="text-base font-semibold text-gray-900">그룹 만들기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹명 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 2026년 봄 신규 문의"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대분류 (선택)
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 크루즈, 여행, VIP"
            />
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
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function GroupsPage() {
  // 데이터
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");

  // 검색/필터
  const [searchEmail, setSearchEmail] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  // 페이지네이션
  const [pageSize, setPageSize] = useState<PageSize>(100);
  const [currentPage, setCurrentPage] = useState(0);

  // 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 모달
  const [scriptSeq, setScriptSeq] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // 삭제 진행
  const [deleting, setDeleting] = useState(false);

  // 스크립트 로딩
  const [scriptLoading, setScriptLoading] = useState<string | null>(null);

  // 그룹 편집 모달
  const [editGroup, setEditGroup] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);

  // 고객 목록 팝업
  const [memberModal, setMemberModal] = useState<{ groupId: string; groupName: string } | null>(null);
  const [memberList, setMemberList] = useState<{ contactId: string; name: string; phone: string; addedAt: string; daysSince: number }[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);

  // 그룹폼 데이터
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([]);
  const [funnelSmsList, setFunnelSmsList] = useState<{ id: string; title: string }[]>([]);
  const [funnelEmailList, setFunnelEmailList] = useState<{ id: string; name: string }[]>([]);

  // ── CSRF 토큰 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/csrf-token", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCsrfToken(d.token);
      })
      .catch((err) => { if (err.name !== 'AbortError') logger.error("[GroupsPage] csrf", { err }); });
    return () => ctrl.abort();
  }, []);

  // ── 데이터 로드 ────────────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const offset = currentPage * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchQ) params.set("q", searchQ);
      if (categoryFilter) params.set("category", categoryFilter);
      if (searchEmail) params.set("emailOnly", "1");

      const res = await fetch(`/api/groups?${params.toString()}`);
      const data = (await res.json()) as {
        ok: boolean;
        groups: GroupRow[];
        totalCount: number;
        categories?: string[];
      };
      if (data.ok) {
        setGroups(data.groups ?? []);
        setTotalCount(data.totalCount ?? 0);
        if (data.categories) setCategories(data.categories);
      }
    } catch (err) {
      logger.error("[GroupsPage] loadGroups", { err });
      showError("그룹을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQ, categoryFilter, searchEmail]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  // funnels + funnel-sms 한 번만 패칭 (모달 열릴 때 필요)
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.allSettled([
      fetch("/api/funnels", { signal: ctrl.signal }).then((r) => r.json()),
      fetch("/api/funnel-sms", { signal: ctrl.signal }).then((r) => r.json()),
      fetch("/api/funnel-email", { signal: ctrl.signal }).then((r) => r.json()),
    ]).then(([fRes, fsRes, feRes]) => {
      if (ctrl.signal.aborted) return;
      if (fRes.status === "fulfilled" && fRes.value.ok) {
        setFunnels((fRes.value as { ok: boolean; funnels?: { id: string; name: string }[] }).funnels ?? []);
      }
      if (fsRes.status === "fulfilled" && fsRes.value.ok) {
        setFunnelSmsList((fsRes.value as { ok: boolean; funnelSmsList?: { id: string; title: string }[] }).funnelSmsList ?? []);
      }
      if (feRes.status === "fulfilled" && feRes.value.ok) {
        const feData = (feRes.value as { ok: boolean; data?: { id: string; title: string }[] }).data ?? [];
        setFunnelEmailList(feData.map((item) => ({ id: item.id, name: item.title })));
      }
    }).catch(() => {/* 패칭 실패는 조용히 무시 */});
    return () => ctrl.abort();
  }, []);

  // ── 트리 빌드 ──────────────────────────────────────────────────────────────
  const buildTree = (flat: GroupRow[]): GroupRow[] => {
    const map = new Map<string, GroupRow>();
    flat.forEach((g) => map.set(g.id, { ...g, children: [] }));
    const roots: GroupRow[] = [];
    map.forEach((g) => {
      if (g.parentGroupId && map.has(g.parentGroupId)) {
        map.get(g.parentGroupId)!.children!.push(g);
      } else {
        roots.push(g);
      }
    });
    return roots;
  };

  const tree = buildTree(groups);

  // ── 선택 헬퍼 ──────────────────────────────────────────────────────────────
  const allLeafIds: string[] = tree.flatMap((g) =>
    g.children && g.children.length > 0 ? g.children.map((c) => c.id) : [g.id]
  );

  const allSelected = allLeafIds.length > 0 && allLeafIds.every((id) => selected.has(id));
  const someSelected = allLeafIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allLeafIds));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 그룹 편집 핸들러 ──────────────────────────────────────────────────────────
  const handleEditGroup = async (groupId: string) => {
    setEditLoading(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (data.ok && data.group) {
        setEditGroup({ id: groupId, data: data.group });
      } else {
        showError('그룹 정보를 불러올 수 없습니다.');
      }
    } catch {
      showError('오류가 발생했습니다.');
    } finally {
      setEditLoading(null);
    }
  };

  // ── 고객 목록 로드 ─────────────────────────────────────────────────────────
  const loadMembers = async (groupId: string, q = '', page = 1) => {
    setMemberLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/groups/${groupId}/members?${params}`);
      const data = await res.json();
      if (data.ok) {
        setMemberList(data.members ?? []);
        setMemberTotal(data.total ?? 0);
      }
    } catch {
      showError('고객 목록을 불러올 수 없습니다.');
    } finally {
      setMemberLoading(false);
    }
  };

  // ── 멤버 수 배지 클릭 핸들러 ───────────────────────────────────────────────
  const handleMemberBadgeClick = (groupId: string, groupName: string) => {
    setMemberModal({ groupId, groupName });
    setMemberSearch('');
    setMemberPage(1);
    loadMembers(groupId);
  };

  // ── 그룹에서 제거 핸들러 ───────────────────────────────────────────────────
  const handleRemoveMember = async (groupId: string, contactId: string) => {
    if (!confirm('이 고객을 그룹에서 해제하시겠습니까?')) return;
    try {
      await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: [contactId] }),
      });
      loadMembers(groupId, memberSearch, memberPage);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, memberCount: g.memberCount - 1 } : g));
    } catch {
      showError('그룹 해제에 실패했습니다.');
    }
  };

  // ── 스크립트 클릭: seq 있으면 바로, 없으면 API 호출해서 생성 ──────────────────
  const handleScriptClick = async (groupId: string, existingSeq: string | null) => {
    if (existingSeq) {
      setScriptSeq(existingSeq);
      return;
    }
    setScriptLoading(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/script`);
      const d = (await res.json()) as { ok: boolean; seq?: string };
      if (d.ok && d.seq) {
        setScriptSeq(d.seq);
        // 로컬 목록도 업데이트
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, seq: d.seq! } : g
          )
        );
      } else {
        showError("스크립트 생성에 실패했습니다.");
      }
    } catch {
      showError("스크립트를 불러올 수 없습니다.");
    } finally {
      setScriptLoading(null);
    }
  };

  // ── 삭제 ──────────────────────────────────────────────────────────────────
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개 그룹을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          fetch(`/api/groups/${id}`, {
            method: "DELETE",
            headers: { "X-CSRF-Token": csrfToken },
          })
        )
      );
      setSelected(new Set());
      await loadGroups();
    } catch (err) {
      logger.error("[GroupsPage] deleteSelected", { err });
      showError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  // ── 페이지네이션 ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const goFirst = () => setCurrentPage(0);
  const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  const goLast = () => setCurrentPage(totalPages - 1);

  // ── UI ────────────────────────────────────────────────────────────────────
  let rowNo = currentPage * pageSize + 1;

  return (
    <>
      {scriptSeq && <ScriptModal seq={scriptSeq} onClose={() => setScriptSeq(null)} />}

      {showCreate && (
        <GroupForm
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          funnels={funnels}
          funnelSmsList={funnelSmsList}
          funnelEmailList={funnelEmailList}
          csrfToken={csrfToken}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void loadGroups();
          }}
        />
      )}

      {editGroup && (
        <GroupForm
          groups={groups.filter(g => g.id !== editGroup.id).map(g => ({ id: g.id, name: g.name }))}
          funnels={funnels}
          funnelSmsList={funnelSmsList}
          funnelEmailList={funnelEmailList}
          csrfToken={csrfToken}
          editGroupId={editGroup.id}
          initialData={{
            name: editGroup.data.name as string,
            category: editGroup.data.category as string | undefined,
            parentGroupId: editGroup.data.parentGroupId as string | undefined,
            description: editGroup.data.description as string | undefined,
            funnelIds: editGroup.data.funnelIds as string[] | undefined,
            funnelSmsIds: editGroup.data.funnelSmsIds as string[] | undefined,
            funnelEmailId: editGroup.data.funnelEmailId as string | undefined,
            reEntryPolicy: editGroup.data.reEntryPolicy as string | undefined,
            autoMoveEnabled: editGroup.data.autoMoveEnabled as boolean | undefined,
            autoMoveDays: editGroup.data.autoMoveDays as number | null | undefined,
            autoMoveTargetGroupId: editGroup.data.autoMoveTargetGroupId as string | null | undefined,
          }}
          onClose={() => setEditGroup(null)}
          onCreated={() => { setEditGroup(null); void loadGroups(); }}
        />
      )}

      {memberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-teal-500 rounded-t-xl">
              <h2 className="text-base font-semibold text-white">고객리스트</h2>
              <button onClick={() => setMemberModal(null)} className="text-white hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium text-gray-700 mb-3">그룹명:{memberModal.groupName}</p>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setMemberPage(1);
                    loadMembers(memberModal.groupId, memberSearch, 1);
                  }
                }}
                placeholder="고객 검색"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none"
              />
              {memberLoading ? (
                <div className="text-center py-8 text-gray-400">불러오는 중...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-2 text-left text-gray-600 font-medium">고객명</th>
                        <th className="pb-2 text-left text-gray-600 font-medium">휴대폰번호</th>
                        <th className="pb-2 text-center text-gray-600 font-medium">그룹유입일</th>
                        <th className="pb-2 text-center text-gray-600 font-medium">일차</th>
                        <th className="pb-2 text-center text-gray-600 font-medium">그룹해제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {memberList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">고객이 없습니다.</td>
                        </tr>
                      ) : memberList.map(member => (
                        <tr key={member.contactId} className="hover:bg-gray-50">
                          <td className="py-2 text-gray-800">{member.name}</td>
                          <td className="py-2 text-gray-600">{member.phone}</td>
                          <td className="py-2 text-center text-gray-500 text-xs">
                            {new Date(member.addedAt).toLocaleDateString('ko-KR').replace(/\./g, '.').trim()}
                          </td>
                          <td className="py-2 text-center text-gray-600">{member.daysSince}</td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => handleRemoveMember(memberModal.groupId, member.contactId)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                            >
                              그룹해제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-gray-400">총 {memberTotal}명</span>
                <button
                  onClick={() => setMemberModal(null)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full p-4 md:p-6 space-y-3">
        {/* ═══ 상단 버튼바 1행 ════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Network className="w-4 h-4" />
              자동화 흐름
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              그룹 만들기
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.checked);
                  setCurrentPage(0);
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              이메일 필드
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchQ(searchInput);
                  setCurrentPage(0);
                }
              }}
              placeholder="그룹명 검색"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSize);
                setCurrentPage(0);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value={10}>10개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <button
              onClick={() => {
                setSearchQ(searchInput);
                setCurrentPage(0);
              }}
              className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
            >
              검색Q
            </button>
          </div>
        </div>

        {/* ═══ 상단 버튼바 2행: 대분류 필터 ═════════════════════════════ */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none min-w-[140px]"
          >
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {categoryFilter && (
            <button
              onClick={() => {
                setCategoryFilter("");
                setCurrentPage(0);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            총 {totalCount.toLocaleString()}개
          </span>
        </div>

        {/* ═══ 테이블 ════════════════════════════════════════════════════ */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex-1 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </th>
                <th className="w-12 px-3 py-3 text-center text-gray-500 font-medium">NO</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">그룹명</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">상위그룹</th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">연결된 고객</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">
                  연결한 카카오톡 / 연결한 자동문자
                </th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">생성일</th>
                <th className="px-3 py-3 text-center text-gray-500 font-medium">스크립트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                      불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : tree.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-gray-400">
                    그룹이 없습니다.
                  </td>
                </tr>
              ) : (
                tree.flatMap((parent) => {
                  const rows: React.ReactNode[] = [];
                  const hasChildren = parent.children && parent.children.length > 0;

                  rows.push(
                    <tr key={`parent-${parent.id}`} className="bg-gray-50">
                      <td className="px-3 py-2 text-center">
                        {!hasChildren && (
                          <input
                            type="checkbox"
                            checked={selected.has(parent.id)}
                            onChange={() => toggleRow(parent.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">
                        {!hasChildren ? rowNo++ : ""}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        {hasChildren ? (
                          <span className="text-gray-700">
                            {parent.name}
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                              {parent.children!.length}개의 그룹이 있습니다.
                            </span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEditGroup(parent.id)}
                            disabled={editLoading === parent.id}
                            className="text-blue-600 hover:underline text-left disabled:opacity-50"
                          >
                            {editLoading === parent.id ? '로딩...' : parent.name}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {parent.category ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!hasChildren && (
                          <button
                            onClick={() => handleMemberBadgeClick(parent.id, parent.name)}
                            className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
                          >
                            {parent.memberCount.toLocaleString()}명
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {!hasChildren && (
                          <FunnelSmsChips
                            chips={parent.funnelSmsChips}
                            fallbackCount={parent.funnelSmsIds.length}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500 text-xs">
                        {!hasChildren ? formatDate(parent.createdAt) : ""}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!hasChildren && (
                          <button
                            onClick={() => handleScriptClick(parent.id, parent.seq)}
                            disabled={scriptLoading === parent.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                          >
                            {scriptLoading === parent.id ? (
                              <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            스크립트 복사
                          </button>
                        )}
                      </td>
                    </tr>
                  );

                  if (hasChildren) {
                    parent.children!.forEach((child) => {
                      rows.push(
                        <tr key={`child-${child.id}`} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected.has(child.id)}
                              onChange={() => toggleRow(child.id)}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-gray-400">{rowNo++}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-gray-300 select-none">└</span>
                              <button
                                onClick={() => handleEditGroup(child.id)}
                                disabled={editLoading === child.id}
                                className="text-blue-600 hover:underline text-left disabled:opacity-50"
                              >
                                {editLoading === child.id ? '로딩...' : child.name}
                              </button>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{parent.name}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleMemberBadgeClick(child.id, child.name)}
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
                            >
                              {child.memberCount.toLocaleString()}명
                            </button>
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">
                            <FunnelSmsChips
                              chips={child.funnelSmsChips}
                              fallbackCount={child.funnelSmsIds.length}
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500 text-xs">
                            {formatDate(child.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleScriptClick(child.id, child.seq)}
                              disabled={scriptLoading === child.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                            >
                              {scriptLoading === child.id ? (
                                <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              스크립트 복사
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══ 하단 버튼바 ══════════════════════════════════════════════ */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              disabled={selected.size === 0}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              onClick={() => showError("선택항목 프로필변경 기능 준비 중입니다.")}
            >
              선택항목 프로필변경
            </button>
            <button
              disabled={selected.size === 0}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              onClick={() => showError("선택항목 유입그래프 기능 준비 중입니다.")}
            >
              선택항목 유입그래프
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={goFirst}
              disabled={currentPage === 0}
              className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goPrev}
              disabled={currentPage === 0}
              className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
              const page = start + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-sm rounded border ${
                    page === currentPage
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {page + 1}
                </button>
              );
            })}
            <button
              onClick={goNext}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goLast}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={selected.size === 0}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              onClick={() => showError("선택항목 묶음변경 기능 준비 중입니다.")}
            >
              선택항목 묶음변경
            </button>
            <button
              disabled={selected.size === 0 || deleting}
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "삭제 중..." : "그룹 삭제"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
