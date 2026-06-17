'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, UserX,
  ToggleLeft, ToggleRight, Trash2, FileText,
  Upload, X, Download, KeyRound, Copy, Check,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type Member = {
  id: string;
  userId: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  isGoldMember: boolean;
  goldMemberSince: string | null;
};

type MemberDoc = {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  status: string;
  uploadedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER:      '대리점장',
  AGENT:      '판매원',
  FREE_SALES: '프리세일즈',
};

const ROLE_BADGE: Record<string, string> = {
  OWNER:      'bg-amber-100 text-amber-700',
  AGENT:      'bg-blue-100 text-blue-700',
  FREE_SALES: 'bg-green-100 text-green-700',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ID_CARD:      '신분증',
  BANK_ACCOUNT: '계좌사본',
  CONTRACT:     '계약서',
  OTHER:        '기타',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

// ─── 서류 패널 ──────────────────────────────────────────────────────────
function MemberDocumentPanel({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<MemberDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('ID_CARD');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/members/${userId}/documents`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      showError('서류 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  async function handleUpload() {
    if (!file) { showError('파일을 선택해 주세요.'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('docType', docType);
      const res = await fetch(`/api/org/members/${userId}/documents`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '업로드 실패'); return; }
      showSuccess('서류를 업로드했습니다.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocs();
    } catch {
      showError('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc() {
    if (!pendingDocId) return;
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/org/members/${userId}/documents/${pendingDocId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) { showError('삭제에 실패했습니다.'); return; }
      showSuccess('서류를 삭제했습니다.');
      setDocs((prev) => prev.filter((d) => d.id !== pendingDocId));
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setPendingDocId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
        <p className="text-sm font-semibold text-gray-600">서류 업로드</p>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && <p className="text-sm text-gray-500 truncate">{file.name} ({formatBytes(file.size)})</p>}
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Upload className="w-4 h-4" />
          업로드
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-600">
          <FileText className="w-7 h-7" />
          <p className="text-sm">등록된 서류가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
              <FileText className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {DOC_TYPE_LABELS[doc.docType] ?? doc.docType} · {formatBytes(doc.fileSize)}
                </p>
                <p className="text-sm text-gray-600">{new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 p-1"
                  aria-label="다운로드"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => { setPendingDocId(doc.id); setConfirmOpen(true); }}
                  className="text-red-400 hover:text-red-600 p-1"
                  aria-label="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="서류 삭제"
        message="이 서류를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDeleteDoc}
        onCancel={() => { setConfirmOpen(false); setPendingDocId(null); }}
      />
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers]         = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [myUserId, setMyUserId]       = useState<string | null>(null);

  // 멤버 삭제 컨펌
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // 서류 슬라이드 오버
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // 비밀번호 관리 (확인 + 임시 발급)
  const [resetTargetId,   setResetTargetId]   = useState<string | null>(null);
  const [resetTargetName, setResetTargetName] = useState<string>('');
  const [tempPassword,    setTempPassword]    = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [resetLoading,    setResetLoading]    = useState(false);
  const [pwCopied,        setPwCopied]        = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const sig = ctrl.signal;

    setLoadingMembers(true);

    try {
      const [membersRes, meRes] = await Promise.all([
        fetch('/api/org/members', { signal: sig }),
        fetch('/api/auth/me',     { signal: sig }),
      ]);

      if (sig.aborted) return;

      const membersData = await membersRes.json();
      const meData      = await meRes.json();

      if (sig.aborted) return;

      setMembers(membersData.members ?? []);
      if (meData.userId) setMyUserId(meData.userId);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      showError('데이터를 불러오지 못했습니다.');
    } finally {
      if (!sig.aborted) {
        setLoadingMembers(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => { abortRef.current?.abort(); };
  }, [fetchAll]);

  async function handleToggleActive(userId: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/org/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '변경에 실패했습니다.'); return; }
      showSuccess(!currentActive ? '팀원을 활성화했습니다.' : '팀원을 비활성화했습니다.');
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, isActive: !currentActive } : m))
      );
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/org/members/${pendingDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '삭제에 실패했습니다.'); return; }
      showSuccess('팀원을 삭제했습니다.');
      setMembers((prev) => prev.filter((m) => m.userId !== pendingDelete));
      if (selectedMember?.userId === pendingDelete) setSelectedMember(null);
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setPendingDelete(null);
    }
  }

  const deletingMember = members.find((m) => m.userId === pendingDelete);

  function openPwModal(member: Member) {
    setResetTargetId(member.id);
    setResetTargetName(member.displayName ?? '팀원');
    setTempPassword(null);
    setCurrentPassword(null);
    setPwCopied(false);
    // 현재 비밀번호 즉시 조회
    fetch(`/api/admin/members/${member.id}/password`)
      .then(r => r.json())
      .then(d => { if (d.ok) setCurrentPassword(d.hasPassword ? '(비밀번호 설정됨)' : '(미설정)'); })
      .catch(() => { setCurrentPassword('(조회 실패)'); });
  }

  async function handleResetPassword(memberId: string) {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '발급에 실패했습니다.'); return; }
      setTempPassword(data.tempPassword);
      setCurrentPassword(data.tempPassword);
    } catch {
      showError('요청 중 오류가 발생했습니다.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleChangeRole(member: Member) {
    const labels: Record<string, string> = { OWNER: '대리점장', AGENT: '판매원', FREE_SALES: '프리세일즈' };
    const currentLabel = labels[member.role] ?? member.role;
    const targetLabel = prompt(
      `역할 변경: 현재 [${currentLabel}]\n새 역할 입력 (대리점장 / 판매원 / 프리세일즈)`
    );
    const roleMap: Record<string, string> = {
      '대리점장': 'OWNER',
      '판매원': 'AGENT',
      '프리세일즈': 'FREE_SALES',
    };
    const newRole = roleMap[targetLabel?.trim() ?? ''];
    if (!newRole) return;
    if (newRole === member.role) { showError('현재와 같은 역할입니다.'); return; }
    try {
      const res = await fetch('/api/org/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, role: newRole }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('역할을 변경했습니다.');
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
        );
      } else {
        showError(data.message ?? '역할 변경 실패');
      }
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  }

  function copyPassword(pw: string) {
    navigator.clipboard.writeText(pw).then(() => {
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 3000);
    });
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-600 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">팀원 관리</h1>
      </div>

      {/* 현재 팀원 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">현재 팀원</h2>
        <div className="space-y-2">
          {loadingMembers ? (
            <><ShimmerCard /><ShimmerCard /><ShimmerCard /></>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-600">
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
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-semibold text-gray-600">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {member.displayName ?? '이름 없음'}
                      </span>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {member.isGoldMember && (
                        <span className="text-sm px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                          골드회원 ★
                        </span>
                      )}
                    </div>
                    {member.isGoldMember && member.goldMemberSince && (
                      <p className="text-[10px] text-yellow-600 mt-0.5">
                        골드 가입: {new Date(member.goldMemberSince).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        서류 관리
                      </button>
                      <button
                        onClick={() => openPwModal(member)}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        비밀번호 확인
                      </button>
                      {myUserId !== member.userId && (
                        <button
                          onClick={() => handleChangeRole(member)}
                          className="text-sm text-purple-600 hover:underline"
                        >
                          역할 변경
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(member.userId, member.isActive)}
                    className="text-gray-600 hover:text-gray-600 transition-colors"
                    aria-label={member.isActive ? '비활성화' : '활성화'}
                  >
                    {member.isActive
                      ? <ToggleRight className="w-6 h-6 text-green-500" />
                      : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => { setPendingDelete(member.userId); setConfirmOpen(true); }}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 멤버 삭제 확인 */}
      <ConfirmDialog
        open={confirmOpen}
        title="팀원 삭제"
        message={`${deletingMember?.displayName ?? '이 팀원'}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />

      {/* 비밀번호 확인 + 임시 발급 모달 */}
      {resetTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setResetTargetId(null); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">비밀번호 관리</h3>
              <button onClick={() => setResetTargetId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{resetTargetName}</p>

            {/* 현재 비밀번호 */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">현재 비밀번호</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                {currentPassword === null ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <>
                    <span className="font-mono font-bold text-base tracking-widest text-gray-900">
                      {currentPassword}
                    </span>
                    {currentPassword !== '(미설정)' && currentPassword !== '(조회 실패)' && (
                      <button onClick={() => copyPassword(currentPassword)} className="shrink-0 text-gray-400 hover:text-gray-700">
                        {pwCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>
              {pwCopied && <p className="text-xs text-green-600">복사됐습니다.</p>}
            </div>

            {/* 임시 비밀번호 발급 */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-500">새 임시 비밀번호를 발급하면 기존 비밀번호가 즉시 변경됩니다.</p>
              {tempPassword && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
                  ✓ 임시 비밀번호 발급 완료 — 위 비밀번호가 업데이트됐습니다.
                </div>
              )}
              <button
                onClick={() => handleResetPassword(resetTargetId)}
                disabled={resetLoading}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                임시 비밀번호 발급
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서류 슬라이드 오버 */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedMember(null)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                {selectedMember.displayName ?? '팀원'} 서류
              </h2>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-600 hover:text-gray-600"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <MemberDocumentPanel userId={selectedMember.userId} />
          </div>
        </div>
      )}

    </div>
  );
}
