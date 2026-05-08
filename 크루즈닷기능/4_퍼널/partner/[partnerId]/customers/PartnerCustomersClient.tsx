'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiX,
  FiFileText,
  FiMic,
  FiUpload,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiBell,
  FiUser,
  FiMessageSquare,
  FiLink,
  FiSettings,
  FiHelpCircle,
  FiInfo,
  FiSend,
  FiArrowRight,
  FiExternalLink,
  FiLayers,
  FiMonitor,
  FiCloud,
  FiDownload,
  FiFile,
  FiImage,
} from 'react-icons/fi';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { showError, showSuccess, showWarning } from '@/components/ui/Toast';
import SymbolPicker from '@/components/ui/SymbolPicker';
import SmsConfigModal from '@/components/partner/SmsConfigModal';
import CustomerStatusBadges from '@/components/CustomerStatusBadges';
// CustomerNoteModal 삭제됨 - 고객 상세 패널의 상담기록으로 통합
// SharedCustomerDetailModal 삭제됨 - DB 전달 기능은 기존 패널에 통합
import ProductInquiryCustomerTable from '@/components/admin/ProductInquiryCustomerTable';
import FinalConfirmSection from '@/components/partner/FinalConfirmSection';

type LeadStatusOption = {
  value: string;
  label: string;
  theme: string;
};

type PartnerInfo = {
  profileId: number;
  type: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'HQ';
  displayName: string | null;
  branchLabel: string | null;
  mallUserId: string;
  shareLinks: {
    mall: string;
    tracked: string;
    landing: string | null;
  };
  manager: {
    label: string | null;
    affiliateCode: string | null;
    branchLabel: string | null;
    mallUserId: string | null;
  } | null;
  teamAgents: Array<{
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
    mallUserId: string | null;
  }>;
};

type SaleSummary = {
  totalSalesCount: number;
  totalSalesAmount: number;
  totalNetRevenue: number;
  confirmedSalesCount: number;
  confirmedSalesAmount: number;
  lastSaleAt: string | null;
  lastSaleStatus: string | null;
};

type InteractionMedia = {
  id: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  url: string;
  isBackedUp: boolean;
  googleDriveFileId: string | null;
};

type Interaction = {
  id: number;
  interactionType: string;
  occurredAt: string;
  note: string | null;
  profileId: number | null;
  createdBy: {
    id: number;
    name: string | null;
    phone: string | null;
  } | null;
  media?: InteractionMedia[];
};

type PartnerCustomer = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  notes: string | null;
  lastContactedAt: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  passportRequestedAt: string | null;
  passportCompletedAt: string | null;
  source: string | null;
  metadata: any | null;
  groupId: number | null;
  manager: {
    id: number;
    displayName: string | null;
  } | null;
  agent: {
    id: number;
    displayName: string | null;
  } | null;
  ownership: 'AGENT' | 'MANAGER' | 'UNKNOWN';
  counterpart: {
    label: string | null;
    affiliateCode: string | null;
  } | null;
  saleSummary: SaleSummary;
  interactions: Interaction[];
  sales: Array<{
    id: number;
    saleAmount: number | null;
    netRevenue: number | null;
    saleDate: string | null;
    status: string;
  }>;
  // 고객 상태 정보 (딱지 표시용)
  testModeStartedAt?: string | null;
  customerStatus?: string | null;
  customerSource?: string | null; // 고객 출처 추가 (명확한 구분용)
  mallUserId?: string | null;
  totalTripCount?: number;
  // 전화상담 고객용 추가 정보
  userId?: number | null;
  cruiseName?: string | null;
  affiliateOwnership?: {
    ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
    ownerName: string | null;
    ownerNickname: string | null;
    userId?: number | null;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PartnerCustomersClientProps = {
  partner: PartnerInfo;
  leadStatusOptions: LeadStatusOption[];
};

type CreateCustomerForm = {
  customerName: string;
  customerPhone: string;
  status: string;
  notes: string;
  nextActionAt: string;
  agentProfileId: string;
  createdAt?: string; // 유입날짜
};

type InteractionForm = {
  note: string;
  status: string;
  nextActionAt: string;
  occurredAt: string;
  files: File[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatChatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === -1) return '어제';
  if (diffDays === 1) return '내일';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function groupInteractionsByDate(interactions: Interaction[]) {
  const groups: Record<string, Interaction[]> = {};

  interactions.forEach((interaction) => {
    const date = new Date(interaction.occurredAt);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(interaction);
  });

  // 날짜별로 정렬 (최신순)
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((dateKey) => ({
    date: dateKey,
    interactions: groups[dateKey].sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    ),
  }));
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return '0';
  return value.toLocaleString('ko-KR');
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess('복사되었습니다.');
  } catch (error) {
    console.error('copyToClipboard error', error);
    showError('복사에 실패했습니다. 다시 시도해주세요.');
  }
}

function StatusBadge({
  status,
  options,
}: {
  status: string;
  options: LeadStatusOption[];
}) {
  const option = options.find((item) => item.value === status);

  // leadStatusOptions에 없는 상태값들 처리
  const statusMap: Record<string, string> = {
    'NEW': '신규',
    'CONTACTED': '소통중',
    'QUALIFIED': '자격확인',
    'CONVERTED': '전환 완료',
    'LOST': '손실',
    'IN_PROGRESS': '진행 중',
    'PURCHASED': '구매 완료',
    'REFUNDED': '환불',
    'CLOSED': '종료',
    'TEST_GUIDE': '3일부재',
  };

  const styleMap: Record<string, string> = {
    'NEW': 'bg-slate-100 text-slate-700',
    'CONTACTED': 'bg-amber-100 text-amber-700',
    'QUALIFIED': 'bg-indigo-100 text-indigo-700',
    'CONVERTED': 'bg-emerald-100 text-emerald-700',
    'LOST': 'bg-red-100 text-red-700',
    'IN_PROGRESS': 'bg-indigo-100 text-indigo-700',
    'PURCHASED': 'bg-emerald-100 text-emerald-700',
    'REFUNDED': 'bg-rose-100 text-rose-700',
    'CLOSED': 'bg-slate-100 text-slate-600',
    'TEST_GUIDE': 'bg-yellow-100 text-yellow-700',
  };

  const label = option?.label || statusMap[status] || status;
  const theme = option?.theme || styleMap[status] || 'bg-slate-200 text-slate-700';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${theme}`}
    >
      {label}
    </span>
  );
}

export default function PartnerCustomersClient({
  partner,
  leadStatusOptions,
}: PartnerCustomersClientProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const partnerId = params?.partnerId as string;

  // URL 파라미터 확인
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('');

  useEffect(() => {
    const action = searchParams.get('action');
    const agentId = searchParams.get('agentId');

    if (action === 'send-db') {
      router.push(`/partner/${partnerId}/customers/send-db`);
    }

    if (agentId) {
      setSelectedAgentFilter(agentId);
    }
  }, [searchParams, router, partnerId]);

  // 판매원별 DB 현황 상태
  const [agentDbStats, setAgentDbStats] = useState<Array<{
    agentId: number;
    agentName: string;
    affiliateCode: string | null;
    mallUserId: string | null;
    stats: {
      totalCustomers: number;
      activeCustomers7d: number;
      activeCustomers30d: number;
      recentAssigned: number;
      statusCounts: Record<string, number>;
    };
  }>>([]);
  const [loadingAgentDbStats, setLoadingAgentDbStats] = useState(false);

  // 판매원별 DB 현황 로드
  const loadAgentDbStats = useCallback(async () => {
    if (partner.type !== 'BRANCH_MANAGER') return;

    try {
      setLoadingAgentDbStats(true);
      const res = await fetch('/api/partner/agents/db-stats', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setAgentDbStats(json.agents || []);
      }
    } catch (error) {
      console.error('[PartnerCustomers] Failed to load agent DB stats:', error);
    } finally {
      setLoadingAgentDbStats(false);
    }
  }, [partner.type]);

  useEffect(() => {
    if (partner.type === 'BRANCH_MANAGER') {
      loadAgentDbStats();
    }
  }, [partner.type, loadAgentDbStats]);
  const [customers, setCustomers] = useState<PartnerCustomer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addForm, setAddForm] = useState<CreateCustomerForm>({
    customerName: '',
    customerPhone: '',
    status: '',
    notes: '',
    nextActionAt: '',
    agentProfileId: '',
    createdAt: new Date().toISOString().split('T')[0], // 기본값: 오늘 날짜
  });

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<PartnerCustomer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [interactionForm, setInteractionForm] = useState<InteractionForm>({
    note: '',
    status: '',
    nextActionAt: '',
    occurredAt: '',
    files: [],
  });
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [updatingLead, setUpdatingLead] = useState(false);
  const [requestingPassport, setRequestingPassport] = useState(false);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [passportMethod, setPassportMethod] = useState<'aligo' | 'link'>('link');
  const [passportMessage, setPassportMessage] = useState('');
  const [passportTemplates, setPassportTemplates] = useState<Array<{
    id: number;
    title: string;
    body: string;
    isDefault: boolean;
  }>>([]);
  const [selectedPassportTemplateId, setSelectedPassportTemplateId] = useState<number | null>(null);
  const [loadingPassportTemplates, setLoadingPassportTemplates] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);
  const [isContractTerminated, setIsContractTerminated] = useState(false);
  const [confirmingSale, setConfirmingSale] = useState<number | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'customers' | 'inquiries' | 'system-consultations'>('customers');
  const [customerGroups, setCustomerGroups] = useState<Array<{
    id: number;
    name: string;
    description: string | null;
    productCode: string | null;
    color: string | null;
    leadCount: number;
  }>>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  // 고객 선택 및 삭제 관련 상태 (대리점장만 삭제 가능)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
  const [deletingCustomers, setDeletingCustomers] = useState(false);

  // 전화상담고객 별도 상태
  const [inquiryCustomers, setInquiryCustomers] = useState<PartnerCustomer[]>([]);
  const [inquiryPagination, setInquiryPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryCurrentPage, setInquiryCurrentPage] = useState(1);
  const [inquirySearchTerm, setInquirySearchTerm] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('ALL');

  // 시스템 상담 신청 별도 상태
  const [systemConsultations, setSystemConsultations] = useState<any[]>([]);
  const [systemConsultationLoading, setSystemConsultationLoading] = useState(false);
  const [systemConsultationSearch, setSystemConsultationSearch] = useState('');

  // 고객 리스트 모달 관련 상태
  const [showCustomerListModal, setShowCustomerListModal] = useState(false);
  const [customerListGroup, setCustomerListGroup] = useState<{ id: number; name: string } | null>(null);
  const [groupCustomers, setGroupCustomers] = useState<Array<{
    id: number;
    userId: number;
    customerName: string | null;
    phone: string | null;
    email: string | null;
    groupInflowDate: string;
    daysSinceInflow: number;
    messageSentCount: number;
  }>>([]);
  const [customerListSearch, setCustomerListSearch] = useState('');
  const [customerListPage, setCustomerListPage] = useState(1);
  const [customerListTotal, setCustomerListTotal] = useState(0);
  const [isLoadingCustomerList, setIsLoadingCustomerList] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    productCode: '',
    color: '#3B82F6',
  });
  const [activeProducts, setActiveProducts] = useState<Array<{
    id: number;
    productCode: string;
    cruiseLine: string;
    shipName: string;
    packageName: string;
    nights: number;
    days: number;
    basePrice: number | null;
  }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [groupExcelFile, setGroupExcelFile] = useState<File | null>(null);
  const [uploadingGroupExcel, setUploadingGroupExcel] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // 퍼널 설정 관련 상태
  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [funnelSettingsGroup, setFunnelSettingsGroup] = useState<{
    id: number;
    name: string;
    funnelTalkIds?: number[] | null;
    funnelSmsIds?: number[] | null;
    funnelEmailIds?: number[] | null;
    reEntryHandling?: string | null;
  } | null>(null);
  const [funnelTalks, setFunnelTalks] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);
  const [funnelSms, setFunnelSms] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);
  const [funnelEmails, setFunnelEmails] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);
  const [funnelForm, setFunnelForm] = useState({
    funnelTalkIds: [] as number[],
    funnelSmsIds: [] as number[],
    funnelEmailIds: [] as number[],
    reEntryHandling: 'time_change_info_change' as string,
  });

  // DB 보내기 관련 상태
  const [showDbSendModal, setShowDbSendModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [newCustomers, setNewCustomers] = useState<Array<{ name: string; phone: string; email: string; notes: string }>>([]);
  const [sendingDb, setSendingDb] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsMethod, setSmsMethod] = useState<'aligo' | 'link'>('aligo');
  // CustomerNoteModal 관련 state 삭제 - 상담기록 패널로 통합됨
  // DB 전달 모달 상태 (통합 상세 모달 제거 후 통합)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetLeadId, setTransferTargetLeadId] = useState<number | null>(null);
  const [transferTargetAgentId, setTransferTargetAgentId] = useState<number | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [smsRecipientMode, setSmsRecipientMode] = useState<'customer' | 'custom'>('customer'); // 고객 선택 또는 직접 번호 입력
  const [customPhoneNumber, setCustomPhoneNumber] = useState(''); // 직접 입력한 번호
  const [aligoConfig, setAligoConfig] = useState({
    apiKey: '',
    userId: '',
    senderPhone: '',
  });
  const [loadingAligoConfig, setLoadingAligoConfig] = useState(false);
  const [savingAligoConfig, setSavingAligoConfig] = useState(false);
  const [hasSyncedAligoConfig, setHasSyncedAligoConfig] = useState(false);
  const [aligoConfigDirty, setAligoConfigDirty] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [showAligoGuide, setShowAligoGuide] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelAgentProfileId, setExcelAgentProfileId] = useState<string>('');
  const [showSmsConfigModal, setShowSmsConfigModal] = useState(false);

  // 이메일 전송 관련 상태
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTitle, setEmailTitle] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailRecipientMode, setEmailRecipientMode] = useState<'customer' | 'custom'>('customer');
  const [customEmailAddress, setCustomEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  // 이메일 이미지 (URL 또는 base64)
  const [emailImages, setEmailImages] = useState<Array<{ id: string; url: string; name: string }>>([]);
  // 이메일 버튼 (최대 3개)
  const [emailButtons, setEmailButtons] = useState<Array<{ id: string; label: string; url: string }>>([]);
  // 이미지 라이브러리 모달
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  // 치환 기능 - 선택된 상품 ID (상품 목록은 기존 activeProducts 사용)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // 치환 함수 - 메시지에서 {이름}, {연락처}, {상품명} 치환
  const applySubstitution = useCallback((text: string) => {
    let result = text;
    // 이름 치환
    if (selectedLead?.customerName) {
      result = result.replace(/\{\{이름\}\}/g, selectedLead.customerName);
    }
    // 연락처 치환
    if (selectedLead?.customerPhone) {
      result = result.replace(/\{\{연락처\}\}/g, selectedLead.customerPhone);
    }
    // 상품명 치환
    if (selectedProductId) {
      const product = activeProducts.find(p => p.id === selectedProductId);
      if (product) {
        result = result.replace(/\{\{상품명\}\}/g, product.packageName);
      }
    }
    return result;
  }, [selectedLead, selectedProductId, activeProducts]);

  const statusSelectOptions = useMemo(
    () => [
      { value: '', label: '상태 선택' },
      ...leadStatusOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ],
    [leadStatusOptions],
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'system-consultations') {
      setActiveTab('system-consultations');
    } else if (tab === 'inquiries') {
      setActiveTab('inquiries');
    }
  }, [searchParams]);

  const loadSystemConsultations = useCallback(async () => {
    try {
      setSystemConsultationLoading(true);
      const res = await fetch('/api/partner/system-inquiries', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSystemConsultations(json.consultations || []);
      } else {
        showError(json.message || '시스템 상담 내역을 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('Failed to load system consultations:', error);
      showError('시스템 상담 내역을 불러오지 못했습니다.');
    } finally {
      setSystemConsultationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'system-consultations') {
      loadSystemConsultations();
    }
  }, [activeTab, loadSystemConsultations]);

  const filteredSystemConsultations = systemConsultations.filter(c => {
    if (systemConsultationSearch) {
      const query = systemConsultationSearch.toLowerCase();
      return (
        c.name?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      );
    }
    return true;
  });

  const getLocalAligoConfig = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem('aligo_config');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || '',
        userId: parsed.userId || '',
        senderPhone: (parsed.senderPhone || '').replace(/[^0-9]/g, ''),
      };
    } catch (error) {
      console.error('Failed to parse local Aligo config:', error);
      return null;
    }
  }, []);

  const updateAligoConfigField = useCallback(
    (field: 'apiKey' | 'userId' | 'senderPhone', value: string) => {
      const sanitizedValue =
        field === 'senderPhone' ? value.replace(/[^0-9]/g, '') : value;
      setAligoConfig((prev) => ({ ...prev, [field]: sanitizedValue }));
      setAligoConfigDirty(true);
      setHasSyncedAligoConfig(false);
    },
    [],
  );

  const loadAligoConfig = useCallback(async () => {
    setLoadingAligoConfig(true);
    try {
      const response = await fetch('/api/partner/settings/sms', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || 'SMS 설정을 불러올 수 없습니다.');
      }
      const config = data.config;
      if (config && config.provider === 'aligo') {
        const sanitized = {
          apiKey: config.apiKey || '',
          userId: config.userId || '',
          senderPhone: (config.senderPhone || '').replace(/[^0-9]/g, ''),
        };
        setAligoConfig(sanitized);
        setHasSyncedAligoConfig(Boolean(sanitized.apiKey && sanitized.userId && sanitized.senderPhone));
        setAligoConfigDirty(false);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('aligo_config', JSON.stringify(sanitized));
        }
      } else {
        const fallback = getLocalAligoConfig();
        if (fallback) {
          setAligoConfig(fallback);
        } else {
          setAligoConfig({ apiKey: '', userId: '', senderPhone: '' });
        }
        setHasSyncedAligoConfig(false);
        setAligoConfigDirty(false);
      }
    } catch (error) {
      console.error('Failed to load Aligo config:', error);
      const fallback = getLocalAligoConfig();
      if (fallback) {
        setAligoConfig(fallback);
      }
      showError(
        error instanceof Error
          ? error.message
          : '알리고 설정을 불러오지 못했습니다. 설정 페이지에서 확인해주세요.',
      );
    } finally {
      setLoadingAligoConfig(false);
    }
  }, [getLocalAligoConfig, showError]);

  // 계약 해지 상태 확인
  useEffect(() => {
    const checkContractStatus = async () => {
      try {
        const res = await fetch('/api/affiliate/my-contract', {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.ok && data.contract) {
          setIsContractTerminated(data.contract.status === 'terminated');
        }
      } catch (error) {
        console.error('Failed to check contract status:', error);
      }
    };
    checkContractStatus();
  }, []);

  const handleExtendTrial = async (leadId: number, currentName: string) => {
    if (!confirm(`${currentName}님의 무료 체험 기간을 7일 연장하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/affiliate/leads/${leadId}/extend-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess(data.message);
        // 목록 새로고침
        fetchCustomers(currentPage);
      } else {
        showError(data.message || '연장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error extending trial:', error);
      showError('오류가 발생했습니다.');
    }
  };

  // 고객 선택 토글 (삭제용)
  const toggleCustomerForDelete = (customerId: number) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제 (삭제용)
  const toggleAllForDelete = (customerIds: number[]) => {
    setSelectedForDelete(prev => {
      const allSelected = customerIds.every(id => prev.has(id));
      if (allSelected) {
        // 모두 해제
        const newSet = new Set(prev);
        customerIds.forEach(id => newSet.delete(id));
        return newSet;
      } else {
        // 모두 선택
        const newSet = new Set(prev);
        customerIds.forEach(id => newSet.add(id));
        return newSet;
      }
    });
  };

  // 선택된 고객 삭제 (대리점장만 가능)
  const handleDeleteSelectedCustomers = async () => {
    if (partner.type !== 'BRANCH_MANAGER') {
      showError('삭제 권한이 없습니다.');
      return;
    }

    if (selectedForDelete.size === 0) {
      showError('삭제할 고객을 선택해주세요.');
      return;
    }

    if (!confirm(`선택된 ${selectedForDelete.size}명의 고객을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingCustomers(true);
    try {
      const deletePromises = Array.from(selectedForDelete).map(leadId =>
        fetch(`/api/partner/customers/${leadId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        showSuccess(`${successCount}명의 고객이 삭제되었습니다.`);
        setSelectedForDelete(new Set());
        fetchCustomers(currentPage);
      }
      if (failCount > 0) {
        showError(`${failCount}명의 고객 삭제에 실패했습니다.`);
      }
    } catch (error) {
      console.error('Error deleting customers:', error);
      showError('고객 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingCustomers(false);
    }
  };

  const fetchCustomers = useCallback(
    async (pageValue: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', pageValue.toString());
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
        if (searchTerm) params.set('q', searchTerm);
        if (selectedAgentFilter) {
          if (selectedAgentFilter === 'unassigned') {
            // 미할당 고객만 필터링 (클라이언트 사이드)
          } else {
            params.set('agentId', selectedAgentFilter);
          }
        }

        const res = await fetch(`/api/partner/customers?${params}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || '고객 목록을 불러오지 못했습니다.');
        }

        let customers = json.customers ?? [];

        // 미할당 고객 필터링 (클라이언트 사이드)
        if (selectedAgentFilter === 'unassigned') {
          customers = customers.filter((c: any) => c.ownership === 'MANAGER' && !c.agent?.id);
        }

        setCustomers(customers);
        if (json.pagination) {
          setPagination(json.pagination);
          setCurrentPage(json.pagination.page);
        }
      } catch (error) {
        console.error('fetchCustomers error', error);
        showError(
          error instanceof Error
            ? error.message
            : '고객 목록을 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, statusFilter, selectedAgentFilter, sourceFilter],
  );

  const loadLeadDetail = useCallback(async (leadId: number): Promise<PartnerCustomer | null> => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/partner/customers/${leadId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '고객 정보를 불러오지 못했습니다.');
      }
      setSelectedLead(json.customer);
      return json.customer;
    } catch (error) {
      console.error('loadLeadDetail error', error);
      showError(
        error instanceof Error
          ? error.message
          : '고객 정보를 불러오지 못했습니다.',
      );
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 고객 그룹 로드
  const loadCustomerGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/customer-groups', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setCustomerGroups(json.groups || []);
      }
    } catch (error) {
      console.error('loadCustomerGroups error', error);
    }
  }, []);

  // 그룹별 고객 리스트 로드
  const loadGroupCustomers = useCallback(async (groupId: number, pageNum?: number) => {
    try {
      setIsLoadingCustomerList(true);
      const page = pageNum ?? customerListPage;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (customerListSearch) {
        params.set('search', customerListSearch);
      }

      const response = await fetch(`/api/partner/customer-groups/${groupId}/customers?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.ok) {
        setGroupCustomers(data.customers || []);
        setCustomerListTotal(data.pagination?.total || 0);
        setCustomerListPage(data.pagination?.page || 1);
      } else {
        showError(data.error || '고객 리스트를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Failed to load group customers:', error);
      showError('고객 리스트를 불러오는 중 네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoadingCustomerList(false);
    }
  }, [customerListSearch, customerListPage]);

  // 그룹별 고객 리스트 열기
  const handleViewCustomerList = useCallback(async (group: { id: number; name: string }) => {
    setCustomerListGroup(group);
    setCustomerListSearch('');
    setCustomerListPage(1);
    setShowCustomerListModal(true);
    await loadGroupCustomers(group.id, 1);
  }, [loadGroupCustomers]);

  // 고객 리스트 검색 (debounce)
  useEffect(() => {
    if (!showCustomerListModal || !customerListGroup) return;

    const timer = setTimeout(() => {
      setCustomerListPage(1);
      loadGroupCustomers(customerListGroup.id, 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [customerListSearch, showCustomerListModal, customerListGroup, loadGroupCustomers]);

  // 퍼널 목록 로드 (예약메시지 groupName별로 그룹화)
  const loadFunnelLists = useCallback(async () => {
    try {
      const response = await fetch('/api/partner/scheduled-messages', { credentials: 'include' });
      const data = await response.json();

      if (data.ok && data.messages) {
        const kakaoMessages = data.messages.filter((m: any) => m.sendMethod === 'kakao');
        const smsMessages = data.messages.filter((m: any) => m.sendMethod === 'sms' || m.sendMethod === 'cruise-guide');
        const emailMessages = data.messages.filter((m: any) => m.sendMethod === 'email');

        const groupByGroupName = (messages: any[]) => {
          const grouped = messages.reduce((acc: any, msg: any) => {
            const groupName = msg.groupName || '기타';
            if (!acc[groupName]) {
              acc[groupName] = [];
            }
            acc[groupName].push({ id: msg.id, title: msg.title });
            return acc;
          }, {});

          return Object.keys(grouped).map(groupName => ({
            groupName,
            messages: grouped[groupName],
          }));
        };

        setFunnelTalks(groupByGroupName(kakaoMessages));
        setFunnelSms(groupByGroupName(smsMessages));
        setFunnelEmails(groupByGroupName(emailMessages));
      }
    } catch (error) {
      console.error('Failed to load funnel lists:', error);
      showError('퍼널 목록을 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  // 활성 상품 목록 로드
  const loadActiveProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/partner/products/active', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setActiveProducts(json.products || []);
      }
    } catch (error) {
      console.error('loadActiveProducts error', error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // 그룹 관리용 엑셀 샘플 다운로드
  const handleDownloadGroupExcelSample = async () => {
    try {
      const res = await fetch('/api/partner/customer-groups/excel-upload', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('엑셀 샘플 다운로드에 실패했습니다.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '고객_일괄등록_양식.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSuccess('엑셀 샘플 파일이 다운로드되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '엑셀 샘플 다운로드에 실패했습니다.');
    }
  };

  // DB 보내기 핸들러
  const handleSendDb = async () => {
    if (!selectedAgentId) {
      showError('판매원을 선택해주세요.');
      return;
    }

    if (selectedCustomerIds.length === 0 && newCustomers.length === 0) {
      showError('고객을 선택하거나 추가해주세요.');
      return;
    }

    // 새 고객 유효성 검사
    for (const customer of newCustomers) {
      if (!customer.name || !customer.phone) {
        showError('새 고객의 이름과 연락처는 필수입니다.');
        return;
      }
    }

    setSendingDb(true);
    try {
      const res = await fetch('/api/partner/customers/assign-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          leadIds: selectedCustomerIds,
          agentId: selectedAgentId,
          customerData: newCustomers,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'DB 보내기에 실패했습니다.');
      }

      showSuccess(`DB 보내기 완료: ${json.results.assigned.length + json.results.created.length}건 처리됨`);
      setShowDbSendModal(false);
      setSelectedAgentId('');
      setSelectedCustomerIds([]);
      setNewCustomers([]);
      fetchCustomers(currentPage);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'DB 보내기에 실패했습니다.');
    } finally {
      setSendingDb(false);
    }
  };

  // DB 회수 핸들러
  const handleRecallDb = async (leadIds: number[]) => {
    if (leadIds.length === 0) {
      showError('회수할 고객을 선택해주세요.');
      return;
    }

    if (!confirm(`${leadIds.length}명의 고객을 회수하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch('/api/partner/customers/assign-leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leadIds }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'DB 회수에 실패했습니다.');
      }

      showSuccess(`DB 회수 완료: ${json.results.recalled.length}건 처리됨`);
      fetchCustomers(currentPage);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'DB 회수에 실패했습니다.');
    }
  };

  // 엑셀 파일 업로드
  const handleUploadGroupExcel = async () => {
    if (!groupExcelFile) {
      showError('엑셀 파일을 선택해주세요.');
      return;
    }

    if (!editingGroup) {
      showError('그룹을 먼저 생성해주세요.');
      return;
    }

    setUploadingGroupExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', groupExcelFile);
      formData.append('groupId', editingGroup.toString());

      const res = await fetch('/api/partner/customer-groups/excel-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || '엑셀 업로드에 실패했습니다.');
      }

      showSuccess(
        `엑셀 업로드 완료: 총 ${json.summary?.total || 0}건 중 ${json.summary?.added || 0}건 추가, ${json.summary?.skipped || 0}건 건너뜀`
      );
      setGroupExcelFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      loadCustomerGroups();
      fetchCustomers(currentPage);
      // 엑셀 업로드 후 모달 닫기
      setShowGroupModal(false);
      setEditingGroup(null);
      setGroupForm({ name: '', description: '', productCode: '', color: '#3B82F6' });
    } catch (error) {
      showError(error instanceof Error ? error.message : '엑셀 업로드에 실패했습니다.');
    } finally {
      setUploadingGroupExcel(false);
    }
  };

  // 전화상담고객 로드 함수
  const fetchInquiryCustomers = useCallback(
    async (pageValue: number) => {
      setInquiryLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', pageValue.toString());
        params.set('source', 'mall'); // 전화상담고객 필터
        if (inquiryStatusFilter !== 'ALL') params.set('status', inquiryStatusFilter);
        if (inquirySearchTerm) params.set('q', inquirySearchTerm);

        const res = await fetch(`/api/partner/customers?${params}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || '전화상담 고객 목록을 불러오지 못했습니다.');
        }

        setInquiryCustomers(json.customers ?? []);
        if (json.pagination) {
          setInquiryPagination(json.pagination);
          setInquiryCurrentPage(json.pagination.page);
        }
      } catch (error) {
        console.error('fetchInquiryCustomers error', error);
        showError(
          error instanceof Error
            ? error.message
            : '전화상담 고객 목록을 불러오지 못했습니다.',
        );
      } finally {
        setInquiryLoading(false);
      }
    },
    [inquiryStatusFilter, inquirySearchTerm],
  );

  // 초기 마운트 시 고객 그룹 로드
  useEffect(() => {
    loadCustomerGroups();
  }, [loadCustomerGroups]);

  // activeTab 변경 시 고객 목록 로드
  useEffect(() => {
    if (activeTab === 'inquiries') {
      fetchInquiryCustomers(inquiryCurrentPage);
    } else if (activeTab === 'customers') {
      fetchCustomers(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, inquiryCurrentPage]);

  // 그룹 모달이 열릴 때 활성 상품 목록 로드
  useEffect(() => {
    if (showGroupModal) {
      loadActiveProducts();
    }
  }, [showGroupModal, loadActiveProducts]);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
    };

    if (productDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [productDropdownOpen]);

  // 검색/필터 변경 시 페이지 초기화 및 재조회
  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === 'customers') {
      fetchCustomers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sourceFilter, searchTerm, selectedAgentFilter, activeTab]);

  // 전화상담고객 탭의 검색/필터 변경 시 재조회
  useEffect(() => {
    setInquiryCurrentPage(1);
    if (activeTab === 'inquiries') {
      fetchInquiryCustomers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryStatusFilter, inquirySearchTerm, activeTab]);

  useEffect(() => {
    loadAligoConfig();
  }, [loadAligoConfig]);

  // 그룹 저장
  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      showError('그룹 이름을 입력해주세요.');
      return;
    }

    try {
      const url = editingGroup
        ? `/api/partner/customer-groups/${editingGroup}`
        : '/api/partner/customer-groups';
      const method = editingGroup ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(groupForm),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '그룹 저장에 실패했습니다.');
      }

      const createdGroupId = editingGroup || json.group?.id;
      showSuccess(editingGroup ? '그룹이 수정되었습니다.' : '그룹이 생성되었습니다.');
      if (!editingGroup && createdGroupId) {
        // 새 그룹 생성 시 그룹 ID를 설정하여 엑셀 업로드 가능하도록 함
        setEditingGroup(createdGroupId);
      } else {
        setShowGroupModal(false);
        setEditingGroup(null);
        setGroupForm({ name: '', description: '', productCode: '', color: '#3B82F6' });
      }
      loadCustomerGroups();
    } catch (error) {
      showError(error instanceof Error ? error.message : '그룹 저장에 실패했습니다.');
    }
  };

  // 브라우저 알림 권한 확인
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);

      // 권한이 없으면 요청
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
          if (permission === 'granted') {
            showSuccess('알림 권한이 허용되었습니다. 다음 조치 알람을 받을 수 있습니다.');
          }
        });
      }
    }
  }, []);

  // 여권 템플릿 로드
  const loadPassportTemplates = useCallback(async () => {
    setLoadingPassportTemplates(true);
    try {
      const res = await fetch('/api/partner/passport-templates', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('템플릿을 불러올 수 없습니다.');
      }
      const data = await res.json();
      if (data.ok && Array.isArray(data.templates)) {
        setPassportTemplates(data.templates);
        if (data.templates.length > 0) {
          const defaultTemplate = data.templates.find((tpl) => tpl.isDefault);
          const firstTemplate = defaultTemplate ?? data.templates[0];
          setSelectedPassportTemplateId(firstTemplate.id);
          // 템플릿 내용을 메시지에 설정 (링크는 나중에 추가)
          setPassportMessage(firstTemplate.body.replace('{링크}', '[링크가 자동으로 추가됩니다]'));
        }
      }
    } catch (error) {
      console.error('[PassportModal] Load templates error:', error);
      showError('템플릿을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoadingPassportTemplates(false);
    }
  }, []);

  // 여권 모달이 열릴 때 템플릿 로드 및 알리고 설정 로드
  useEffect(() => {
    if (showPassportModal) {
      if (passportTemplates.length === 0) {
        loadPassportTemplates();
      }
      // 알리고 설정이 아직 로드되지 않았으면 로드
      if (!hasSyncedAligoConfig && !loadingAligoConfig) {
        loadAligoConfig();
      }
    }
  }, [showPassportModal, passportTemplates.length, loadPassportTemplates, hasSyncedAligoConfig, loadingAligoConfig, loadAligoConfig]);

  // SMS 모달이 열릴 때 알리고 설정 및 상품 목록 로드
  useEffect(() => {
    if (showSmsModal) {
      // 알리고 설정이 아직 로드되지 않았으면 로드
      if (!hasSyncedAligoConfig && !loadingAligoConfig) {
        loadAligoConfig();
      }
      // 상품 목록 로드
      loadActiveProducts();
    }
  }, [showSmsModal, hasSyncedAligoConfig, loadingAligoConfig, loadAligoConfig, loadActiveProducts]);

  // 이메일 모달이 열릴 때 상품 목록 로드
  useEffect(() => {
    if (showEmailModal) {
      loadActiveProducts();
    }
  }, [showEmailModal, loadActiveProducts]);

  // 템플릿 선택 시 메시지 업데이트
  useEffect(() => {
    if (selectedPassportTemplateId && passportTemplates.length > 0) {
      const template = passportTemplates.find((tpl) => tpl.id === selectedPassportTemplateId);
      if (template) {
        setPassportMessage(template.body.replace('{링크}', '[링크가 자동으로 추가됩니다]'));
      }
    }
  }, [selectedPassportTemplateId, passportTemplates]);

  // URL 파라미터로 모달 열기 (한 번만 실행)
  const [smsActionProcessed, setSmsActionProcessed] = useState(false);
  const [emailActionProcessed, setEmailActionProcessed] = useState(false);
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'sms' && !smsActionProcessed) {
      setSmsActionProcessed(true);
      // selectedLeadId가 있으면 바로 모달 열기
      if (selectedLeadId && !showSmsModal) {
        // 고객 정보가 로드되지 않았으면 먼저 로드
        if (!selectedLead) {
          loadLeadDetail(selectedLeadId).then(() => {
            setShowSmsModal(true);
          });
        } else {
          setShowSmsModal(true);
        }
      }
      // selectedLeadId가 없어도 모달 열기 (직접 번호 입력 모드 사용 가능)
      else if (!selectedLeadId && !showSmsModal) {
        setShowSmsModal(true);
        setSmsRecipientMode('custom'); // 직접 번호 입력 모드로 시작
      }
    }
    // 이메일 action 처리
    if (action === 'email' && !emailActionProcessed) {
      setEmailActionProcessed(true);
      // 이메일 모달 바로 열기 (직접 이메일 입력 모드)
      if (!showEmailModal) {
        setShowEmailModal(true);
        setEmailRecipientMode('custom');
      }
    }
    // action이 없으면 초기화
    if (!action && smsActionProcessed) {
      setSmsActionProcessed(false);
    }
    if (!action && emailActionProcessed) {
      setEmailActionProcessed(false);
    }
  }, [searchParams, selectedLeadId, selectedLead, showSmsModal, showEmailModal, loadLeadDetail, customers.length, smsActionProcessed, emailActionProcessed]);

  // 다음 조치 알람 스케줄링 함수
  const scheduleNextActionAlarm = useCallback((nextActionAt: string, customerName: string | null, leadId: number) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const actionDate = new Date(nextActionAt);
    const now = new Date();

    // 과거 시간이면 알람 설정 안 함
    if (actionDate <= now) {
      return;
    }

    const timeUntilAction = actionDate.getTime() - now.getTime();

    // 알람 시간에 브라우저 알림 표시
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('다음 조치 알림', {
          body: `${customerName || '고객'}님의 다음 조치 시간입니다.`,
          icon: '/favicon.ico',
          tag: `next-action-${leadId}`,
          requireInteraction: true,
        });
      }
    }, timeUntilAction);

    // 백엔드에도 알람 정보 전송
    fetch(`/api/partner/customers/${leadId}/schedule-alarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nextActionAt,
        customerName: customerName || '고객',
      }),
    }).catch((error) => {
      console.error('알람 스케줄링 실패:', error);
    });
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const resetAddForm = () =>
    setAddForm({
      customerName: '',
      customerPhone: '',
      status: '',
      notes: '',
      nextActionAt: '',
      agentProfileId: '',
      createdAt: new Date().toISOString().split('T')[0], // 기본값: 오늘 날짜
    });

  const handleCreateCustomer = async () => {
    if (!addForm.customerName && !addForm.customerPhone) {
      showError('고객 이름 또는 연락처를 입력해주세요.');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        customerName: addForm.customerName,
        customerPhone: addForm.customerPhone,
        status: addForm.status || undefined,
        notes: addForm.notes || undefined,
      };
      if (addForm.createdAt) {
        // 유입날짜를 ISO 형식으로 변환
        const createdAtDate = new Date(addForm.createdAt);
        createdAtDate.setHours(0, 0, 0, 0);
        payload.createdAt = createdAtDate.toISOString();
      }
      if (addForm.nextActionAt) {
        // 다음 조치 예정일을 ISO 형식으로 변환 (날짜+시간)
        const nextActionDate = new Date(addForm.nextActionAt);
        payload.nextActionAt = nextActionDate.toISOString();
      }
      if (partner.type === 'BRANCH_MANAGER' && addForm.agentProfileId) {
        payload.agentProfileId = Number(addForm.agentProfileId);
      }

      // 백업 컨텍스트 추가 (내 고객 관리)
      payload.backupContext = 'management';

      const res = await fetch('/api/partner/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '고객 추가에 실패했습니다.');
      }

      // 다음 조치 예정일이 있으면 알람 스케줄링
      if (addForm.nextActionAt && json.customer?.id) {
        scheduleNextActionAlarm(
          addForm.nextActionAt,
          addForm.customerName || null,
          json.customer.id
        );
      }

      showSuccess('고객이 추가되었습니다.');
      setIsAddModalOpen(false);
      resetAddForm();
      setCurrentPage(1);
      fetchCustomers(1);
    } catch (error) {
      console.error('handleCreateCustomer error', error);
      showError(
        error instanceof Error ? error.message : '고객 추가에 실패했습니다.',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateLead = async (updates: Record<string, unknown>) => {
    if (!selectedLeadId) return;
    setUpdatingLead(true);
    try {
      const res = await fetch(`/api/partner/customers/${selectedLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '고객 정보를 수정하지 못했습니다.');
      }
      showSuccess('고객 정보가 업데이트되었습니다.');
      setSelectedLead(json.customer);
      fetchCustomers(currentPage);
    } catch (error) {
      console.error('handleUpdateLead error', error);
      showError(
        error instanceof Error
          ? error.message
          : '고객 정보를 수정하지 못했습니다.',
      );
    } finally {
      setUpdatingLead(false);
    }
  };

  const handleAddInteraction = async () => {
    if (!selectedLeadId) return;
    if (!interactionForm.note.trim()) {
      showError('상담 메모를 입력해주세요.');
      return;
    }
    setInteractionSaving(true);
    try {
      const payload: Record<string, unknown> = {
        note: interactionForm.note,
        interactionType: 'NOTE',
      };
      if (interactionForm.status) payload.status = interactionForm.status;
      if (interactionForm.nextActionAt) payload.nextActionAt = interactionForm.nextActionAt;
      if (interactionForm.occurredAt) payload.occurredAt = interactionForm.occurredAt;

      const res = await fetch(`/api/partner/customers/${selectedLeadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '상담 기록을 저장하지 못했습니다.');
      }

      // 파일이 있으면 백그라운드에서 업로드 (사용자가 기다리지 않음)
      const filesToUpload = [...interactionForm.files];
      const interactionId = json.interaction?.id;

      // 폼 초기화 및 성공 메시지 먼저 표시
      setInteractionForm({ note: '', status: '', nextActionAt: '', occurredAt: '', files: [] });

      if (filesToUpload.length > 0 && interactionId) {
        showSuccess(`상담 기록이 저장되었습니다. 파일 ${filesToUpload.length}개 업로드 중...`);

        // 백그라운드에서 파일 업로드 (Promise.all로 병렬 처리)
        Promise.all(
          filesToUpload.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            try {
              const uploadRes = await fetch(`/api/admin/affiliate/interactions/${interactionId}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });
              const uploadJson = await uploadRes.json();
              if (!uploadRes.ok || !uploadJson.ok) {
                console.error('File upload failed:', uploadJson.message);
                return { success: false, fileName: file.name };
              }
              return { success: true, fileName: file.name };
            } catch (uploadError) {
              console.error('File upload error:', uploadError);
              return { success: false, fileName: file.name };
            }
          })
        ).then((results) => {
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;

          if (failCount === 0) {
            showSuccess(`파일 ${successCount}개 업로드 완료!`);
          } else if (successCount > 0) {
            showSuccess(`파일 ${successCount}개 업로드 완료, ${failCount}개 실패`);
          } else {
            showError(`파일 업로드 실패`);
          }

          // 업로드 완료 후 상세정보 새로고침
          if (selectedLeadId) {
            loadLeadDetail(selectedLeadId);
          }
        });
      } else {
        showSuccess('상담 기록이 추가되었습니다.');
      }

      // 상세정보만 새로고침 (고객 목록은 새로고침하지 않음 - 화면 유지)
      const updatedLead = await loadLeadDetail(selectedLeadId);

      // 상태나 다음 조치일시가 변경된 경우에만 목록에서 해당 고객 정보 업데이트
      if (updatedLead) {
        setCustomers(prev => prev.map(c =>
          c.id === selectedLeadId
            ? { ...c, status: updatedLead.status, nextActionAt: updatedLead.nextActionAt, lastContactedAt: updatedLead.lastContactedAt }
            : c
        ));
      }

      // 다음 조치 시간이 설정되었으면 알람 스케줄링
      if (interactionForm.nextActionAt && selectedLead && selectedLeadId) {
        scheduleNextActionAlarm(interactionForm.nextActionAt, selectedLead.customerName, selectedLeadId);
      }
    } catch (error) {
      console.error('handleAddInteraction error', error);
      showError(
        error instanceof Error
          ? error.message
          : '상담 기록을 저장하지 못했습니다.',
      );
    } finally {
      setInteractionSaving(false);
    }
  };

  const openDetail = (leadId: number) => {
    setSelectedLeadId(leadId);
    setSelectedLead(null);
    loadLeadDetail(leadId);
    // 고객 상세보기 열 때 그룹 목록도 함께 로드
    loadCustomerGroups();
    // 고객 상세보기 열 때는 문자보내기 모달을 열지 않음
    setShowSmsModal(false);
  };

  const closeDetail = () => {
    setSelectedLeadId(null);
    setSelectedLead(null);
    setInteractionForm({ note: '', status: '', nextActionAt: '', occurredAt: '', files: [] });
    setShowSmsModal(false);
  };

  const handleSaveAligoConfig = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const trimmedApiKey = aligoConfig.apiKey.trim();
      const trimmedUserId = aligoConfig.userId.trim();
      const sanitizedSender = aligoConfig.senderPhone.replace(/[^0-9]/g, '');

      if (!trimmedApiKey || !trimmedUserId || !sanitizedSender) {
        showError('알리고 API 정보를 모두 입력해주세요.');
        return false;
      }

      setSavingAligoConfig(true);
      try {
        const payload = {
          provider: 'aligo',
          apiKey: trimmedApiKey,
          userId: trimmedUserId,
          senderPhone: sanitizedSender,
          isActive: true,
        };
        const res = await fetch('/api/partner/settings/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || '알리고 설정 저장에 실패했습니다.');
        }

        setAligoConfig({
          apiKey: payload.apiKey,
          userId: payload.userId,
          senderPhone: payload.senderPhone,
        });
        setHasSyncedAligoConfig(true);
        setAligoConfigDirty(false);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'aligo_config',
            JSON.stringify({
              apiKey: payload.apiKey,
              userId: payload.userId,
              senderPhone: payload.senderPhone,
            }),
          );
        }
        if (!silent) {
          showSuccess('알리고 설정이 저장되었습니다. 다음부터 자동으로 연동됩니다.');
        }
        return true;
      } catch (error) {
        console.error('handleSaveAligoConfig error', error);
        showError(error instanceof Error ? error.message : '알리고 설정 저장 중 오류가 발생했습니다.');
        return false;
      } finally {
        setSavingAligoConfig(false);
      }
    },
    [aligoConfig.apiKey, aligoConfig.userId, aligoConfig.senderPhone],
  );

  const handleSendSms = async () => {
    // 수신자 번호 결정
    let recipientPhone = '';
    if (smsRecipientMode === 'customer') {
      if (!selectedLead || !selectedLeadId) {
        showError('고객을 선택해주세요.');
        return;
      }
      recipientPhone = selectedLead.customerPhone || '';
      if (!recipientPhone) {
        showError('고객의 전화번호가 없습니다.');
        return;
      }
    } else {
      // 직접 번호 입력 모드
      const cleanedPhone = customPhoneNumber.replace(/[^0-9]/g, '');
      if (!cleanedPhone || cleanedPhone.length < 10) {
        showError('올바른 전화번호를 입력해주세요.');
        return;
      }
      recipientPhone = cleanedPhone;
    }

    if (smsMethod === 'aligo') {
      // 알리고 API로 직접 발송
      if (!aligoConfig.apiKey || !aligoConfig.userId || !aligoConfig.senderPhone) {
        showWarning('SMS 발송을 위해 API 설정이 필요합니다. 설정 창을 열어드릴게요!');
        setShowSmsConfigModal(true);
        return;
      }

      if (!smsMessage.trim()) {
        showError('문자 내용을 입력해주세요.');
        return;
      }

      setSendingSms(true);
      try {
        // 치환 적용
        const finalMessage = applySubstitution(smsMessage);

        const res = await fetch('/api/partner/customers/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            leadId: smsRecipientMode === 'customer' ? selectedLeadId : null,
            phone: recipientPhone,
            message: finalMessage,
            aligoApiKey: aligoConfig.apiKey,
            aligoUserId: aligoConfig.userId,
            aligoSenderPhone: aligoConfig.senderPhone,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.message || '문자 발송에 실패했습니다.');
        }

        showSuccess('문자가 성공적으로 발송되었습니다!');
        setShowSmsModal(false);
        setSmsMessage('');
        setCustomPhoneNumber('');
        setSmsRecipientMode('customer');
      } catch (error) {
        console.error('handleSendSms error', error);
        showError(
          error instanceof Error ? error.message : '문자 발송 중 오류가 발생했습니다.',
        );
      } finally {
        setSendingSms(false);
      }
    } else {
      // 링크 생성 방식
      if (smsRecipientMode === 'customer' && selectedLeadId) {
        // 본사로 여권 전송 링크 생성
        const passportLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/passport-upload?leadId=${selectedLeadId}&partnerId=${partnerId}`;

        // 링크 복사만 수행
        try {
          if (typeof window !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(passportLink);
            showSuccess('여권 업로드 링크가 복사되었습니다.');
          } else {
            showError('링크 복사에 실패했습니다. 링크를 수동으로 복사해주세요.');
          }
          setShowSmsModal(false);
          setSmsMessage('');
          setCustomPhoneNumber('');
          setSmsRecipientMode('customer');
        } catch (error) {
          console.error('링크 복사 실패:', error);
          showError('링크 복사에 실패했습니다. 링크를 수동으로 복사해주세요.');
        }
      } else {
        // 직접 번호 입력 모드에서는 링크 생성 불가
        showError('링크 생성 방식은 고객 선택 모드에서만 사용할 수 있습니다.');
      }
    }
  };

  // 이메일 전송 함수
  const handleSendEmail = async () => {
    // 수신자 이메일 결정
    let recipientEmail = '';
    if (emailRecipientMode === 'customer') {
      // 고객의 이메일이 있는지 확인 - selectedLead에 email이 없으면 직접 입력 모드로 안내
      showWarning('고객 이메일 주소를 직접 입력해주세요.');
      setEmailRecipientMode('custom');
      return;
    } else {
      // 직접 이메일 입력 모드
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!customEmailAddress || !emailRegex.test(customEmailAddress)) {
        showError('올바른 이메일 주소를 입력해주세요.');
        return;
      }
      recipientEmail = customEmailAddress;
    }

    if (!emailTitle.trim()) {
      showError('이메일 제목을 입력해주세요.');
      return;
    }

    if (!emailContent.trim()) {
      showError('이메일 내용을 입력해주세요.');
      return;
    }

    setSendingEmail(true);
    try {
      // 치환 적용
      const finalTitle = applySubstitution(emailTitle);
      const finalContent = applySubstitution(emailContent);

      const res = await fetch('/api/partner/customers/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emails: [recipientEmail],
          title: finalTitle,
          content: finalContent,
          images: emailImages.map(img => ({ url: img.url, name: img.name })),
          buttons: emailButtons.filter(btn => btn.label && btn.url).map(btn => ({ label: btn.label, url: btn.url })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '이메일 발송에 실패했습니다.');
      }

      showSuccess('이메일이 성공적으로 발송되었습니다! (크루즈닷 푸터가 자동으로 추가됩니다)');
      setShowEmailModal(false);
      setEmailTitle('');
      setEmailContent('');
      setCustomEmailAddress('');
      setEmailRecipientMode('customer');
      setEmailImages([]);
      setEmailButtons([]);
    } catch (error) {
      console.error('handleSendEmail error', error);
      showError(
        error instanceof Error ? error.message : '이메일 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handleRequestPassport = async () => {
    if (!selectedLeadId) return;
    if (!confirm('고객에게 여권 요청을 전송하시겠습니까?')) {
      return;
    }

    try {
      setRequestingPassport(true);
      const res = await fetch(`/api/admin/affiliate/leads/${selectedLeadId}/request-passport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: '여권 정보가 필요합니다.' }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = '여권 요청에 실패했습니다.';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = `서버 오류 (${res.status})`;
        }
        throw new Error(errorMessage);
      }

      const json = await res.json().catch(() => ({ ok: false }));
      if (!json.ok) {
        throw new Error(json.message || '여권 요청에 실패했습니다.');
      }

      showSuccess('여권 요청이 전송되었습니다. 본사 확인 후 여권 완료 처리가 됩니다.');
      await loadLeadDetail(selectedLeadId);
      fetchCustomers(currentPage);
    } catch (error) {
      console.error('handleRequestPassport error', error);
      showError(
        error instanceof Error ? error.message : '여권 요청 중 오류가 발생했습니다.',
      );
    } finally {
      setRequestingPassport(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLeadId) return;
    if (!confirm('정말로 이 고객을 삭제하시겠습니까? 삭제된 고객은 복구할 수 없으며, 판매원 고객관리에서도 자동으로 삭제됩니다.')) {
      return;
    }

    try {
      setDeletingLead(true);
      const res = await fetch(`/api/partner/customers/${selectedLeadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '고객 삭제에 실패했습니다.');
      }

      showSuccess('고객이 삭제되었습니다.');
      closeDetail();
      fetchCustomers(currentPage);
    } catch (error) {
      console.error('handleDeleteLead error', error);
      showError(
        error instanceof Error ? error.message : '고객 삭제 중 오류가 발생했습니다.',
      );
    } finally {
      setDeletingLead(false);
    }
  };

  const handleConfirmSale = async (saleId: number) => {
    if (!selectedLeadId) return;
    if (!confirm('매출을 확정하시겠습니까? 확정된 매출은 수당 책정이 가능합니다.')) {
      return;
    }

    try {
      setConfirmingSale(saleId);
      const res = await fetch(`/api/partner/customers/${selectedLeadId}/sales/${saleId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '매출 확정에 실패했습니다.');
      }

      showSuccess('매출이 확정되었습니다. 수당 책정이 가능합니다.');
      await loadLeadDetail(selectedLeadId);
      fetchCustomers(currentPage);
    } catch (error) {
      console.error('handleConfirmSale error', error);
      showError(
        error instanceof Error ? error.message : '매출 확정 중 오류가 발생했습니다.',
      );
    } finally {
      setConfirmingSale(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setInteractionForm((prev) => ({
      ...prev,
      files: [...prev.files, ...files],
    }));
  };

  const removeFile = (index: number) => {
    setInteractionForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  // 여권 만료 임박 체크 (6개월 이내)
  const checkPassportExpiry = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(now.getMonth() + 6);

    if (expiry <= sixMonthsLater) {
      return '임박';
    }
    return null;
  };

  const handleDownloadExcelSample = () => {
    const link = document.createElement('a');
    link.href = '/api/partner/customers/excel/sample';
    link.download = '고객_목록_샘플.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadExcel = async () => {
    if (!excelFile) {
      showError('엑셀 파일을 선택해주세요.');
      return;
    }

    // 파일 크기 확인 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (excelFile.size > maxSize) {
      showError(`파일 크기가 너무 큽니다. (최대 10MB, 현재: ${(excelFile.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    // 파일 형식 확인
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileName = excelFile.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      showError('엑셀 파일만 업로드 가능합니다. (.xlsx, .xls)');
      return;
    }

    setUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      if (excelAgentProfileId) {
        formData.append('agentProfileId', excelAgentProfileId);
      }

      logger.log('[PartnerCustomersClient] Uploading Excel file:', {
        fileName: excelFile.name,
        fileSize: excelFile.size,
        fileType: excelFile.type,
        agentProfileId: excelAgentProfileId || 'none',
      });

      const res = await fetch('/api/partner/customers/excel/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      logger.log('[PartnerCustomersClient] Upload response:', {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      // 응답이 JSON인지 확인
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('[PartnerCustomersClient] Non-JSON response:', text);
        throw new Error('서버 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해주세요.');
      }

      const json = await res.json();
      logger.log('[PartnerCustomersClient] Upload result:', json);

      if (!res.ok || !json?.ok) {
        const errorMessage = json?.message || `엑셀 업로드에 실패했습니다. (${res.status})`;
        throw new Error(errorMessage);
      }

      const { results } = json;
      const message = `처리 완료: 성공 ${results.success}건, 실패 ${results.failed}건${results.errors.length > 0 ? `\n\n실패 내역:\n${results.errors.slice(0, 10).join('\n')}${results.errors.length > 10 ? `\n... 외 ${results.errors.length - 10}건` : ''}` : ''
        }`;

      if (results.success > 0) {
        showSuccess(message);
        setShowExcelModal(false);
        setExcelFile(null);
        setExcelAgentProfileId('');
        setCurrentPage(1);
        fetchCustomers(1);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('[PartnerCustomersClient] handleUploadExcel error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.');
      } else {
        showError(
          error instanceof Error ? error.message : '엑셀 업로드 중 오류가 발생했습니다.'
        );
      }
    } finally {
      setUploadingExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 md:px-6">
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl shadow-slate-900/20">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <FiArrowLeft /> 대시보드로 돌아가기
          </Link>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Partner CRM</p>
                <h1 className="mt-2 text-3xl font-black leading-snug md:text-4xl">나의 고객 관리</h1>
              </div>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                상담 기록과 다음 조치 일정을 관리하고, 고객이 어떤 파트너 링크를 통해 유입되었는지 추적하세요.
              </p>
              <div className="flex flex-wrap gap-3 text-xs md:text-sm">
                <StatusBadge
                  status={partner.type === 'BRANCH_MANAGER' ? 'MANAGER' : 'AGENT'}
                  options={[
                    {
                      value: 'MANAGER',
                      label: '대리점장',
                      theme: 'bg-white/20 text-white',
                    },
                    {
                      value: 'AGENT',
                      label: '판매원',
                      theme: 'bg-white/15 text-white',
                    },
                  ]}
                />
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  파트너 ID {partner.mallUserId}
                </span>
                {partner.branchLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    {partner.branchLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl bg-white/95 p-6 shadow-lg">
          {/* 탭 메뉴 */}
          <div className="mb-6 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'customers'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              고객 관리
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inquiries')}
              className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'inquiries'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              전화상담고객
            </button>
          </div>

          {activeTab === 'customers' ? (
            <>
              {/* 판매원별 DB 관리 현황 (대리점장만) - 판매원에게는 표시하지 않음 */}
              {partner.type === 'BRANCH_MANAGER' && (
                <div className="mb-6 rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-3xl md:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                      <FiUsers className="text-slate-600" />
                      판매원별 DB 관리 현황
                    </h2>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/partner/${partnerId}/customers`}
                        className="text-xs text-slate-600 hover:text-slate-900 md:text-sm font-semibold"
                      >
                        전체보기 <FiArrowRight className="inline ml-1" />
                      </Link>
                      <Link
                        href={`/partner/${partnerId}/customers/send-db`}
                        className="text-xs text-slate-600 hover:text-slate-900 md:text-sm font-semibold"
                      >
                        DB 보내기 <FiArrowRight className="inline ml-1" />
                      </Link>
                    </div>
                  </div>
                  {loadingAgentDbStats ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      판매원 DB 현황을 불러오는 중입니다...
                    </div>
                  ) : agentDbStats.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">판매원이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {agentDbStats.map((agent) => {
                        const activityRate = agent.stats.totalCustomers > 0
                          ? (agent.stats.activeCustomers30d / agent.stats.totalCustomers * 100).toFixed(1)
                          : '0';
                        const isActive = parseFloat(activityRate) >= 30; // 30% 이상 활동률

                        return (
                          <Link
                            key={agent.agentId}
                            href={`/partner/${partnerId}/customers?agentId=${agent.agentId}`}
                            className="block rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50 transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-bold text-gray-900 text-base md:text-lg">
                                    {agent.agentName}
                                  </p>
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isActive
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {isActive ? '활발' : '비활발'}
                                  </span>
                                </div>
                                {agent.affiliateCode && (
                                  <p className="text-xs text-gray-500">{agent.affiliateCode}</p>
                                )}
                              </div>
                              <FiArrowRight className="text-gray-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">총 고객 수</p>
                                <p className="text-lg font-bold text-gray-900">{agent.stats.totalCustomers.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">활동률 (30일)</p>
                                <p className="text-lg font-bold text-gray-900">{activityRate}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">최근 활동 (7일)</p>
                                <p className="text-sm font-semibold text-gray-700">{agent.stats.activeCustomers7d.toLocaleString()}명</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">최근 할당</p>
                                <p className="text-sm font-semibold text-gray-700">{agent.stats.recentAssigned.toLocaleString()}명</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  ```
                  <FiSearch className="text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="고객 이름 또는 연락처 검색"
                    className="flex-1 border-none bg-transparent text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    검색
                  </button>
                </form>
                <div className="flex items-center gap-3 text-sm">
                  {/* 판매원 필터는 대리점장만 사용 가능 (판매원은 본인 고객만 관리) */}
                  {partner.type === 'BRANCH_MANAGER' && partner.teamAgents.length > 0 && (
                    <>
                      <label className="text-slate-500">판매원</label>
                      <select
                        value={selectedAgentFilter}
                        onChange={(event) => {
                          setSelectedAgentFilter(event.target.value);
                          const agentId = event.target.value;
                          if (agentId) {
                            router.push(`/partner/${partnerId}/customers?agentId=${agentId}`);
                          } else {
                            router.push(`/partner/${partnerId}/customers`);
                          }
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">전체 판매원</option>
                        <option value="unassigned">미할당 고객</option>
                        {partner.teamAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.displayName ?? '판매원'}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label className="text-slate-500">유입경로</label>
                  <select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ALL">전체</option>
                    <option value="mall">판매몰 구매</option>
                    <option value="trial">3일체험</option>
                    <option value="cruise-guide">크루즈가이드 이용</option>
                    <option value="manual">수동 입력</option>
                    <option value="product-inquiry">상품 문의</option>
                    <option value="b2b">B2B 유입</option>
                  </select>
                  <label className="text-slate-500">상태</label>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ALL">전체</option>
                    {leadStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>


                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(true);
                      resetAddForm();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                  >
                    <FiPlus /> 새 고객 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelModal(true);
                      setExcelFile(null);
                      setExcelAgentProfileId('');
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-slate-50"
                  >
                    <FiUpload /> 엑셀 업로드
                  </button>
                  {/* 고객 그룹관리 빠른버튼 (판매원, 대리점장 모두 사용 가능) */}
                  <Link
                    href={`/partner/${partnerId}/customer-groups`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                  >
                    <FiLayers /> 고객 그룹관리
                  </Link>
                  {/* DB 보내기 버튼은 대리점장만 사용 가능 (판매원은 DB를 보낼 수 없음) */}
                  {partner.type === 'BRANCH_MANAGER' && (
                    <Link
                      href={`/partner/${partnerId}/customers/send-db`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                    >
                      <FiUsers /> DB 보내기
                    </Link>
                  )}
                </div>
              </div>

              {/* ?action=sms 파라미터가 있을 때 안내 메시지 */}
              {searchParams.get('action') === 'sms' && !selectedLeadId && (
                <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <FiMessageSquare className="text-2xl text-emerald-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-900 text-base mb-2">📱 문자 보내기 모드</p>
                      {customers.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm text-emerald-800">
                            등록된 고객이 없습니다. 먼저 고객을 추가한 후 문자를 보낼 수 있습니다.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddModalOpen(true);
                              resetAddForm();
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
                          >
                            <FiPlus /> 새 고객 추가 후 문자 보내기
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-emerald-800">
                          아래 고객 목록에서 &quot;문자 보내기&quot; 버튼을 클릭하거나, 고객을 선택한 후 상세 정보에서 &quot;문자 보내기&quot; 버튼을 클릭하세요.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 일반 고객 목록 */}
              {!loading && customers.length > 0 && (() => {
                // 일반 고객: 전화상담 고객이 아닌 모든 고객 (partner-manual, affiliate-manual 등)
                const regularCustomers = customers.filter(c =>
                  !c.source?.startsWith('mall-') && c.source !== 'product-inquiry' && c.source !== 'phone-consultation'
                );

                return (
                  <>
                    {/* 선택된 고객이 있을 때 삭제 버튼 표시 (대리점장만) */}
                    {partner.type === 'BRANCH_MANAGER' && selectedForDelete.size > 0 && (
                      <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                        <span className="text-sm font-medium text-red-700">
                          {selectedForDelete.size}명 선택됨
                        </span>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedCustomers}
                          disabled={deletingCustomers}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <FiTrash2 />
                          {deletingCustomers ? '삭제 중...' : '선택 삭제'}
                        </button>
                      </div>
                    )}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-100">
                            <tr>
                              {/* 체크박스 열 (대리점장만) */}
                              {partner.type === 'BRANCH_MANAGER' && (
                                <th className="w-12 px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={regularCustomers.length > 0 && regularCustomers.every(c => selectedForDelete.has(c.id))}
                                    onChange={() => toggleAllForDelete(regularCustomers.map(c => c.id))}
                                    className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-blue-500"
                                  />
                                </th>
                              )}
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                고객
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                유입날짜
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                상태
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                상담 일정
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                판매 현황
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                소유
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                작업
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {loading ? (
                              <tr>
                                <td colSpan={partner.type === 'BRANCH_MANAGER' ? 8 : 7} className="px-6 py-10 text-center text-sm text-slate-500">
                                  데이터를 불러오는 중입니다...
                                </td>
                              </tr>
                            ) : regularCustomers.length === 0 && inquiryCustomers.length === 0 ? (
                              <tr>
                                <td colSpan={partner.type === 'BRANCH_MANAGER' ? 8 : 7} className="px-6 py-10 text-center text-sm text-slate-500">
                                  등록된 고객이 없습니다. &ldquo;새 고객 추가&rdquo; 버튼으로 고객을 등록해 주세요.
                                </td>
                              </tr>
                            ) : regularCustomers.length === 0 ? (
                              <tr>
                                <td colSpan={partner.type === 'BRANCH_MANAGER' ? 8 : 7} className="px-6 py-10 text-center text-sm text-slate-500">
                                  일반 고객이 없습니다.
                                </td>
                              </tr>
                            ) : (
                              regularCustomers.map((customer) => {
                                // 구매 완료 자동 표시: 나의 구매몰에서 구매한 경우
                                const hasPurchase = customer.sales?.some((sale) => sale.status === 'CONFIRMED' || sale.status === 'PENDING');
                                const displayStatus = hasPurchase && customer.status !== 'PURCHASED' ? 'PURCHASED' : customer.status;

                                return (
                                  <tr key={customer.id} className="hover:bg-slate-50">
                                    {/* 체크박스 (대리점장만) */}
                                    {partner.type === 'BRANCH_MANAGER' && (
                                      <td className="w-12 px-4 py-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={selectedForDelete.has(customer.id)}
                                          onChange={() => toggleCustomerForDelete(customer.id)}
                                          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-blue-500"
                                        />
                                      </td>
                                    )}
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                      <div className="flex flex-col gap-1">
                                        <span className="font-semibold text-slate-900">
                                          {customer.customerName ?? '이름 미입력'}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {customer.customerPhone ?? '연락처 미입력'}
                                        </span>
                                        <CustomerStatusBadges
                                          testModeStartedAt={customer.testModeStartedAt}
                                          customerStatus={customer.customerStatus}
                                          customerSource={customer.customerSource}
                                          mallUserId={customer.mallUserId}
                                          totalTripCount={customer.totalTripCount || 0}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                      {formatDate(customer.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                      <StatusBadge status={displayStatus} options={leadStatusOptions} />
                                      {hasPurchase && customer.status !== 'PURCHASED' && (
                                        <span className="ml-2 text-xs text-emerald-600 font-semibold">(구매완료)</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                      <div className="flex flex-col gap-1">
                                        <span>최근 상담: {formatDateTime(customer.lastContactedAt)}</span>
                                        <span className="text-xs text-slate-500">
                                          다음 조치: {formatDate(customer.nextActionAt)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                      <div className="flex flex-col gap-1">
                                        <span>총 {customer.saleSummary.totalSalesCount}건</span>
                                        <span className="text-xs text-slate-500">
                                          매출 {formatCurrency(customer.saleSummary.totalSalesAmount)}원
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                      <div className="flex flex-col gap-1">
                                        {/* 고객 분류 표시 */}
                                        {(() => {
                                          // 1. 자신의 개개인 몰에서 구매고객
                                          const hasPurchase = customer.sales?.some((sale) =>
                                            sale.status === 'CONFIRMED' || sale.status === 'PENDING' || sale.status === 'PAID'
                                          );
                                          // 자신의 개개인 몰에서 구매한 고객만 구매고객으로 표시
                                          const customerMallUserId = customer.metadata?.mallUserId || customer.metadata?.affiliateMallUserId;
                                          const isMallPurchase = hasPurchase && (
                                            customer.source === `mall-${partner.mallUserId}` ||
                                            customerMallUserId === partner.mallUserId ||
                                            (customer.source?.startsWith('mall-') && customer.ownership === 'AGENT' && partner.type === 'SALES_AGENT')
                                          );

                                          // 2. 시스템 상담신청 (TRIAL_DASHBOARD)
                                          const isSystemInquiry = !isMallPurchase && customer.source === 'TRIAL_DASHBOARD';

                                          // 3. B2B 유입 (B2B_INFLOW, test-guide)
                                          const isB2BInflow = !isMallPurchase && !isSystemInquiry && (
                                            customer.source === 'B2B_INFLOW' ||
                                            customer.source === 'test-guide'
                                          );

                                          // 4. 파트너 B2B 유입 (B2B_LANDING)
                                          const isPartnerB2B = !isMallPurchase && !isSystemInquiry && !isB2BInflow && (
                                            customer.source === 'B2B_LANDING'
                                          );

                                          // 5. 상담신청고객 (구매고객이 아닌 경우에만)
                                          const isInquiry = !isMallPurchase && !isSystemInquiry && !isB2BInflow && !isPartnerB2B && (
                                            customer.source?.startsWith('mall-') ||
                                            customer.source === 'product-inquiry' ||
                                            customer.source === 'phone-consultation'
                                          );

                                          // 6. 내가입력한 고객 (구매고객, 상담신청고객이 아닌 경우에만)
                                          const isManualInput = !isMallPurchase && !isSystemInquiry && !isB2BInflow && !isPartnerB2B && !isInquiry && customer.ownership === 'AGENT' && (
                                            customer.source === 'affiliate-manual' ||
                                            customer.source === 'partner-manual'
                                          );

                                          // 7. 대리점장이 DB 보내줘서 받은 고객 (구매고객, 상담신청고객, 내가입력한 고객이 아닌 경우에만)
                                          const isDbReceived = !isMallPurchase && !isSystemInquiry && !isB2BInflow && !isPartnerB2B && !isInquiry && !isManualInput &&
                                            customer.ownership === 'MANAGER' && customer.agent?.id;

                                          return (
                                            <>
                                              <span className="font-semibold">
                                                {isMallPurchase
                                                  ? '구매고객'
                                                  : isSystemInquiry
                                                    ? '시스템 상담신청'
                                                    : isB2BInflow
                                                      ? 'B2B 유입'
                                                      : isPartnerB2B
                                                        ? '파트너 B2B 유입'
                                                        : isInquiry
                                                          ? '상담신청고객'
                                                          : isManualInput
                                                            ? '내가입력한 고객'
                                                            : isDbReceived
                                                              ? 'DB 받은 고객'
                                                              : customer.ownership === 'AGENT'
                                                                ? '내 고객'
                                                                : customer.ownership === 'MANAGER'
                                                                  ? '대리점 고객'
                                                                  : '협업 고객'}
                                              </span>
                                              {customer.agent && customer.ownership === 'MANAGER' && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-slate-500">
                                                    담당: {customer.agent.displayName ?? '판매원'}
                                                  </span>
                                                  {partner.type === 'BRANCH_MANAGER' && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRecallDb([customer.id])}
                                                      className="text-xs text-slate-700 hover:text-slate-700 hover:underline"
                                                      title="DB 회수"
                                                    >
                                                      회수
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                              {customer.counterpart?.label && !customer.agent && (
                                                <span className="text-xs text-slate-500">
                                                  담당: {customer.counterpart.label}
                                                </span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm">
                                      <div className="flex items-center gap-2 justify-end">
                                        {searchParams.get('action') === 'sms' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await openDetail(customer.id);
                                              if (!selectedLead && customer.id) {
                                                await loadLeadDetail(customer.id);
                                              }
                                              setShowSmsModal(true);
                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                                          >
                                            문자 보내기
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => openDetail(customer.id)}
                                          className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                          상세 보기
                                        </button>
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
                  </>
                );
              })()}

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>
                  총 {pagination.total.toLocaleString()}명 · {pagination.page} /{' '}
                  {pagination.totalPages} 페이지
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-30"
                  >
                    <FiChevronLeft /> 이전
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= pagination.totalPages || loading}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-30"
                  >
                    다음 <FiChevronRight />
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'system-consultations' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiMonitor className="text-slate-700" />
                  시스템 상담 신청
                </h3>
                <p className="text-sm text-slate-600">
                  시스템 도입에 대해 문의한 고객 목록입니다.
                </p>
              </div>

              {/* 검색 */}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="이름 또는 연락처 검색"
                    value={systemConsultationSearch}
                    onChange={(e) => setSystemConsultationSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <button
                  onClick={loadSystemConsultations}
                  className="p-2 text-slate-500 hover:text-slate-700 transition-colors"
                  title="새로고침"
                >
                  <FiRefreshCw className={systemConsultationLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* 테이블 */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          신청일시
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          고객명
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          연락처
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          상태
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          메모
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {systemConsultationLoading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                            데이터를 불러오는 중입니다...
                          </td>
                        </tr>
                      ) : filteredSystemConsultations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                            상담 신청 내역이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredSystemConsultations.map((consultation) => (
                          <tr key={consultation.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {formatDateTime(consultation.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              {consultation.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {consultation.phone}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${consultation.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {consultation.status === 'COMPLETED' ? '상담완료' : '접수'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {consultation.memo || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'inquiries' ? (
            // 전화상담고객 탭
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiPhone className="text-slate-700" />
                  전화상담고객
                </h3>
                <p className="text-sm text-slate-600">
                  {partner.type === 'BRANCH_MANAGER'
                    ? '대리점장 본인 및 소속 판매원의 전화상담 고객 목록입니다.'
                    : '본인의 전화상담 고객 목록입니다.'}
                </p>
              </div>

              {/* 검색 및 필터 */}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={inquirySearchTerm}
                    onChange={(e) => setInquirySearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setInquiryCurrentPage(1);
                        fetchInquiryCustomers(1);
                      }
                    }}
                    placeholder="고객명, 전화번호 검색"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-slate-500"
                  />
                </div>
                <select
                  value={inquiryStatusFilter}
                  onChange={(e) => {
                    setInquiryStatusFilter(e.target.value);
                    setInquiryCurrentPage(1);
                    fetchInquiryCustomers(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-slate-500"
                >
                  <option value="ALL">전체 상태</option>
                  <option value="NEW">신규</option>
                  <option value="CONTACTED">연락완료</option>
                  <option value="IN_PROGRESS">진행중</option>
                  <option value="PURCHASED">구매완료</option>
                  <option value="REFUNDED">환불</option>
                </select>
                <button
                  onClick={() => {
                    setInquiryCurrentPage(1);
                    fetchInquiryCustomers(1);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  disabled={inquiryLoading}
                >
                  <FiRefreshCw className={inquiryLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {inquiryLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
                  <p className="text-slate-500">전화상담 고객 목록을 불러오는 중...</p>
                </div>
              ) : inquiryCustomers.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
                  <p className="text-slate-500">전화상담 고객이 없습니다.</p>
                </div>
              ) : (
                <ProductInquiryCustomerTable
                  customers={inquiryCustomers.map((customer) => ({
                    id: customer.id,
                    name: customer.customerName,
                    phone: customer.customerPhone,
                    createdAt: customer.createdAt,
                    cruiseName: customer.cruiseName || null,
                    affiliateOwnership: customer.affiliateOwnership || null,
                    userId: customer.userId || null,
                    leadId: (customer as any).leadId || customer.id, // AffiliateLead ID
                  }))}
                  onRefresh={() => fetchInquiryCustomers(inquiryCurrentPage)}
                />
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white/95 p-6 shadow-lg">
          <h2 className="text-lg font-bold text-slate-900">파트너 관리 요약</h2>
          <p className="mt-2 text-sm text-slate-500">
            고객 관리 도구에서 상담 메모와 판매 현황을 확인하고, 파트너몰 링크를 공유해 고객을 추적하세요.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-700">
                  <FiUsers className="text-xl" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">내 파트너 정보</p>
                  <p className="text-xs text-slate-500">파트너몰 링크와 담당자를 확인하세요.</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-semibold text-slate-500">파트너몰</dt>
                  <dd className="col-span-2 break-all text-slate-700">
                    {/* 판매원인 경우 대리점장의 파트너몰 링크 표시, 대리점장인 경우 본인의 파트너몰 링크 표시 */}
                    {partner.type === 'SALES_AGENT' && partner.manager?.mallUserId
                      ? `/${partner.manager.mallUserId}/shop`
                      : partner.shareLinks.mall}
                  </dd>
                </div>
                {partner.manager ? (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="font-semibold text-slate-500">담당 대리점장</dt>
                    <dd className="col-span-2">{partner.manager.label ?? '정보 없음'}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {/* 판매원 목록은 대리점장만 볼 수 있음 (판매원에게는 불필요) */}
            {partner.type === 'BRANCH_MANAGER' && partner.teamAgents.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-700">
                    <FiUsers className="text-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">내 판매원 목록</p>
                    <p className="text-xs text-slate-500">판매원들의 판매몰 링크를 확인하세요.</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {partner.teamAgents.map((agent) => (
                    <div key={agent.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {agent.displayName ?? '판매원'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {agent.affiliateCode ?? '코드 없음'}
                        </span>
                      </div>
                      {agent.mallUserId ? (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/products/${agent.mallUserId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-700 hover:text-blue-800 hover:underline break-all flex-1"
                          >
                            /products/{agent.mallUserId}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              const fullUrl = typeof window !== 'undefined'
                                ? `${window.location.origin}/products/${agent.mallUserId}`
                                : `/products/${agent.mallUserId}`;
                              copyToClipboard(fullUrl);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <FiCopy className="text-xs" />
                            복사
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">판매몰 링크 미발급</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">고객 관리 팁</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="rounded-xl bg-slate-100 px-4 py-3">
                  상담 기록에 메모를 남기면 다음 조치 일정을 자동으로 관리할 수 있습니다.
                </li>
                <li className="rounded-xl bg-slate-100 px-4 py-3">
                  파트너몰 링크를 공유하면 어떤 파트너가 판매를 이끌었는지 추적됩니다.
                </li>
                <li className="rounded-xl bg-slate-100 px-4 py-3">
                  확정된 판매는 정산 대시보드와 연동되어 수당 계산에 반영됩니다.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">새 고객 추가</h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddForm();
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">이름</label>
                <input
                  value={addForm.customerName}
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, customerName: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="고객 이름"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">연락처</label>
                <input
                  value={addForm.customerPhone}
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, customerPhone: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="010-0000-0000"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">상태</label>
                  <select
                    value={addForm.status}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {statusSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">유입날짜</label>
                  <input
                    type="date"
                    value={addForm.createdAt || ''}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, createdAt: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                  다음 조치 예정일
                  {notificationPermission === 'granted' && (
                    <FiBell className="text-blue-500" title="알람이 설정됩니다" />
                  )}
                  {notificationPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if ('Notification' in window) {
                          const permission = await Notification.requestPermission();
                          setNotificationPermission(permission);
                          if (permission === 'granted') {
                            showSuccess('알림 권한이 허용되었습니다.');
                          } else {
                            showError('알림 권한이 필요합니다.');
                          }
                        }
                      }}
                      className="text-blue-500 hover:text-slate-700"
                      title="알림 권한 요청"
                    >
                      <FiBell />
                    </button>
                  )}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={addForm.nextActionAt ? addForm.nextActionAt.split('T')[0] : ''}
                    onChange={(event) => {
                      const dateValue = event.target.value;
                      const timeValue = addForm.nextActionAt
                        ? new Date(addForm.nextActionAt).toTimeString().slice(0, 5)
                        : '09:00';
                      setAddForm((prev) => ({
                        ...prev,
                        nextActionAt: dateValue ? `${dateValue}T${timeValue}` : '',
                      }));
                    }}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={addForm.nextActionAt
                      ? new Date(addForm.nextActionAt).toTimeString().slice(0, 5)
                      : ''}
                    onChange={(event) => {
                      const timeValue = event.target.value;
                      const dateValue = addForm.nextActionAt
                        ? addForm.nextActionAt.split('T')[0]
                        : new Date().toISOString().split('T')[0];
                      setAddForm((prev) => ({
                        ...prev,
                        nextActionAt: dateValue && timeValue ? `${dateValue}T${timeValue}` : prev.nextActionAt,
                      }));
                    }}
                    className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  다음 조치 예정일을 설정하면 알람이 자동으로 설정됩니다.
                </p>
              </div>
              {/* 담당 판매원 배정은 대리점장만 가능 (판매원은 본인만 배정 가능) */}
              {partner.type === 'BRANCH_MANAGER' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-500">담당 판매원 배정 (선택)</label>
                  <select
                    value={addForm.agentProfileId}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, agentProfileId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">대리점장이 직접 관리</option>
                    {partner.teamAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.displayName ?? '판매원'} ({agent.affiliateCode ?? '코드 없음'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="text-xs font-semibold text-slate-500">메모</label>
                <textarea
                  value={addForm.notes}
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="상담 메모를 입력하세요."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddForm();
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateCustomer}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:bg-slate-300"
              >
                {creating ? '저장 중...' : '고객 추가'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 엑셀 업로드 모달 */}
      {showExcelModal ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">엑셀 파일로 고객 일괄 등록</h3>
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelFile(null);
                  setExcelAgentProfileId('');
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-2">📋 엑셀 파일 형식</p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>첫 번째 행은 헤더(컬럼명)입니다</li>
                  <li>필수 컬럼: <strong>이름</strong>, <strong>연락처</strong></li>
                  <li>컬럼명은 &quot;이름&quot;, &quot;연락처&quot; 또는 &quot;name&quot;, &quot;phone&quot; 등으로 작성 가능합니다</li>
                  <li>샘플 파일을 다운로드하여 형식을 확인하세요</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownloadExcelSample}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FiFileText /> 샘플 다운로드
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">엑셀 파일 선택</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                {excelFile && (
                  <p className="mt-2 text-xs text-slate-600">선택된 파일: {excelFile.name}</p>
                )}
              </div>

              {partner.type === 'BRANCH_MANAGER' && (
                <div>
                  <label className="text-xs font-semibold text-slate-500">담당 판매원 배정 (선택)</label>
                  <select
                    value={excelAgentProfileId}
                    onChange={(e) => setExcelAgentProfileId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">대리점장이 직접 관리</option>
                    {partner.teamAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.displayName ?? '판매원'} ({agent.affiliateCode ?? '코드 없음'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelFile(null);
                  setExcelAgentProfileId('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!excelFile || uploadingExcel}
                onClick={handleUploadExcel}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:bg-slate-300"
              >
                {uploadingExcel ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-b-transparent rounded-full animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <FiUpload /> 업로드
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLeadId ? (
        <div className="fixed inset-0 z-[998] flex justify-end bg-slate-900/30 backdrop-blur">
          <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            {/* 고정 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10">
              <div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  <FiArrowLeft /> 목록으로
                </button>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {selectedLead?.customerName ?? '이름 미입력'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {selectedLead ? (
                  <StatusBadge status={selectedLead.status} options={leadStatusOptions} />
                ) : null}
                {/* 판매원은 고객 삭제 기능 제거: 대리점장만 삭제 가능 */}
                {selectedLead &&
                  partner.type === 'BRANCH_MANAGER' &&
                  selectedLead.ownership === 'MANAGER' &&
                  !isContractTerminated && (
                    <button
                      type="button"
                      onClick={handleDeleteLead}
                      disabled={deletingLead}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <FiTrash2 />
                      {deletingLead ? '삭제 중...' : '고객 삭제'}
                    </button>
                  )}
                {/* DB 전달 버튼 (대리점장만 표시) */}
                {selectedLeadId && partner.type === 'BRANCH_MANAGER' && partner.teamAgents && partner.teamAgents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTransferTargetLeadId(selectedLeadId);
                      setShowTransferModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                  >
                    <FiSend />
                    DB 전달
                  </button>
                )}
              </div>
            </div>

            {/* 스크롤 가능한 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
              {detailLoading || !selectedLead ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  데이터를 불러오는 중입니다...
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {/* 전화상담 신청 상품 정보 */}
                  {selectedLead.source?.startsWith('mall-') || selectedLead.source === 'product-inquiry' ? (
                    (() => {
                      const productCode = selectedLead.metadata?.productCode || selectedLead.metadata?.product_code;
                      const productName = selectedLead.metadata?.productName || selectedLead.metadata?.product_name;
                      const partnerId = selectedLead.metadata?.mallUserId || selectedLead.metadata?.affiliateMallUserId;

                      if (productCode) {
                        return (
                          <div className="rounded-3xl border-2 border-slate-200 bg-slate-50/70 p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <FiPhone className="text-slate-700" />
                              <h4 className="font-bold text-slate-900">전화상담 신청 상품</h4>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">상품명</p>
                                <p className="text-sm font-semibold text-slate-900">
                                  {productName || productCode}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">상품 코드</p>
                                <p className="text-sm text-slate-700 font-mono">
                                  {productCode}
                                </p>
                              </div>
                              <div className="pt-2">
                                <Link
                                  href={partnerId
                                    ? `/products/${productCode}?partner=${encodeURIComponent(partnerId)}`
                                    : `/products/${productCode}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                                >
                                  상품 상세 보기 →
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()
                  ) : null}

                  {/* 기본 정보 및 설정 섹션 */}
                  <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 mb-6 shadow-sm">
                    <h4 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-200">기본 정보</h4>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">연락처</label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg flex-1">{selectedLead.customerPhone ?? '연락처 미입력'}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">다음 조치</label>
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                            <FiCalendar className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-900">{formatDate(selectedLead.nextActionAt)}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">메모</label>
                          <textarea
                            defaultValue={selectedLead.notes ?? ''}
                            onBlur={(event) =>
                              handleUpdateLead({ notes: event.target.value })
                            }
                            rows={4}
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                            placeholder="고객 메모를 입력하세요."
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">상태 변경</label>
                          <select
                            value={selectedLead.status}
                            disabled={updatingLead}
                            onChange={(event) =>
                              handleUpdateLead({ status: event.target.value })
                            }
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white"
                          >
                            {leadStatusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {partner.type === 'BRANCH_MANAGER' ? (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">담당 판매원</label>
                            <select
                              value={selectedLead.agent?.id ?? ''}
                              disabled={updatingLead}
                              onChange={(event) =>
                                handleUpdateLead({
                                  agentProfileId: event.target.value || null,
                                })
                              }
                              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white"
                            >
                              <option value="">대리점장이 직접 관리</option>
                              {partner.teamAgents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.displayName ?? '판매원'} (
                                  {agent.affiliateCode ?? '코드 없음'})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">담당 대리점장</label>
                            <div className="bg-slate-50 px-3 py-2.5 rounded-lg">
                              <p className="text-sm font-medium text-slate-900">
                                {selectedLead.manager?.displayName ?? '정보 없음'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 그룹 관리 섹션 */}
                    <div className="mt-6 pt-6 border-t-2 border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-slate-700">고객 그룹</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedLead.groupId || ''}
                          onChange={async (e) => {
                            const newGroupId = e.target.value === '' ? null : parseInt(e.target.value);
                            try {
                              const res = await fetch(`/api/partner/customers/${selectedLeadId}/move-group`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ groupId: newGroupId }),
                              });
                              const json = await res.json();
                              if (!res.ok || !json?.ok) {
                                throw new Error(json?.message || '그룹 이동에 실패했습니다.');
                              }
                              showSuccess('그룹이 변경되었습니다.');
                              await loadLeadDetail(selectedLeadId);
                              loadCustomerGroups();
                            } catch (error) {
                              showError(error instanceof Error ? error.message : '그룹 이동에 실패했습니다.');
                            }
                          }}
                          className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                        >
                          <option value="">그룹 없음</option>
                          {customerGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name} ({group.leadCount}명)
                            </option>
                          ))}
                        </select>
                        {/* 판매원/대리점장 모두 그룹 생성 가능 */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup(null);
                            setGroupForm({ name: '', description: '', productCode: '', color: '#3B82F6' });
                            setShowGroupModal(true);
                          }}
                          className="rounded-xl border-2 border-slate-500 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
                        >
                          <FiPlus /> 새 그룹
                        </button>
                      </div>
                    </div>

                    {/* 여권 관리 섹션 */}
                    <div className="mt-6 pt-6 border-t-2 border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-xs font-bold text-slate-700">여권 상태</label>
                        {selectedLead.passportCompletedAt ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                              <FiCheckCircle /> 여권 완료
                            </span>
                            {selectedLead.passportRequestedAt && (
                              <button
                                type="button"
                                onClick={() => setShowPassportModal(true)}
                                disabled={requestingPassport}
                                className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-500 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
                              >
                                <FiFileText /> 여권 재요청
                              </button>
                            )}
                          </div>
                        ) : selectedLead.passportRequestedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-bold text-yellow-700 border border-yellow-200">
                            <FiClock /> 요청됨 (본사 확인 대기중)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowPassportModal(true)}
                            disabled={requestingPassport}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
                          >
                            <FiFileText />
                            {requestingPassport ? '전송 중...' : '여권 보내기'}
                          </button>
                        )}
                      </div>

                      {/* 빠른 메시지 섹션 */}
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          빠른 메시지
                        </label>
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedLead && selectedLeadId) {
                                await loadLeadDetail(selectedLeadId);
                              }
                              setShowSmsModal(true);
                            }}
                            disabled={!selectedLead?.customerPhone}
                            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <FiMessageSquare size={18} />
                            문자 보내기
                          </button>
                          {!selectedLead?.customerPhone && (
                            <p className="text-xs text-slate-500">* 전화번호가 없어 문자를 보낼 수 없습니다.</p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmailModal(true);
                            }}
                            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors"
                          >
                            <FiSend size={18} />
                            이메일 보내기
                          </button>
                          <p className="text-xs text-slate-500">* 이메일 주소를 직접 입력하여 발송합니다.</p>
                        </div>
                      </div>
                    </div>

                    {/* 최종확인 섹션 */}
                    <div className="mt-6 pt-6 border-t-2 border-slate-200">
                      <FinalConfirmSection
                        leadId={selectedLeadId}
                        customerName={selectedLead.customerName || '고객'}
                        onStatusChange={() => loadLeadDetail(selectedLeadId)}
                      />
                    </div>
                  </div>

                  {/* 상담 기록 섹션 */}
                  <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 mb-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
                      <h4 className="text-base font-bold text-slate-900">상담 기록</h4>
                      <button
                        type="button"
                        onClick={() => loadLeadDetail(selectedLeadId)}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <FiRefreshCw /> 새로고침
                      </button>
                    </div>
                    <div className="space-y-6">
                      {/* 상담 기록 입력 폼 - 스크롤 가능하도록 개선 */}
                      <div className="space-y-4 min-w-0 flex flex-col bg-slate-50 rounded-xl p-5 border-2 border-slate-200">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">상담 내용</label>
                          <textarea
                            value={interactionForm.note}
                            onChange={(event) =>
                              setInteractionForm((prev) => ({ ...prev, note: event.target.value }))
                            }
                            rows={4}
                            placeholder="상담 내용을 입력하세요."
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">상담 일시</label>
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={interactionForm.occurredAt ? interactionForm.occurredAt.split('T')[0] : ''}
                                onChange={(event) => {
                                  const dateValue = event.target.value;
                                  const timeValue = interactionForm.occurredAt
                                    ? new Date(interactionForm.occurredAt).toTimeString().slice(0, 5)
                                    : new Date().toTimeString().slice(0, 5);
                                  setInteractionForm((prev) => ({
                                    ...prev,
                                    occurredAt: dateValue ? `${dateValue}T${timeValue}` : '',
                                  }));
                                }}
                                className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                              />
                              <input
                                type="time"
                                value={interactionForm.occurredAt
                                  ? new Date(interactionForm.occurredAt).toTimeString().slice(0, 5)
                                  : ''}
                                onChange={(event) => {
                                  const timeValue = event.target.value;
                                  const dateValue = interactionForm.occurredAt
                                    ? interactionForm.occurredAt.split('T')[0]
                                    : new Date().toISOString().split('T')[0];
                                  setInteractionForm((prev) => ({
                                    ...prev,
                                    occurredAt: dateValue && timeValue ? `${dateValue}T${timeValue}` : prev.occurredAt,
                                  }));
                                }}
                                className="w-32 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                              다음 조치
                              {notificationPermission === 'granted' && (
                                <FiBell className="text-blue-500" title="알람이 설정됩니다" />
                              )}
                              {notificationPermission !== 'granted' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if ('Notification' in window) {
                                      const permission = await Notification.requestPermission();
                                      setNotificationPermission(permission);
                                      if (permission === 'granted') {
                                        showSuccess('알림 권한이 허용되었습니다.');
                                      } else {
                                        showError('알림 권한이 필요합니다.');
                                      }
                                    }
                                  }}
                                  className="text-blue-500 hover:text-slate-700"
                                  title="알림 권한 요청"
                                >
                                  <FiBell />
                                </button>
                              )}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={interactionForm.nextActionAt ? interactionForm.nextActionAt.split('T')[0] : ''}
                                onChange={(event) => {
                                  const dateValue = event.target.value;
                                  const timeValue = interactionForm.nextActionAt
                                    ? new Date(interactionForm.nextActionAt).toTimeString().slice(0, 5)
                                    : '09:00';
                                  setInteractionForm((prev) => ({
                                    ...prev,
                                    nextActionAt: dateValue ? `${dateValue}T${timeValue}` : '',
                                  }));
                                }}
                                className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                              />
                              <input
                                type="time"
                                value={interactionForm.nextActionAt
                                  ? new Date(interactionForm.nextActionAt).toTimeString().slice(0, 5)
                                  : ''}
                                onChange={(event) => {
                                  const timeValue = event.target.value;
                                  const dateValue = interactionForm.nextActionAt
                                    ? interactionForm.nextActionAt.split('T')[0]
                                    : new Date().toISOString().split('T')[0];
                                  setInteractionForm((prev) => ({
                                    ...prev,
                                    nextActionAt: dateValue && timeValue ? `${dateValue}T${timeValue}` : prev.nextActionAt,
                                  }));
                                }}
                                className="w-32 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">상담 후 상태</label>
                          <select
                            value={interactionForm.status}
                            onChange={(event) =>
                              setInteractionForm((prev) => ({
                                ...prev,
                                status: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                          >
                            {statusSelectOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">기록/녹음 파일 업로드</label>
                          <input
                            type="file"
                            multiple
                            accept="audio/*,video/*,image/*"
                            onChange={handleFileChange}
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-500 bg-white"
                          />
                          {interactionForm.files.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {interactionForm.files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs border border-slate-200">
                                  <span className="flex items-center gap-2">
                                    <FiMic className="text-blue-500" />
                                    <span className="font-medium">{file.name}</span>
                                    <span className="text-slate-500">({(file.size / 1024).toFixed(1)}KB)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="text-red-600 hover:text-red-800 font-bold"
                                  >
                                    <FiX />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleAddInteraction}
                          disabled={interactionSaving}
                          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
                        >
                          {interactionSaving ? '저장 중...' : '상담 기록 추가'}
                        </button>
                      </div>
                      {/* Empty state helper */}
                      {selectedLead.interactions?.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                          <div className="font-semibold text-slate-800">등록된 상담 기록이 없습니다</div>
                          <p className="mt-1 text-xs text-slate-500">
                            위의 입력 폼에서 상담 기록을 저장하면 아래에서 타임라인 형식으로 확인할 수 있습니다.
                          </p>
                        </div>
                      )}

                      {/* 채팅 형식 상담 기록 */}
                      <div className="space-y-4">
                        {selectedLead.interactions?.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                            상담 기록이 추가되면 이 영역에서 진행 상황을 확인할 수 있습니다.
                          </div>
                        ) : (
                          (() => {
                            const groupedInteractions = groupInteractionsByDate(selectedLead.interactions || []);
                            return groupedInteractions.map((group) => (
                              <div key={group.date} className="space-y-3">
                                <div className="flex items-center justify-center my-4">
                                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
                                    <FiCalendar className="text-xs text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-600">
                                      {formatChatDate(group.date)}
                                    </span>
                                  </div>
                                </div>

                                {group.interactions.map((interaction) => {
                                  const isMyRecord =
                                    selectedLead &&
                                    ((selectedLead.ownership === 'AGENT' && interaction.profileId === selectedLead.agent?.id) ||
                                      (selectedLead.ownership === 'MANAGER' && interaction.profileId === selectedLead.manager?.id));

                                  return (
                                    <div key={interaction.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                      <div className="flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                          <FiUser className="text-slate-400" />
                                          <span>{interaction.createdBy?.name || '알 수 없음'}</span>
                                          <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full ${selectedLead.ownership === 'AGENT' && interaction.profileId === selectedLead.agent?.id
                                              ? 'bg-slate-100 text-slate-700'
                                              : selectedLead.ownership === 'MANAGER' && interaction.profileId === selectedLead.manager?.id
                                                ? 'bg-slate-100 text-slate-700'
                                                : 'bg-gray-100 text-gray-600'
                                              }`}
                                          >
                                            {selectedLead.ownership === 'AGENT' && interaction.profileId === selectedLead.agent?.id
                                              ? '판매원'
                                              : selectedLead.ownership === 'MANAGER' && interaction.profileId === selectedLead.manager?.id
                                                ? '대리점장'
                                                : '기타'}
                                          </span>
                                        </div>
                                        <span className="text-[10px]">{formatTime(interaction.occurredAt)}</span>
                                      </div>

                                      <div
                                        className={`rounded-xl px-4 py-3 text-sm whitespace-pre-line leading-relaxed ${isMyRecord
                                          ? selectedLead.ownership === 'AGENT'
                                            ? 'bg-slate-50 border border-slate-200 text-slate-900'
                                            : 'bg-slate-50 border border-slate-200 text-slate-900'
                                          : 'bg-slate-50 border border-slate-200 text-slate-700'
                                          }`}
                                      >
                                        <div className="text-xs font-semibold mb-2 opacity-70">{interaction.interactionType}</div>
                                        <p>{interaction.note ?? '메모 없음'}</p>

                                        {/* 첨부 파일 목록 - 간소화 버전 */}
                                        {interaction.media && interaction.media.length > 0 && (
                                          <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="flex flex-wrap gap-2">
                                              {interaction.media.map((file) => (
                                                <a
                                                  key={file.id}
                                                  href={file.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                                  title={file.fileName || '파일 열기'}
                                                >
                                                  {file.mimeType?.startsWith('audio/') ? (
                                                    <FiMic className="text-blue-500 flex-shrink-0" />
                                                  ) : (
                                                    <FiFile className="text-slate-400 flex-shrink-0" />
                                                  )}
                                                  <span className="truncate max-w-[120px] font-medium">
                                                    {file.fileName || '파일'}
                                                  </span>
                                                  <FiDownload className="text-blue-500 flex-shrink-0" />
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* 문자 보내기 모달 */}
      {showSmsModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSmsModal(false);
              setSmsMessage('');
              setCustomPhoneNumber('');
              setSmsRecipientMode('customer');
            }
          }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">문자 보내기</h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSmsModal(false);
                  setSmsMessage('');
                  setCustomPhoneNumber('');
                  setSmsRecipientMode('customer');
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* 내용 */}
            <div className="px-6 py-6 space-y-6">
              {/* 수신자 선택 모드 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  수신자 선택
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSmsRecipientMode('customer');
                      setCustomPhoneNumber('');
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${smsRecipientMode === 'customer'
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiUser className="text-lg" />
                      <span className="font-semibold">고객 선택</span>
                    </div>
                    <p className="text-xs text-gray-600">고객 목록에서 선택</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSmsRecipientMode('custom');
                      if (selectedLeadId) {
                        // 고객 선택 모드에서 직접 번호 모드로 전환 시 고객 번호를 기본값으로 설정
                        if (selectedLead?.customerPhone) {
                          setCustomPhoneNumber(selectedLead.customerPhone.replace(/[^0-9]/g, ''));
                        }
                      }
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${smsRecipientMode === 'custom'
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiPhone className="text-lg" />
                      <span className="font-semibold">직접 번호 입력</span>
                    </div>
                    <p className="text-xs text-gray-600">번호를 직접 입력</p>
                  </button>
                </div>
              </div>

              {/* 고객 정보 또는 직접 번호 입력 */}
              {smsRecipientMode === 'customer' ? (
                selectedLead ? (
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-900 mb-2">📋 보낼 고객 정보</p>
                    <div className="space-y-1 text-sm text-blue-800">
                      <p><span className="font-semibold">고객명:</span> {selectedLead.customerName || '이름 없음'}</p>
                      <p><span className="font-semibold">전화번호:</span> {selectedLead.customerPhone || '전화번호 없음'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-yellow-50 p-4 border border-yellow-200">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ 고객을 선택해주세요</p>
                    <p className="text-xs text-yellow-800">고객 목록에서 고객을 선택한 후 문자를 보내주세요.</p>
                  </div>
                )
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    📱 전화번호 입력 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customPhoneNumber}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '');
                      setCustomPhoneNumber(cleaned);
                    }}
                    placeholder="01012345678 (하이픈 없이 숫자만 입력)"
                    className="w-full rounded-lg border border-purple-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  <p className="mt-1 text-xs text-slate-700">하이픈 없이 숫자만 입력해주세요 (예: 01012345678)</p>
                </div>
              )}

              {/* 발송 방식 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  발송 방식 선택
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSmsMethod('aligo')}
                    className={`p-4 rounded-xl border-2 transition-all ${smsMethod === 'aligo'
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiSettings className="text-lg" />
                      <span className="font-semibold">알리고 API</span>
                    </div>
                    <p className="text-xs text-gray-600">API 키 입력 후 자동 발송</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsMethod('link')}
                    className={`p-4 rounded-xl border-2 transition-all ${smsMethod === 'link'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiLink className="text-lg" />
                      <span className="font-semibold">링크 생성</span>
                    </div>
                    <p className="text-xs text-gray-600">링크 복사 후 직접 발송</p>
                  </button>
                </div>
              </div>

              {/* 알리고 API 설정 */}
              {smsMethod === 'aligo' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">⚙️ 알리고 API 설정</h4>
                    <button
                      type="button"
                      onClick={() => setShowAligoGuide(!showAligoGuide)}
                      className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-700"
                    >
                      <FiHelpCircle />
                      {showAligoGuide ? '가이드 숨기기' : '연결 가이드 보기'}
                    </button>
                  </div>

                  {/* 알리고 연결 가이드 */}
                  {showAligoGuide && (
                    <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <FiInfo className="text-slate-700 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 space-y-3 text-sm text-slate-900">
                          <p className="font-bold text-base">📱 알리고 문자 서비스 연결 가이드</p>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">1️⃣ 알리고 회원가입</p>
                              <p className="text-xs text-blue-800">• 알리고 홈페이지 (https://www.aligo.in) 접속</p>
                              <p className="text-xs text-blue-800">• 회원가입 후 로그인</p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">2️⃣ 발신번호 등록</p>
                              <p className="text-xs text-blue-800">• 알리고 관리자 페이지 → 발신번호 관리</p>
                              <p className="text-xs text-blue-800">• 본인 명의 전화번호 등록 (인증 필요)</p>
                              <p className="text-xs text-blue-800">• 등록 완료 후 발신번호 확인</p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">3️⃣ API 키 발급</p>
                              <p className="text-xs text-blue-800">• 알리고 관리자 페이지 → API 관리</p>
                              <p className="text-xs text-blue-800">• &quot;API 키 발급&quot; 클릭</p>
                              <p className="text-xs text-blue-800">• 발급된 API 키 복사 (아래 입력란에 붙여넣기)</p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">4️⃣ 정보 입력</p>
                              <p className="text-xs text-blue-800">• 아래 입력란에 알리고에서 받은 정보 입력</p>
                              <p className="text-xs text-blue-800">• &quot;설정 저장하기&quot; 클릭 (다음에도 사용 가능)</p>
                            </div>
                          </div>
                          <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                            <p className="font-semibold text-xs mb-1">💡 알리고에서 받아야 할 정보:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
                              <li>API 키 (알리고 관리자 페이지 → API 관리)</li>
                              <li>사용자 ID (알리고 로그인 아이디)</li>
                              <li>발신번호 (알리고에서 등록한 전화번호, 하이픈 없이 숫자만)</li>
                            </ul>
                          </div>
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="font-semibold text-xs mb-1 text-amber-800">📊 발송 건수 제한 (사업자 등록 기준)</p>
                            <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
                              <li>■ 동일한 내용의 문자 (POST /send/) : 1회 기준 최대 <span className="font-bold">1,000건</span></li>
                              <li>■ 개별 내용의 문자 (POST /send_mass/) : 1회 기준 최대 <span className="font-bold">500건</span></li>
                              <li>■ 알림톡 & 친구톡 : 1회 기준 최대 <span className="font-bold">500건</span></li>
                            </ul>
                            <p className="mt-2 text-xs text-amber-600">예) 동일한 내용의 문자를 10,000건 전송하는 경우 1,000건씩 10회 호출해 주셔야 합니다.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        1️⃣ API 키 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={aligoConfig.apiKey}
                        onChange={(e) => setAligoConfig({ ...aligoConfig, apiKey: e.target.value })}
                        placeholder="알리고에서 받은 API 키를 입력하세요"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">알리고 관리자 페이지 → API 관리에서 확인</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        2️⃣ 사용자 ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={aligoConfig.userId}
                        onChange={(e) => setAligoConfig({ ...aligoConfig, userId: e.target.value })}
                        placeholder="알리고 로그인 아이디를 입력하세요"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">알리고에 로그인할 때 사용하는 아이디</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        3️⃣ 발신번호 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={aligoConfig.senderPhone}
                        onChange={(e) => setAligoConfig({ ...aligoConfig, senderPhone: e.target.value.replace(/[^0-9]/g, '') })}
                        placeholder="01012345678 (하이픈 없이 숫자만 입력)"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">알리고에서 등록한 발신번호 (하이픈 없이 숫자만)</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveAligoConfig()}
                    className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    💾 설정 저장하기 (다음에도 사용)
                  </button>
                </div>
              )}

              {/* 링크 생성 방식 안내 */}
              {smsMethod === 'link' && (
                <div className="rounded-xl bg-emerald-50 border-2 border-emerald-200 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <FiInfo className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2 text-sm text-emerald-900">
                      <p className="font-bold">🔗 링크 생성 방식</p>
                      <p className="text-emerald-800">
                        여권 업로드 링크가 자동으로 생성됩니다. 아래 문자 내용에 링크가 포함되어 문자 앱으로 열립니다.
                      </p>
                      <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200">
                        <p className="font-semibold text-xs mb-1">📝 사용 방법:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-emerald-800">
                          <li>아래 문자 내용을 확인하세요 (링크가 자동 포함됩니다)</li>
                          <li>&quot;문자 보내기&quot; 버튼을 클릭하면 문자 앱이 열립니다</li>
                          <li>문자 앱에서 고객에게 전송하세요</li>
                          <li>고객이 링크를 클릭하면 본사로 여권 정보가 전송됩니다</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 치환 가이드 및 상품 선택 */}
              <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 text-lg">📝</span>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm mb-2">치환 가이드</p>
                    <p className="text-xs text-amber-800 mb-3">아래 치환 태그를 문자 내용에 넣으면 발송 시 자동으로 치환됩니다.</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setSmsMessage(smsMessage + '{이름}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{이름}'}</span>
                        <span className="text-amber-500">→ {selectedLead?.customerName || '고객명'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSmsMessage(smsMessage + '{연락처}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{연락처}'}</span>
                        <span className="text-amber-500">→ {selectedLead?.customerPhone || '연락처'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSmsMessage(smsMessage + '{상품명}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{상품명}'}</span>
                        <span className="text-amber-500">→ {selectedProductId ? activeProducts.find(p => p.id === selectedProductId)?.packageName || '상품명' : '상품 선택 필요'}</span>
                      </button>
                    </div>
                    {/* 상품 선택 드롭다운 */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-amber-800 whitespace-nowrap">상품 선택:</label>
                      <select
                        value={selectedProductId || ''}
                        onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        disabled={loadingProducts}
                      >
                        <option value="">{'상품을 선택하세요 ({상품명} 치환용)'}</option>
                        {activeProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.packageName} ({product.cruiseLine} - {product.shipName})
                          </option>
                        ))}
                      </select>
                      {loadingProducts && <span className="text-xs text-amber-600">로딩중...</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* 문자 내용 입력 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    문자 내용 {smsMethod === 'link' && <span className="text-xs text-gray-500">(링크가 자동으로 포함됩니다)</span>}
                  </label>
                  <div className="relative">
                    <SymbolPicker
                      onSymbolSelect={(symbol) => {
                        const textarea = document.querySelector('textarea[data-sms-message]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = smsMessage;
                          const newText = text.substring(0, start) + symbol + text.substring(end);
                          setSmsMessage(newText);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + symbol.length, start + symbol.length);
                          }, 0);
                        } else {
                          setSmsMessage(smsMessage + symbol);
                        }
                      }}
                    />
                  </div>
                </div>
                <textarea
                  data-sms-message
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder={smsMethod === 'link'
                    ? `안녕하세요 {이름}님. 여권 정보를 업로드해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n[링크가 자동으로 포함됩니다]`
                    : '안녕하세요 {이름}님. {상품명} 상품에 관심 가져주셔서 감사합니다.'}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {/* 미리보기 */}
                {smsMessage && (smsMessage.includes('{이름}') || smsMessage.includes('{연락처}') || smsMessage.includes('{상품명}')) && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">📱 발송될 메시지 미리보기:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{applySubstitution(smsMessage)}</p>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {smsMethod === 'link'
                    ? '링크는 자동으로 문자 내용 끝에 추가됩니다.'
                    : '치환 태그({이름}, {연락처}, {상품명})를 사용하면 발송 시 자동 치환됩니다.'}
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSmsModal(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={sendingSms}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSendSms}
                disabled={
                  sendingSms ||
                  (smsMethod === 'aligo' && (!aligoConfig.apiKey || !aligoConfig.userId || !aligoConfig.senderPhone)) ||
                  (smsRecipientMode === 'customer' && (!selectedLead?.customerPhone || !selectedLeadId)) ||
                  (smsRecipientMode === 'custom' && (!customPhoneNumber || customPhoneNumber.replace(/[^0-9]/g, '').length < 10)) ||
                  !smsMessage.trim()
                }
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {sendingSms ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <FiMessageSquare />
                    {smsMethod === 'link' ? '링크 복사' : '문자 보내기'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 여권 보내기 모달 */}
      {showPassportModal && selectedLeadId && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPassportModal(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">여권 보내기</h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPassportModal(false);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* 내용 */}
            <div className="px-6 py-6 space-y-6">
              {/* 고객 정보 */}
              {selectedLead ? (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm font-semibold text-slate-900 mb-1">고객 정보</p>
                  <p className="text-sm text-blue-800">{selectedLead.customerName || '이름 없음'}</p>
                  <p className="text-sm text-blue-800">{selectedLead.customerPhone || '전화번호 없음'}</p>
                </div>
              ) : (
                <div className="rounded-xl bg-yellow-50 p-4 border border-yellow-200">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">⏳ 고객 정보 로딩 중...</p>
                </div>
              )}

              {/* 발송 방법 선택 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-3 block">발송 방법</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPassportMethod('link')}
                    className={`p-4 rounded-xl border-2 transition-all ${passportMethod === 'link'
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiLink className="text-xl" />
                      <span className="font-semibold">링크 복사</span>
                    </div>
                    <p className="text-xs text-gray-600">여권 업로드 링크를 복사하여 문자로 보내기</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassportMethod('aligo')}
                    className={`p-4 rounded-xl border-2 transition-all ${passportMethod === 'aligo'
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FiMessageSquare className="text-xl" />
                      <span className="font-semibold">알리고 API</span>
                    </div>
                    <p className="text-xs text-gray-600">알리고 API로 직접 발송</p>
                  </button>
                </div>
              </div>

              {/* 알리고 API 설정 */}
              {passportMethod === 'aligo' && (
                <div className="space-y-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-900">⚙️ 알리고 API 설정</h4>
                    {hasSyncedAligoConfig && (
                      <span className="text-xs text-green-600 font-semibold">✓ 저장됨</span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      알리고 API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={aligoConfig.apiKey}
                      onChange={(e) => updateAligoConfigField('apiKey', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="알리고 API Key 입력"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      알리고 User ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={aligoConfig.userId}
                      onChange={(e) => updateAligoConfigField('userId', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="알리고 User ID 입력"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      발신번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={aligoConfig.senderPhone}
                      onChange={(e) => updateAligoConfigField('senderPhone', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="01012345678 (하이픈 없이 숫자만)"
                    />
                  </div>
                  {aligoConfigDirty && (
                    <button
                      type="button"
                      onClick={() => handleSaveAligoConfig()}
                      disabled={savingAligoConfig}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingAligoConfig ? '저장 중...' : '💾 설정 저장하기 (다음에도 사용)'}
                    </button>
                  )}
                  {hasSyncedAligoConfig && !aligoConfigDirty && (
                    <div className="text-xs text-gray-600 bg-green-50 border border-green-200 rounded-lg p-2">
                      ✓ 저장된 설정이 자동으로 사용됩니다. 수정하려면 값을 변경하세요.
                    </div>
                  )}
                </div>
              )}

              {/* 템플릿 선택 */}
              {passportTemplates.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">템플릿 선택</label>
                  <select
                    value={selectedPassportTemplateId || ''}
                    onChange={(e) => setSelectedPassportTemplateId(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    disabled={loadingPassportTemplates}
                  >
                    {passportTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title} {template.isDefault ? '(기본)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 메시지 입력 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">메시지 내용</label>
                {loadingPassportTemplates ? (
                  <div className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-500">
                    템플릿 로딩 중...
                  </div>
                ) : (
                  <textarea
                    value={passportMessage}
                    onChange={(e) => setPassportMessage(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="여권 요청 메시지를 입력하세요."
                  />
                )}
              </div>

              {/* 여권 링크 표시 (링크 복사 방식일 때) */}
              {passportMethod === 'link' && selectedLeadId && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900 mb-2">🛂 여권 등록 링크</p>
                  <div className="mb-3 rounded-lg bg-white border border-blue-300 p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">링크 URL</p>
                    <p className="text-xs text-gray-900 break-all font-mono">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/public/passport-upload?leadId=${selectedLeadId}&partnerId=${partnerId}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!selectedLead?.userId) {
                            showError('해당 고객의 계정(User) 정보를 찾을 수 없어 V4 여권 링크를 생성할 수 없습니다. (전화번호 불일치 등)');
                            return;
                          }

                          const res = await fetch('/api/partner/passport-request/link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: selectedLead.userId, leadId: selectedLeadId }),
                          });
                          const data = await res.json();

                          if (data.ok && data.passportLink) {
                            await navigator.clipboard.writeText(data.passportLink);
                            showSuccess('여권 업로드 링크가 복사되었습니다.');
                          } else {
                            throw new Error(data.error || '링크 생성 실패');
                          }
                        } catch (error) {
                          console.error('링크 복사 실패:', error);
                          showError(error instanceof Error ? error.message : '링크 복사 실패');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      <span>📋</span>
                      <span>링크 복사</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!selectedLead?.userId) {
                            showError('해당 고객의 계정(User) 정보를 찾을 수 없어 미리보기를 할 수 없습니다.');
                            return;
                          }
                          const res = await fetch('/api/partner/passport-request/link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: selectedLead.userId, leadId: selectedLeadId }),
                          });
                          const data = await res.json();
                          if (data.ok && data.passportLink) {
                            window.open(data.passportLink, '_blank', 'width=1200,height=800');
                          } else {
                            showError(data.error || '링크 생성 실패');
                          }
                        } catch (e) {
                          showError('미리보기 실패');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span>👁️</span>
                      <span>미리보기</span>
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    💡 미리보기 버튼을 클릭하면 고객이 보는 화면을 확인할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPassportModal(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={requestingPassport}
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedLead || !selectedLeadId) return;

                  if (passportMethod === 'aligo') {
                    // 알리고 API로 직접 발송
                    if (!aligoConfig.apiKey || !aligoConfig.userId || !aligoConfig.senderPhone) {
                      showError('알리고 API 설정을 모두 입력해주세요.');
                      return;
                    }

                    if (!passportMessage.trim()) {
                      showError('메시지 내용을 입력해주세요.');
                      return;
                    }

                    setRequestingPassport(true);
                    try {
                      // 설정이 변경되었으면 자동으로 저장
                      if (aligoConfigDirty) {
                        const saved = await handleSaveAligoConfig({ silent: true });
                        if (!saved) {
                          setRequestingPassport(false);
                          return;
                        }
                      }

                      // 여권 업로드 링크 생성
                      // 여권 업로드 링크 생성 (V4)
                      let passportLink = '';
                      if (selectedLead?.userId) {
                        const linkRes = await fetch('/api/partner/passport-request/link', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: selectedLead.userId, leadId: selectedLeadId }),
                        });
                        const linkData = await linkRes.json();
                        if (linkData.ok) {
                          passportLink = linkData.passportLink;
                        }
                      }

                      if (!passportLink) {
                        // Fallback to old link if V4 fails or no userId (though V4 is preferred)
                        passportLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/passport-upload?leadId=${selectedLeadId}&partnerId=${partnerId}`;
                      }

                      // 템플릿 변수 채우기
                      let messageWithLink = passportMessage
                        .replace('[링크가 자동으로 추가됩니다]', passportLink)
                        .replace('{링크}', passportLink)
                        .replace('{고객명}', selectedLead?.customerName || '고객')
                        .replace('{상품명}', '크루즈 상품') // TODO: 실제 상품명 가져오기
                        .replace('{출발일}', new Date().toLocaleDateString('ko-KR')); // TODO: 실제 출발일 가져오기

                      if (!messageWithLink || messageWithLink.trim() === '') {
                        messageWithLink = `안녕하세요 ${selectedLead?.customerName || '고객'}님. 여권 정보를 업로드해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n${passportLink}`;
                      }

                      const res = await fetch('/api/partner/customers/send-sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          leadId: selectedLeadId,
                          phone: selectedLead?.customerPhone || '',
                          message: messageWithLink,
                        }),
                      });

                      const json = await res.json();
                      if (!res.ok || !json?.ok) {
                        throw new Error(json?.message || '여권 요청 발송에 실패했습니다.');
                      }

                      showSuccess('여권 요청이 발송되었습니다.');
                      setShowPassportModal(false);
                      await loadLeadDetail(selectedLeadId);
                      fetchCustomers(currentPage);
                    } catch (error) {
                      console.error('여권 요청 발송 오류:', error);
                      showError(
                        error instanceof Error ? error.message : '여권 요청 발송 중 오류가 발생했습니다.',
                      );
                    } finally {
                      setRequestingPassport(false);
                    }
                  } else {
                    // 링크 복사 방식
                    if (!selectedLead?.customerPhone) {
                      showError('고객 전화번호가 없습니다.');
                      return;
                    }

                    try {
                      if (!selectedLead?.userId) {
                        showError('해당 고객의 계정(User) 정보를 찾을 수 없어 V4 여권 링크를 생성할 수 없습니다.');
                        // Fallback to old link? Maybe, but user wants V4.
                        // Let's try to generate V4, if fails, show error.
                        return;
                      }

                      const res = await fetch('/api/partner/passport-request/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: selectedLead.userId, leadId: selectedLeadId }),
                      });
                      const data = await res.json();

                      if (data.ok && data.passportLink) {
                        await navigator.clipboard.writeText(data.passportLink);
                        showSuccess('여권 업로드 링크가 복사되었습니다.');
                      } else {
                        showError(data.error || '링크 생성 실패');
                      }
                      // 모달은 닫지 않고 링크 표시 유지 (미리보기 가능하도록)
                    } catch (error) {
                      console.error('링크 복사 실패:', error);
                      showError('링크 복사에 실패했습니다. 링크를 수동으로 복사해주세요.');
                    }
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
                disabled={requestingPassport}
              >
                {requestingPassport ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <FiSend />
                    {passportMethod === 'aligo' ? '알리고로 발송' : '링크 복사'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 그룹 생성/수정 모달 */}
      {showGroupModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGroupModal(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingGroup ? '그룹 수정' : '그룹 추가'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroup(null);
                  setGroupForm({ name: '', description: '', productCode: '', color: '#3B82F6' });
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  그룹 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 일본 크루즈 관심 고객"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">설명</label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="그룹에 대한 설명을 입력하세요."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">관련 상품 코드</label>
                <div className="relative" ref={productDropdownRef}>
                  <input
                    type="text"
                    value={productSearchTerm || (groupForm.productCode ? activeProducts.find(p => p.productCode === groupForm.productCode)?.packageName || groupForm.productCode : '없음')}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setProductDropdownOpen(true);
                    }}
                    onFocus={() => setProductDropdownOpen(true)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="상품을 검색하거나 선택하세요"
                  />
                  {productDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setGroupForm(prev => ({ ...prev, productCode: '' }));
                          setProductSearchTerm('');
                          setProductDropdownOpen(false);
                        }}
                      >
                        없음
                      </div>
                      {loadingProducts ? (
                        <div className="px-3 py-2 text-sm text-gray-500">로딩 중...</div>
                      ) : (
                        activeProducts
                          .filter(p =>
                            !productSearchTerm ||
                            p.productCode.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                            p.packageName?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                            p.cruiseLine?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                            p.shipName?.toLowerCase().includes(productSearchTerm.toLowerCase())
                          )
                          .map(product => (
                            <div
                              key={product.id}
                              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer border-t border-gray-100"
                              onClick={() => {
                                setGroupForm(prev => ({ ...prev, productCode: product.productCode }));
                                setProductSearchTerm('');
                                setProductDropdownOpen(false);
                              }}
                            >
                              <div className="font-semibold">{product.productCode}</div>
                              <div className="text-xs text-gray-500">
                                {product.cruiseLine} {product.shipName} - {product.packageName}
                                {product.nights && product.days && ` (${product.nights}박 ${product.days}일)`}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">그룹 색상</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-16 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-mono"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              {/* 엑셀 샘플 다운로드 및 등록 */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleDownloadGroupExcelSample}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <FiFileText /> 엑셀 샘플 받기
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 block">엑셀 등록하기</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setGroupExcelFile(file);
                        }
                      }}
                      className="flex-1 text-sm"
                    />
                    {groupExcelFile && (
                      <span className="text-xs text-gray-600">{groupExcelFile.name}</span>
                    )}
                  </div>
                  {groupExcelFile && editingGroup && (
                    <button
                      type="button"
                      onClick={handleUploadGroupExcel}
                      disabled={uploadingGroupExcel}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingGroupExcel ? '업로드 중...' : '엑셀 등록하기'}
                    </button>
                  )}
                  {groupExcelFile && !editingGroup && (
                    <p className="text-xs text-gray-500">그룹을 먼저 생성한 후 엑셀을 등록할 수 있습니다.</p>
                  )}
                  {groupExcelFile && editingGroup && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupExcelFile(null);
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      className="w-full mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      파일 선택 취소
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroup(null);
                  setGroupForm({ name: '', description: '', productCode: '', color: '#3B82F6' });
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                {editingGroup ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DB 보내기 모달 */}
      {showDbSendModal && partner.type === 'BRANCH_MANAGER' && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDbSendModal(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">DB 보내기</h3>
              <button
                type="button"
                onClick={() => {
                  setShowDbSendModal(false);
                  setSelectedAgentId('');
                  setSelectedCustomerIds([]);
                  setNewCustomers([]);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 1. 판매원 선택 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  판매원 선택 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">판매원을 선택하세요</option>
                  {partner.teamAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName ?? '판매원'} ({agent.affiliateCode ?? '코드 없음'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. 고객 선택 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">고객 선택</label>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-3 space-y-2">
                  {customers
                    .filter(c => c.ownership === 'MANAGER' && !c.agent?.id)
                    .map((customer) => (
                      <label key={customer.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomerIds([...selectedCustomerIds, customer.id]);
                            } else {
                              setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== customer.id));
                            }
                          }}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{customer.customerName ?? '이름 없음'}</div>
                          <div className="text-xs text-gray-500">{customer.customerPhone ?? '연락처 없음'}</div>
                        </div>
                      </label>
                    ))}
                  {customers.filter(c => c.ownership === 'MANAGER' && !c.agent?.id).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">선택 가능한 고객이 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 3. 새 고객 추가 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">새 고객 추가</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomers([...newCustomers, { name: '', phone: '', email: '', notes: '' }]);
                    }}
                    className="text-xs text-slate-700 hover:text-slate-700"
                  >
                    + 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {newCustomers.map((customer, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600">고객 {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomers(newCustomers.filter((_, i) => i !== index));
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="이름 *"
                          value={customer.name}
                          onChange={(e) => {
                            const updated = [...newCustomers];
                            updated[index].name = e.target.value;
                            setNewCustomers(updated);
                          }}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="연락처 *"
                          value={customer.phone}
                          onChange={(e) => {
                            const updated = [...newCustomers];
                            updated[index].phone = e.target.value;
                            setNewCustomers(updated);
                          }}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="email"
                          placeholder="이메일"
                          value={customer.email}
                          onChange={(e) => {
                            const updated = [...newCustomers];
                            updated[index].email = e.target.value;
                            setNewCustomers(updated);
                          }}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="비고"
                          value={customer.notes}
                          onChange={(e) => {
                            const updated = [...newCustomers];
                            updated[index].notes = e.target.value;
                            setNewCustomers(updated);
                          }}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDbSendModal(false);
                  setSelectedAgentId('');
                  setSelectedCustomerIds([]);
                  setNewCustomers([]);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSendDb}
                disabled={sendingDb}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingDb ? '보내는 중...' : '보내기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 퍼널 설정 모달 */}
      {showFunnelModal && funnelSettingsGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {funnelSettingsGroup.name} - 퍼널 설정
              </h2>
              <button
                onClick={() => {
                  setShowFunnelModal(false);
                  setFunnelSettingsGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 퍼널톡 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널톡 (카카오톡)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelTalks.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 카카오톡 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-slate-700 mb-1">
                      {funnelTalks.filter(group => group.messages.some(msg => funnelForm.funnelTalkIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelTalks.length, 10)}
                      value={funnelTalks
                        .filter(group => group.messages.some(msg => funnelForm.funnelTalkIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelTalks.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFunnelForm({
                          ...funnelForm,
                          funnelTalkIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-slate-500"
                    >
                      {funnelTalks.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 퍼널문자 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널문자 (SMS)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelSms.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 SMS 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-slate-700 mb-1">
                      {funnelSms.filter(group => group.messages.some(msg => funnelForm.funnelSmsIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelSms.length, 10)}
                      value={funnelSms
                        .filter(group => group.messages.some(msg => funnelForm.funnelSmsIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelSms.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFunnelForm({
                          ...funnelForm,
                          funnelSmsIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-slate-500"
                    >
                      {funnelSms.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 퍼널메일 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널메일 (Email)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelEmails.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 이메일 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-slate-700 mb-1">
                      {funnelEmails.filter(group => group.messages.some(msg => funnelForm.funnelEmailIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelEmails.length, 10)}
                      value={funnelEmails
                        .filter(group => group.messages.some(msg => funnelForm.funnelEmailIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelEmails.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFunnelForm({
                          ...funnelForm,
                          funnelEmailIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-slate-500"
                    >
                      {funnelEmails.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 재유입 처리 설정 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  재유입 처리 설정
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  고객이 해당그룹에 다시 들어올경우(해당그룹에 이미 존재할경우)
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="no_time_change_info_change"
                      checked={funnelForm.reEntryHandling === 'no_time_change_info_change'}
                      onChange={(e) => setFunnelForm({ ...funnelForm, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">유입시간변경 X, 고객정보변경 O</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="no_time_change_no_info_change"
                      checked={funnelForm.reEntryHandling === 'no_time_change_no_info_change'}
                      onChange={(e) => setFunnelForm({ ...funnelForm, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">유입시간변경 X, 고객정보변경 X</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="time_change_info_change"
                      checked={funnelForm.reEntryHandling === 'time_change_info_change'}
                      onChange={(e) => setFunnelForm({ ...funnelForm, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">
                      유입시간변경 O, 고객정보변경 O (*0일차 퍼널 부터 다시 시작)
                    </span>
                  </label>
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowFunnelModal(false);
                    setFunnelSettingsGroup(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/partner/customer-groups/${funnelSettingsGroup.id}/funnel-settings`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          funnelTalkIds: funnelForm.funnelTalkIds,
                          funnelSmsIds: funnelForm.funnelSmsIds,
                          funnelEmailIds: funnelForm.funnelEmailIds,
                          reEntryHandling: funnelForm.reEntryHandling,
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error:', errorText);
                        showError(`퍼널 설정 저장에 실패했습니다. (${response.status})`);
                        return;
                      }

                      const data = await response.json();
                      if (data.ok) {
                        showSuccess('퍼널 설정이 저장되었습니다.');
                        setShowFunnelModal(false);
                        setFunnelSettingsGroup(null);
                        loadCustomerGroups();
                      } else {
                        showError(data.error || '퍼널 설정 저장에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('Failed to save funnel settings:', error);
                      showError('퍼널 설정 저장 중 네트워크 오류가 발생했습니다.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 고객 리스트 모달 */}
      {showCustomerListModal && customerListGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {customerListGroup.name} - 고객 리스트
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  총 {customerListTotal}명
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCustomerListModal(false);
                  setCustomerListGroup(null);
                  setGroupCustomers([]);
                  setCustomerListSearch('');
                  setCustomerListPage(1);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <FiSearch className="text-gray-400" />
                <input
                  type="text"
                  value={customerListSearch}
                  onChange={(e) => setCustomerListSearch(e.target.value)}
                  placeholder="고객 이름 또는 연락처 검색"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingCustomerList ? (
                <div className="text-center py-12">
                  <FiRefreshCw className="inline-block animate-spin text-4xl text-slate-700 mb-4" />
                  <p className="text-gray-600">고객 목록을 불러오는 중...</p>
                </div>
              ) : groupCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUsers className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-600">
                    {customerListSearch ? '검색 결과가 없습니다.' : '이 그룹에 속한 고객이 없습니다.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {customer.customerName || '이름 없음'}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{customer.phone || '전화번호 없음'}</span>
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>유입일: {formatDate(customer.groupInflowDate)}</span>
                          <span>유입 후 {customer.daysSinceInflow}일</span>
                          {customer.messageSentCount > 0 && (
                            <span>발송: {customer.messageSentCount}건</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {customerListTotal > 50 && (
              <div className="flex items-center justify-between p-6 border-t">
                <button
                  onClick={() => {
                    if (customerListPage > 1) {
                      const newPage = customerListPage - 1;
                      setCustomerListPage(newPage);
                      loadGroupCustomers(customerListGroup.id, newPage);
                    }
                  }}
                  disabled={customerListPage === 1 || isLoadingCustomerList}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="text-sm text-gray-600">
                  {customerListPage} / {Math.ceil(customerListTotal / 50)}
                </span>
                <button
                  onClick={() => {
                    if (customerListPage < Math.ceil(customerListTotal / 50)) {
                      const newPage = customerListPage + 1;
                      setCustomerListPage(newPage);
                      loadGroupCustomers(customerListGroup.id, newPage);
                    }
                  }}
                  disabled={customerListPage >= Math.ceil(customerListTotal / 50) || isLoadingCustomerList}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CustomerNoteModal 삭제됨 - 고객 상세 패널의 상담기록으로 통합 */}

      {/* DB 전달 모달 (대리점장 전용) */}
      {showTransferModal && transferTargetLeadId && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTransferModal(false);
              setTransferTargetLeadId(null);
              setTransferTargetAgentId(null);
            }
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setShowTransferModal(false);
                setTransferTargetLeadId(null);
                setTransferTargetAgentId(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100"
            >
              <FiX className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-4">DB 전달</h3>
            <p className="text-sm text-gray-600 mb-4">
              선택한 고객을 판매원에게 전달합니다.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">전달할 판매원 선택</label>
              <select
                value={transferTargetAgentId || ''}
                onChange={(e) => setTransferTargetAgentId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">판매원을 선택하세요</option>
                {partner.teamAgents?.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.displayName} ({agent.affiliateCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferTargetLeadId(null);
                  setTransferTargetAgentId(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!transferTargetAgentId || transferring}
                onClick={async () => {
                  if (!transferTargetAgentId || !transferTargetLeadId) return;
                  setTransferring(true);
                  try {
                    const res = await fetch('/api/shared/customers/transfer', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        leadIds: [transferTargetLeadId],
                        targetType: 'SALES_AGENT',
                        targetProfileId: transferTargetAgentId,
                      }),
                    });
                    const json = await res.json();
                    if (res.ok && json.ok) {
                      showSuccess(json.message || 'DB 전달이 완료되었습니다.');
                      setShowTransferModal(false);
                      setTransferTargetLeadId(null);
                      setTransferTargetAgentId(null);
                      fetchCustomers(currentPage);
                    } else {
                      showError(json.message || 'DB 전달에 실패했습니다.');
                    }
                  } catch (error) {
                    showError('DB 전달 중 오류가 발생했습니다.');
                  } finally {
                    setTransferring(false);
                  }
                }}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {transferring ? '전달 중...' : '전달하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이메일 보내기 모달 */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEmailModal(false);
              setEmailTitle('');
              setEmailContent('');
              setCustomEmailAddress('');
              setEmailRecipientMode('customer');
              setEmailImages([]);
              setEmailButtons([]);
            }
          }}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">이메일 보내기</h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmailModal(false);
                  setEmailTitle('');
                  setEmailContent('');
                  setCustomEmailAddress('');
                  setEmailRecipientMode('customer');
                  setEmailImages([]);
                  setEmailButtons([]);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* 내용 */}
            <div className="px-6 py-6 space-y-6">
              {/* 안내 메시지 */}
              <div className="rounded-xl bg-indigo-50 border-2 border-indigo-200 p-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2 text-sm text-indigo-900">
                    <p className="font-bold">📧 이메일 발송 안내</p>
                    <p className="text-indigo-800">
                      이메일 하단에 크루즈닷 로고, 담당자 정보(계급, 이름, 연락처), 슬로건, 회사 주소가 자동으로 추가됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 수신자 이메일 입력 */}
              <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-200">
                <label className="block text-sm font-semibold text-indigo-900 mb-2">
                  📬 수신자 이메일 주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={customEmailAddress}
                  onChange={(e) => setCustomEmailAddress(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full rounded-lg border border-indigo-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs text-indigo-700">고객의 이메일 주소를 입력해주세요.</p>
              </div>

              {/* 이메일 제목 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 이메일 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={emailTitle}
                  onChange={(e) => setEmailTitle(e.target.value)}
                  placeholder="{이름}님께 드리는 특별한 크루즈 여행 안내"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* 치환 가이드 및 상품 선택 */}
              <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 text-lg">📝</span>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm mb-2">치환 가이드</p>
                    <p className="text-xs text-amber-800 mb-3">아래 치환 태그를 제목/내용에 넣으면 발송 시 자동으로 치환됩니다.</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setEmailContent(emailContent + '{이름}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{이름}'}</span>
                        <span className="text-amber-500">→ {selectedLead?.customerName || '고객명'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailContent(emailContent + '{연락처}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{연락처}'}</span>
                        <span className="text-amber-500">→ {selectedLead?.customerPhone || '연락처'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailContent(emailContent + '{상품명}')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span>{'{상품명}'}</span>
                        <span className="text-amber-500">→ {selectedProductId ? activeProducts.find(p => p.id === selectedProductId)?.packageName || '상품명' : '상품 선택 필요'}</span>
                      </button>
                    </div>
                    {/* 상품 선택 드롭다운 */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-amber-800 whitespace-nowrap">상품 선택:</label>
                      <select
                        value={selectedProductId || ''}
                        onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        disabled={loadingProducts}
                      >
                        <option value="">{'상품을 선택하세요 ({상품명} 치환용)'}</option>
                        {activeProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.packageName} ({product.cruiseLine} - {product.shipName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 이메일 내용 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ✉️ 이메일 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder="안녕하세요 {이름}님,&#10;&#10;{상품명} 상품에 관심을 가져주셔서 감사합니다.&#10;&#10;자세한 문의사항이 있으시면 연락 주세요."
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                {/* 미리보기 */}
                {emailContent && (emailContent.includes('{이름}') || emailContent.includes('{연락처}') || emailContent.includes('{상품명}')) && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">📧 발송될 내용 미리보기:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{applySubstitution(emailContent)}</p>
                  </div>
                )}
              </div>

              {/* 이미지 추가 섹션 */}
              <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FiImage className="text-slate-700" />
                    이미지 추가
                  </p>
                  <div className="flex gap-2">
                    <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-800 transition-colors">
                      <FiPlus className="w-3 h-3" />
                      업로드
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setEmailImages([...emailImages, {
                                id: `img-${Date.now()}`,
                                url: result,
                                name: file.name
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                {emailImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {emailImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img src={img.url} alt={img.name} className="w-full h-24 object-cover rounded-lg border border-blue-300" />
                        <button
                          type="button"
                          onClick={() => setEmailImages(emailImages.filter(i => i.id !== img.id))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                        <p className="text-xs text-blue-800 mt-1 truncate">{img.name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-700">이미지를 추가하면 이메일 본문에 포함됩니다.</p>
                )}
              </div>

              {/* 버튼 추가 섹션 */}
              <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FiExternalLink className="text-slate-700" />
                    버튼 추가 (최대 3개)
                  </p>
                  {emailButtons.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setEmailButtons([...emailButtons, {
                        id: `btn-${Date.now()}`,
                        label: '자세히 보기',
                        url: ''
                      }])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      <FiPlus className="w-3 h-3" />
                      버튼 추가
                    </button>
                  )}
                </div>
                {emailButtons.length > 0 ? (
                  <div className="space-y-3">
                    {emailButtons.map((btn, index) => (
                      <div key={btn.id} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">버튼 {index + 1}</span>
                        <input
                          type="text"
                          value={btn.label}
                          onChange={(e) => {
                            const updated = [...emailButtons];
                            updated[index].label = e.target.value;
                            setEmailButtons(updated);
                          }}
                          placeholder="버튼 이름"
                          className="flex-1 min-w-0 rounded border border-purple-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                        />
                        <input
                          type="url"
                          value={btn.url}
                          onChange={(e) => {
                            const updated = [...emailButtons];
                            updated[index].url = e.target.value;
                            setEmailButtons(updated);
                          }}
                          placeholder="https://..."
                          className="flex-1 min-w-0 rounded border border-purple-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEmailButtons(emailButtons.filter(b => b.id !== btn.id))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-700">버튼을 추가하면 이메일 하단에 클릭 가능한 버튼이 포함됩니다.</p>
                )}
              </div>

              {/* 푸터 미리보기 */}
              <div className="rounded-xl bg-gray-100 p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">📋 자동 추가되는 푸터 미리보기</p>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 text-center">
                  <p className="text-white font-bold text-sm mb-1">🚢 CruiseDot</p>
                  <p className="text-white text-xs opacity-90">당신의 행복한 크루즈 여행을 동행합니다</p>
                  <p className="text-white text-xs opacity-80">크루즈닷AI와 함께</p>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  + 담당자 계급, 이름, 연락처, 회사 주소가 포함됩니다
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmailModal(false);
                  setEmailImages([]);
                  setEmailButtons([]);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={sendingEmail}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={
                  sendingEmail ||
                  !customEmailAddress.includes('@') ||
                  !emailTitle.trim() ||
                  !emailContent.trim()
                }
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {sendingEmail ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <FiSend />
                    이메일 보내기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS 설정 모달 */}
      <SmsConfigModal
        isOpen={showSmsConfigModal}
        onClose={() => setShowSmsConfigModal(false)}
        onSuccess={() => {
          loadAligoConfig();
        }}
      />
    </div>
  );
}
