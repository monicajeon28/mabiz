'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiLink,
  FiShoppingCart,
  FiDollarSign,
  FiUser,
  FiFileText,
  FiUsers,
  FiRefreshCw,
  FiCheckCircle,
  FiClock,
  FiArrowRight,
  FiTrendingUp,
  FiAlertTriangle,
  FiAlertCircle,
  FiXCircle,
  FiActivity,
  FiCopy,
  FiCalendar,
  FiUpload,
  FiPhone,
  FiMessageSquare,
  FiAlertOctagon,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import { csrfFetch } from '@/lib/csrf-client';
import { logger } from '@/lib/logger';
import CallScriptSection from '@/components/partner/CallScriptSection';
import CallScriptSearch from '@/components/partner/CallScriptSearch';
import HeroBanner from '@/components/partner/dashboard/HeroBanner';

interface AffiliateProfileBasic {
  id: number;
  type: string;
  displayName: string | null;
  nickname: string | null;
  affiliateCode: string | null;
  status: string;
  isActive: boolean;
  landingSlug: string | null;
}

type PartnerDashboardProps = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: AffiliateProfileBasic;
  trialInfo?: {
    trialEndDate: string | null;
    daysRemaining: number | null;
  } | null;
};

interface CustomerSummary {
  totalSaleAmount: number;
  totalCommission: number;
  purchaseCount: number;
  trialCount: number;
}

interface AccountStatus {
  isActive: boolean;
  riskLevel: 'safe' | 'warning' | 'danger' | 'deactivated';
  rollingCommission: number;
  recentSalesCount: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number;
  daysUntilDeactivation: number;
  gracePeriodDaysLeft: number;
  monthsSinceJoin: number;
  isGracePeriod: boolean;
  deactivationReason: string | null;
}

interface PurchasedCustomer {
  leadId: number;
  maskedName: string | null;
  customerType: 'PURCHASE' | 'TRIAL_ACTIVE' | 'TRIAL_ENDED';
  productName: string | null;
  cabinType: string | null;
  paymentMethod: string | null;
  hasPassport: boolean;
  purchaseDate: string | null;
  commissionAmount: number;
}

interface LeadItem {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  leadStage: string | null;
  notes: string | null;
  isDuplicate?: boolean;
}

interface TripCommission {
  tripId: number;
  productCode: string | null;
  shipName: string | null;
  departureDate: string | null;
  daysUntilDeparture: number | null;
  buyerCount: number;
  expectedCommission: number;
  tripStatus: 'upcoming' | 'departed' | 'confirmed';
}

export default function SalesAgentDashboard({ user, profile, trialInfo }: PartnerDashboardProps) {
  const router = useRouter();
  const partnerId = user.mallUserId;
  const partnerBase = `/partner/${partnerId}`;

  const isBranchManager = profile.type === 'BRANCH_MANAGER';
  const displayName =
    profile.displayName || profile.nickname || user.mallNickname || user.name || '파트너';

  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [customers, setCustomers] = useState<PurchasedCustomer[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissionTrips, setCommissionTrips] = useState<TripCommission[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hasIdCard, setHasIdCard] = useState(false);
  const [hasBankbook, setHasBankbook] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [uploadingBankbook, setUploadingBankbook] = useState(false);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [noteLeadId, setNoteLeadId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [customersRes, statusRes, commissionRes, docsRes, leadsRes] = await Promise.all([
        fetch('/api/partner/my-customers?limit=5'),
        fetch('/api/partner/account-status'),
        fetch('/api/partner/commission-by-trip'),
        fetch('/api/user/my-documents'),
        fetch('/api/partner/customers?limit=5&sortBy=lastContact'),
      ]);

      // 세션 만료 시 로그인으로 이동
      if ([customersRes, statusRes, commissionRes, docsRes, leadsRes].some(r => r.status === 401)) {
        router.push('/partner');
        return;
      }

      if (customersRes.ok) {
        const data = await customersRes.json();
        if (data.ok) {
          setSummary(data.summary);
          setCustomers(
            (data.customers as PurchasedCustomer[])
              .filter((c) => c.customerType === 'PURCHASE')
              .slice(0, 5),
          );
        }
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.ok) setAccountStatus(statusData.data);
      }
      if (commissionRes.ok) {
        const commissionData = await commissionRes.json();
        if (commissionData.ok) {
          setCommissionTrips(commissionData.trips ?? []);
          setTotalPending(commissionData.totalPending ?? 0);
        }
      }
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        if (docsData.ok) {
          setHasIdCard(docsData.data?.hasIdCard ?? false);
          setHasBankbook(docsData.data?.hasBankbook ?? false);
        }
      }
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.ok && Array.isArray(leadsData.customers)) {
          const allLeads = leadsData.customers as Array<{
            id: number; customerName?: string | null; customerPhone?: string | null;
            status?: string; leadStage?: string | null; notes?: string | null;
          }>;
          // 전화번호 기준 중복 감지
          const phoneCount = new Map<string, number>();
          allLeads.forEach(l => { if (l.customerPhone) phoneCount.set(l.customerPhone, (phoneCount.get(l.customerPhone) ?? 0) + 1); });
          setLeads(allLeads.map(l => ({
            id: l.id,
            customerName: l.customerName ?? null,
            customerPhone: l.customerPhone ?? null,
            status: l.status ?? 'NEW',
            leadStage: l.leadStage ?? null,
            notes: l.notes ?? null,
            isDuplicate: l.customerPhone ? (phoneCount.get(l.customerPhone) ?? 0) > 1 : false,
          })));
        }
      }
    } catch {
      showError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatWon = (amount: number) =>
    amount >= 10000
      ? `${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}만원`
      : `${amount.toLocaleString('ko-KR')}원`;

  const affiliateLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${user.mallUserId}/shop`
      : `/${user.mallUserId}/shop`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setLinkCopied(true);
      showSuccess('링크가 복사되었습니다!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showError('링크 복사에 실패했습니다.');
    }
  };

  const handleSaveNote = async (leadId: number) => {
    if (!noteText.trim()) { showError('메모 내용을 입력해주세요.'); return; }
    setSavingNote(true);
    try {
      const res = await csrfFetch(`/api/partner/customers/${leadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionType: 'CALL', note: noteText.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { showError(json.error || json.message || '저장 실패'); return; }
      showSuccess('상담 메모가 저장되었습니다.');
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: noteText.trim() } : l));
      setNoteLeadId(null);
      setNoteText('');
    } catch (err) {
      logger.debug('[SalesAgentDashboard] 메모 저장 오류', { err, leadId });
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDocumentUpload = async (file: File, documentType: 'ID_CARD' | 'BANKBOOK') => {
    if (file.size > 5 * 1024 * 1024) { showError('파일 크기는 5MB를 초과할 수 없습니다.'); return; }
    if (!file.type.startsWith('image/')) { showError('이미지 파일만 업로드 가능합니다.'); return; }
    const setter = documentType === 'ID_CARD' ? setUploadingIdCard : setUploadingBankbook;
    setter(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsDataURL(file);
      });
      const res = await csrfFetch('/api/user/my-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, imageData: base64 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { showError(json.error || '업로드에 실패했습니다.'); return; }
      showSuccess(documentType === 'ID_CARD' ? '신분증이 등록되었습니다.' : '통장사본이 등록되었습니다.');
      if (documentType === 'ID_CARD') setHasIdCard(true);
      else setHasBankbook(true);
    } catch (err) {
      logger.debug('[SalesAgentDashboard] 서류 업로드 오류', { err, documentType });
      showError('업로드 중 오류가 발생했습니다.');
    } finally {
      setter(false);
    }
  };

  // ── 계정 위험도 배너 ────────────────────────────────────────────────────────
  function AccountStatusBanner() {
    if (!accountStatus) return null;
    const s = accountStatus;

    if (s.riskLevel === 'deactivated') {
      return (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiXCircle className="text-red-600 text-lg shrink-0" />
            <p className="font-bold text-red-700 text-sm">계정이 비활성화되었습니다</p>
          </div>
          <p className="text-xs text-red-600 leading-relaxed">
            최근 5개월간 매출 실적이 없어 계정이 비활성화되었습니다.<br />
            재가입을 원하시면 담당 매니저에게 면담을 신청해주세요.
          </p>
          <Link
            href={`${partnerBase}/profile`}
            className="mt-3 inline-block rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            재가입 신청하기
          </Link>
        </div>
      );
    }

    if (s.riskLevel === 'danger') {
      return (
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiAlertCircle className="text-red-500 text-lg shrink-0 animate-pulse" />
            <p className="font-bold text-red-700 text-sm">⚠️ 계정 삭제 임박 — 지금 즉시 영업 시작!</p>
          </div>
          <div className="grid grid-cols-2 gap-2 my-3">
            <div className="rounded-xl bg-white border border-red-200 p-3 text-center">
              <p className="text-2xl font-black text-red-600">{s.daysUntilDeactivation}</p>
              <p className="text-xs text-red-500 mt-0.5">비활성화까지 남은 일수</p>
            </div>
            <div className="rounded-xl bg-white border border-red-200 p-3 text-center">
              <p className="text-lg font-black text-red-600">₩0</p>
              <p className="text-xs text-red-500 mt-0.5">최근 5개월 수당</p>
            </div>
          </div>
          <p className="text-xs text-red-600 leading-relaxed">
            오늘 기준 최근 5개월 매출이 0원입니다. 계약이 자동 해지되고 계정이 삭제됩니다.
            지금 바로 영업을 시작하세요!
          </p>
          <Link
            href={`${partnerBase}/links`}
            className="mt-3 inline-block rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            지금 구매링크 공유하기
          </Link>
        </div>
      );
    }

    if (s.riskLevel === 'warning') {
      return (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiAlertTriangle className="text-amber-500 text-lg shrink-0" />
            <p className="font-bold text-amber-700 text-sm">계정 비활성화 경고</p>
          </div>
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="rounded-xl bg-white border border-amber-200 p-2 text-center">
              <p className="text-xl font-black text-amber-600">{s.daysUntilDeactivation}</p>
              <p className="text-xs text-amber-500 mt-0.5">남은 일수</p>
            </div>
            <div className="rounded-xl bg-white border border-amber-200 p-2 text-center">
              <p className="text-base font-black text-amber-600">
                {s.rollingCommission > 0 ? formatWon(s.rollingCommission) : '₩0'}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">5개월 수당</p>
            </div>
            <div className="rounded-xl bg-white border border-amber-200 p-2 text-center">
              <p className="text-base font-black text-amber-600">{s.recentSalesCount}건</p>
              <p className="text-xs text-amber-500 mt-0.5">최근 실적</p>
            </div>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            {s.daysUntilDeactivation}일 후 계정이 자동 비활성화됩니다.
            매출을 발생시키면 비활성화가 자동 취소됩니다.
          </p>
        </div>
      );
    }

    // safe 이지만 유예 기간 중인 경우 (신규 가입 후 5개월 미만)
    if (s.gracePeriodDaysLeft > 0 && s.recentSalesCount === 0) {
      return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FiActivity className="text-blue-500 text-base shrink-0" />
            <p className="font-semibold text-blue-700 text-sm">유예 기간 중</p>
          </div>
          <p className="text-xs text-blue-600 leading-relaxed">
            가입 후 <strong>{s?.monthsSinceJoin ?? '-'}개월</strong> 경과 · 유예 기간{' '}
            <strong>{s.gracePeriodDaysLeft}일</strong> 남음<br />
            아직 5개월 유예 기간입니다. 지금 첫 판매를 시작해보세요!
          </p>
        </div>
      );
    }

    // safe + 실적 있음 → 5개월 수당 현황 표시
    if (s.recentSalesCount > 0) {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="text-emerald-500 text-base shrink-0" />
              <p className="text-xs font-semibold text-emerald-700">최근 5개월 실적</p>
            </div>
            <span className="text-xs text-emerald-600">계정 정상 유지 중</span>
          </div>
          <div className="mt-2 flex gap-3">
            <div className="text-center">
              <p className="text-base font-black text-emerald-700">{formatWon(s.rollingCommission)}</p>
              <p className="text-xs text-emerald-500">5개월 수당</p>
            </div>
            <div className="text-center ml-4">
              <p className="text-base font-black text-emerald-700">{s.recentSalesCount}건</p>
              <p className="text-xs text-emerald-500">건수</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  // ── 메뉴 정의 ────────────────────────────────────────────────────────────────
  type MenuItem = {
    icon: React.ReactNode;
    label: string;
    sublabel: string;
    href: string;
    colorClass: string;
  };

  const menuItems: MenuItem[] = [
    {
      icon: <FiLink className="text-xl" />,
      label: '구매링크',
      sublabel: '어필리에이트 링크 관리',
      href: `${partnerBase}/links`,
      colorClass: 'bg-slate-900 text-white hover:bg-slate-700',
    },
    {
      icon: <FiShoppingCart className="text-xl" />,
      label: '구매고객 관리',
      sublabel: '확정 고객 목록·여권 현황',
      href: `${partnerBase}/purchased-customers`,
      colorClass: 'bg-blue-600 text-white hover:bg-blue-700',
    },
    {
      icon: <FiDollarSign className="text-xl" />,
      label: '결제 / 정산',
      sublabel: '수당 내역 조회',
      href: `${partnerBase}/payment`,
      colorClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
    },
    {
      icon: <FiUser className="text-xl" />,
      label: '프로필 설정',
      sublabel: '3.3% 서류 · 계정 관리',
      href: `${partnerBase}/profile`,
      colorClass: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200',
    },
    {
      icon: <FiFileText className="text-xl" />,
      label: '나의 계약서',
      sublabel: '3.3% 프리랜서 계약 확인',
      href: `${partnerBase}/contract`,
      colorClass: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200',
    },
    ...(isBranchManager
      ? ([
          {
            icon: <FiUsers className="text-xl" />,
            label: '팀 관리',
            sublabel: '판매원 현황 · 명세서',
            href: `${partnerBase}/team`,
            colorClass: 'bg-indigo-600 text-white hover:bg-indigo-700',
          },
          {
            icon: <FiTrendingUp className="text-xl" />,
            label: '팀원 명세서',
            sublabel: '팀 수당 정산 현황',
            href: `${partnerBase}/team-statements`,
            colorClass: 'bg-teal-600 text-white hover:bg-teal-700',
          },
        ] as MenuItem[])
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 크루즈몰 보기 고정 버튼 ── */}
      <a
        href="https://www.cruisedot.co.kr"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-2 right-2 z-[100] flex items-center gap-1 rounded-full bg-[#C8392B] px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-[#A93226] active:scale-95 transition-all"
      >
        크루즈몰 보기 →
      </a>
      <HeroBanner
        displayName={user.name ?? profile.displayName ?? '파트너'}
        roleLabel={isBranchManager ? '대리점장' : '판매원'}
      />
      {/* ── 헤더 ──────────────────────────────────────────────────────────────── */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-lg px-4 pt-10 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block rounded-full bg-gold/20 border border-gold/30 px-3 py-0.5 text-xs font-medium text-gold-light mb-2">
                {isBranchManager ? '대리점장' : '판매원'}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">{displayName} 님</h1>
              {profile.affiliateCode && (
                <p className="mt-1 text-xs text-slate-400">코드: {profile.affiliateCode}</p>
              )}
            </div>
            <button
              onClick={loadData}
              className="mt-1 rounded-xl bg-white/10 p-2.5 hover:bg-white/20 transition-colors"
              aria-label="새로고침"
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 핵심 지표 */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/10" />
                ))}
              </>
            ) : summary ? (
              <>
                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold">{summary.purchaseCount}</p>
                  <p className="mt-1 text-xs text-slate-400">구매고객</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
                  <p className="text-lg font-bold">{formatWon(summary.totalSaleAmount)}</p>
                  <p className="mt-1 text-xs text-slate-400">총 판매금액</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
                  <p className="text-lg font-bold text-emerald-300">
                    {formatWon(summary.totalCommission)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">확정 수당</p>
                </div>
              </>
            ) : (
              <div className="col-span-3 rounded-2xl bg-white/5 py-6 text-center text-sm text-slate-400">
                정보를 불러올 수 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 본문 ──────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
        {/* 계정 위험도 배너 — 최우선 표시 */}
        <AccountStatusBanner />

        {/* 체험 안내 배너 */}
        {trialInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              체험 기간{' '}
              {trialInfo.daysRemaining !== null ? `— ${trialInfo.daysRemaining}일 남음` : ''}
            </p>
            {trialInfo.trialEndDate && (
              <p className="mt-0.5 text-xs text-amber-600">
                만료: {new Date(trialInfo.trialEndDate).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
        )}

        {/* 빠른 메뉴 */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-500 px-1">메뉴</h2>
          <div className="grid grid-cols-2 gap-3">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col gap-3 rounded-2xl p-5 shadow-sm transition-all ${item.colorClass}`}
              >
                {item.icon}
                <div>
                  <p className="font-bold text-sm leading-snug">{item.label}</p>
                  <p className="mt-0.5 text-xs opacity-60 leading-snug">{item.sublabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 내 판매 링크 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FiLink className="text-blue-500 shrink-0" />
            <h2 className="font-bold text-slate-900 text-sm">내 판매 링크</h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="flex-1 text-xs text-slate-600 truncate">{affiliateLink}</p>
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1 shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                linkCopied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <FiCopy className="text-xs" />
              {linkCopied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>

        {/* 여행별 수당 현황 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-emerald-500 shrink-0" />
              <h2 className="font-bold text-slate-900 text-sm">여행별 수당 현황</h2>
            </div>
            {totalPending > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                대기 {formatWon(totalPending)}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5">
            <FiClock className="shrink-0" />
            수당은 여행 출발일 이후 지급됩니다
          </p>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : commissionTrips.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-400">연결된 여행 일정이 없습니다</p>
              <p className="mt-1 text-xs text-slate-300">구매 확정 후 여행 배정 시 표시됩니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissionTrips.map((trip) => (
                <div
                  key={trip.tripId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {trip.shipName ?? trip.productCode ?? '여행 상품'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.departureDate
                        ? `출발 ${trip.departureDate.replace(/-/g, '.')}${
                            trip.daysUntilDeparture !== null && trip.daysUntilDeparture > 0
                              ? ` (D-${trip.daysUntilDeparture})`
                              : trip.daysUntilDeparture !== null && trip.daysUntilDeparture <= 0
                              ? ' (출발완료)'
                              : ''
                          }`
                        : '출발일 미정'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-emerald-600">
                      {formatWon(trip.expectedCommission)}
                    </p>
                    <p className="text-xs text-slate-400">{trip.buyerCount}명 구매</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 구매 문의 관리 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">구매 문의</h2>
            <Link href={`${partnerBase}/inquiries`}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600">
              전체보기 <FiArrowRight />
            </Link>
          </div>
          <p className="text-xs text-gray-500 mb-3">내 링크로 들어온 문의를 확인하고 콜 기록을 남기세요.</p>
          <Link href={`${partnerBase}/inquiries`}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors">
            📞 콜 기록 & 문의 관리
          </Link>
        </div>

        {/* 최근 구매고객 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">최근 구매고객</h2>
            <Link
              href={`${partnerBase}/purchased-customers`}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600"
            >
              전체보기 <FiArrowRight />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">구매 확정된 고객이 없습니다</p>
              <Link
                href={`${partnerBase}/links`}
                className="mt-2 inline-block text-xs text-blue-600 underline"
              >
                구매링크 공유하러 가기
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.leadId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                      <FiShoppingCart className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {customer.maskedName ?? '고객'} 님
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[120px]">
                        {customer.productName ?? '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600">
                      {customer.commissionAmount > 0
                        ? formatWon(customer.commissionAmount)
                        : '-'}
                    </p>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-0.5 text-xs ${
                        customer.hasPassport ? 'text-emerald-500' : 'text-amber-500'
                      }`}
                    >
                      {customer.hasPassport ? (
                        <>
                          <FiCheckCircle /> 여권완료
                        </>
                      ) : (
                        <>
                          <FiClock /> 여권대기
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 실시간 멘트 검색 — 콜 중 고객 발언 입력 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">실시간 멘트 검색</h2>
          <CallScriptSearch />
        </div>

        {/* 크루즈 렌탈 콜 스크립트 */}
        <CallScriptSection canEdit={isBranchManager} />

        {/* 3.3% 세금서류 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FiUpload className="text-blue-500 shrink-0" />
            <h2 className="font-bold text-slate-900 text-sm">3.3% 세금신고 서류</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">수당 정산을 위해 서류를 등록해주세요</p>
          <div className="space-y-2">
            <label className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 cursor-pointer">
              <div className="flex items-center gap-2">
                {hasIdCard
                  ? <FiCheckCircle className="text-emerald-500 shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-700">신분증 사진</p>
                  <p className="text-xs text-slate-400">{hasIdCard ? '등록됨' : '미등록'}</p>
                </div>
              </div>
              <span className={`px-3 py-2.5 rounded-lg text-sm font-medium border min-h-[44px] flex items-center ${uploadingIdCard ? 'text-slate-400 border-slate-100 bg-white' : 'border-slate-200 text-slate-600 bg-white'}`}>
                {uploadingIdCard ? '업로드 중...' : hasIdCard ? '재업로드' : '업로드'}
              </span>
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(f, 'ID_CARD'); e.target.value = ''; }} />
            </label>
            <label className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 cursor-pointer">
              <div className="flex items-center gap-2">
                {hasBankbook
                  ? <FiCheckCircle className="text-emerald-500 shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-700">통장사본</p>
                  <p className="text-xs text-slate-400">{hasBankbook ? '등록됨' : '미등록'}</p>
                </div>
              </div>
              <span className={`px-3 py-2.5 rounded-lg text-sm font-medium border min-h-[44px] flex items-center ${uploadingBankbook ? 'text-slate-400 border-slate-100 bg-white' : 'border-slate-200 text-slate-600 bg-white'}`}>
                {uploadingBankbook ? '업로드 중...' : hasBankbook ? '재업로드' : '업로드'}
              </span>
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(f, 'BANKBOOK'); e.target.value = ''; }} />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">jpg, png 이미지만 · 최대 5MB</p>
        </div>

        {/* 내 고객 DB */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FiUsers className="text-indigo-500 shrink-0" />
              <h2 className="font-bold text-slate-900 text-sm">내 고객 DB</h2>
            </div>
            <a href={`${partnerBase}/customers`} className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
              전체보기 <FiArrowRight />
            </a>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : leads.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-400">배정된 고객이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => (
                <div key={lead.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {lead.customerName ?? '이름 없음'}
                        </p>
                        {lead.isDuplicate && (
                          <span title="다른 파트너도 보유 중인 고객">
                            <FiAlertOctagon className="text-amber-400 text-xs shrink-0" />
                          </span>
                        )}
                      </div>
                      {lead.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">메모: {lead.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {lead.customerPhone && (
                        <a
                          href={`tel:${lead.customerPhone}`}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors min-h-[44px]"
                        >
                          <FiPhone className="text-xs" /> 전화
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setNoteLeadId(lead.id);
                          setNoteText(lead.notes ?? '');
                        }}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors min-h-[44px]"
                      >
                        <FiMessageSquare className="text-xs" /> 메모
                      </button>
                    </div>
                  </div>

                  {/* 인라인 메모 입력 */}
                  {noteLeadId === lead.id && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        rows={3}
                        placeholder="상담 내용을 입력하세요 (예: 지중해 크루즈 관심, 5월 출발 원함)"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => handleSaveNote(lead.id)}
                          disabled={savingNote}
                          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[44px]"
                        >
                          {savingNote ? '저장 중...' : '저장'}
                        </button>
                        <button
                          onClick={() => { setNoteLeadId(null); setNoteText(''); }}
                          className="px-3 rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors min-h-[44px]"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 계약서 확인 */}
        <Link
          href={`${partnerBase}/contract`}
          className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 p-4 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FiFileText className="text-blue-500 text-lg shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">내 계약서 확인 (330만원)</p>
              <p className="text-xs text-blue-500">위약벌 및 계약 조건을 확인하세요</p>
            </div>
          </div>
          <span className="text-xs text-blue-400">보기 →</span>
        </Link>

      </div>
    </div>
  );
}
