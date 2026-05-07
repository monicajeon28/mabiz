'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  X,
  Loader2,
  ShieldOff,
  Users,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

type Org = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  contractRef: string | null;
  memberCount: number;
  createdAt: string;
};

// ─── Badge helpers ────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  TERMINATED: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '운영중',
  SUSPENDED: '정지',
  TERMINATED: '해지',
};

function planBadge(plan: string): string {
  if (plan === 'PRO') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}

// ─── Shimmer skeleton ────────────────────────────────────────

function ShimmerOrgCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-5 w-14 bg-gray-100 rounded-full" />
          <div className="h-5 w-10 bg-gray-100 rounded-full" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-gray-100 rounded" />
        <div className="h-4 w-20 bg-gray-100 rounded" />
      </div>
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  );
}

// ─── Registration modal ──────────────────────────────────────

interface RegisterModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function RegisterModal({ onClose, onCreated }: RegisterModalProps) {
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) { showError('대리점명을 입력해 주세요.'); return; }
    if (!ownerName.trim()) { showError('대표자명을 입력해 주세요.'); return; }
    if (!ownerPhone.trim()) { showError('연락처를 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message ?? '등록에 실패했습니다.');
        return;
      }
      showSuccess('대리점을 등록했습니다.');
      onCreated();
      onClose();
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">신규 대리점 수동 등록</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              대리점명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="예: 크루즈닷몰 부산지점"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              대표자명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="예: 010-1234-5678"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Org card ─────────────────────────────────────────────────

function OrgCard({ org }: { org: Org }) {
  const statusClass = STATUS_BADGE[org.status] ?? 'bg-gray-100 text-gray-600';
  const statusLabel = STATUS_LABELS[org.status] ?? org.status;

  return (
    <Link
      href={`/settings/organization?orgId=${org.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 md:p-5 hover:border-blue-300 hover:shadow-sm transition-all space-y-3"
    >
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-900 text-sm truncate">{org.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
            {statusLabel}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planBadge(org.plan)}`}>
            {org.plan}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {org.memberCount}명
        </span>
        <span>계약번호: {org.contractRef ?? '없음'}</span>
      </div>

      {/* Created date */}
      <p className="text-xs text-gray-400">
        등록일: {new Date(org.createdAt).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // Verify role
      const meRes = await fetch('/api/auth/me', { signal });
      if (meRes.status === 401 || meRes.status === 403) {
        setForbidden(true);
        return;
      }
      if (!meRes.ok) throw new Error('me fetch failed');
      const me = await meRes.json();
      if (me?.role !== 'GLOBAL_ADMIN') {
        setForbidden(true);
        return;
      }

      // Fetch org list
      const orgRes = await fetch('/api/admin/organizations', { signal });
      if (!orgRes.ok) throw new Error('orgs fetch failed');
      const data = await orgRes.json();
      setOrgs(data.organizations ?? []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      showError('대리점 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  function handleCreated() {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal);
  }

  // ── 403 state ──
  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <ShieldOff className="w-12 h-12 text-red-400" />
        <h1 className="text-xl font-bold text-gray-800">접근 권한 없음</h1>
        <p className="text-sm text-gray-500">
          이 페이지는 GLOBAL_ADMIN 전용입니다. 권한이 없으면 접근할 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">대리점 관리</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          대리점 등록
        </button>
      </div>

      {/* Org list */}
      <section className="space-y-3">
        {loading ? (
          <>
            <ShimmerOrgCard />
            <ShimmerOrgCard />
            <ShimmerOrgCard />
          </>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Building2 className="w-10 h-10" />
            <p className="text-sm">등록된 대리점이 없습니다.</p>
          </div>
        ) : (
          orgs.map((org) => <OrgCard key={org.id} org={org} />)
        )}
      </section>

      {/* Registration modal */}
      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
