'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, TrendingUp, RotateCcw, Clock, Star, Phone, Settings, Send, AlertCircle, Copy, Check, Calendar } from "lucide-react";
import Link from "next/link";
import { AuthSession } from '@/types/auth';
import { logger } from '@/lib/logger';
import { useToast } from '@/lib/api/use-toast';

type DashboardData = {
  role: string;
  yearMonth: string;
  // GLOBAL_ADMIN
  totalAgents?: number;
  monthSaleAmount?: number;
  monthRefundAmount?: number;
  pendingApprovalCount?: number;
  goldMemberCount?: number;
  monthlyData?: Array<{ month: string; totalSales: number }>;
  partnerApplicationsPending?: number;
  // OWNER
  teamAgentCount?: number;
  // AGENT
  monthRefundCount?: number;
  // FREE_SALES
  affiliateCode?: string | null;
  // CRM 전용 (affiliateProfileId 없는 OWNER/AGENT)
  totalContacts?: number;
  newContactsThisMonth?: number;
  // 오늘 콜 (모든 역할)
  callDueToday?: number;
  // 캠페인 발송 현황 (OWNER/AGENT)
  campaignScheduledToday?: number;
  campaignInProgress?: number;
  campaignCompletedToday?: number;
};

type FeedItem = {
  id:        string;
  type:      'LANDING_REG' | 'SALE_PENDING' | 'GOLD_INQUIRY' | 'B2B_LEAD' | 'NEW_CONTACT' | 'ORG_CONTRACT' | 'CALL_DUE';
  name:      string;
  phone:     string | null;
  detail:    string | null;
  amount:    number | null;
  linkPath:  string;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; emoji: string; dotColor: string }> = {
  LANDING_REG:  { label: '랜딩 신규 등록', emoji: '👤', dotColor: 'bg-blue-500'   },
  SALE_PENDING: { label: '판매 승인 대기', emoji: '💰', dotColor: 'bg-amber-500'  },
  GOLD_INQUIRY: { label: '골드문의 신규',  emoji: '⭐', dotColor: 'bg-yellow-500' },
  B2B_LEAD:     { label: 'B2B 잠재고객',  emoji: '🏢', dotColor: 'bg-indigo-500' },
  NEW_CONTACT:  { label: '신규 고객',      emoji: '📋', dotColor: 'bg-green-500'  },
  ORG_CONTRACT: { label: '신규 대리점',    emoji: '🤝', dotColor: 'bg-purple-500' },
  CALL_DUE:     { label: '오늘 콜 예정',    emoji: '📞', dotColor: 'bg-rose-500'   },
  CONTACT_SHARED:     { label: '고객 전달받음',  emoji: '👥', dotColor: 'bg-purple-500' },
  CONTACT_UPDATED:    { label: '고객 정보 수정',  emoji: '✏️', dotColor: 'bg-sky-500'    },
  CONTACT_NOTE_ADDED: { label: '상담기록 추가',   emoji: '📝', dotColor: 'bg-teal-500'   },
  REFUND_NOTIFICATION:{ label: '환불·수당 변경',  emoji: '💸', dotColor: 'bg-red-500'    },
};

interface DashboardClientProps {
  session: AuthSession | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function KpiCard({
  title, value, sub, color = "", icon, href,
}: {
  title: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode; href?: string;
}) {
  const content = (
    <div className={`rounded-xl border p-5 shadow-sm ${color || "bg-white border-gray-200"} ${href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${color ? "text-white/80" : "text-gray-500"}`}>{title}</p>
        {icon && <span className={color ? "text-white/60" : "text-gray-300"}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold mt-1 ${color ? "text-white" : "text-navy-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className={`text-sm mt-1 ${color ? "text-white/60" : "text-gray-600"}`}>{sub}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function CampaignStatusCard({
  scheduledToday,
  inProgress,
  completedToday,
}: {
  scheduledToday: number;
  inProgress: number;
  completedToday: number;
}) {
  return (
    <Link href="/marketing/campaigns">
      <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 p-5 mb-6 cursor-pointer hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-indigo-900">📅 오늘 예약 발송</h3>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 border border-indigo-100">
            <p className="text-sm text-gray-600 mb-1">예정</p>
            <p className="text-2xl font-bold text-indigo-600">{scheduledToday}</p>
            <p className="text-sm text-gray-600 mt-1">개</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="text-sm text-gray-600 mb-1">진행중</p>
            <p className="text-2xl font-bold text-amber-600">{inProgress}</p>
            <p className="text-sm text-gray-600 mt-1">개</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-100">
            <p className="text-sm text-gray-600 mb-1">완료</p>
            <p className="text-2xl font-bold text-green-600">{completedToday}</p>
            <p className="text-sm text-gray-600 mt-1">개</p>
          </div>
        </div>

        <div className="mt-4 text-right">
          <span className="text-sm text-indigo-600 font-medium">자세히 보기 →</span>
        </div>
      </div>
    </Link>
  );
}

function PushCallNotification({ callDueCount }: { callDueCount: number }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pushSettings, setPushSettings] = useState<{ notifyEnabled: boolean; notifyAtHour: number }>({
    notifyEnabled: true,
    notifyAtHour: 9,
  });

  useEffect(() => {
    if (showSettings) {
      fetch('/api/push/settings')
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.settings) {
            setPushSettings(d.settings);
          }
        })
        .catch(() => {});
    }
  }, [showSettings]);

  const sendNow = async () => {
    setSending(true);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const result = await fetch('/api/push/send-today', { method: 'POST' });
      const data = await result.json();

      if (data.ok) {
        toast({ title: '푸시 알림 발송 완료', description: `${callDueCount}명의 고객 콜 알림을 폰으로 보냈습니다.` });
      } else {
        toast({ title: '푸시 발송 실패', description: data.error || '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: '오류 발생', description: '푸시 발송 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const saveSettings = async () => {
    try {
      const result = await fetch('/api/push/settings', {
        method: 'PUT',
        body: JSON.stringify(pushSettings),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await result.json();

      if (data.ok) {
        toast({ title: '설정 저장 완료' });
        setShowSettings(false);
      } else {
        toast({ title: '설정 저장 실패', description: data.error || '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: '오류 발생', description: '설정 저장 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-rose-600" />
            <h3 className="font-semibold text-rose-900">
              {callDueCount > 0 ? `오늘 콜 목록 (${callDueCount}명)` : '푸시 알림 설정'}
            </h3>
          </div>
          <p className="text-sm text-rose-700">
            {callDueCount > 0 ? '스마트폰에 푸시 알림으로 받아보세요' : '매일 지정된 시간에 자동으로 알림을 받을 수 있습니다'}
          </p>
        </div>
        <div className="flex gap-2">
          {callDueCount > 0 && (
            <button
              onClick={sendNow}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? '전송 중...' : '폰으로 보내기'}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-navy-900 mb-4">푸시 알림 설정</h2>

            <div className="mb-5 p-4 border border-gray-200 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushSettings.notifyEnabled}
                  onChange={e => setPushSettings({ ...pushSettings, notifyEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">자동 푸시 알림 활성화</span>
              </label>
              <p className="text-sm text-gray-500 mt-2 ml-7">매일 지정한 시간에 자동으로 알림을 보냅니다</p>
            </div>

            {pushSettings.notifyEnabled && (
              <div className="mb-5 p-4 border border-gray-200 rounded-xl">
                <label className="text-sm font-medium text-gray-700 mb-2 block">몇 시에 보낼까요?</label>
                <select
                  value={pushSettings.notifyAtHour}
                  onChange={e => setPushSettings({ ...pushSettings, notifyAtHour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">아침 6시부터 밤 10시까지 선택 가능</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardClient({ session }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [todayStr, setTodayStr] = useState<string>("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [regLinkCopied, setRegLinkCopied] = useState(false);
  const [suspendedPartnerCount, setSuspendedPartnerCount] = useState<number>(0);

  // Timer references for cleanup
  const linkCopiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const regLinkCopiedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // origin/todayStr은 마운트 후에만 설정 (SSR hydration 불일치 방지)
  useEffect(() => {
    setOrigin(window.location.origin);
    setTodayStr(new Date().toLocaleDateString("ko-KR"));
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
      if (regLinkCopiedTimerRef.current) clearTimeout(regLinkCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    Promise.allSettled([
      fetch("/api/dashboard", { signal: ctrl.signal }).then((r) => r.json()),
      fetch('/api/notifications/feed?limit=5', { signal: ctrl.signal }).then(r => r.json()),
      fetch('/api/admin/partner-suspensions?status=SUSPENDED&limit=1', { signal: ctrl.signal }).then(r => r.json()),
      fetch('/api/marketing/campaigns/today-stats', { signal: ctrl.signal }).then(r => r.json()),
    ]).then(results => {
      if (ctrl.signal.aborted) return;

      if (results[0].status === 'fulfilled' && results[0].value?.ok) {
        setData(results[0].value);
      }

      if (results[1].status === 'fulfilled' && results[1].value?.ok) {
        setFeed(results[1].value.items ?? []);
      } else if (results[1].status === 'rejected') {
        logger.error('알림 피드 로드 실패:', results[1].reason);
      }

      if (results[2].status === 'fulfilled' && results[2].value?.ok) {
        setSuspendedPartnerCount(results[2].value.data.total ?? 0);
      }

      if (results[3].status === 'fulfilled' && results[3].value?.ok) {
        const campaignStats = results[3].value;
        setData(prev => prev ? {
          ...prev,
          campaignScheduledToday: campaignStats.scheduledToday ?? 0,
          campaignInProgress: campaignStats.inProgress ?? 0,
          campaignCompletedToday: campaignStats.completedToday ?? 0,
        } : prev);
      }

      setFeedLoading(false);
    });

    // Get org from props (session passed from layout)
    if (session?.organizationId) {
      setMyOrgId(session.organizationId);
    } else {
      setMyOrgId('');
    }

    return () => ctrl.abort();
  }, [session]);

  const role = data?.role;
  const ym   = data?.yearMonth ?? new Date().toISOString().slice(0, 7);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">{ym} 기준 · {todayStr}</p>
      </div>

      {false && (role === "GLOBAL_ADMIN" || role === "OWNER") && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gold-300 mb-1">내 B2B 홍보 랜딩 링크</p>
              <p className="text-sm text-gray-600">이 링크로 유입된 고객이 CRM에 자동 등록됩니다</p>
            </div>
            <button
              onClick={() => {
                const baseUrl = window.location.origin;
                const link = role === "GLOBAL_ADMIN"
                  ? `${baseUrl}/landing`
                  : `${baseUrl}/landing?ref=${myOrgId}`;
                navigator.clipboard.writeText(link).then(() => {
                  setLinkCopied(true);
                  // Clear previous timer if exists
                  if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
                  linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
                }).catch(() => { window.prompt("링크를 복사하세요:", link); });
              }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {linkCopied ? <><Check className="w-4 h-4 text-green-400" /> 복사됨!</> : <><Copy className="w-4 h-4" /> 링크 복사</>}
            </button>
          </div>
          <div className="mt-3 bg-white/5 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 truncate">
            {origin
              ? (role === "GLOBAL_ADMIN"
                  ? `${origin}/landing`
                  : myOrgId
                    ? `${origin}/landing?ref=${myOrgId}`
                    : "로딩 중...")
              : "로딩 중..."}
          </div>
        </div>
      )}

      {false && (role === "GLOBAL_ADMIN" || role === "OWNER" || role === "AGENT") && (
        <div className="bg-white border-2 border-gold-400 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-navy-900 mb-1">프리마케터 간편 등록 링크</p>
              <p className="text-sm text-gray-500">이 링크를 공유하면 프리마케터가 직접 가입할 수 있습니다</p>
            </div>
            <button
              onClick={() => {
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/register/free-marketer`;
                navigator.clipboard.writeText(link).then(() => {
                  setRegLinkCopied(true);
                  // Clear previous timer if exists
                  if (regLinkCopiedTimerRef.current) clearTimeout(regLinkCopiedTimerRef.current);
                  regLinkCopiedTimerRef.current = setTimeout(() => setRegLinkCopied(false), 2000);
                }).catch(() => { window.prompt("링크를 복사하세요:", link); });
              }}
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {regLinkCopied ? <><Check className="w-4 h-4 text-green-600" /> 복사됨!</> : <><Copy className="w-4 h-4" /> 링크 복사</>}
            </button>
          </div>
          <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-500 truncate">
            {origin ? `${origin}/register/free-marketer` : "로딩 중..."}
          </div>
        </div>
      )}

      {role === "FREE_SALES" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">내 어필리에이트 코드</p>
          {data?.affiliateCode ? (
            <p className="text-2xl font-bold text-navy-900 font-mono">{data.affiliateCode}</p>
          ) : (
            <p className="text-gray-600 text-sm">코드가 등록되지 않았습니다.</p>
          )}
          <Link href="/my-sales" className="inline-block mt-3 text-sm text-blue-600 hover:underline">내 판매 현황 →</Link>
        </div>
      )}

      {role === "GLOBAL_ADMIN" && data && (
        <>
          {suspendedPartnerCount > 0 && (
            <Link href="/admin/partner-suspensions">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-6 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">정지된 파트너</p>
                      <p className="text-2xl font-bold text-red-800">{suspendedPartnerCount}명</p>
                    </div>
                  </div>
                  <span className="text-red-600 font-semibold">상세보기 →</span>
                </div>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
            <KpiCard title="전체 대리점장"  value={data.totalAgents ?? 0}          icon={<Users className="w-5 h-5" />} color="bg-navy-900" href="/team/affiliate" />
            <KpiCard title="이번달 매출"  value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"} icon={<TrendingUp className="w-5 h-5" />} href="/affiliate-sales" />
            <KpiCard title="이번달 환불"  value={(data.monthRefundAmount ?? 0).toLocaleString() + "원"} icon={<RotateCcw className="w-5 h-5" />} href="/affiliate-sales" />
            <KpiCard title="승인 대기"    value={data.pendingApprovalCount ?? 0} icon={<Clock className="w-5 h-5" />} href="/admin/organizations" />
            <KpiCard title="골드회원"     value={data.goldMemberCount ?? 0}      icon={<Star className="w-5 h-5" />} href="/gold-members" />
            <KpiCard title="오늘 콜"      value={data.callDueToday ?? 0}         icon={<Phone className="w-5 h-5" />} color="bg-rose-600" href="/contacts" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <KpiCard title="CRM 전체 고객"     value={data.totalContacts ?? 0}        icon={<Users className="w-5 h-5" />} color="bg-emerald-600" href="/contacts/all" />
            <KpiCard title="이번달 신규 고객"  value={data.newContactsThisMonth ?? 0} icon={<TrendingUp className="w-5 h-5" />} href="/contacts" />
          </div>
        </>
      )}

      {role === "OWNER" && data && data.teamAgentCount !== undefined && data.monthSaleAmount !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <KpiCard title="소속 대리점장"    value={data.teamAgentCount ?? 0}                                   icon={<Users className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="팀 이번달 매출" value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"}        icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="팀 환불"        value={(data.monthRefundAmount ?? 0).toLocaleString() + "원"}      icon={<RotateCcw className="w-5 h-5" />} />
          <KpiCard title="승인 대기"      value={data.pendingApprovalCount ?? 0}                             icon={<Clock className="w-5 h-5" />} />
          <KpiCard title="오늘 콜"       value={data.callDueToday ?? 0}                                     icon={<Phone className="w-5 h-5" />} color="bg-rose-600" />
        </div>
      )}

      {role === "OWNER" && data && data.totalContacts !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <KpiCard title="전체 고객"        value={data.totalContacts ?? 0}          icon={<Users className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="이번달 신규 고객" value={data.newContactsThisMonth ?? 0}   icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="오늘 콜"        value={data.callDueToday ?? 0}         icon={<Phone className="w-5 h-5" />} color="bg-rose-600" />
        </div>
      )}

      {role === "AGENT" && data && data.monthSaleAmount !== undefined && data.totalContacts === undefined && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <KpiCard title="이번달 매출"  value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"} icon={<TrendingUp className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="환불 건수"    value={data.monthRefundCount ?? 0}     icon={<RotateCcw className="w-5 h-5" />} />
          <KpiCard title="승인 대기"    value={data.pendingApprovalCount ?? 0} icon={<Clock className="w-5 h-5" />} />
          <KpiCard title="내 골드회원"  value={data.goldMemberCount ?? 0}      icon={<Star className="w-5 h-5" />} />
          <KpiCard title="오늘 콜"     value={data.callDueToday ?? 0}         icon={<Phone className="w-5 h-5" />} color="bg-rose-600" />
        </div>
      )}

      {role === "AGENT" && data && data.totalContacts !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <KpiCard title="담당 고객"        value={data.totalContacts ?? 0}          icon={<Users className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="이번달 신규 고객" value={data.newContactsThisMonth ?? 0}   icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="오늘 콜"        value={data.callDueToday ?? 0}         icon={<Phone className="w-5 h-5" />} color="bg-rose-600" />
        </div>
      )}

      {data && (role === "OWNER" || role === "AGENT") && (
        <CampaignStatusCard
          scheduledToday={data.campaignScheduledToday ?? 0}
          inProgress={data.campaignInProgress ?? 0}
          completedToday={data.campaignCompletedToday ?? 0}
        />
      )}

      {data && data.callDueToday !== undefined && (
        <PushCallNotification callDueCount={data.callDueToday} />
      )}

      {false && (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-navy-900 mb-4">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/contacts/new",    label: "고객 추가",    bg: "bg-navy-900",    show: false },
            { href: "/affiliate-sales", label: "판매 관리",    bg: "bg-blue-600",    show: false },
            { href: "/gold-members",    label: "골드회원",     bg: "bg-gold-500",    show: false },
            { href: "/gold-inquiries",  label: "골드문의",     bg: "bg-emerald-600", show: false },
            { href: "/my-sales",        label: "내 판매",      bg: "bg-purple-600",  show: false },
            { href: "/payslips",        label: "급여명세",     bg: "bg-teal-600",    show: false },
            { href: "/team",            label: "팀 현황",      bg: "bg-indigo-600",  show: false },
            { href: "/contacts",        label: "고객 목록",    bg: "bg-gray-700",    show: false },
          ]
            .filter((m) => m.show)
            .map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`${m.bg} text-white rounded-xl p-4 flex items-center justify-center text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                {m.label}
              </Link>
            ))}
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy-900">최근 알림</h2>
          <Link href="/notifications" className="text-sm text-blue-600 hover:underline">전체 보기</Link>
        </div>

        {feedLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">새 알림이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {feed.map(item => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <Link key={item.id} href={item.linkPath}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dotColor ?? 'bg-gray-400'}`} />
                  <span className="text-base shrink-0">{cfg?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">{cfg?.label}</span>
                      {item.amount && (
                        <span className="text-sm font-bold text-amber-600">{item.amount.toLocaleString()}원</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}{item.phone ? ` · ${item.phone}` : ''}{item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600 shrink-0 whitespace-nowrap">
                    {relativeTime(item.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
