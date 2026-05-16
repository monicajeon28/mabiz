'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Search, Send, UserCheck, Download, FileText, Link, Copy, X, Info } from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface PassportRequestTemplate {
  id: number;
  title: string;
  body: string;
  variables: Record<string, any> | null;
  isDefault: boolean;
  updatedAt: string;
}

interface PassportRequestLogSummary {
  id: number;
  status: string;
  messageChannel: string;
  sentAt: string;
  admin: {
    id: number;
    name: string | null;
  } | null;
}

interface PassportSubmissionSummary {
  id: number;
  tripId: number | null;
  token: string;
  tokenExpiresAt: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PassportRequestCustomer {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  customerStatus: string | null;
  createdAt: string;
  tripCount: number;
  latestTrip: {
    id: number;
    cruiseName: string | null;
    reservationCode: string | null;
    productId: number | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
  submission: PassportSubmissionSummary | null;
  lastRequest: PassportRequestLogSummary | null;
  submissionStatus: 'submitted' | 'pending' | 'not_requested';
}

interface SendResultItem {
  userId: number;
  success: boolean;
  link?: string;
  token?: string;
  submissionId?: number;
  message?: string;
  error?: string;
  messageId?: string | null;
  resultCode?: string;
}

interface SendResultResponse {
  ok: boolean;
  channel: string;
  expiresInHours: number;
  results: SendResultItem[];
  missingUserIds: number[];
  aligoRemain?: AligoRemainSummary;
  remainingCash?: number;
  lowBalance?: boolean;
}

interface AligoRemainSummary {
  result_code: string;
  message?: string;
  SMS_CNT?: string;
  LMS_CNT?: string;
  MMS_CNT?: string;
  cash?: string;
}

interface AligoStatusResponse {
  ok: boolean;
  balance: number;
  lastUpdated: string;
  message?: string;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'submitted', label: '제출 완료' },
  { value: 'pending', label: '제출 대기' },
  { value: 'not_requested', label: '요청 없음' },
  { value: 'no_request', label: '발송 이력 없음' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

type RoleFilter = 'all' | 'guide' | 'mall' | 'test';

type ChannelOption = 'SMS' | 'ALIMTALK';

const CHANNEL_LABELS: Record<ChannelOption, string> = {
  SMS: 'SMS (알리고)',
  ALIMTALK: '알림톡 (카카오)',
};

const formatChannelLabel = (channel: string) => {
  if (channel in CHANNEL_LABELS) {
    return CHANNEL_LABELS[channel as ChannelOption];
  }
  if (channel === 'KAKAO') return '카카오 메시지';
  return channel;
};

type SearchMatch = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  customerStatus: string | null;
  createdAt: string;
  tripCount: number;
  trips: Array<{
    id: number;
    productName: string | null;
    cruiseName: string | null;
    departureDate: string;
    startDate: string | null;
    endDate: string | null;
  }>;
  passportSubmissions: Array<{
    id: number;
    isSubmitted: boolean;
    updatedAt: string;
    submittedAt: string | null;
    tokenExpiresAt: string;
  }>;
  passportRequestsSent: Array<{
    id: number;
    status: string;
    sentAt: string;
    messageChannel: string;
    admin: {
      id: number;
      name: string | null;
    } | null;
  }>;
};

type SendMode = 'link' | 'message';

interface ProductCode {
  code: string;
  cruiseName: string | null;
  shipName: string;
  customerCount: number;
}

// 검색 API 응답을 고객 객체로 변환하는 헬퍼
const convertSearchMatchToCustomer = (match: SearchMatch): PassportRequestCustomer => ({
  id: match.id,
  name: match.name,
  phone: match.phone,
  email: match.email,
  role: match.role,
  customerStatus: match.customerStatus,
  createdAt: match.createdAt,
  tripCount: match.tripCount,
  latestTrip: match.trips && match.trips.length > 0 ? {
    id: match.trips[0].id,
    cruiseName: match.trips[0].cruiseName,
    reservationCode: null,
    productId: null,
    startDate: match.trips[0].startDate,
    endDate: match.trips[0].endDate,
  } : null,
  submission: match.passportSubmissions && match.passportSubmissions.length > 0 ? {
    id: match.passportSubmissions[0].id,
    tripId: null,
    token: '',
    tokenExpiresAt: match.passportSubmissions[0].tokenExpiresAt,
    isSubmitted: match.passportSubmissions[0].isSubmitted,
    submittedAt: match.passportSubmissions[0].submittedAt,
    createdAt: match.createdAt,
    updatedAt: match.passportSubmissions[0].updatedAt,
  } : null,
  lastRequest: match.passportRequestsSent && match.passportRequestsSent.length > 0 ? {
    id: match.passportRequestsSent[0].id,
    status: match.passportRequestsSent[0].status,
    messageChannel: match.passportRequestsSent[0].messageChannel,
    sentAt: match.passportRequestsSent[0].sentAt,
    admin: match.passportRequestsSent[0].admin,
  } : null,
  submissionStatus: match.passportSubmissions && match.passportSubmissions.length > 0
    ? (match.passportSubmissions[0].isSubmitted ? 'submitted' : 'pending')
    : 'not_requested',
});

export default function PassportRequestPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [customers, setCustomers] = useState<PassportRequestCustomer[]>([]);
  const [templates, setTemplates] = useState<PassportRequestTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // roleFilter 제거: 모든 구매 고객을 표시하므로 역할 구분 불필요
  const [productCodeFilter, setProductCodeFilter] = useState<string>('all');
  const [productCodes, setProductCodes] = useState<ProductCode[]>([]);
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'submittedAt'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [channel, setChannel] = useState<ChannelOption>('SMS');
  const [expiresInHours, setExpiresInHours] = useState<number>(72);
  const [lastResult, setLastResult] = useState<SendResultResponse | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadingApis, setDownloadingApis] = useState<number | null>(null);
  const searchDropdownRef = useRef<HTMLLabelElement | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedCustomerForManual, setSelectedCustomerForManual] = useState<PassportRequestCustomer | null>(null);
  const [manualTemplateId, setManualTemplateId] = useState<number | null>(null);
  const [manualMessageBody, setManualMessageBody] = useState('');
  const [manualExpiresInHours, setManualExpiresInHours] = useState<number>(72);
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);
  const [manualResult, setManualResult] = useState<{ link: string; message: string; token: string; submissionId: number; expiresAt: string } | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>('link');
  const [aligoStatus, setAligoStatus] = useState<AligoStatusResponse | null>(null);
  const [isLoadingAligoStatus, setIsLoadingAligoStatus] = useState(false);

  // 일괄 링크 생성 결과 (인라인 표시용)
  const [bulkLinkResult, setBulkLinkResult] = useState<{
    link: string;
    message: string;
    expiresAt: string;
    selectedSendMode: SendMode;
    templateId?: number;
  } | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const selectedTemplates = useMemo(() => {
    if (selectedTemplateId === null) return null;
    return templates.find((tpl) => tpl.id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  const selectedCustomers = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return customers.filter((customer) => selectedSet.has(customer.id));
  }, [customers, selectedIds]);

  // 여권 제출 상태 통계
  const submissionStats = useMemo(() => {
    const stats = {
      submitted: 0,
      pending: 0,
      notRequested: 0,
      total: customers.length,
    };
    customers.forEach((customer) => {
      if (customer.submissionStatus === 'submitted') {
        stats.submitted++;
      } else if (customer.submissionStatus === 'pending') {
        stats.pending++;
      } else {
        stats.notRequested++;
      }
    });
    return stats;
  }, [customers]);

  // 예상 SMS 발송 비용 계산 (SMS 기준: 메시지당 100원)
  const estimatedCost = useMemo(() => {
    if (channel !== 'SMS') {
      // SMS가 아닌 경우 비용 계산 안 함 (알림톡은 별도 가격)
      return {
        count: selectedIds.length,
        messageLength: messageBody.length,
        costPerMessage: 0,
        totalCost: 0,
        isLowBalance: false,
      };
    }

    const costPerMessage = 100; // SMS 메시지당 100원
    const selectedCount = selectedIds.length;
    const messageLength = messageBody.length;
    const totalCost = selectedCount * costPerMessage;
    const isLowBalance = aligoStatus ? totalCost > aligoStatus.balance : false;

    return {
      count: selectedCount,
      messageLength,
      costPerMessage,
      totalCost,
      isLowBalance,
    };
  }, [selectedIds.length, messageBody.length, channel, aligoStatus]);

  // 정렬된 고객 목록
  const sortedCustomers = useMemo(() => {
    const sorted = [...customers];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortBy === 'status') {
        const statusOrder = { submitted: 3, pending: 2, not_requested: 1 };
        aValue = statusOrder[a.submissionStatus] || 0;
        bValue = statusOrder[b.submissionStatus] || 0;
      } else if (sortBy === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (sortBy === 'submittedAt') {
        aValue = a.submission?.submittedAt ? new Date(a.submission.submittedAt).getTime() : 0;
        bValue = b.submission?.submittedAt ? new Date(b.submission.submittedAt).getTime() : 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [customers, sortBy, sortOrder]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/passport/admin/templates', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error('템플릿을 불러올 수 없습니다.');
      }

      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          const defaultTemplate = data.templates.find((tpl: PassportRequestTemplate) => tpl.isDefault);
          const firstTemplate = defaultTemplate ?? data.templates[0];
          setSelectedTemplateId(firstTemplate.id);
          setMessageBody((body) => body || firstTemplate.body || '');
        }
      } else {
        throw new Error('템플릿 데이터 형식이 올바르지 않습니다.');
      }
    } catch (error) {
      logger.error('[PassportRequest] Load templates error:', { error: error instanceof Error ? error.message : String(error) });
      showError('템플릿을 불러오는 중 문제가 발생했습니다.');
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (productCodeFilter !== 'all') params.set('productCode', productCodeFilter);
      // roleFilter 제거: 모든 구매 고객을 조회하므로 역할 필터 불필요

      const res = await fetch(`/api/passport/admin/customers?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('고객 목록을 불러올 수 없습니다.');
      }
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setCustomers(data.data);
        setSelectedIds((prev) => prev.filter((id) => data.data.some((item: PassportRequestCustomer) => item.id === id)));
      } else {
        throw new Error('응답 형식이 올바르지 않습니다.');
      }
    } catch (error) {
      logger.error('[PassportRequest] Load customers error:', { error: error instanceof Error ? error.message : String(error) });
      showError('고객 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, productCodeFilter]);

  const loadAligoStatus = useCallback(async () => {
    setIsLoadingAligoStatus(true);
    try {
      const res = await fetch('/api/passport/admin/aligo-status', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Aligo 잔액 조회 실패');
      }
      const data = await res.json();
      if (data.ok) {
        setAligoStatus(data);
      } else {
        throw new Error(data.error || 'Aligo 잔액 조회 실패');
      }
    } catch (error) {
      logger.error('[PassportRequest] Load Aligo status error:', { error: error instanceof Error ? error.message : String(error) });
      setAligoStatus(null);
    } finally {
      setIsLoadingAligoStatus(false);
    }
  }, []);

  const handleDownloadApis = useCallback(async (tripId: number, cruiseName: string | null) => {
    setDownloadingApis(tripId);
    try {
      const res = await fetch(`/api/admin/apis/excel?tripId=${tripId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('APIS 다운로드에 실패했습니다.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `APIS_${cruiseName || 'Trip'}_${tripId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showSuccess('APIS 엑셀이 다운로드되었습니다.');
    } catch (error) {
      logger.error('[PassportRequest] APIS 다운로드 오류:', { error: error instanceof Error ? error.message : String(error) });
      showError('APIS 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingApis(null);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadAligoStatus();

    // 상품 코드 목록 로드
    const loadProductCodes = async () => {
      try {
        const res = await fetch('/api/passport/admin/product-codes', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.productCodes)) {
            setProductCodes(data.productCodes);
          }
        }
      } catch (error) {
        logger.error('[PassportRequest] Load product codes error:', { error });
      }
    };

    loadProductCodes();
  }, [loadTemplates, loadAligoStatus]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadCustomers();
    }, 350);
    return () => clearTimeout(handler);
  }, [loadCustomers, refreshFlag]);

  useEffect(() => {
    const controller = new AbortController();
    const term = search.trim();

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/passport/admin/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('검색에 실패했습니다.');
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.data)) {
          const matches = data.data as SearchMatch[];
          setSearchMatches(matches);
          setIsSearchOpen((prev) => (prev ? matches.length > 0 : prev));
        } else {
          setSearchMatches([]);
          setIsSearchOpen((prev) => (prev ? false : prev));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          logger.error('[PassportRequest] 검색 오류:', { error: error instanceof Error ? error.message : String(error) });
        }
        setSearchMatches([]);
        setIsSearchOpen((prev) => (prev ? false : prev));
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((customer) => customer.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleMatchClick = (match: SearchMatch) => {
    const keyword = match.phone?.trim() || match.email?.trim() || match.name?.trim() || '';
    if (keyword) {
      setSearch(keyword);
    }
    setSelectedIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));

    // 검색 결과로 고객 정보 구성
    const searchResultCustomer = convertSearchMatchToCustomer(match);

    // 고객 목록에 추가 또는 업데이트
    setCustomers((prev) => {
      const index = prev.findIndex((c) => c.id === match.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = searchResultCustomer;
        return updated;
      } else {
        return [...prev, searchResultCustomer];
      }
    });

    setIsSearchOpen(false);
    setSearchMatches([]);
    setSearchLoading(false);
    searchInputRef.current?.focus();
  };

  const handleTemplateChange = (templateId: number) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((tpl) => tpl.id === templateId);
    if (template) {
      setMessageBody(template.body || '');
    }
  };

  const handleAddMatches = () => {
    if (searchMatches.length === 0) return;
    setSelectedIds((prev) => Array.from(new Set([...prev, ...searchMatches.map((item) => item.id)])));

    // 검색 결과 모두를 고객 목록에 추가
    const searchResultCustomers = searchMatches.map(convertSearchMatchToCustomer);

    setCustomers((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newCustomers = searchResultCustomers.filter((c) => !existingIds.has(c.id));
      return [...prev, ...newCustomers];
    });

    setIsSearchOpen(false);
  };

  const handleOpenManualModal = (customer: PassportRequestCustomer) => {
    if (customer.submission && !customer.submission.isSubmitted) {
      showError('이미 여권 요청이 진행 중입니다.');
      return;
    }
    setSelectedCustomerForManual(customer);
    setManualResult(null);
    const defaultTemplate = templates.find((tpl) => tpl.isDefault) ?? templates[0];
    if (defaultTemplate) {
      setManualTemplateId(defaultTemplate.id);
      setManualMessageBody(defaultTemplate.body || '');
    } else {
      setManualTemplateId(null);
      setManualMessageBody('');
    }
    setManualExpiresInHours(72);
    setShowManualModal(true);
  };

  const handleManualTemplateChange = (templateId: number) => {
    setManualTemplateId(templateId);
    const template = templates.find((tpl) => tpl.id === templateId);
    if (template) {
      setManualMessageBody(template.body || '');
    }
    setManualResult(null);
  };

  const handleGenerateManualLink = async () => {
    if (!selectedCustomerForManual) return;
    if (!manualMessageBody.trim()) {
      showError('메시지 내용을 입력해주세요.');
      return;
    }

    setIsGeneratingManual(true);
    setManualResult(null);
    try {
      const res = await fetch('/api/passport/admin/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedCustomerForManual.id,
          templateId: manualTemplateId ?? undefined,
          messageBody: manualMessageBody,
          expiresInHours: manualExpiresInHours,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        logger.error('[PassportRequest] Manual API error response:', { status: res.status });
        throw new Error('여권 제출 링크 생성에 실패했습니다.');
      }

      setManualResult(data.result);
      showSuccess('여권 제출 링크가 생성되었습니다. 메시지를 복사해 고객에게 전달하세요.');
      setRefreshFlag((prev) => prev + 1);
    } catch (error: any) {
      logger.error('[PassportRequest] Manual error', { error: error?.message });
      showError('여권 제출 링크를 생성하지 못했습니다.');
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(`${label} 복사 완료`);
    } catch {
      showError('클립보드에 복사하지 못했습니다. 직접 선택해서 복사해주세요.');
    }
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      showError('먼저 발송할 고객을 선택해주세요.');
      return;
    }

    setIsBulkGenerating(true);
    try {
      // 1. 메시지 선택: "메시지로 발송" 모드일 때만 필요
      let requestMessageBody = '';
      if (sendMode === 'message') {
        const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
        const template = selectedTemplate || templates.find((t) => t.isDefault);
        if (!template?.body) {
          throw new Error('템플릿을 선택해주세요.');
        }
        requestMessageBody = template.body;
      } else {
        // "링크만 전송" - 메시지 없이 처리 (API에서 처리)
        requestMessageBody = '';
      }

      // 2. 링크 생성 API 호출 (실제로는 send API가 링크도 생성)
      const res = await fetch('/api/passport/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIds: selectedIds,
          templateId: sendMode === 'message' ? selectedTemplateId ?? undefined : undefined,
          messageBody: requestMessageBody,
          channel: 'SMS', // 링크 생성 시점에는 SMS로 지정하지 않음 (선택)
          expiresInHours,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        logger.error('[PassportRequest] Send API error response:', { status: res.status, data });
        throw new Error(data.message || '링크 생성에 실패했습니다.');
      }

      // 3. 첫 번째 사용자의 링크 정보 추출 (대표로 사용)
      const firstResult = data.results?.[0];
      if (!firstResult?.link) {
        throw new Error('링크가 생성되지 않았습니다.');
      }

      // 4. 메시지 렌더링
      let renderedMessage = '';
      if (sendMode === 'message') {
        const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
        const template = selectedTemplate || templates.find((t) => t.isDefault);
        if (template) {
          // 기본 고객명/상품명으로 미리보기
          renderedMessage = template.body
            .replace(/{고객명}/g, '고객명')
            .replace(/{링크}/g, firstResult.link)
            .replace(/{상품명}/g, '상품명')
            .replace(/{출발일}/g, '출발일');
        }
      } else {
        // "링크만 전송" 모드
        renderedMessage = firstResult.link;
      }

      // 5. 결과를 인라인 표시 상태에 저장
      setBulkLinkResult({
        link: firstResult.link,
        message: renderedMessage,
        expiresAt: firstResult.token ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
        selectedSendMode: sendMode,
        templateId: sendMode === 'message' ? selectedTemplateId ?? undefined : undefined,
      });

      showSuccess(`${selectedIds.length}명에게 링크가 생성되었습니다.`);
    } catch (error) {
      logger.error('[PassportRequest] handleSend error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      showError(error instanceof Error ? error.message : '링크 생성 중 오류가 발생했습니다.');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // 링크 생성 후 SMS 발송
  const handleBulkSendAfterLinkGeneration = async () => {
    if (!bulkLinkResult) {
      showError('먼저 링크를 생성해주세요.');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/passport/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIds: selectedIds,
          templateId: bulkLinkResult.templateId ?? undefined,
          messageBody: bulkLinkResult.message,
          channel: 'SMS',
          expiresInHours,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        logger.error('[PassportRequest] Send API error:', { status: res.status });
        throw new Error(data.message || 'SMS 발송에 실패했습니다.');
      }

      setLastResult(data);
      showSuccess(`${selectedIds.length}명에게 SMS가 발송되었습니다.`);
      setBulkLinkResult(null);
      setSelectedIds([]);
      setRefreshFlag((prev) => prev + 1);
    } catch (error) {
      logger.error('[PassportRequest] handleBulkSendAfterLinkGeneration error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      showError(error instanceof Error ? error.message : 'SMS 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <section className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-800 flex items-center gap-3">
              <span className="text-4xl">🛂</span>
              여권 요청 관리
            </h1>
            <p className="mt-2 text-base md:text-lg text-gray-600 leading-relaxed">
              선택한 고객에게 여권 제출 링크를 일괄로 발송하고 진행 상태를 한눈에 확인하세요.
            </p>
          </div>
          <button
            onClick={() => setRefreshFlag((prev) => prev + 1)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> 새로고침
          </button>
        </div>
      </section>

      {/* 여권 제출 상태 통계 카드 */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg border-2 border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 mb-1">제출 완료</p>
              <p className="text-3xl font-bold text-green-900">{submissionStats.submitted}</p>
              <p className="text-xs text-green-600 mt-1">
                {submissionStats.total > 0 ? Math.round((submissionStats.submitted / submissionStats.total) * 100) : 0}%
              </p>
            </div>
            <CheckCircle className="h-9 w-9 text-green-500" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-lg border-2 border-yellow-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 mb-1">제출 대기</p>
              <p className="text-3xl font-bold text-yellow-900">{submissionStats.pending}</p>
              <p className="text-xs text-yellow-600 mt-1">
                {submissionStats.total > 0 ? Math.round((submissionStats.pending / submissionStats.total) * 100) : 0}%
              </p>
            </div>
            <AlertCircle className="h-9 w-9 text-yellow-500" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">요청 없음</p>
              <p className="text-3xl font-bold text-gray-900">{submissionStats.notRequested}</p>
              <p className="text-xs text-gray-600 mt-1">
                {submissionStats.total > 0 ? Math.round((submissionStats.notRequested / submissionStats.total) * 100) : 0}%
              </p>
            </div>
            <UserCheck className="h-9 w-9 text-gray-500" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 mb-1">전체 고객</p>
              <p className="text-3xl font-bold text-blue-900">{submissionStats.total}</p>
              <p className="text-xs text-blue-600 mt-1">현재 필터 기준</p>
            </div>
            <UserCheck className="h-9 w-9 text-blue-500" />
          </div>
        </div>
      </section>

      {/* Aligo 잔액 카드 */}
      <section className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg border-2 border-emerald-200 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">💚</span>
              <div>
                <p className="text-sm font-semibold text-emerald-700">Aligo 잔액</p>
                {isLoadingAligoStatus ? (
                  <p className="text-2xl font-bold text-emerald-900 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" /> 조회 중...
                  </p>
                ) : aligoStatus && aligoStatus.ok ? (
                  <div>
                    <p className="text-2xl font-bold text-emerald-900">
                      {aligoStatus.balance.toLocaleString('ko-KR')}원
                    </p>
                    {aligoStatus.balance <= 5000 && (
                      <p className="text-sm font-semibold text-red-600 mt-1">
                        🚨 저잔액 경고 (5,000원 이하)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-red-600">조회 불가</p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={loadAligoStatus}
            disabled={isLoadingAligoStatus}
            className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-semibold shadow-md transition-colors ${
              isLoadingAligoStatus
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingAligoStatus ? 'animate-spin' : ''}`} />
            <span className="ml-2">새로고침</span>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col relative" ref={searchDropdownRef}>
            <span className="text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <Search className="h-4 w-4" /> 이름/전화/이메일 검색
            </span>
            <input
              type="text"
              value={search}
              ref={searchInputRef}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setSearch(event.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="예: 홍길동 또는 010"
              className="px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-blue-500 focus:outline-none text-lg"
            />
            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-blue-200 rounded-xl shadow-xl z-20 max-h-80 overflow-auto">
                <div className="flex items-center justify-between px-4 py-2 border-b border-blue-100 bg-blue-50">
                  <p className="text-sm font-semibold text-blue-700">
                    {search.trim() ? `검색 결과 (${searchMatches.length}명)` : '최근 고객 목록'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={handleAddMatches}
                      disabled={searchMatches.length === 0}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                        searchMatches.length === 0
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      결과 전체 선택
                    </button>
                  </div>
                </div>
                {searchLoading ? (
                  <div className="px-4 py-3 text-sm text-blue-600">검색 중...</div>
                ) : searchMatches.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">검색 결과가 없습니다.</div>
                ) : (
                  <ul className="divide-y divide-blue-50">
                    {searchMatches.map((match) => (
                      <li key={`match-${match.id}`} className="px-4 py-3 hover:bg-blue-50 flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleMatchClick(match)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm text-gray-700">
                            <p className="font-semibold text-gray-900">{match.name ?? '이름 없음'}</p>
                            <p className="text-xs text-gray-500">
                              {match.phone ?? '전화번호 없음'} / {match.email ?? '이메일 없음'}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelect(match.id);
                          }}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                            selectedIds.includes(match.id)
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          {selectedIds.includes(match.id) ? '선택됨' : '선택'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </label>

          <label className="flex flex-col">
            <span className="text-gray-700 font-semibold mb-2">제출 상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-blue-500 focus:outline-none text-lg"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-gray-700 font-semibold mb-2">상품별</span>
            <select
              value={productCodeFilter}
              onChange={(event) => setProductCodeFilter(event.target.value)}
              className="px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-blue-500 focus:outline-none text-lg"
            >
              <option value="all">전체 상품</option>
              {productCodes.map((pc) => (
                <option key={pc.code} value={pc.code}>
                  {pc.cruiseName || pc.shipName || pc.code} ({pc.customerCount}명)
                </option>
              ))}
            </select>
          </label>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <UserCheck className="h-7 w-7 text-blue-600" />
            <div>
              <p className="text-blue-900 font-bold text-xl">선택된 고객</p>
              <p className="text-blue-700 text-lg">{selectedIds.length}명</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === sortedCustomers.length}
                    onChange={toggleSelectAll}
                    className="w-5 h-5"
                    aria-label="전체 선택"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">
                  <button
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-blue-700"
                  >
                    고객 정보
                    {sortBy === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">최근 여행/상태</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">
                  <button
                    onClick={() => {
                      if (sortBy === 'status') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('status');
                        setSortOrder('desc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-blue-700"
                  >
                    여권 제출
                    {sortBy === 'status' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">
                  <button
                    onClick={() => {
                      if (sortBy === 'submittedAt') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('submittedAt');
                        setSortOrder('desc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-blue-700"
                  >
                    최근 발송
                    {sortBy === 'submittedAt' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-lg text-gray-500">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-lg text-gray-500">
                    조건에 맞는 고객이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => {
                  const isSelected = selectedIds.includes(customer.id);
                  const submission = customer.submission;
                  const lastRequest = customer.lastRequest;
                  const roleLabel = customer.role === 'community' ? '크루즈몰 고객' : '크루즈가이드 고객';
                  const isTestCustomer = (customer.customerStatus || '').toLowerCase() === 'test';

                  const isSubmitted = submission?.isSubmitted ?? false;
                  const isPending = submission && !submission.isSubmitted;

                  return (
                    <tr
                      key={customer.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70'
                          : isSubmitted
                          ? 'bg-green-50/50 hover:bg-green-50'
                          : isPending
                          ? 'bg-yellow-50/50 hover:bg-yellow-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(customer.id)}
                          className="w-5 h-5"
                          aria-label={`${customer.name ?? '이름 없음'} 선택`}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900">{customer.name ?? '이름 없음'}</p>
                          <p className="text-sm text-gray-600">{customer.phone ?? '전화번호 없음'}</p>
                          <p className="text-sm text-gray-500">{customer.email ?? '이메일 없음'}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              {roleLabel}
                            </span>
                            {isTestCustomer && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                테스트 고객
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {customer.latestTrip ? (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-800">{customer.latestTrip.cruiseName || '여행명 없음'}</p>
                              <p className="text-sm text-gray-600">
                                {customer.latestTrip.startDate ? customer.latestTrip.startDate.slice(0, 10) : '?'} ~{' '}
                                {customer.latestTrip.endDate ? customer.latestTrip.endDate.slice(0, 10) : '?'}
                              </p>
                              {customer.latestTrip.reservationCode && (
                                <p className="text-sm text-gray-500">PNR: {customer.latestTrip.reservationCode}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDownloadApis(customer.latestTrip!.id, customer.latestTrip!.cruiseName)}
                              disabled={downloadingApis === customer.latestTrip.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                downloadingApis === customer.latestTrip.id
                                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                  : 'bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow-md'
                              }`}
                            >
                              {downloadingApis === customer.latestTrip.id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  다운로드 중...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" />
                                  APIS 다운로드
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">여행 정보 없음</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          {!submission && (
                            <button
                              onClick={() => handleOpenManualModal(customer)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                              <Link className="h-3 w-3" />
                              링크 생성
                            </button>
                          )}
                          {submission ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {submission.isSubmitted ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                                )}
                                <span
                                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${
                                    submission.isSubmitted
                                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                      : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white'
                                  }`}
                                >
                                  {submission.isSubmitted ? '제출 완료' : '제출 대기'}
                                </span>
                              </div>
                              {submission.isSubmitted && submission.submittedAt && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                                  <p className="text-xs font-semibold text-green-700">
                                    제출 완료일: {new Date(submission.submittedAt).toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              )}
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <p>링크 만료: {new Date(submission.tokenExpiresAt).toLocaleDateString('ko-KR')}</p>
                                {!submission.isSubmitted && (
                                  <p className="text-yellow-600 font-semibold">아직 제출되지 않았습니다</p>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {lastRequest ? (
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                lastRequest.status === 'SUCCESS'
                                  ? 'bg-green-100 text-green-700'
                                  : lastRequest.status === 'FAILED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {lastRequest.status}
                            </span>
                            <p className="text-xs text-gray-500">
                              {lastRequest.sentAt.slice(0, 16).replace('T', ' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              채널: {lastRequest.messageChannel}
                            </p>
                            <p className="text-xs text-gray-400">
                              담당: {lastRequest.admin?.name ?? '관리자'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">발송 이력 없음</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 링크로 직접 보내기 섹션 */}
      <section className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 space-y-6">
        <h2 className="text-2xl font-bold text-green-800 flex items-center gap-3">
          <span className="text-3xl">🔗</span>
          링크로 직접 보내기 (비용 0원)
        </h2>

        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <UserCheck className="h-7 w-7 text-green-600" />
          <div>
            <p className="text-green-900 font-bold text-xl">선택된 고객</p>
            <p className="text-green-700 text-lg">{selectedIds.length}명</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex flex-col">
            <span className="text-gray-700 font-semibold mb-2">링크 만료 시간 (시간 단위)</span>
            <input
              type="number"
              min={1}
              max={24 * 14}
              value={expiresInHours}
              onChange={(event) => setExpiresInHours(Math.max(1, Math.min(24 * 14, Number(event.target.value) || 1)))}
              className="px-4 py-3 rounded-xl border-2 border-green-100 focus:border-green-500 focus:outline-none text-lg"
            />
            <span className="text-xs text-gray-500 mt-1">최대 14일(336시간)까지 지정 가능합니다.</span>
          </label>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800 leading-relaxed">
            <p className="font-semibold mb-2">링크 생성 방식</p>
            <ul className="list-disc list-inside space-y-1">
              <li>SMS/카톡으로 보낼 고객을 선택하세요</li>
              <li>링크 생성하기를 누르면 여권 제출 링크가 생성됩니다</li>
              <li>생성된 링크를 복사해 고객에게 직접 전달하세요</li>
              <li>제출이 완료되면 자동으로 현황이 갱신됩니다</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => {
            if (selectedIds.length === 0) {
              showError('먼저 발송할 고객을 선택해주세요.');
              return;
            }
            setIsSending(true);
            handleSend();
          }}
          disabled={isSending || selectedIds.length === 0}
          className="w-full inline-flex items-center justify-center px-6 py-3 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-transform hover:scale-[1.02]"
        >
          {isSending ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" /> 링크 생성 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Link className="h-5 w-5" /> 링크 생성하기
            </span>
          )}
        </button>

        {/* 링크 생성 결과 인라인 표시 */}
        {bulkLinkResult && (
          <div className="mt-6 space-y-4 border border-green-200 bg-green-50 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                ✅ 링크가 생성되었습니다
              </h3>
              <button
                onClick={() => setBulkLinkResult(null)}
                className="rounded-lg p-1 text-green-600 hover:bg-green-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 메시지 미리보기 (메시지 모드인 경우만) */}
            {bulkLinkResult.selectedSendMode === 'message' && (
              <div className="space-y-2">
                <label className="block">
                  <p className="text-sm font-semibold text-green-800 mb-2">📝 완성된 메시지</p>
                  <textarea
                    value={bulkLinkResult.message}
                    readOnly
                    rows={6}
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-green-900 font-mono"
                  />
                </label>
                <button
                  onClick={() => handleCopy(bulkLinkResult.message, '메시지')}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  메시지 복사
                </button>
              </div>
            )}

            {/* 링크 표시 */}
            <div className="space-y-2">
              <label className="block">
                <p className="text-sm font-semibold text-green-800 mb-2">🔗 제출 링크</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={bulkLinkResult.link}
                    readOnly
                    className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-green-900 font-mono"
                  />
                  <button
                    onClick={() => handleCopy(bulkLinkResult.link, '링크')}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors whitespace-nowrap"
                  >
                    <Copy className="h-4 w-4" />
                    링크 복사
                  </button>
                </div>
              </label>
              <p className="text-xs text-green-700">
                ⏰ 만료: {new Date(bulkLinkResult.expiresAt).toLocaleString('ko-KR')}
              </p>
            </div>

            {/* 다음 단계 선택 */}
            <div className="border-t border-green-200 pt-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">📋 다음 단계</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setBulkLinkResult(null)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  다시 선택
                </button>
                <button
                  onClick={handleBulkSendAfterLinkGeneration}
                  disabled={isSending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      SMS로 발송하기 ({selectedIds.length}명 × 100원)
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-green-700 bg-green-100/50 rounded p-2">
                💡 복사 후 카톡/문자로 직접 보내도 됩니다.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 space-y-6">
        <h2 className="text-2xl font-bold text-indigo-800 flex items-center gap-3">
          <span className="text-3xl">📝</span>
          메시지 설정 및 발송
        </h2>

        {/* 메시지/링크 탭 선택 */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm font-semibold text-gray-700">발송 방식 선택:</span>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-colors" style={{
              borderColor: sendMode === 'link' ? '#10b981' : '#e5e7eb',
              backgroundColor: sendMode === 'link' ? '#ecfdf5' : '#f9fafb',
            }}>
              <input
                type="radio"
                name="sendMode"
                value="link"
                checked={sendMode === 'link'}
                onChange={(e) => setSendMode(e.target.value as SendMode)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-700">링크만 전송</span>
            </label>
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-colors" style={{
              borderColor: sendMode === 'message' ? '#6366f1' : '#e5e7eb',
              backgroundColor: sendMode === 'message' ? '#eef2ff' : '#f9fafb',
            }}>
              <input
                type="radio"
                name="sendMode"
                value="message"
                checked={sendMode === 'message'}
                onChange={(e) => setSendMode(e.target.value as SendMode)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-700">메시지로 발송</span>
            </label>
          </div>
        </div>

        {/* 권장사항 표시 */}
        {selectedIds.length < 10 && sendMode === 'link' && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              추천: 링크로 보내기가 가장 경제적입니다 (비용 0원)
            </p>
          </div>
        )}

        {selectedIds.length >= 10 && sendMode === 'message' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 text-sm text-yellow-900">
            <p className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {selectedIds.length}명에게 발송 시: 약 {Math.ceil(selectedIds.length / 60)}분 소요, SMS 비용 약 {selectedIds.length * 50}원 예상
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex flex-col">
              <span className="text-gray-700 font-semibold mb-2">사용할 템플릿</span>
              <select
                value={selectedTemplateId ?? ''}
                onChange={(event) => handleTemplateChange(Number(event.target.value))}
                className="px-4 py-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-lg"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title} {template.isDefault ? '(기본)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col">
              <span className="text-gray-700 font-semibold mb-2">발송 채널</span>
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as ChannelOption)}
                className="px-4 py-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-lg"
              >
                <option value="SMS">SMS (알리고)</option>
                <option value="ALIMTALK">알림톡 (카카오)</option>
              </select>
            </label>

            <label className="flex flex-col">
              <span className="text-gray-700 font-semibold mb-2">링크 만료 시간 (시간 단위)</span>
              <input
                type="number"
                min={1}
                max={24 * 14}
                value={expiresInHours}
                onChange={(event) => setExpiresInHours(Math.max(1, Math.min(24 * 14, Number(event.target.value) || 1)))}
                className="px-4 py-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-lg"
              />
              <span className="text-xs text-gray-500 mt-1">최대 14일(336시간)까지 지정 가능합니다.</span>
            </label>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-sm text-indigo-800 leading-relaxed">
              <p className="font-semibold mb-2">사용 가능한 변수</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>{`{고객명}`}</code> – 고객 이름</li>
                <li><code>{`{링크}`}</code> – 여권 제출 링크</li>
                <li><code>{`{상품명}`}</code> – 최근 여행/상품 이름</li>
                <li><code>{`{출발일}`}</code> – 최근 여행 출발일</li>
              </ul>
            </div>
          </div>

          <label className="flex flex-col h-full">
            <span className="text-gray-700 font-semibold mb-2">메시지 내용</span>
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={14}
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-lg leading-relaxed"
              placeholder="고객에게 발송할 안내 메시지를 입력하세요."
            />
            <span className="text-xs text-gray-500 mt-2">링크와 고객 이름이 자동으로 삽입됩니다.</span>
          </label>
        </div>

        {/* SMS 예상 비용 섹션 */}
        {sendMode === 'message' && channel === 'SMS' && (
          <div className={`rounded-2xl p-6 ${estimatedCost.isLowBalance ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📊</span> 예상 비용
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">선택된 고객</p>
                  <p className="text-xl font-bold text-gray-900">{estimatedCost.count}명</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">메시지 길이</p>
                  <p className="text-xl font-bold text-gray-900">
                    {estimatedCost.messageLength} / 90자
                    <span className={`text-sm ml-2 ${estimatedCost.messageLength > 90 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {estimatedCost.messageLength > 90 ? `(LMS: ${Math.ceil(estimatedCost.messageLength / 150)}건 필요)` : '(SMS)'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">메시지당 비용</p>
                  <p className="text-xl font-bold text-blue-600">{estimatedCost.costPerMessage}원</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-sm text-gray-600">총 예상 비용</p>
                  <p className={`text-2xl font-bold ${estimatedCost.isLowBalance ? 'text-red-600' : 'text-blue-600'}`}>
                    {estimatedCost.totalCost.toLocaleString('ko-KR')}원
                  </p>
                </div>
              </div>
            </div>

            {/* 잔액 부족 경고 */}
            {estimatedCost.isLowBalance && aligoStatus && (
              <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  잔액 부족: 현재 {aligoStatus.balance.toLocaleString('ko-KR')}원 / 필요 {estimatedCost.totalCost.toLocaleString('ko-KR')}원
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3 text-gray-700 text-sm leading-relaxed">
            <AlertCircle className="h-6 w-6 text-yellow-500" />
            <p>
              선택된 고객에게는 즉시 여권 제출 링크가 생성되고 SMS 발송 결과가 기록됩니다.
            </p>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-transform hover:scale-[1.02]"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin" /> 발송 준비 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-5 w-5" /> {selectedIds.length}명에게 여권 링크 발송하기
              </span>
            )}
          </button>
        </div>
      </section>

      {lastResult && (
        <section className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 space-y-4">
          <h3 className="text-2xl font-bold text-green-700 flex items-center gap-3">
            <CheckCircle className="h-8 w-8" /> 최신 발송 결과
          </h3>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-900">
              <p className="text-sm font-semibold">발송 채널</p>
              <p className="text-xl font-bold mt-1">{formatChannelLabel(lastResult.channel)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-900">
              <p className="text-sm font-semibold">만료 시간</p>
              <p className="text-xl font-bold mt-1">{lastResult.expiresInHours}시간</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-900">
              <p className="text-sm font-semibold">성공/실패</p>
              <p className="text-xl font-bold mt-1">
                {lastResult.results.filter((item) => item.success).length}명 성공 /{' '}
                {lastResult.results.filter((item) => !item.success).length}명 실패
              </p>
            </div>
          </div>

          {lastResult.missingUserIds.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-yellow-800 text-sm">
              선택한 고객 중 {lastResult.missingUserIds.length}명은 찾을 수 없어 제외되었습니다.
            </div>
          )}
        </section>
      )}

      {/* 수동 링크 생성 모달 */}
      {showManualModal && selectedCustomerForManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">여권 제출 링크 생성</h2>
                <p className="text-sm text-gray-500 mt-1">
                  메시지를 복사해 고객에게 직접 전달하면 제출 현황이 자동으로 갱신됩니다.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowManualModal(false);
                  setSelectedCustomerForManual(null);
                  setManualResult(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3 text-sm text-blue-900">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="font-semibold">복사해서 보내는 방식</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>링크를 생성하면 고객별 제출 페이지가 만들어집니다.</li>
                      <li>완성된 메시지와 링크를 복사해서 카카오톡/문자로 직접 보내주세요.</li>
                      <li>제출이 완료되면 이 화면에 상태가 자동으로 표시됩니다.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">고객 정보</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-semibold text-gray-800">고객명:</span> {selectedCustomerForManual.name ?? '이름 없음'}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-800">전화번호:</span> {selectedCustomerForManual.phone ?? '-'}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-800">이메일:</span> {selectedCustomerForManual.email ?? '-'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">사용할 템플릿</span>
                  <select
                    value={manualTemplateId ?? ''}
                    onChange={(e) => handleManualTemplateChange(Number(e.target.value))}
                    disabled={!templates.length}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title} {template.isDefault ? '(기본)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">링크 만료 시간 (최대 14일)</span>
                  <input
                    type="number"
                    min={1}
                    max={336}
                    value={manualExpiresInHours}
                    onChange={(e) => setManualExpiresInHours(Math.max(1, Math.min(336, Number(e.target.value) || 1)))}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">메시지 기본 내용</label>
                <textarea
                  value={manualMessageBody}
                  onChange={(e) => {
                    setManualMessageBody(e.target.value);
                    setManualResult(null);
                  }}
                  rows={8}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="템플릿 내용을 입력하거나 수정하세요."
                />
                <p className="text-xs text-gray-500">
                  사용 가능한 변수: <code>{'{고객명}'}</code>, <code>{'{링크}'}</code>, <code>{'{상품명}'}</code>,{' '}
                  <code>{'{출발일}'}</code>
                </p>
              </div>

              <button
                onClick={handleGenerateManualLink}
                disabled={isGeneratingManual || !manualMessageBody.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingManual ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    링크 생성하기
                  </>
                )}
              </button>

              {manualResult && (
                <div className="space-y-4 border border-green-200 bg-green-50 rounded-2xl p-4">
                  <div>
                    <p className="text-sm font-semibold text-green-800 mb-2">완성된 메시지</p>
                    <textarea
                      value={manualResult.message}
                      readOnly
                      rows={6}
                      className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-green-900"
                    />
                    <button
                      onClick={() => handleCopy(manualResult.message, '메시지')}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      메시지 복사
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 mb-2">제출 링크</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={manualResult.link}
                        readOnly
                        className="flex-1 rounded-xl border border-green-200 bg-white px-4 py-2 text-sm text-green-900"
                      />
                      <button
                        onClick={() => handleCopy(manualResult.link, '링크')}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        링크 복사
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-green-700">
                      만료 예정: {new Date(manualResult.expiresAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
