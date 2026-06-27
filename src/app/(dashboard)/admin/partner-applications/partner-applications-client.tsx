'use client';

import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle, XCircle, Clock, ChevronRight, RefreshCw,
  ExternalLink, X, ZoomIn, Loader2,
} from 'lucide-react';

type ContractStatus = 'submitted' | 'PROCESSING' | 'APPROVED' | 'rejected';

interface Application {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: ContractStatus;
  createdAt: string;
  metadata: {
    type?: string;
    supervisorName?: string;
    supervisorAgency?: string;
    supervisorPhone?: string;
    snsChannels?: Record<string, string>;
    applyNote?: string;
    approvedAt?: string;
    rejectedAt?: string;
    rejectReason?: string;
    idPhotoUrl?: string;
    bankBookUrl?: string;
    idPhotoDriveId?: string;
    bankBookDriveId?: string;
  } | null;
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; icon: React.ReactNode }> = {
  submitted: { label: '검토 대기', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  PROCESSING: { label: '처리 중', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  APPROVED: { label: '승인 완료', color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  rejected: { label: '반려', color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> },
};

// SNS 채널별 아이덴티티 (의존성 없이 색/라벨로 직관화)
const SNS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  youtube: { label: '유튜브', dot: 'bg-red-500', text: 'text-red-600' },
  instagram: { label: '인스타그램', dot: 'bg-pink-500', text: 'text-pink-600' },
  blog: { label: '블로그', dot: 'bg-green-500', text: 'text-green-600' },
  kakao: { label: '카카오채널', dot: 'bg-yellow-400', text: 'text-yellow-700' },
  etc: { label: '기타', dot: 'bg-gray-400', text: 'text-gray-600' },
};

// 자주 쓰는 반려 사유 프리셋
const REJECT_REASONS = ['서류 미제출', 'SNS 채널 부적합', '정보 불일치', '중복 신청'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * URL 안전 정규화 — 외부 공개 신청폼발 입력이므로 신뢰 불가.
 * http(s)만 허용, javascript:/data:/vbscript: 등 스킴 차단. 부적합 시 null.
 */
function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ── 라이트박스 (이미지 확대) ───────────────────────────────────────────
function Lightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/85 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={src} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 bg-white/90 text-gray-800 rounded-lg text-sm font-medium hover:bg-white">
          <ExternalLink className="w-4 h-4" /> 원본 열기
        </a>
        <button onClick={onClose} className="p-2 bg-white/90 text-gray-800 rounded-lg hover:bg-white" aria-label="닫기">
          <X className="w-5 h-5" />
        </button>
      </div>
      <Image
        src={src} alt={label} width={1200} height={1600} unoptimized
        className="max-h-[88vh] w-auto object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// 서류 src 해석: Drive fileId → 관리자 프록시 경로 / 레거시 base64·URL 폴백
function docSrc(app: Application, kind: 'idPhoto' | 'bankBook'): string | null {
  const m = app.metadata;
  if (!m) return null;
  const driveId = kind === 'idPhoto' ? m.idPhotoDriveId : m.bankBookDriveId;
  if (typeof driveId === 'string' && driveId) {
    return `/api/affiliate/contracts/${app.id}/document?kind=${kind}`;
  }
  const legacy = kind === 'idPhoto' ? m.idPhotoUrl : m.bankBookUrl;
  if (typeof legacy === 'string' && legacy) {
    if (legacy.startsWith('data:image/')) return legacy; // 레거시 base64
    return safeHref(legacy);                              // 레거시 외부 URL
  }
  return null;
}

// ── 첨부 서류 슬롯 (클릭 시에만 로드 → 라이트박스 확대) ──────────────────
function DocSlot({ label, src, status }: { label: string; src: string | null; status: ContractStatus }) {
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  if (!src) {
    // 검토 대기인데 미제출이면 주의(amber), 그 외엔 회색 점선
    const warn = status === 'submitted';
    return (
      <div className="space-y-1">
        <p className="text-xs text-gray-400">{label}</p>
        <div className={`rounded-xl py-4 text-center text-sm border border-dashed ${warn ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 bg-white text-gray-400'}`}>
          미제출
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400">{label}</p>
      {loaded ? (
        <button onClick={() => setLightbox(true)} className="relative block w-full group" aria-label={`${label} 확대`}>
          <span className="block w-full aspect-[3/2] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
            <Image src={src} alt={label} width={400} height={267} unoptimized loading="lazy"
              className="w-full h-full object-cover" />
          </span>
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 rounded-xl transition-colors">
            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </button>
      ) : (
        <button onClick={() => setLoaded(true)}
          className="w-full text-sm bg-white border border-gray-200 rounded-xl py-3 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1">
          <ZoomIn className="w-3.5 h-3.5" /> 확인
        </button>
      )}
      {lightbox && <Lightbox src={src} label={label} onClose={() => setLightbox(false)} />}
    </div>
  );
}

// ── 상세 모달 ──────────────────────────────────────────────────────────
function DetailModal({
  app, actionLoading, onApprove, onReject, onCreateAccount, onClose,
}: {
  app: Application;
  actionLoading: number | null;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onCreateAccount: (id: number) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const meta = app.metadata;
  const am = meta as Record<string, unknown> | null; // 동적 메타(documentsSubmittedAt·accountCreated 등)
  const statusCfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.submitted;
  const busy = actionLoading === app.id;
  const isPending = app.status === 'submitted';

  // ESC 닫기(반려 패널 열려있으면 그것부터) + 포커스 트랩 + body 스크롤 락
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rejecting) { setRejecting(false); return; }
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, rejecting]);

  const snsEntries = meta?.snsChannels
    ? Object.entries(meta.snsChannels).filter(([, v]) => safeHref(v))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => !busy && onClose()}>
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby="app-modal-title"
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 (sticky) */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-700 font-bold text-sm">{(app.name || '?')[0]}</span>
            </div>
            <div className="min-w-0">
              <h3 id="app-modal-title" className="font-bold text-gray-900 text-base truncate">{app.name}</h3>
              <p className="text-sm text-gray-500">{app.phone} · {formatDate(app.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${statusCfg.color}`}>
              {statusCfg.icon}{statusCfg.label}
            </span>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
          {/* 반려된 건이면 사유 배너 */}
          {app.status === 'rejected' && meta?.rejectReason && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
              <span className="font-semibold">반려 사유</span> · {meta.rejectReason}
            </div>
          )}

          {/* 담당 지사장 */}
          {meta?.supervisorName && (
            <div className="bg-white rounded-xl border border-gray-100 border-l-2 border-l-teal-300 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">담당 지사장</p>
              <p className="text-sm text-gray-900 font-medium">
                {meta.supervisorName} <span className="text-gray-500 font-normal">({meta.supervisorAgency || '-'})</span>
              </p>
              {meta.supervisorPhone && <p className="text-sm text-gray-500 mt-0.5">{meta.supervisorPhone}</p>}
            </div>
          )}

          {/* 기본 정보 */}
          {(app.email || app.address) && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">기본 정보</p>
              <div className="grid grid-cols-2 gap-3">
                {app.email && (
                  <div><p className="text-xs text-gray-400 mb-0.5">이메일</p><p className="text-sm text-gray-900 break-all">{app.email}</p></div>
                )}
                {app.address && (
                  <div><p className="text-xs text-gray-400 mb-0.5">주소</p><p className="text-sm text-gray-900">{app.address}</p></div>
                )}
              </div>
            </div>
          )}

          {/* SNS 채널 */}
          {snsEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">SNS 채널</p>
              <div className="flex flex-wrap gap-2">
                {snsEntries.map(([key, url]) => {
                  const cfg = SNS_CONFIG[key] ?? SNS_CONFIG.etc;
                  const href = safeHref(url)!;
                  return (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                      aria-label={`${cfg.label} 새 탭으로 열기`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition text-sm">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* 지원 동기 */}
          {meta?.applyNote && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">지원 동기</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words bg-blue-50/40 rounded-lg p-3">
                {meta.applyNote}
              </p>
            </div>
          )}

          {/* 첨부 서류 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">첨부 서류</p>
            <div className="grid grid-cols-2 gap-2">
              <DocSlot label="신분증" src={docSrc(app, 'idPhoto')} status={app.status} />
              <DocSlot label="통장사본" src={docSrc(app, 'bankBook')} status={app.status} />
            </div>
          </div>

          {/* 처리 이력 */}
          {meta?.approvedAt && <p className="text-sm text-green-600 px-1">승인: {formatDate(meta.approvedAt)}</p>}
          {meta?.rejectedAt && <p className="text-sm text-red-500 px-1">반려: {formatDate(meta.rejectedAt)}</p>}
        </div>

        {/* 액션바 (sticky 하단) */}
        {isPending ? (
          <div className="flex-shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur px-5 py-4">
            {rejecting ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">반려 사유 (선택)</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {REJECT_REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setReason(r)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${reason === r ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                    placeholder="신청자에게 전달할 반려 사유를 입력하세요"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                    취소
                  </button>
                  <button onClick={() => onReject(app.id, reason)} disabled={busy}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} 반려 확정
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setRejecting(true)} disabled={busy}
                  className="flex-1 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4" /> 반려
                </button>
                <button onClick={() => onApprove(app.id)} disabled={busy}
                  className="flex-[2] py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} 승인
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-4 space-y-2">
            <div className={`flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border ${statusCfg.color}`}>
              {statusCfg.icon}{statusCfg.label}
            </div>
            {/* 서류 제출 완료 + 미발급 → 계정 생성(최종 승인). 서류는 위 '첨부 서류'에서 확인 후. */}
            {app.status === 'APPROVED' && Boolean(am?.documentsSubmittedAt) && !am?.accountCreated && (
              <button onClick={() => onCreateAccount(app.id)} disabled={busy}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} 서류 확인 완료 — 계정 생성
              </button>
            )}
            {Boolean(am?.accountCreated) && (
              <p className="text-center text-sm text-emerald-600 font-medium">✅ 계정 발급됨 (아이디: {String(am?.presalesPartnerId ?? '')})</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 목록 카드 (요약만, 클릭 시 모달) ─────────────────────────────────────
const ApplicationCard = memo(function ApplicationCard({ app, onClick }: { app: Application; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.submitted;
  const meta = app.metadata;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition px-5 py-4 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-blue-700 font-bold text-sm">{(app.name || '?')[0]}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{app.name}</p>
          <p className="text-sm text-gray-500">{app.phone}</p>
          {meta?.supervisorName && (
            <p className="text-xs text-teal-600 mt-0.5 truncate">담당: {meta.supervisorName} ({meta.supervisorAgency || '-'})</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${statusCfg.color}`}>
          {statusCfg.icon}{statusCfg.label}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
});

// ── 클라이언트 컴포넌트 ──────────────────────────────────────────────────────
interface PartnerApplicationsClientProps {
  initialRole: string;
}

export default function PartnerApplicationsClient({ initialRole: _initialRole }: PartnerApplicationsClientProps) {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('submitted');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const refreshApplications = useCallback(async (signal?: AbortSignal, overridePage?: number) => {
    setIsLoading(true);
    try {
      const currentPage = overridePage ?? page;
      const res = await fetch(
        `/api/affiliate/contracts?status=${statusFilter}&page=${currentPage}&type=CRUISE_PARTNER`,
        { signal },
      );
      const data = await res.json();
      if (data?.ok) {
        setApplications((data.data?.contracts ?? []) as Application[]);
        setTotalPages(data.data?.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [statusFilter, showToast, page]);

  // 상태 필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // 권한 확인 (GLOBAL_ADMIN만)
  useEffect(() => {
    const ctrl = new AbortController();
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', signal: ctrl.signal });
        if (!res.ok) { router.push('/'); return; }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') { router.push('/'); return; }
        setAuthChecked(true);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        router.push('/');
      }
    };
    checkAuth();
    return () => ctrl.abort();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    const ctrl = new AbortController();
    refreshApplications(ctrl.signal);
    return () => ctrl.abort();
  }, [authChecked, refreshApplications]);

  // 선택 항목 파생 (stale 방지) — 목록에서 사라지면 모달 자동 닫힘
  const selected = applications.find((a) => a.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId !== null && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  // 낙관적 업데이트: 현재 필터와 안 맞으면 목록에서 제거, 맞으면 status 패치
  const applyLocal = useCallback((id: number, status: ContractStatus, extraMeta?: Record<string, unknown>) => {
    setApplications((prev) => {
      const keep = statusFilter === 'all' || statusFilter === status;
      if (!keep) return prev.filter((a) => a.id !== id);
      return prev.map((a) => (a.id === id
        ? { ...a, status, metadata: { ...(a.metadata ?? {}), ...extraMeta } }
        : a));
    });
  }, [statusFilter]);

  const handleApprove = useCallback(async (id: number) => {
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/affiliate/contracts/${id}/simple-approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data?.ok) {
        applyLocal(id, 'APPROVED', { approvedAt: new Date().toISOString() });
        setSelectedId(null);
        showToast('승인되었습니다.', 'success');
      } else {
        showToast(data?.message || '승인 실패', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading, applyLocal, showToast]);

  // 서류 확인 후 무료 파트너스 계정 생성(최종 승인)
  const handleCreateAccount = useCallback(async (id: number) => {
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/affiliate/contracts/${id}/presales-create-account`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data?.ok) {
        applyLocal(id, 'APPROVED', { accountCreated: true, presalesPartnerId: data?.data?.partnerId });
        showToast(data?.message || '계정이 생성되었습니다.', 'success');
        if (data?.data?.tempPassword) {
          window.alert(`이메일 미발송 — 아이디: ${data.data.partnerId} / 임시비번: ${data.data.tempPassword}\n신청자에게 직접 전달하세요.`);
        }
      } else {
        showToast(data?.message || '계정 생성 실패', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading, applyLocal, showToast]);

  const handleReject = useCallback(async (id: number, reason: string) => {
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/affiliate/contracts/${id}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data?.ok) {
        applyLocal(id, 'rejected', { rejectedAt: new Date().toISOString(), rejectReason: reason });
        setSelectedId(null);
        showToast('반려되었습니다.', 'success');
      } else {
        showToast(data?.message || '반려 실패', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading, applyLocal, showToast]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">파트너스 신청 관리</h1>
              <p className="text-sm text-gray-500 mt-0.5">크루즈닷 파트너스 가입 신청 검토</p>
            </div>
            <button onClick={() => refreshApplications()} className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition" aria-label="새로고침">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 상태 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { value: 'submitted', label: '검토 대기' },
            { value: 'APPROVED', label: '승인 완료' },
            { value: 'rejected', label: '반려' },
            { value: 'all', label: '전체' },
          ] as const).map((item) => (
            <button key={item.value} onClick={() => setStatusFilter(item.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                statusFilter === item.value ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {item.label}
            </button>
          ))}
        </div>

        {/* 결과 요약 */}
        {!isLoading && (
          <p className="text-sm text-gray-500">
            총 <strong className="text-gray-800">{applications.length}건</strong>
            {statusFilter === 'submitted' && applications.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">검토가 필요합니다</span>
            )}
          </p>
        )}

        {/* 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />)}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CheckCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              {statusFilter === 'submitted' ? '검토 대기 중인 신청이 없습니다.' : '해당하는 신청이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app} onClick={() => setSelectedId(app.id)} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-4 py-3 rounded-xl bg-gray-100 disabled:opacity-40 text-base font-medium hover:bg-gray-200 transition-colors"
            >
              이전
            </button>
            <span className="text-base text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="px-4 py-3 rounded-xl bg-gray-100 disabled:opacity-40 text-base font-medium hover:bg-gray-200 transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selected && (
        <DetailModal
          app={selected}
          actionLoading={actionLoading}
          onApprove={handleApprove}
          onReject={handleReject}
          onCreateAccount={handleCreateAccount}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white ${
          toastMsg.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}
