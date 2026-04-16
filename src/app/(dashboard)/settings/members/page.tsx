'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Loader2, UserX, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type Member = {
  userId: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type InviteToken = {
  id: string;
  token: string;
  role: string;
  note: string | null;
  url: string;
  isExpired: boolean;
  isUsed: boolean;
  expiresAt: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: '대리점장',
  AGENT: '판매원',
  FREE_SALES: '프리세일즈',
};

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-amber-100 text-amber-700',
  AGENT: 'bg-blue-100 text-blue-700',
  FREE_SALES: 'bg-gray-100 text-gray-600',
};

function ShimmerCard() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // 초대 링크 생성 폼
  const [newRole, setNewRole] = useState('AGENT');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ConfirmDialog 상태
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch('/api/org/members');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch {
      showError('팀원 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch('/api/org/invite');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInvites(data.tokens ?? []);
    } catch {
      showError('초대 링크 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, [fetchMembers, fetchInvites]);

  async function handleToggleActive(userId: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/org/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '변경에 실패했습니다.');
        return;
      }
      showSuccess(!currentActive ? '팀원을 활성화했습니다.' : '팀원을 비활성화했습니다.');
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, isActive: !currentActive } : m))
      );
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  }

  function openDeleteConfirm(userId: string) {
    setPendingDelete(userId);
    setConfirmOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/org/members/${pendingDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '삭제에 실패했습니다.');
        return;
      }
      showSuccess('팀원을 삭제했습니다.');
      setMembers((prev) => prev.filter((m) => m.userId !== pendingDelete));
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setPendingDelete(null);
    }
  }

  async function handleCreateInvite() {
    setCreating(true);
    setCreatedUrl(null);
    try {
      const res = await fetch('/api/org/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, note: newNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '초대 링크 생성에 실패했습니다.');
        return;
      }
      setCreatedUrl(data.invite.url);
      setNewNote('');
      await fetchInvites();
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('클립보드 복사에 실패했습니다.');
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      const res = await fetch(`/api/org/invite?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) {
        showError('초대 링크 취소에 실패했습니다.');
        return;
      }
      showSuccess('초대 링크를 취소했습니다.');
      setInvites((prev) => prev.filter((t) => t.id !== id));
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  }

  const deletingMember = members.find((m) => m.userId === pendingDelete);

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">팀원 관리</h1>
      </div>

      {/* 현재 팀원 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">현재 팀원</h2>
        <div className="space-y-2">
          {loadingMembers ? (
            <>
              <ShimmerCard />
              <ShimmerCard />
              <ShimmerCard />
            </>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
              <UserX className="w-8 h-8" />
              <p className="text-sm">등록된 팀원이 없습니다.</p>
            </div>
          ) : (
            members.map((member) => {
              const initial = (member.displayName ?? '?')[0].toUpperCase();
              return (
                <div
                  key={member.userId}
                  className={`flex items-center gap-3 p-4 bg-white rounded-xl border transition-colors ${
                    member.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                  }`}
                >
                  {/* 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-semibold text-gray-600">
                    {initial}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {member.displayName ?? '이름 없음'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      가입일 {new Date(member.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>

                  {/* 활성화 토글 */}
                  <button
                    onClick={() => handleToggleActive(member.userId, member.isActive)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={member.isActive ? '비활성화' : '활성화'}
                    title={member.isActive ? '비활성화' : '활성화'}
                  >
                    {member.isActive
                      ? <ToggleRight className="w-6 h-6 text-green-500" />
                      : <ToggleLeft className="w-6 h-6" />
                    }
                  </button>

                  {/* 삭제 */}
                  <button
                    onClick={() => openDeleteConfirm(member.userId)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    aria-label="삭제"
                    title="팀원 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 초대 링크 생성 */}
      <section className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">초대 링크 생성</h2>

        <div className="space-y-2">
          <label className="block text-xs text-gray-500 font-medium">역할</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="OWNER">대리점장 (OWNER)</option>
            <option value="AGENT">판매원 (AGENT)</option>
            <option value="FREE_SALES">프리세일즈 (FREE_SALES)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-gray-500 font-medium">메모 (선택)</label>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="예: 박팀장님께 전달"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={handleCreateInvite}
          disabled={creating}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          초대 링크 생성
        </button>

        {createdUrl && (
          <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-700 truncate flex-1">{createdUrl}</p>
            <button
              onClick={() => handleCopy(createdUrl)}
              className="text-blue-600 hover:text-blue-800 shrink-0"
              aria-label="복사"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {copied && <span className="text-xs text-green-600 shrink-0">복사됨!</span>}
          </div>
        )}
      </section>

      {/* 초대 링크 목록 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">초대 링크 목록</h2>
        {loadingInvites ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">생성된 초대 링크가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => {
              const statusLabel = invite.isUsed ? '사용됨' : invite.isExpired ? '만료' : '유효';
              const statusClass = invite.isUsed
                ? 'bg-gray-100 text-gray-500'
                : invite.isExpired
                ? 'bg-red-100 text-red-600'
                : 'bg-green-100 text-green-700';
              const canCancel = !invite.isUsed && !invite.isExpired;

              return (
                <div
                  key={invite.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[invite.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[invite.role] ?? invite.role}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {invite.note && (
                      <p className="text-xs text-gray-500 truncate">{invite.note}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      만료: {new Date(invite.expiresAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium transition-colors"
                    >
                      취소
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmOpen}
        title="팀원 삭제"
        message={`${deletingMember?.displayName ?? '이 팀원'}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
