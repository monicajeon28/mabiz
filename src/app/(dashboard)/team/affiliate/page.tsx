'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  ArrowRight,
  MessageSquare,
  X,
  Send,
  Trash2,
  Filter,
  CornerUpLeft,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';
import { showError } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// dayjs 없음 → 간단한 상대 시간 유틸
function fromNow(dateStr: string | null): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}달 전`;
  return `${Math.floor(months / 12)}년 전`;
}

type ManagerMetric = {
  manager: {
    id: number;
    affiliateCode: string;
    displayName: string | null;
    nickname: string | null;
    branchLabel: string | null;
    contactPhone: string | null;
    status: string;
  };
  agentCount: number;
  leads: {
    total: number;
    byStatus: Record<string, number>;
  };
  sales: {
    count: number;
    saleAmount: number;
    netRevenue: number | null;
    branchCommission: number | null;
    overrideCommission: number | null;
    salesCommission: number | null;
  };
  ledger: {
    branchSettled: number;
    branchPending: number;
    overrideSettled: number;
    overridePending: number;
    withholding: number;
    withholdingAdjustments: number;
    withholdingSettled: number;
    withholdingPending: number;
    branchWithholding: number;
    overrideWithholding: number;
    totalWithholding: number;
    grossCommission: number;
    netCommission: number;
  };
  agents: AgentMetric[];
  monthlyTrend: {
    month: string;
    saleCount: number;
    saleAmount: number;
    branchCommission: number;
    overrideCommission: number;
    salesCommission: number;
  }[];
};

type AgentMetric = {
  agent: {
    id: number;
    affiliateCode: string;
    displayName: string | null;
    nickname: string | null;
    contactPhone: string | null;
    status: string;
  } | null;
  relation: {
    status: string;
    connectedAt: string | null;
  };
  leads: {
    total: number;
    byStatus: Record<string, number>;
  };
  sales: {
    count: number;
    saleAmount: number;
    netRevenue: number | null;
    salesCommission: number | null;
    overrideCommission: number | null;
    branchContribution: number | null;
  };
  ledger: {
    settled: number;
    pending: number;
    withholding: number;
    withholdingAdjustments: number;
    withholdingSettled: number;
    withholdingPending: number;
    salesWithholding: number;
    overrideWithholding: number;
    totalWithholding: number;
    grossCommission: number;
    netCommission: number;
  };
};

type DashboardResponse = {
  ok: boolean;
  message?: string;
  managers: ManagerMetric[];
  totals: {
    managerCount: number;
    agentCount: number;
    totalSalesCount: number;
    totalSalesAmount: number;
    totalNetRevenue: number;
    totalBranchCommission: number;
    totalOverrideCommission: number;
    totalSalesCommission: number;
    totalLeads: number;
    totalWithholding: number;
    totalNetCommission: number;
    hq?: {
      grossRevenue: number;
      cardFees: number;
      corporateTax: number;
      netAfterFees: number;
    };
  } | null;
  filters: {
    from?: string;
    to?: string;
    search?: string;
  };
};

type Filters = {
  search: string;
  from: string;
  to: string;
};

type LeadItem = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  managerId: number | null;
  metadata?: {
    productCode?: string;
    product_code?: string;
    productName?: string;
    product_name?: string;
    mallUserId?: string;
    affiliateMallUserId?: string;
  } | null;
};

type TeamMessage = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  admin?: { id: number; name: string | null };
  sender?: { id: number; name: string | null };
  recipient?: { id: number; name: string | null };
  messageType?: string;
  isRead: boolean;
  isSent?: boolean;
};

type Activity = {
  id: number;
  interactionType: string;
  note: string | null;
  occurredAt: string;
  lead?: {
    customerName: string | null;
    customerPhone: string | null;
  } | null;
  profile?: {
    displayName: string | null;
    type: string;
  } | null;
};

type ActivitiesPagination = {
  page: number;
  hasMore: boolean;
  total: number;
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: '신규',
  CONTACTED: '연락완료',
  IN_PROGRESS: '진행중',
  PURCHASED: '구매완료',
  REFUNDED: '환불',
  CLOSED: '종료',
  TEST_GUIDE: '테스트',
};

const affiliateStatusLabel: Record<string, string> = {
  DRAFT: '작성중',
  AWAITING_APPROVAL: '승인 대기',
  ACTIVE: '활성',
  SUSPENDED: '중지',
  TERMINATED: '종료',
};

const relationStatusLabel: Record<string, string> = {
  ACTIVE: '활성',
  PAUSED: '일시중지',
  TERMINATED: '종료',
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return '₩0';
  return `₩${value.toLocaleString('ko-KR')}`;
}

type ConfirmState = {
  open: boolean;
  message: string;
  isDangerous: boolean;
  resolve: ((value: boolean) => void) | null;
};

export default function AffiliateTeamDashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const role = (user?.publicMetadata as { role?: string })?.role;

  useEffect(() => {
    if (user && role !== 'GLOBAL_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, role, router]);

  // ConfirmDialog 상태 관리 (useConfirm 대체)
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    message: '',
    isDangerous: false,
    resolve: null,
  });

  const confirm = (opts: { message: string; isDangerous?: boolean }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ open: true, message: opts.message, isDangerous: opts.isDangerous ?? false, resolve });
    });
  };

  const handleConfirmOk = () => {
    confirmState.resolve?.(true);
    setConfirmState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  const handleConfirmCancel = () => {
    confirmState.resolve?.(false);
    setConfirmState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  const [filters, setFilters] = useState<Filters>({ search: '', from: '', to: '' });
  const [metrics, setMetrics] = useState<ManagerMetric[]>([]);
  const [totals, setTotals] = useState<DashboardResponse['totals']>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [phoneInquiries, setPhoneInquiries] = useState<Array<{
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    productCode: string | null;
    productName: string | null;
    createdAt: string;
    status: string;
    mallUserId: string | null;
    managerId: number | null;
  }>>([]);
  const [teamMessages, setTeamMessages] = useState<Array<{
    id: number;
    title: string;
    content: string;
    createdAt: string;
    admin?: { id: number; name: string | null };
    sender?: { id: number; name: string | null };
    recipient?: { id: number; name: string | null };
    messageType?: string;
    isRead: boolean;
    isSent?: boolean;
  }>>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<Array<{id: number; name: string | null; phone: string | null; role: string}>>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageTab, setMessageTab] = useState<'received' | 'sent'>('received');
  const [sentMessages, setSentMessages] = useState<TeamMessage[]>([]);

  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSortBy, setMessageSortBy] = useState<'newest' | 'oldest' | 'unread'>('newest');
  const [messageFilterBy, setMessageFilterBy] = useState<'all' | 'unread' | 'read'>('all');
  const [showMessageFilterMenu, setShowMessageFilterMenu] = useState(false);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const [messageModalTab, setMessageModalTab] = useState<'messages' | 'activities'>('messages');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesPagination, setActivitiesPagination] = useState<ActivitiesPagination | null>(null);
  const [activitySelectionMode, setActivitySelectionMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
  const [deletingActivities, setDeletingActivities] = useState(false);

  // phoneInquiries 미사용 경고 억제
  void phoneInquiries;

  useEffect(() => {
    loadMetrics();
    loadPhoneInquiries();
    loadTeamMessages();
    const interval = setInterval(() => {
      loadTeamMessages();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMetrics = async (overrideFilters?: Partial<Filters>) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const effectiveFilters = { ...filters, ...(overrideFilters || {}) };
      if (effectiveFilters.search.trim()) params.set('search', effectiveFilters.search.trim());
      if (effectiveFilters.from) params.set('from', effectiveFilters.from);
      if (effectiveFilters.to) params.set('to', effectiveFilters.to);

      const res = await fetch(`/api/team/metrics?${params.toString()}`);
      const json: DashboardResponse = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '팀 성과 데이터를 불러오지 못했습니다.');
      }
      setMetrics(json.managers || []);
      setTotals(json.totals || null);
      setFilters((prev) => ({
        ...prev,
        search: json.filters.search ?? '',
        from: json.filters.from ?? '',
        to: json.filters.to ?? '',
      }));
    } catch (error: unknown) {
      showError((error instanceof Error ? error.message : String(error)) || '팀 성과 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadMetrics();
  };

  const handleReset = async () => {
    setFilters({ search: '', from: '', to: '' });
    await loadMetrics({ search: '', from: '', to: '' });
  };

  const toggleManager = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadPhoneInquiries = async () => {
    try {
      const res = await fetch('/api/contacts?type=LEAD&limit=20');
      const json = await res.json();
      if (res.ok && json?.ok && json.leads) {
        const filtered = (json.leads as LeadItem[])
          .filter((lead) => lead.source?.startsWith('mall-') || lead.source === 'product-inquiry')
          .map((lead) => ({
            id: lead.id,
            customerName: lead.customerName,
            customerPhone: lead.customerPhone,
            productCode: lead.metadata?.productCode || lead.metadata?.product_code || null,
            productName: lead.metadata?.productName || lead.metadata?.product_name || null,
            createdAt: lead.createdAt,
            status: lead.status,
            mallUserId: lead.metadata?.mallUserId || lead.metadata?.affiliateMallUserId || null,
            managerId: lead.managerId,
          }));
        setPhoneInquiries(filtered);
      }
    } catch {
      // 클라이언트 컴포넌트 — 무시
    }
  };

  // /api/team/messages 미구현 시 주석 처리 필요
  const loadTeamMessages = async (showAll: boolean = false) => {
    try {
      const url = showAll
        ? '/api/team/messages'
        : '/api/team/messages?unreadOnly=true';
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json?.ok) {
        const received = (json.messages as TeamMessage[] || []).filter((m) => !m.isSent);
        const sent = (json.messages as TeamMessage[] || []).filter((m) => m.isSent);
        setTeamMessages(received);
        setSentMessages(sent);
        setUnreadMessageCount(json.unreadCount || 0);
      }
    } catch {
      // 클라이언트 컴포넌트 — 무시
    }
  };

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await fetch('/api/team/messages/recipients', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setRecipients(json.recipients || []);
      }
    } catch {
      // 클라이언트 컴포넌트 — 무시
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim() || !selectedRecipient) return;

    setSendingMessage(true);
    try {
      const res = await fetch('/api/team/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientUserId: selectedRecipient,
          title: messageTitle,
          content: messageContent,
        }),
      });

      const json = await res.json();
      if (res.ok && json?.ok) {
        setShowSendMessageModal(false);
        setMessageTitle('');
        setMessageContent('');
        setSelectedRecipient(null);
        loadTeamMessages(true);
      } else {
        showError(json.error || '메시지 전송에 실패했습니다.');
      }
    } catch {
      showError('메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!(await confirm({ message: '이 메시지를 삭제하시겠습니까?', isDangerous: true }))) return;

    try {
      const res = await fetch(`/api/team/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const json = await res.json();
      if (res.ok && json?.ok) {
        loadTeamMessages(true);
      } else {
        showError(json.error || '메시지 삭제에 실패했습니다.');
      }
    } catch {
      showError('메시지 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      const res = await fetch('/api/team/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        setTeamMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m));
        setUnreadMessageCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // 클라이언트 컴포넌트 — 무시
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadMessages = teamMessages.filter(m => !m.isRead);
    if (unreadMessages.length === 0) return;

    try {
      await Promise.all(unreadMessages.map(m =>
        fetch('/api/team/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ messageId: m.id }),
        })
      ));
      setTeamMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      setUnreadMessageCount(0);
    } catch {
      // 클라이언트 컴포넌트 — 무시
    }
  };

  const handleReplyMessage = (message: TeamMessage) => {
    const senderId = message.sender?.id || message.admin?.id;
    if (senderId) setSelectedRecipient(senderId);
    setMessageTitle(message.title?.startsWith('Re: ') ? message.title : `Re: ${message.title}`);
    setMessageContent(`\n\n--- 원본 메시지 ---\n보낸 사람: ${(message.sender || message.admin)?.name}\n날짜: ${new Date(message.createdAt).toLocaleString('ko-KR')}\n\n${message.content}`);
    setShowSendMessageModal(true);
    loadRecipients();
  };

  const toggleMessageSelection = (id: number) => {
    setSelectedMessageIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllMessages = () => {
    const currentMessages = messageTab === 'received' ? processedReceivedMessages : processedSentMessages;
    if (selectedMessageIds.length === currentMessages.length) {
      setSelectedMessageIds([]);
    } else {
      setSelectedMessageIds(currentMessages.map(m => m.id));
    }
  };

  const handleBulkDeleteMessages = async () => {
    if (selectedMessageIds.length === 0) return;

    const confirmMsg = selectedMessageIds.length === 1
      ? '선택한 메시지를 삭제하시겠습니까?'
      : `선택한 ${selectedMessageIds.length}개의 메시지를 삭제하시겠습니까?`;

    if (!(await confirm({ message: confirmMsg, isDangerous: true }))) return;

    setDeletingMessages(true);
    try {
      await Promise.all(selectedMessageIds.map(id =>
        fetch(`/api/team/messages/${id}`, { method: 'DELETE', credentials: 'include' })
      ));
      setSelectedMessageIds([]);
      setMessageSelectionMode(false);
      loadTeamMessages(true);
    } catch {
      showError('일부 메시지 삭제에 실패했습니다.');
    } finally {
      setDeletingMessages(false);
    }
  };

  const cancelMessageSelectionMode = () => {
    setMessageSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const loadActivities = async (page = 1, append = false) => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/api/team/messages/activities?page=${page}&limit=50`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok) {
        if (append) {
          setActivities(prev => [...prev, ...json.activities]);
        } else {
          setActivities(json.activities);
        }
        setActivitiesPagination(json.pagination);
      }
    } catch {
      // 클라이언트 컴포넌트 — 무시
    } finally {
      setActivitiesLoading(false);
    }
  };

  const toggleActivitySelection = (id: number) => {
    setSelectedActivityIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllActivities = () => {
    if (selectedActivityIds.length === activities.length) {
      setSelectedActivityIds([]);
    } else {
      setSelectedActivityIds(activities.map(a => a.id));
    }
  };

  const handleBulkDeleteActivities = async () => {
    if (selectedActivityIds.length === 0) return;

    const confirmMsg = selectedActivityIds.length === 1
      ? '선택한 기록을 삭제하시겠습니까?'
      : `선택한 ${selectedActivityIds.length}개의 기록을 삭제하시겠습니까?`;

    if (!(await confirm({ message: confirmMsg, isDangerous: true }))) return;

    setDeletingActivities(true);
    try {
      const results = await Promise.all(selectedActivityIds.map(id =>
        fetch(`/api/team/messages/activities/${id}`, { method: 'DELETE', credentials: 'include' })
      ));
      const failedCount = results.filter(r => !r.ok).length;
      if (failedCount > 0) {
        showError(`${selectedActivityIds.length - failedCount}개 삭제됨, ${failedCount}개 실패`);
      }
      setSelectedActivityIds([]);
      setActivitySelectionMode(false);
      loadActivities(1);
    } catch {
      showError('일부 기록 삭제에 실패했습니다.');
    } finally {
      setDeletingActivities(false);
    }
  };

  const cancelActivitySelectionMode = () => {
    setActivitySelectionMode(false);
    setSelectedActivityIds([]);
  };

  const interactionTypeLabels: Record<string, string> = {
    call: '전화',
    sms: 'SMS',
    email: '이메일',
    visit: '방문',
    meeting: '미팅',
    kakao: '카카오톡',
    other: '기타',
  };

  const processedReceivedMessages = useMemo(() => {
    let result = [...teamMessages];
    if (messageSearchQuery.trim()) {
      const query = messageSearchQuery.toLowerCase();
      result = result.filter(m =>
        m.title?.toLowerCase().includes(query) ||
        m.content?.toLowerCase().includes(query) ||
        (m.sender || m.admin)?.name?.toLowerCase().includes(query)
      );
    }
    if (messageFilterBy === 'unread') {
      result = result.filter(m => !m.isRead);
    } else if (messageFilterBy === 'read') {
      result = result.filter(m => m.isRead);
    }
    if (messageSortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (messageSortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (messageSortBy === 'unread') {
      result.sort((a, b) => {
        if (a.isRead === b.isRead) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.isRead ? 1 : -1;
      });
    }
    return result;
  }, [teamMessages, messageSearchQuery, messageFilterBy, messageSortBy]);

  const processedSentMessages = useMemo(() => {
    let result = [...sentMessages];
    if (messageSearchQuery.trim()) {
      const query = messageSearchQuery.toLowerCase();
      result = result.filter(m =>
        m.title?.toLowerCase().includes(query) ||
        m.content?.toLowerCase().includes(query) ||
        m.recipient?.name?.toLowerCase().includes(query)
      );
    }
    if (messageSortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (messageSortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return result;
  }, [sentMessages, messageSearchQuery, messageSortBy]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearchQuery.trim()) return recipients;
    const query = recipientSearchQuery.toLowerCase();
    return recipients.filter(r =>
      r.name?.toLowerCase().includes(query) ||
      r.role?.toLowerCase().includes(query) ||
      (r.role === 'manager' && '대리점장'.includes(query)) ||
      (r.role === 'agent' && '판매원'.includes(query))
    );
  }, [recipients, recipientSearchQuery]);

  const overviewCards = useMemo(() => {
    if (!totals) return [];
    const cards = [
      {
        title: '활성 대리점장',
        value: `${totals.managerCount.toLocaleString('ko-KR')}명`,
        icon: <Users className="w-6 h-6" />,
        description: '대리점장 어필리에이트 프로필 수',
      },
      {
        title: '팀 판매 건수',
        value: `${totals.totalSalesCount.toLocaleString('ko-KR')}건`,
        icon: <TrendingUp className="w-6 h-6" />,
        description: '승인/지급 대기 중인 판매 건수',
      },
      {
        title: '판매 총액',
        value: formatCurrency(totals.totalSalesAmount),
        icon: <DollarSign className="w-6 h-6" />,
        description: '해당 기간 내 팀 전체 판매 금액 합계',
      },
      {
        title: '세전 커미션 합계',
        value: formatCurrency((totals.totalBranchCommission ?? 0) + (totals.totalOverrideCommission ?? 0)),
        icon: <DollarSign className="w-6 h-6" />,
        description: '브랜치 + 오버라이드 커미션 총액',
      },
    ];

    cards.push({
      title: '원천징수 예정',
      value: `- ${formatCurrency(totals.totalWithholding)}`,
      icon: <DollarSign className="w-6 h-6" />,
      description: '브랜치/오버라이드 원천징수 합계',
    });

    cards.push({
      title: '세후 지급 예상',
      value: formatCurrency(totals.totalNetCommission),
      icon: <TrendingUp className="w-6 h-6" />,
      description: '대리점장 예상 입금액 (세후)',
    });

    if (totals.hq) {
      cards.push({
        title: '본사 순이익 (세후)',
        value: formatCurrency(totals.hq.netAfterFees),
        icon: <DollarSign className="w-6 h-6" />,
        description: `법인세 ${formatCurrency(totals.hq.corporateTax)}·카드 수수료 ${formatCurrency(totals.hq.cardFees)} 반영`,
      });
    }

    return cards;
  }, [totals]);

  // GLOBAL_ADMIN 아닌 경우 렌더링 차단
  if (user && role !== 'GLOBAL_ADMIN') return null;

  return (
    <div className="space-y-8 p-6">
      {/* ConfirmDialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="확인"
        message={confirmState.message}
        variant={confirmState.isDangerous ? 'danger' : 'default'}
        confirmLabel={confirmState.isDangerous ? '삭제' : '확인'}
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">어필리에이트 팀 성과 대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">대리점장별 판매/리드/커미션 현황과 판매원 실적을 한눈에 확인할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowMessagesModal(true);
              loadTeamMessages(true);
            }}
            className="relative flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
          >
            <MessageSquare className="w-4 h-4" />
            팀 메시지
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => loadMetrics()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">검색</span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-500">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="지점명, 코드, 연락처 검색"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">시작일</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">종료일</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              적용
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              disabled={loading}
            >
              초기화
            </button>
          </div>
        </div>
      </form>

      {totals && overviewCards.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <article
              key={card.title}
              className="flex h-full flex-col justify-between rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">{card.title}</h3>
                  <p className="mt-2 text-2xl font-bold">{card.value}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-3 text-white">{card.icon}</div>
              </div>
              <p className="mt-4 text-xs text-white/70">{card.description}</p>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-6">
        {loading && metrics.length === 0 ? (
          <div className="rounded-3xl bg-white/80 p-10 text-center text-slate-500 shadow-sm">데이터를 불러오는 중입니다...</div>
        ) : metrics.length === 0 ? (
          <div className="rounded-3xl bg-white/80 p-10 text-center text-slate-500 shadow-sm">
            조건에 맞는 대리점장 데이터가 없습니다. 필터를 조정해 주세요.
          </div>
        ) : (
          metrics.map((item) => {
            const managerName = item.manager.displayName || item.manager.nickname || `대리점장 #${item.manager.id}`;
            const branchLabel = item.manager.branchLabel ? `(${item.manager.branchLabel})` : '';
            const managerStatus = affiliateStatusLabel[item.manager.status] || item.manager.status;
            return (
              <article key={item.manager.id} className="rounded-3xl bg-white/90 p-6 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {managerName} {branchLabel && <span className="text-sm text-slate-500">{branchLabel}</span>}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">코드 {item.manager.affiliateCode}</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600">{managerStatus}</span>
                      <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-600">본사 직속</span>
                      {item.manager.contactPhone && <span>{item.manager.contactPhone}</span>}
                      <span className="text-slate-400">판매원 {item.agentCount.toLocaleString('ko-KR')}명</span>
                      <span className="text-slate-400">리드 {item.leads.total.toLocaleString('ko-KR')}건</span>
                      <span className="text-slate-400">판매 {item.sales.count.toLocaleString('ko-KR')}건</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleManager(item.manager.id)}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {expanded[item.manager.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} 팀 상세 보기
                  </button>
                </header>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">리드 현황</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{item.leads.total.toLocaleString('ko-KR')}건</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      {Object.entries(item.leads.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between">
                          <span>{LEAD_STATUS_LABELS[status] || status}</span>
                          <span className="font-semibold">{count.toLocaleString('ko-KR')}건</span>
                        </div>
                      ))}
                      {Object.keys(item.leads.byStatus).length === 0 && <p className="text-slate-400">집계된 리드가 없습니다.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">판매 요약</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{item.sales.count.toLocaleString('ko-KR')}건</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>판매 금액</span><span className="font-semibold">{formatCurrency(item.sales.saleAmount)}</span></div>
                      <div className="flex justify-between"><span>순이익</span><span className="font-semibold">{formatCurrency(item.sales.netRevenue)}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">커미션 예정</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>브랜치</span><span className="font-semibold">{formatCurrency(item.sales.branchCommission)}</span></div>
                      <div className="flex justify-between"><span>오버라이드</span><span className="font-semibold">{formatCurrency(item.sales.overrideCommission)}</span></div>
                      <div className="flex justify-between"><span>판매원 수당</span><span className="font-semibold">{formatCurrency(item.sales.salesCommission)}</span></div>
                      <div className="flex justify-between text-red-500"><span>원천징수</span><span className="font-semibold">- {formatCurrency(item.ledger.totalWithholding)}</span></div>
                      <div className="mt-2 border-t border-slate-200 pt-2 text-emerald-600">
                        <div className="flex justify-between font-semibold">
                          <span>세후 예상지급</span>
                          <span>{formatCurrency(item.ledger.netCommission)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">정산 현황</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>브랜치 (지급완료)</span><span className="font-semibold">{formatCurrency(item.ledger.branchSettled)}</span></div>
                      <div className="flex justify-between"><span>브랜치 (지급대기)</span><span className="font-semibold">{formatCurrency(item.ledger.branchPending)}</span></div>
                      <div className="flex justify-between"><span>오버라이드 (지급완료)</span><span className="font-semibold">{formatCurrency(item.ledger.overrideSettled)}</span></div>
                      <div className="flex justify-between"><span>오버라이드 (지급대기)</span><span className="font-semibold">{formatCurrency(item.ledger.overridePending)}</span></div>
                      <div className="flex justify-between"><span>원천징수 조정</span><span className="font-semibold">{formatCurrency(item.ledger.withholdingAdjustments)}</span></div>
                      <div className="flex justify-between"><span>원천징수 (지급완료)</span><span className="font-semibold">{formatCurrency(item.ledger.withholdingSettled)}</span></div>
                      <div className="flex justify-between"><span>원천징수 (지급대기)</span><span className="font-semibold">{formatCurrency(item.ledger.withholdingPending)}</span></div>
                    </div>
                  </div>
                </div>

                {expanded[item.manager.id] && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <h3 className="text-lg font-semibold text-slate-900">팀 판매원 현황</h3>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">판매원</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">연결 상태</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">리드</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">판매</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">판매금액</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">판매원 수당</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">오버라이드</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-600">정산(지급완료/대기)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {item.agents.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                                  연결된 판매원이 없습니다.
                                </td>
                              </tr>
                            ) : (
                              item.agents.map((agentItem) => {
                                const agentName = agentItem.agent?.displayName || agentItem.agent?.nickname || `판매원 #${agentItem.agent?.id ?? 'N/A'}`;
                                const relationLabel = relationStatusLabel[agentItem.relation.status] || agentItem.relation.status;
                                const managerLabel = item.manager.displayName || item.manager.nickname || `대리점장 #${item.manager.id}`;
                                return (
                                  <tr key={`${agentItem.agent?.id ?? 'none'}-${agentItem.relation.connectedAt ?? 'rel'}`} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-900">{agentName}</div>
                                      <div className="text-xs text-slate-500">코드 {agentItem.agent?.affiliateCode ?? '-'}</div>
                                      {agentItem.agent?.contactPhone && <div className="text-xs text-slate-500">{agentItem.agent.contactPhone}</div>}
                                      <div className="text-[11px] text-slate-400">소속 대리점장: {managerLabel}</div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600">
                                      <div className="font-semibold text-slate-700">{relationLabel}</div>
                                      <div>{fromNow(agentItem.relation.connectedAt)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      <div className="font-semibold">{agentItem.leads.total.toLocaleString('ko-KR')}건</div>
                                      <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                                        {Object.entries(agentItem.leads.byStatus).map(([status, count]) => (
                                          <span key={status} className="rounded-full bg-slate-100 px-2 py-0.5">
                                            {LEAD_STATUS_LABELS[status] || status} {count}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{agentItem.sales.count.toLocaleString('ko-KR')}건</td>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(agentItem.sales.saleAmount)}</td>
                                    <td className="px-4 py-3 text-slate-700">{formatCurrency(agentItem.sales.salesCommission)}</td>
                                    <td className="px-4 py-3 text-slate-700">{formatCurrency(agentItem.sales.overrideCommission)}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600">
                                      <div>완료 {formatCurrency(agentItem.ledger.settled)}</div>
                                      <div>대기 {formatCurrency(agentItem.ledger.pending)}</div>
                                      <div className="pt-1 text-[11px] text-slate-500">원천징수 {formatCurrency(agentItem.ledger.totalWithholding)}</div>
                                      <div className="text-[11px] text-slate-500">조정 {formatCurrency(agentItem.ledger.withholdingAdjustments)}</div>
                                      <div className="pt-1 text-[11px] font-semibold text-emerald-600">
                                        세후 {formatCurrency(agentItem.ledger.netCommission)}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <h3 className="text-lg font-semibold text-slate-900">최근 6개월 추세</h3>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm text-slate-600">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold">월</th>
                              <th className="px-4 py-2 text-right font-semibold">판매 건수</th>
                              <th className="px-4 py-2 text-right font-semibold">판매 금액</th>
                              <th className="px-4 py-2 text-right font-semibold">지점 수당</th>
                              <th className="px-4 py-2 text-right font-semibold">오버라이드</th>
                              <th className="px-4 py-2 text-right font-semibold">판매원 수당</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.monthlyTrend.map((trend) => (
                              <tr key={`${item.manager.id}-${trend.month}`} className="odd:bg-white even:bg-slate-50">
                                <td className="px-4 py-2 font-semibold text-slate-700">{trend.month}</td>
                                <td className="px-4 py-2 text-right">{trend.saleCount.toLocaleString('ko-KR')}건</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(trend.saleAmount)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(trend.branchCommission)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(trend.overrideCommission)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(trend.salesCommission)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* 팀 메시지 모달 */}
      {showMessagesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowMessagesModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">팀 커뮤니케이션</h2>
                {messageModalTab === 'messages' && messageTab === 'received' && unreadMessageCount > 0 && (
                  <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadMessageCount}개 미읽음
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {messageModalTab === 'messages' && (
                  <button
                    onClick={() => {
                      setShowSendMessageModal(true);
                      setRecipientSearchQuery('');
                      loadRecipients();
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                  >
                    <Send className="w-4 h-4" />
                    새 메시지
                  </button>
                )}
                <button
                  onClick={() => setShowMessagesModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 상위 탭 */}
            <div className="flex gap-4 mb-4 border-b">
              <button
                onClick={() => { setMessageModalTab('messages'); cancelActivitySelectionMode(); }}
                className={`px-4 py-2 font-medium flex items-center gap-2 ${
                  messageModalTab === 'messages'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                메시지
                {unreadMessageCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadMessageCount}</span>
                )}
              </button>
              <button
                onClick={() => { setMessageModalTab('activities'); cancelMessageSelectionMode(); loadActivities(1); }}
                className={`px-4 py-2 font-medium flex items-center gap-2 ${
                  messageModalTab === 'activities'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4" />
                고객 기록 업데이트
              </button>
            </div>

            {messageModalTab === 'messages' ? (
              <>
                {/* 하위 탭 */}
                <div className="flex gap-2 mb-4 border-b">
                  <button
                    onClick={() => { setMessageTab('received'); cancelMessageSelectionMode(); }}
                    className={`px-4 py-2 font-medium ${
                      messageTab === 'received'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    받은 메시지 ({processedReceivedMessages.length})
                  </button>
                  <button
                    onClick={() => { setMessageTab('sent'); cancelMessageSelectionMode(); }}
                    className={`px-4 py-2 font-medium ${
                      messageTab === 'sent'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    보낸 메시지 ({processedSentMessages.length})
                  </button>
                </div>

                {/* 검색 및 필터 바 */}
                <div className="mb-4 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      placeholder="제목, 내용, 발신자 검색..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                    {messageSearchQuery && (
                      <button
                        onClick={() => setMessageSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {messageSelectionMode ? (
                      <>
                        <button
                          onClick={toggleSelectAllMessages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                        >
                          {selectedMessageIds.length === (messageTab === 'received' ? processedReceivedMessages.length : processedSentMessages.length) ? (
                            <><CheckSquare className="w-4 h-4" /> 전체해제</>
                          ) : (
                            <><Square className="w-4 h-4" /> 전체선택</>
                          )}
                        </button>
                        <span className="text-sm text-gray-500">{selectedMessageIds.length}개 선택됨</span>
                        <button
                          onClick={handleBulkDeleteMessages}
                          disabled={selectedMessageIds.length === 0 || deletingMessages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingMessages ? '삭제 중...' : '삭제'}
                        </button>
                        <button
                          onClick={cancelMessageSelectionMode}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <button
                            onClick={() => setShowMessageFilterMenu(!showMessageFilterMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <Filter className="w-4 h-4" />
                            {messageFilterBy === 'all' ? '전체' : messageFilterBy === 'unread' ? '안읽음만' : '읽음만'}
                            {' / '}
                            {messageSortBy === 'newest' ? '최신순' : messageSortBy === 'oldest' ? '오래된순' : '안읽음 우선'}
                          </button>
                          {showMessageFilterMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 min-w-[160px]">
                              <p className="text-xs font-medium text-gray-500 mb-1 px-2">필터</p>
                              {[
                                { value: 'all', label: '전체 보기' },
                                { value: 'unread', label: '안읽음만' },
                                { value: 'read', label: '읽음만' },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setMessageFilterBy(opt.value as 'all' | 'unread' | 'read'); setShowMessageFilterMenu(false); }}
                                  className={`w-full text-left px-2 py-1 text-sm rounded ${messageFilterBy === opt.value ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                              <hr className="my-2" />
                              <p className="text-xs font-medium text-gray-500 mb-1 px-2">정렬</p>
                              {[
                                { value: 'newest', label: '최신순' },
                                { value: 'oldest', label: '오래된순' },
                                { value: 'unread', label: '안읽음 우선' },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setMessageSortBy(opt.value as 'newest' | 'oldest' | 'unread'); setShowMessageFilterMenu(false); }}
                                  className={`w-full text-left px-2 py-1 text-sm rounded ${messageSortBy === opt.value ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {messageTab === 'received' && unreadMessageCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Check className="w-4 h-4" />
                            모두 읽음
                          </button>
                        )}

                        {((messageTab === 'received' && processedReceivedMessages.length > 0) ||
                          (messageTab === 'sent' && processedSentMessages.length > 0)) && (
                          <button
                            onClick={() => setMessageSelectionMode(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <CheckSquare className="w-4 h-4" />
                            선택
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 메시지 목록 */}
                <div className="flex-1 overflow-y-auto">
                  {messageTab === 'received' ? (
                    processedReceivedMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>{messageSearchQuery || messageFilterBy !== 'all' ? '검색 결과가 없습니다.' : '받은 메시지가 없습니다.'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {processedReceivedMessages.map((message) => (
                          <div
                            key={message.id}
                            onClick={() => messageSelectionMode && toggleMessageSelection(message.id)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                              messageSelectionMode && selectedMessageIds.includes(message.id)
                                ? 'bg-blue-50 border-blue-300'
                                : message.isRead
                                  ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                  : 'bg-teal-50 border-teal-300 hover:bg-teal-100'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {messageSelectionMode ? (
                                <input
                                  type="checkbox"
                                  checked={selectedMessageIds.includes(message.id)}
                                  onChange={() => toggleMessageSelection(message.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                                />
                              ) : (
                                <div className="mt-1.5">
                                  {message.isRead ? (
                                    <div className="w-2 h-2 bg-gray-300 rounded-full" />
                                  ) : (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className={`font-semibold ${message.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                                    {message.title}
                                  </h3>
                                  {message.messageType && message.messageType !== 'team-dashboard' && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                      {message.messageType === 'agent-manager' ? '판매원→대리점장' :
                                       message.messageType === 'manager-agent' ? '대리점장→판매원' :
                                       message.messageType === 'manager-manager' ? '대리점장→대리점장' :
                                       message.messageType === 'agent-admin' ? '판매원→관리자' :
                                       message.messageType === 'manager-admin' ? '대리점장→관리자' : message.messageType}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2 line-clamp-2">{message.content}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>발신: {(message.sender || message.admin)?.name || '알 수 없음'}</span>
                                  <span>
                                    {new Date(message.createdAt).toLocaleString('ko-KR', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>

                              {!messageSelectionMode && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleReplyMessage(message); }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                    title="답장"
                                  >
                                    <CornerUpLeft className="w-4 h-4" />
                                  </button>
                                  {!message.isRead && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMarkAsRead(message.id); }}
                                      className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                                      title="읽음 처리"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMessage(message.id); }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    processedSentMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>{messageSearchQuery ? '검색 결과가 없습니다.' : '보낸 메시지가 없습니다.'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {processedSentMessages.map((message) => (
                          <div
                            key={message.id}
                            onClick={() => messageSelectionMode && toggleMessageSelection(message.id)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                              messageSelectionMode && selectedMessageIds.includes(message.id)
                                ? 'bg-blue-100 border-blue-400'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {messageSelectionMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedMessageIds.includes(message.id)}
                                  onChange={() => toggleMessageSelection(message.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                                />
                              )}

                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 mb-1">{message.title}</h3>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2 line-clamp-2">{message.content}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>수신: {message.recipient?.name || '알 수 없음'}</span>
                                  <span>
                                    {new Date(message.createdAt).toLocaleString('ko-KR', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {message.isRead && (
                                    <span className="text-green-600 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> 읽음
                                    </span>
                                  )}
                                </div>
                              </div>

                              {!messageSelectionMode && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(message.id); }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                  title="삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              /* 고객 기록 업데이트 탭 */
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {activitySelectionMode ? (
                    <>
                      <button
                        onClick={toggleSelectAllActivities}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                      >
                        {selectedActivityIds.length === activities.length ? (
                          <><CheckSquare className="w-4 h-4" /> 전체해제</>
                        ) : (
                          <><Square className="w-4 h-4" /> 전체선택</>
                        )}
                      </button>
                      <span className="text-sm text-gray-500">{selectedActivityIds.length}개 선택됨</span>
                      <button
                        onClick={handleBulkDeleteActivities}
                        disabled={selectedActivityIds.length === 0 || deletingActivities}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingActivities ? '삭제 중...' : '삭제'}
                      </button>
                      <button
                        onClick={cancelActivitySelectionMode}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-gray-600">
                        최근 30일간의 팀 고객 기록 ({activities.length}건)
                      </div>
                      {activities.length > 0 && (
                        <button
                          onClick={() => setActivitySelectionMode(true)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <CheckSquare className="w-4 h-4" />
                          선택
                        </button>
                      )}
                      <button
                        onClick={() => loadActivities(1)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <RefreshCw className={`w-4 h-4 ${activitiesLoading ? 'animate-spin' : ''}`} />
                        새로고침
                      </button>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {activitiesLoading && activities.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-300" />
                      <p>로딩 중...</p>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>최근 30일간 기록이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div
                          key={activity.id}
                          onClick={() => activitySelectionMode && toggleActivitySelection(activity.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            activitySelectionMode && selectedActivityIds.includes(activity.id)
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {activitySelectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedActivityIds.includes(activity.id)}
                                onChange={() => toggleActivitySelection(activity.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 w-4 h-4 text-blue-600 rounded"
                              />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  activity.interactionType === 'call' ? 'bg-blue-100 text-blue-700' :
                                  activity.interactionType === 'sms' ? 'bg-green-100 text-green-700' :
                                  activity.interactionType === 'email' ? 'bg-purple-100 text-purple-700' :
                                  activity.interactionType === 'visit' ? 'bg-orange-100 text-orange-700' :
                                  activity.interactionType === 'kakao' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {interactionTypeLabels[activity.interactionType] || activity.interactionType}
                                </span>
                                {activity.lead && (
                                  <span className="text-sm font-medium text-gray-900">
                                    {activity.lead.customerName || '이름없음'}
                                    {activity.lead.customerPhone && (
                                      <span className="text-gray-500 ml-1">({activity.lead.customerPhone})</span>
                                    )}
                                  </span>
                                )}
                              </div>

                              {activity.note && (
                                <p className="text-sm text-gray-700 mb-2 line-clamp-2">{activity.note}</p>
                              )}

                              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                {activity.profile && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {activity.profile.displayName}
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      activity.profile.type === 'BRANCH_MANAGER' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                    }`}>
                                      {activity.profile.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'}
                                    </span>
                                  </span>
                                )}
                                <span>
                                  {new Date(activity.occurredAt).toLocaleString('ko-KR', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            {!activitySelectionMode && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (await confirm({ message: '이 기록을 삭제하시겠습니까?', isDangerous: true })) {
                                    fetch(`/api/team/messages/activities/${activity.id}`, {
                                      method: 'DELETE',
                                      credentials: 'include',
                                    }).then(() => loadActivities(1));
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {activitiesPagination?.hasMore && (
                        <button
                          onClick={() => loadActivities(activitiesPagination.page + 1, true)}
                          disabled={activitiesLoading}
                          className="w-full py-3 text-center text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 mt-2"
                        >
                          {activitiesLoading ? '로딩 중...' : '더 보기'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 메시지 보내기 모달 */}
      {showSendMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowSendMessageModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{messageTitle.startsWith('Re: ') ? '답장 보내기' : '새 메시지 보내기'}</h2>
              <button
                onClick={() => {
                  setShowSendMessageModal(false);
                  setMessageTitle('');
                  setMessageContent('');
                  setSelectedRecipient(null);
                  setRecipientSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수신자 <span className="text-red-500">*</span>
                </label>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={recipientSearchQuery}
                    onChange={(e) => setRecipientSearchQuery(e.target.value)}
                    placeholder="이름 또는 역할로 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                  {recipientSearchQuery && (
                    <button
                      onClick={() => setRecipientSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {loadingRecipients ? (
                  <div className="text-sm text-gray-500 py-4 text-center">로딩 중...</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredRecipients.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        {recipientSearchQuery ? '검색 결과가 없습니다.' : '수신자가 없습니다.'}
                      </div>
                    ) : (
                      filteredRecipients.map((r) => (
                        <label
                          key={r.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                            selectedRecipient === r.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="recipient"
                            checked={selectedRecipient === r.id}
                            onChange={() => setSelectedRecipient(r.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">{r.name || '이름 없음'}</span>
                            {r.phone && <span className="text-gray-500 text-sm ml-2">({r.phone})</span>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            r.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                            r.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {r.role === 'manager' ? '대리점장' : r.role === 'admin' ? '관리자' : '판매원'}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {selectedRecipient && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    선택됨: <span className="font-medium">{recipients.find(r => r.id === selectedRecipient)?.name || '알 수 없음'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="메시지 제목을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="메시지 내용을 입력하세요"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowSendMessageModal(false);
                    setMessageTitle('');
                    setMessageContent('');
                    setSelectedRecipient(null);
                    setRecipientSearchQuery('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageTitle.trim() || !messageContent.trim() || !selectedRecipient || sendingMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendingMessage ? '전송 중...' : messageTitle.startsWith('Re: ') ? '답장 보내기' : '보내기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
