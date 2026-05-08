'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiRefreshCw,
  FiCopy,
  FiCalendar,
  FiClock,
  FiAlertCircle,
  FiXCircle,
  FiCheckCircle,
  FiFileText,
  FiUpload,
  FiGift,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import { csrfFetch } from '@/lib/csrf-client';
import { logger } from '@/lib/logger';
import CallScriptSection from '@/components/partner/CallScriptSection';

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

type Props = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: AffiliateProfileBasic;
  trialInfo?: { trialEndDate: string | null; daysRemaining: number | null } | null;
};

interface AccountStatus {
  isActive: boolean;
  riskLevel: 'safe' | 'warning' | 'danger' | 'deactivated';
  rollingCommission: number;
  daysUntilDeactivation: number;
}

interface TripCommission {
  tripId: number;
  shipName: string | null;
  productCode: string | null;
  departureDate: string | null;
  daysUntilDeparture: number | null;
  buyerCount: number;
  expectedCommission: number;
  tripStatus: 'upcoming' | 'departed' | 'confirmed';
}

export default function FreeSalesAgentDashboard({ user, profile, trialInfo }: Props) {
  const router = useRouter();
  const partnerId = user.mallUserId;
  const partnerBase = `/partner/${partnerId}`;

  const displayName =
    profile.displayName || profile.nickname || user.mallNickname || user.name || '파트너';

  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [commissionTrips, setCommissionTrips] = useState<TripCommission[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [bonusPending, setBonusPending] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [bonusCount, setBonusCount] = useState(0);

  // 세금서류
  const [hasIdCard, setHasIdCard] = useState(false);
  const [hasBankbook, setHasBankbook] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [uploadingBankbook, setUploadingBankbook] = useState(false);

  const affiliateLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${user.mallUserId}/shop`
      : `/${user.mallUserId}/shop`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, commissionRes, docsRes, summaryRes, bonusRes] = await Promise.all([
        fetch('/api/partner/account-status'),
        fetch('/api/partner/commission-by-trip'),
        fetch('/api/user/my-documents'),
        fetch('/api/partner/my-customers?limit=1'),
        fetch('/api/partner/bonus-summary'),
      ]);

      if ([statusRes, commissionRes, docsRes, bonusRes].some(r => r.status === 401)) {
        router.push('/partner');
        return;
      }

      if (statusRes.ok) {
        const d = await statusRes.json();
        if (d.ok) setAccountStatus(d.data);
      }
      if (commissionRes.ok) {
        const d = await commissionRes.json();
        if (d.ok) {
          setCommissionTrips(d.trips ?? []);
          setTotalPending(d.totalPending ?? 0);
        }
      }
      if (docsRes.ok) {
        const d = await docsRes.json();
        if (d.ok) {
          setHasIdCard(d.data?.hasIdCard ?? false);
          setHasBankbook(d.data?.hasBankbook ?? false);
        }
      }
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        if (d.ok) setTotalCommission(d.summary?.totalCommission ?? 0);
      }
      if (bonusRes.ok) {
        const d = await bonusRes.json();
        setBonusPending(d.pendingBonus ?? 0);
        setBonusTotal(d.totalBonus ?? 0);
        setBonusCount(d.count ?? 0);
      }
    } catch {
      showError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatWon = (n: number) =>
    n >= 10000
      ? `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만원`
      : `${n.toLocaleString('ko-KR')}원`;

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

  const handleDocumentUpload = async (file: File, documentType: 'ID_CARD' | 'BANKBOOK') => {
    if (file.size > 5 * 1024 * 1024) {
      showError('파일 크기는 5MB를 초과할 수 없습니다.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showError('이미지 파일만 업로드 가능합니다. (jpg, png 등)');
      return;
    }

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
      if (!res.ok || !json.ok) {
        showError(json.error || '업로드에 실패했습니다.');
        return;
      }

      showSuccess(documentType === 'ID_CARD' ? '신분증이 등록되었습니다.' : '통장사본이 등록되었습니다.');
      if (documentType === 'ID_CARD') setHasIdCard(true);
      else setHasBankbook(true);
    } catch (err) {
      logger.debug('[FreeSalesAgentDashboard] 서류 업로드 오류', { err, documentType });
      showError('업로드 중 오류가 발생했습니다.');
    } finally {
      setter(false);
    }
  };

  const riskLevel = accountStatus?.riskLevel;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 헤더 */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-lg px-4 pt-10 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block rounded-full bg-gold/20 border border-gold/30 px-3 py-0.5 text-xs font-semibold text-gold-light mb-2">
                프리세일즈
              </span>
              <h1 className="text-2xl font-bold tracking-tight">{displayName} 님</h1>
              {profile.affiliateCode && (
                <p className="mt-1 text-xs text-gold/70">코드: {profile.affiliateCode}</p>
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
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-emerald-300">
                {loading ? '...' : formatWon(totalCommission)}
              </p>
              <p className="mt-1 text-xs text-purple-200">확정 수당</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-amber-300">
                {loading ? '...' : formatWon(totalPending)}
              </p>
              <p className="mt-1 text-xs text-purple-200">지급 대기 수당</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">

        {/* 체험 배너 */}
        {trialInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              체험 기간{trialInfo.daysRemaining !== null ? ` — ${trialInfo.daysRemaining}일 남음` : ''}
            </p>
          </div>
        )}

        {/* 계정 경고 배너 */}
        {riskLevel === 'deactivated' && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiXCircle className="text-red-600 shrink-0" />
              <p className="font-bold text-red-700 text-sm">본사 확인이 필요합니다</p>
            </div>
            <p className="text-xs text-red-600 leading-relaxed mb-3">
              최근 5개월간 실적이 없어 계정이 정지되었습니다.<br />
              계속 활동을 원하시면 본사로 연락해주세요.
            </p>
            <a
              href="tel:01032893800"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
            >
              📞 본사 문의 · 010-3289-3800
            </a>
          </div>
        )}
        {(riskLevel === 'danger' || riskLevel === 'warning') && (
          <div className={`rounded-2xl p-4 ${riskLevel === 'danger' ? 'border-2 border-red-400 bg-red-50' : 'border border-amber-300 bg-amber-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <FiAlertCircle className={`shrink-0 ${riskLevel === 'danger' ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
              <p className={`font-bold text-sm ${riskLevel === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>
                {riskLevel === 'danger' ? '계정 삭제 임박!' : '계정 비활성화 경고'}
              </p>
            </div>
            <p className={`text-xs leading-relaxed mt-1 ${riskLevel === 'danger' ? 'text-red-600' : 'text-amber-700'}`}>
              최근 5개월 실적이 없으면 계정이 자동으로 삭제됩니다.{' '}
              {accountStatus && accountStatus.daysUntilDeactivation > 0
                ? `비활성화까지 ${accountStatus.daysUntilDeactivation}일 남았습니다.`
                : '지금 바로 링크를 공유하세요!'}
            </p>
          </div>
        )}

        {/* 보너스 혜택 섹션 */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiGift className="text-amber-500 text-lg shrink-0" />
            <h2 className="font-bold text-amber-900 text-sm">보너스 혜택</h2>
            {bonusCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                {bonusCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-amber-700 leading-relaxed mb-3">
            내 링크로 유입된 고객이 대리점장 또는 판매원과 계약하면<br />
            본사에서 <span className="font-bold">1,000원 보너스</span>를 드려요!
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white border border-amber-100 p-3 text-center">
              <p className="text-lg font-bold text-amber-600">
                {loading ? '...' : bonusPending === 0 ? '미적립' : `${(bonusPending / 1000).toFixed(0)}천원`}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">지급 대기</p>
            </div>
            <div className="rounded-xl bg-white border border-amber-100 p-3 text-center">
              <p className="text-lg font-bold text-amber-800">
                {loading ? '...' : bonusTotal === 0 ? '0원' : `${(bonusTotal / 1000).toFixed(0)}천원`}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">누적 보너스</p>
            </div>
          </div>
        </div>

        {/* 내 판매 링크 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">내 판매 링크</p>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="flex-1 text-xs text-slate-600 truncate">{affiliateLink}</p>
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1 shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                linkCopied ? 'bg-emerald-500 text-white' : 'bg-gold text-navy font-bold hover:bg-gold-light'
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
              {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : commissionTrips.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-400">연결된 여행 일정이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {commissionTrips.map((trip) => (
                <div key={trip.tripId} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {trip.shipName ?? trip.productCode ?? '여행 상품'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.departureDate
                        ? `출발 ${trip.departureDate.replace(/-/g, '.')}${
                            trip.daysUntilDeparture !== null && trip.daysUntilDeparture > 0
                              ? ` (D-${trip.daysUntilDeparture})`
                              : ' (출발완료)'
                          }`
                        : '출발일 미정'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-emerald-600">{formatWon(trip.expectedCommission)}</p>
                    <p className="text-xs text-slate-400">{trip.buyerCount}명 구매</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 크루즈 렌탈 콜 스크립트 */}
        <CallScriptSection canEdit={false} />

        {/* 3.3% 세금서류 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FiUpload className="text-blue-500 shrink-0" />
            <h2 className="font-bold text-slate-900 text-sm">3.3% 세금신고 서류</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">수당 정산을 위해 서류를 등록해주세요</p>
          <div className="space-y-2">
            {/* 신분증 */}
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
              <span className={`px-3 py-2.5 rounded-lg text-sm font-medium border min-h-[44px] flex items-center ${
                uploadingIdCard ? 'text-slate-400 border-slate-100 bg-white' : 'border-slate-200 text-slate-600 bg-white'
              }`}>
                {uploadingIdCard ? '업로드 중...' : hasIdCard ? '재업로드' : '업로드'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocumentUpload(f, 'ID_CARD');
                  e.target.value = '';
                }}
              />
            </label>
            {/* 통장사본 */}
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
              <span className={`px-3 py-2.5 rounded-lg text-sm font-medium border min-h-[44px] flex items-center ${
                uploadingBankbook ? 'text-slate-400 border-slate-100 bg-white' : 'border-slate-200 text-slate-600 bg-white'
              }`}>
                {uploadingBankbook ? '업로드 중...' : hasBankbook ? '재업로드' : '업로드'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocumentUpload(f, 'BANKBOOK');
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">jpg, png 이미지 파일만 가능 · 최대 5MB</p>
        </div>

        {/* 계약서 확인 (하단) */}
        <Link
          href={`${partnerBase}/contract`}
          className="flex items-center justify-between rounded-2xl border border-gold/30 bg-navy/5 p-4 hover:bg-navy/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FiFileText className="text-navy text-lg shrink-0" />
            <div>
              <p className="text-sm font-semibold text-navy">내 계약서 확인</p>
              <p className="text-xs text-navy/60">위약벌 및 계약 조건을 확인하세요</p>
            </div>
          </div>
          <span className="text-xs text-gold">보기 →</span>
        </Link>

      </div>
    </div>
  );
}
