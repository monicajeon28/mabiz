'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FiSend, FiClock, FiList, FiMessageSquare, FiMail, FiSmartphone,
  FiUsers, FiSearch, FiPlus, FiEdit, FiTrash2, FiLoader,
  FiCheckCircle, FiAlertCircle, FiFilter, FiDownload, FiSettings,
  FiEye, FiPhone, FiUser, FiBarChart2, FiX, FiArrowLeft, FiUpload,
  FiShare2, FiCopy, FiFolder, FiUserCheck
} from 'react-icons/fi';
import Link from 'next/link';
import { showSuccess, showError, showWarning, showInfo } from '@/components/ui/Toast';
import { FunnelShareModal } from '@/components/partner/FunnelShareModal';
import ImageLibraryModal from '@/components/partner/ImageLibraryModal';
import { isSafeUrl } from '@/lib/utils/url-safety';

// 탭 타입 (SMS, 이메일만)
type TabType = 'instant' | 'scheduled' | 'history';
type SendMethodType = 'sms' | 'email';
type ScheduledSubTabType = 'my' | 'shared'; // 예약발송 서브탭

// 고객 그룹 타입 (6종)
type CustomerCategoryType = 'all' | 'free_trial' | 'purchased' | 'mall' | 'b2b' | 'landing' | 'group';

// 고객 타입
interface Customer {
  id: number;
  leadId?: number;
  name: string | null;
  phone: string | null;
  email?: string | null;
  source: string | null;
  status: string | null;
  groupName?: string | null;
  createdAt: string;
}

// 그룹 타입
interface CustomerGroup {
  id: number;
  name: string;
  color?: string | null;
  count: number; // API에서 count로 반환
}

// 예약 메시지 타입
interface ScheduledMessage {
  id: number;
  title: string;
  sendMethod: string;
  isActive: boolean;
  startDate: string | null;
  startTime: string | null;
  stages: Array<{
    id: number;
    stageNumber: number;
    daysAfter: number;
    sendTime: string | null;
    title: string;
    content: string;
  }>;
  targetGroup?: {
    id: number;
    name: string;
    _count: { members: number };
  } | null;
  createdAt: string;
}

// 발송 내역 타입
interface MessageHistory {
  id: number;
  subject: string;
  content: string;
  type: string;
  recipientCount: number;
  totalRecipients: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

// 공유받은 퍼널 타입
interface SharedFunnel {
  id: number;
  messageType: string;
  title: string;
  category: string | null;
  groupName: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  shareInfo: {
    id: number;
    shareType: string;
    sharedAt: string;
  } | null;
  sharedBy: {
    type: string;
    profileId?: number;
    userId?: number;
    name: string;
    partnerType?: string;
    role?: string;
  } | null;
  owner: {
    type: string;
    profileId?: number;
    userId?: number;
    name: string;
    partnerType?: string;
    role?: string;
  } | null;
  isCloned: boolean;
  stages: Array<{
    id: number;
    stageNumber: number;
    daysAfter: number;
    sendTime: string | null;
    content: string;
    imageUrl: string | null;
    order: number;
  }>;
}

export default function PartnerMessageCenterPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;

  const [activeTab, setActiveTab] = useState<TabType>('instant');
  const [scheduledSubTab, setScheduledSubTab] = useState<ScheduledSubTabType>('my');

  // 공유 관련 상태
  const [sharedFunnels, setSharedFunnels] = useState<SharedFunnel[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFunnelForShare, setSelectedFunnelForShare] = useState<{id: number; title: string} | null>(null);
  const [isCloningFunnel, setIsCloningFunnel] = useState<number | null>(null);
  const [sharedTypeFilter, setSharedTypeFilter] = useState<'all' | 'sms' | 'email'>('all');

  // 즉시 발송 상태
  const [sendMethod, setSendMethod] = useState<SendMethodType>('sms');
  const [customerCategory, setCustomerCategory] = useState<CustomerCategoryType>('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isManager, setIsManager] = useState(false);

  // API 설정 상태
  const [smsConfig, setSmsConfig] = useState<{
    isConfigured: boolean;
    senderPhone: string;
  }>({ isConfigured: false, senderPhone: '' });
  const [emailConfig, setEmailConfig] = useState<{
    isConfigured: boolean;
    senderEmail: string;
  }>({ isConfigured: false, senderEmail: '' });
  const [showSmsConfigModal, setShowSmsConfigModal] = useState(false);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);

  // 고객/그룹 상태
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  // 수동 입력 수신자
  const [manualRecipients, setManualRecipients] = useState<Array<{ name: string; phone: string; email?: string }>>([]);
  const [newManualName, setNewManualName] = useState('');
  const [newManualPhone, setNewManualPhone] = useState('');
  const [newManualEmail, setNewManualEmail] = useState('');

  // 예약 메시지 상태
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  // 발송 내역 상태
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sms' | 'email'>('all');

  // 이메일 추가 옵션
  const [emailImages, setEmailImages] = useState<Array<{ id: string; url: string; name: string }>>([]);
  const [emailButtons, setEmailButtons] = useState<Array<{ id: string; label: string; url: string }>>([]);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  // 템플릿 변수
  const [selectedProduct, setSelectedProduct] = useState('');
  const [products, setProducts] = useState<Array<{ productCode: string; label: string }>>([]);

  // SMS 설정 모달 상태
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsUserId, setSmsUserId] = useState('');
  const [smsSenderPhone, setSmsSenderPhone] = useState('');
  const [smsIpAddress, setSmsIpAddress] = useState('');
  const [isSavingSmsConfig, setIsSavingSmsConfig] = useState(false);

  // 이메일 설정 모달 상태
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderEmail, setEmailSenderEmail] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);

  // SMS 설정 로드
  const loadSmsConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/settings/sms', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.config) {
        setSmsConfig({
          isConfigured: !!(data.config.apiKey && data.config.userId && data.config.senderPhone),
          senderPhone: data.config.senderPhone || '',
        });
        setSmsApiKey(data.config.apiKey || '');
        setSmsUserId(data.config.userId || '');
        setSmsSenderPhone(data.config.senderPhone || '');
        setSmsIpAddress(data.config.ipAddress || '');
      }
    } catch (error) {
      console.error('SMS 설정 로드 실패:', error);
    }
  }, []);

  // 이메일 설정 로드
  const loadEmailConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/settings/email', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.config) {
        setEmailConfig({
          isConfigured: !!data.config.senderEmail,
          senderEmail: data.config.senderEmail || '',
        });
        setEmailSenderName(data.config.senderName || '');
        setEmailSenderEmail(data.config.senderEmail || '');
        setEmailSignature(data.config.signature || '');
      }
    } catch (error) {
      console.error('이메일 설정 로드 실패:', error);
    }
  }, []);

  // 고객 목록 로드
  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams();
      if (customerCategory && customerCategory !== 'all') {
        params.append('category', customerCategory);
      }
      if (selectedGroupId) {
        params.append('groupId', selectedGroupId.toString());
      }
      const url = `/api/partner/message-center/customers${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setCustomers(data.customers || []);
        setIsManager(data.isManager || false);
      }
    } catch (error) {
      console.error('고객 목록 로드 실패:', error);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [customerCategory, selectedGroupId]);

  // 고객 그룹 로드
  const loadCustomerGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/customer-groups', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setCustomerGroups(data.groups || []);
      }
    } catch (error) {
      console.error('고객 그룹 로드 실패:', error);
    }
  }, []);

  // 상품 목록 로드
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/products/active', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        // 상품 목록을 productCode와 label 형식으로 변환
        const formattedProducts = (data.products || []).map((p: any) => ({
          productCode: p.productCode,
          label: `${p.packageName || p.cruiseLine} (${p.productCode})`
        }));
        setProducts(formattedProducts);
      }
    } catch (error) {
      console.error('상품 목록 로드 실패:', error);
    }
  }, []);

  // 예약 메시지 로드
  const loadScheduledMessages = useCallback(async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch('/api/partner/scheduled-messages', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setScheduledMessages(data.messages || []);
      }
    } catch (error) {
      console.error('예약 메시지 로드 실패:', error);
    } finally {
      setIsLoadingScheduled(false);
    }
  }, []);

  // 공유받은 퍼널 로드
  const loadSharedFunnels = useCallback(async () => {
    setIsLoadingShared(true);
    try {
      const params = new URLSearchParams();
      if (sharedTypeFilter !== 'all') {
        params.append('type', sharedTypeFilter);
      }
      const url = `/api/partner/funnel-messages/shared${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setSharedFunnels(data.funnels || []);
      }
    } catch (error) {
      console.error('공유받은 퍼널 로드 실패:', error);
    } finally {
      setIsLoadingShared(false);
    }
  }, [sharedTypeFilter]);

  // 퍼널 복제
  const handleCloneFunnel = async (funnelId: number) => {
    if (!confirm('이 퍼널을 내 퍼널로 복제하시겠습니까?')) return;

    setIsCloningFunnel(funnelId);
    try {
      const res = await fetch(`/api/partner/funnel-messages/${funnelId}/clone`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('퍼널이 복제되었습니다. "내 퍼널" 탭에서 확인하세요.');
        loadSharedFunnels(); // 복제 상태 업데이트
        loadScheduledMessages(); // 내 퍼널 목록 새로고침
      } else {
        showError(data.error || '복제에 실패했습니다.');
      }
    } catch (error) {
      console.error('퍼널 복제 오류:', error);
      showError('복제 중 오류가 발생했습니다.');
    } finally {
      setIsCloningFunnel(null);
    }
  };

  // 공유하기 모달 열기
  const handleOpenShareModal = (funnel: ScheduledMessage) => {
    setSelectedFunnelForShare({ id: funnel.id, title: funnel.title });
    setShareModalOpen(true);
  };

  // 발송 내역 로드
  const loadMessageHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyFilter !== 'all') {
        params.append('type', historyFilter);
      }
      const url = `/api/partner/message-center/history${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setMessageHistory(data.messages || []);
      }
    } catch (error) {
      console.error('발송 내역 로드 실패:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyFilter]);

  // 초기 로드
  useEffect(() => {
    loadSmsConfig();
    loadEmailConfig();
    loadCustomerGroups();
    loadProducts();
    loadCustomers();
  }, [loadSmsConfig, loadEmailConfig, loadCustomerGroups, loadProducts, loadCustomers]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'scheduled') {
      if (scheduledSubTab === 'my') {
        loadScheduledMessages();
      } else {
        loadSharedFunnels();
      }
    } else if (activeTab === 'history') {
      loadMessageHistory();
    }
  }, [activeTab, scheduledSubTab, loadScheduledMessages, loadSharedFunnels, loadMessageHistory]);

  // 공유 필터 변경 시 재로드
  useEffect(() => {
    if (activeTab === 'scheduled' && scheduledSubTab === 'shared') {
      loadSharedFunnels();
    }
  }, [sharedTypeFilter]);

  // 카테고리 또는 그룹 선택 시 고객 재로드
  useEffect(() => {
    loadCustomers();
  }, [customerCategory, selectedGroupId, loadCustomers]);

  // 필터링된 고객 목록
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    return (
      (c.name?.toLowerCase() || '').includes(search) ||
      (c.phone || '').includes(search) ||
      (c.email?.toLowerCase() || '').includes(search)
    );
  });

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers(new Set());
    } else {
      const allIds = new Set(filteredCustomers.map(c => c.id));
      setSelectedCustomers(allIds);
    }
    setSelectAll(!selectAll);
  };

  // 개별 선택
  const handleSelectCustomer = (id: number) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCustomers(newSelected);
    setSelectAll(newSelected.size === filteredCustomers.length && filteredCustomers.length > 0);
  };

  // 수동 수신자 추가
  const handleAddManualRecipient = () => {
    if (sendMethod === 'sms' && (!newManualName.trim() || !newManualPhone.trim())) {
      alert('이름과 전화번호를 모두 입력해주세요.');
      return;
    }
    if (sendMethod === 'email' && (!newManualName.trim() || !newManualEmail.trim())) {
      alert('이름과 이메일을 모두 입력해주세요.');
      return;
    }
    setManualRecipients([...manualRecipients, {
      name: newManualName.trim(),
      phone: newManualPhone.trim(),
      email: newManualEmail.trim(),
    }]);
    setNewManualName('');
    setNewManualPhone('');
    setNewManualEmail('');
  };

  // 수동 수신자 삭제
  const handleRemoveManualRecipient = (index: number) => {
    setManualRecipients(manualRecipients.filter((_, i) => i !== index));
  };

  // 엑셀 양식 다운로드
  const handleDownloadExcelTemplate = () => {
    // CSV 형식의 템플릿 다운로드 (Excel에서 열림)
    const BOM = '\uFEFF'; // UTF-8 BOM for Korean support
    const headers = sendMethod === 'sms' ? '이름,전화번호' : '이름,이메일';
    const example = sendMethod === 'sms' ? '홍길동,01012345678' : '홍길동,example@email.com';
    const csvContent = BOM + headers + '\n' + example + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sendMethod === 'sms' ? '수신자_양식_SMS.csv' : '수신자_양식_이메일.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 엑셀 파일 업로드
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        // 첫 번째 줄은 헤더로 건너뜀
        const dataLines = lines.slice(1);
        const newRecipients: Array<{ name: string; phone: string; email?: string }> = [];

        for (const line of dataLines) {
          const [name, contact] = line.split(',').map(s => s.trim().replace(/"/g, ''));
          if (name && contact) {
            newRecipients.push({
              name,
              phone: sendMethod === 'sms' ? contact : '',
              email: sendMethod === 'email' ? contact : '',
            });
          }
        }

        if (newRecipients.length > 0) {
          setManualRecipients(prev => [...prev, ...newRecipients]);
          alert(`${newRecipients.length}명의 수신자가 추가되었습니다.`);
        } else {
          alert('유효한 수신자가 없습니다. 양식을 확인해주세요.');
        }
      } catch (error) {
        alert('파일 형식이 올바르지 않습니다. CSV 파일을 업로드해주세요.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // Reset input
  };

  // SMS 설정 저장
  const handleSaveSmsConfig = async () => {
    if (!smsApiKey.trim() || !smsUserId.trim() || !smsSenderPhone.trim()) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    setIsSavingSmsConfig(true);
    try {
      const res = await fetch('/api/partner/settings/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'aligo',
          apiKey: smsApiKey,
          userId: smsUserId,
          senderPhone: smsSenderPhone,
          ipAddress: smsIpAddress,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert('SMS 설정이 저장되었습니다.');
        setShowSmsConfigModal(false);
        loadSmsConfig();
      } else {
        alert(data.error || 'SMS 설정 저장에 실패했습니다.');
      }
    } catch (error) {
      alert('SMS 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSmsConfig(false);
    }
  };

  // 이메일 설정 저장
  const handleSaveEmailConfig = async () => {
    if (!emailSenderEmail.trim()) {
      alert('발신자 이메일을 입력해주세요.');
      return;
    }
    setIsSavingEmailConfig(true);
    try {
      const res = await fetch('/api/partner/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          senderName: emailSenderName,
          senderEmail: emailSenderEmail,
          signature: emailSignature,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert('이메일 설정이 저장되었습니다.');
        setShowEmailConfigModal(false);
        loadEmailConfig();
      } else {
        alert(data.error || '이메일 설정 저장에 실패했습니다.');
      }
    } catch (error) {
      alert('이메일 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  // 메시지 변수 치환
  const applyMessageVariables = (text: string, recipient: { name: string; phone?: string }) => {
    const productLabel = products.find(p => p.productCode === selectedProduct)?.label || selectedProduct || '크루즈 상품';
    return text
      .replace(/\{\{이름\}\}/g, recipient.name || '고객님')
      .replace(/\{이름\}/g, recipient.name || '고객님')
      .replace(/\{\{연락처\}\}/g, recipient.phone || '')
      .replace(/\{연락처\}/g, recipient.phone || '')
      .replace(/\{\{상품명\}\}/g, productLabel)
      .replace(/\{상품명\}/g, productLabel);
  };


  // 즉시 발송
  const handleInstantSend = async () => {
    // 설정 확인
    if (sendMethod === 'sms' && !smsConfig.isConfigured) {
      setShowSmsConfigModal(true);
      return;
    }
    if (sendMethod === 'email' && !emailConfig.isConfigured) {
      setShowEmailConfigModal(true);
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    // 총 발송 대상 수 계산
    const totalRecipients = selectedCustomers.size + manualRecipients.length;
    if (totalRecipients === 0) {
      alert('발송 대상을 선택해주세요.');
      return;
    }

    if (!confirm(`총 ${totalRecipients}명에게 ${sendMethod === 'sms' ? '문자' : '이메일'}를 발송하시겠습니까?`)) {
      return;
    }

    setIsSending(true);
    try {
      // 선택된 고객들의 정보 수집
      const selectedRecipients = filteredCustomers
        .filter(c => selectedCustomers.has(c.id))
        .map(c => ({
          name: c.name || '고객',
          phone: c.phone || '',
          email: c.email || '',
          leadId: c.leadId,
        }));

      const allRecipients = [...selectedRecipients, ...manualRecipients];

      const endpoint = sendMethod === 'sms'
        ? '/api/partner/message-center/send-sms'
        : '/api/partner/message-center/send-email';

      const body: any = {
        title,
        content,
        recipients: allRecipients,
        productName: selectedProduct,
      };

      if (sendMethod === 'email') {
        body.images = emailImages.length > 0 ? emailImages : undefined;
        body.buttons = emailButtons.filter(btn => btn.label.trim() && btn.url.trim());
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.ok) {
        alert(`발송 완료! (성공: ${data.successCount || data.sentCount || 1}건)`);
        setTitle('');
        setContent('');
        setSelectedCustomers(new Set());
        setManualRecipients([]);
      } else {
        alert(data.error || data.message || '발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('발송 오류:', error);
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 예약 메시지 삭제
  const handleDeleteScheduled = async (id: number) => {
    if (!confirm('이 예약 메시지를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/partner/scheduled-messages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        alert('삭제되었습니다.');
        loadScheduledMessages();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/partner/${partnerId}`}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <FiMessageSquare />
                  메시지 센터
                </h1>
                <p className="text-slate-300 text-sm mt-1">고객에게 문자/이메일을 발송하고 관리하세요</p>
              </div>
            </div>
            <Link
              href={`/partner/${partnerId}/settings`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiSettings />
              설정
            </Link>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'instant', label: '즉시발송', icon: FiSend },
              { id: 'scheduled', label: '예약발송', icon: FiClock },
              { id: 'history', label: '발송내역', icon: FiList },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-slate-700 text-slate-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 즉시발송 탭 */}
        {activeTab === 'instant' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 왼쪽: 발송 설정 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 발송 방법 선택 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FiSend className="text-slate-600" />
                  발송 방법
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSendMethod('sms')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      sendMethod === 'sms'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FiSmartphone className={`w-8 h-8 mx-auto mb-2 ${sendMethod === 'sms' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <p className="font-semibold">문자 (SMS)</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {smsConfig.isConfigured ? (
                        <span className="text-green-600">✓ 연동됨</span>
                      ) : (
                        <span className="text-yellow-600">설정 필요</span>
                      )}
                    </p>
                  </button>
                  <button
                    onClick={() => setSendMethod('email')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      sendMethod === 'email'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FiMail className={`w-8 h-8 mx-auto mb-2 ${sendMethod === 'email' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className="font-semibold">이메일</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {emailConfig.isConfigured ? (
                        <span className="text-green-600">✓ 연동됨</span>
                      ) : (
                        <span className="text-yellow-600">설정 필요</span>
                      )}
                    </p>
                  </button>
                </div>
              </div>

              {/* 발송 대상 선택 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FiUsers className="text-slate-600" />
                  발송 대상
                </h2>

                {/* 고객 카테고리 선택 (6종) */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { id: 'all', label: '전체 고객', managerOnly: false },
                    { id: 'free_trial', label: '3일무료체험', managerOnly: false },
                    { id: 'purchased', label: '구매고객', managerOnly: false },
                    { id: 'mall', label: '크루즈몰고객', managerOnly: false },
                    { id: 'b2b', label: 'B2B유입', managerOnly: true },
                    { id: 'landing', label: '랜딩유입', managerOnly: true },
                    { id: 'group', label: '그룹선택', managerOnly: false },
                  ]
                    .filter(cat => !cat.managerOnly || isManager) // 대리점장 전용 카테고리 필터
                    .map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setCustomerCategory(cat.id as CustomerCategoryType);
                          setSelectedCustomers(new Set());
                          setSelectAll(false);
                          if (cat.id !== 'group') {
                            setSelectedGroupId(null);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          customerCategory === cat.id
                            ? 'border-slate-600 bg-slate-100 text-slate-800'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                </div>

                {/* 그룹 선택 드롭다운 (그룹선택일 때만) */}
                {customerCategory === 'group' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">고객 그룹 선택</label>
                    <select
                      value={selectedGroupId || ''}
                      onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="">그룹을 선택하세요</option>
                      {customerGroups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.count}명)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 고객 목록 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {selectedCustomers.size > 0 ? `${selectedCustomers.size}명 선택됨` : '전체 선택'}
                      </span>
                    </div>
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="이름, 전화번호 검색"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {isLoadingCustomers ? (
                      <div className="p-8 text-center text-gray-500">
                        <FiLoader className="w-6 h-6 mx-auto animate-spin mb-2" />
                        로딩 중...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        고객이 없습니다.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody>
                          {filteredCustomers.map(customer => (
                            <tr
                              key={customer.id}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedCustomers.has(customer.id)}
                                  onChange={() => handleSelectCustomer(customer.id)}
                                  className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500"
                                />
                              </td>
                              <td className="px-4 py-2 font-medium">{customer.name || '-'}</td>
                              <td className="px-4 py-2 text-gray-600">{customer.phone || '-'}</td>
                              <td className="px-4 py-2 text-gray-600">{customer.email || '-'}</td>
                              <td className="px-4 py-2">
                                {customer.groupName && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                                    {customer.groupName}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* 수동 입력 및 엑셀 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">추가 수신자</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadExcelTemplate}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                      >
                        <FiDownload className="w-3.5 h-3.5" />
                        양식 다운로드
                      </button>
                      <label className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer">
                        <FiUpload className="w-3.5 h-3.5" />
                        엑셀 업로드
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleExcelUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="이름"
                      value={newManualName}
                      onChange={(e) => setNewManualName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {sendMethod === 'sms' ? (
                      <input
                        type="tel"
                        placeholder="전화번호"
                        value={newManualPhone}
                        onChange={(e) => setNewManualPhone(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : (
                      <input
                        type="email"
                        placeholder="이메일"
                        value={newManualEmail}
                        onChange={(e) => setNewManualEmail(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    )}
                    <button
                      onClick={handleAddManualRecipient}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  {manualRecipients.length > 0 && (
                    <div className="space-y-1">
                      {manualRecipients.map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                          <span>{r.name} - {sendMethod === 'sms' ? r.phone : r.email}</span>
                          <button
                            onClick={() => handleRemoveManualRecipient(i)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 메시지 작성 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">메시지 작성</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="메시지 제목을 입력하세요"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="메시지 내용을 입력하세요"
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  {/* 치환 태그 */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">치환 태그 (클릭하여 삽입)</p>
                    <div className="flex flex-wrap gap-2">
                      {['{이름}', '{연락처}', '{상품명}'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => setContent(prev => prev + tag)}
                          className="px-3 py-1 bg-white border border-slate-300 rounded-full text-sm hover:bg-slate-100 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 상품 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택 (선택사항)</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="">상품을 선택하세요</option>
                      {products.map(product => (
                        <option key={product.productCode} value={product.productCode}>
                          {product.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 이메일 전용: 이미지/버튼 */}
                  {sendMethod === 'email' && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          📷 이미지 추가 (선택, 최대 5개)
                        </label>
                        {emailImages.length < 5 && (
                          <button
                            onClick={() => setShowImageLibrary(true)}
                            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <FiPlus size={18} /> 이미지 라이브러리에서 선택
                          </button>
                        )}
                        {emailImages.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {emailImages.map((img) => (
                              <div key={img.id} className="relative group">
                                <img
                                  src={img.url}
                                  alt={img.name}
                                  className="w-20 h-20 object-cover rounded-lg border"
                                />
                                <button
                                  onClick={() => setEmailImages(emailImages.filter(i => i.id !== img.id))}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          버튼 추가 (선택, 최대 3개)
                        </label>
                        {emailButtons.length < 3 && (
                          <button
                            onClick={() => {
                              setEmailButtons([...emailButtons, { id: Date.now().toString(), label: '', url: '' }]);
                            }}
                            className="px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700"
                          >
                            <FiPlus className="inline mr-1" /> 버튼 추가
                          </button>
                        )}
                        {emailButtons.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {emailButtons.map((btn, i) => (
                              <div key={btn.id} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="버튼 텍스트"
                                  value={btn.label}
                                  onChange={(e) => {
                                    const newButtons = [...emailButtons];
                                    newButtons[i].label = e.target.value;
                                    setEmailButtons(newButtons);
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <input
                                  type="url"
                                  placeholder="링크 URL"
                                  value={btn.url}
                                  onChange={(e) => {
                                    const newButtons = [...emailButtons];
                                    newButtons[i].url = e.target.value;
                                    setEmailButtons(newButtons);
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                  onClick={() => setEmailButtons(emailButtons.filter((_, idx) => idx !== i))}
                                  className="text-red-500 hover:text-red-700 p-2"
                                >
                                  <FiX />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽: 미리보기 및 발송 */}
            <div className="space-y-6">
              {/* 미리보기 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-20">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FiEye className="text-slate-600" />
                  미리보기
                </h2>

                <div className={`rounded-lg p-4 ${sendMethod === 'sms' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                  {sendMethod === 'sms' ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <FiSmartphone className="text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800">문자 메시지</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-emerald-200">
                        <p className="text-sm font-semibold mb-1">{title || '제목을 입력하세요'}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {applyMessageVariables(content || '내용을 입력하세요', { name: '홍길동', phone: '01012345678' })}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <FiMail className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">이메일</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <p className="text-sm font-semibold mb-1">{title || '제목을 입력하세요'}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {applyMessageVariables(content || '내용을 입력하세요', { name: '홍길동' })}
                        </p>
                        {emailImages.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {emailImages.map((img) => (
                              <img
                                key={img.id}
                                src={img.url}
                                alt={img.name}
                                className="w-full max-h-32 object-contain rounded-lg border"
                              />
                            ))}
                          </div>
                        )}
                        {emailButtons.filter(b => b.label && b.url).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {emailButtons.filter(b => b.label && b.url).map(btn => (
                              <a
                                key={btn.id}
                                href={isSafeUrl(btn.url) ? btn.url : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                onClick={(e) => {
                                  if (!isSafeUrl(btn.url)) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                {btn.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 발송 요약 */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">발송 요약</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>• 고객 선택: {selectedCustomers.size}명</p>
                    <p>• 수동 입력: {manualRecipients.length}명</p>
                    <p className="font-semibold text-gray-900">
                      총 {selectedCustomers.size + manualRecipients.length}명에게 발송
                    </p>
                  </div>
                </div>

                {/* 발송 버튼 */}
                <button
                  onClick={handleInstantSend}
                  disabled={isSending}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold rounded-xl hover:from-slate-800 hover:to-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <FiLoader className="animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      <FiSend />
                      메시지 발송
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 예약발송 탭 */}
        {activeTab === 'scheduled' && (
          <div className="space-y-6">
            {/* 서브탭 네비게이션 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
              <div className="flex gap-1">
                <button
                  onClick={() => setScheduledSubTab('my')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                    scheduledSubTab === 'my'
                      ? 'bg-slate-700 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FiFolder className="w-4 h-4" />
                  내 퍼널
                  {scheduledMessages.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      scheduledSubTab === 'my' ? 'bg-white/20' : 'bg-gray-200'
                    }`}>
                      {scheduledMessages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setScheduledSubTab('shared')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                    scheduledSubTab === 'shared'
                      ? 'bg-slate-700 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FiShare2 className="w-4 h-4" />
                  공유 라이브러리
                  {sharedFunnels.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      scheduledSubTab === 'shared' ? 'bg-white/20' : 'bg-gray-200'
                    }`}>
                      {sharedFunnels.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 내 퍼널 서브탭 */}
            {scheduledSubTab === 'my' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">내 퍼널 메시지</h2>
                  <div className="flex gap-2">
                    <Link
                      href={`/partner/${partnerId}/message-center/scheduled/new/sms`}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                      <FiSmartphone className="w-4 h-4" />
                      퍼널문자 만들기
                    </Link>
                    <Link
                      href={`/partner/${partnerId}/message-center/scheduled/new/email`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <FiMail className="w-4 h-4" />
                      퍼널이메일 만들기
                    </Link>
                  </div>
                </div>

                {isLoadingScheduled ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FiLoader className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-2" />
                    <p className="text-gray-500">로딩 중...</p>
                  </div>
                ) : scheduledMessages.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FiClock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">등록된 퍼널 메시지가 없습니다.</p>
                    <div className="flex gap-3 justify-center">
                      <Link
                        href={`/partner/${partnerId}/message-center/scheduled/new/sms`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        <FiSmartphone className="w-4 h-4" />
                        퍼널문자 만들기
                      </Link>
                      <Link
                        href={`/partner/${partnerId}/message-center/scheduled/new/email`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <FiMail className="w-4 h-4" />
                        퍼널이메일 만들기
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {scheduledMessages.map(msg => (
                      <div
                        key={msg.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-gray-900">{msg.title}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                msg.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {msg.isActive ? '활성' : '비활성'}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                msg.sendMethod === 'sms'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {msg.sendMethod === 'sms' ? 'SMS' : '이메일'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {msg.stages.length}단계 |
                              {msg.targetGroup ? ` 대상: ${msg.targetGroup.name} (${msg.targetGroup._count.members}명)` : ' 대상 미지정'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.stages.slice(0, 3).map(stage => (
                                <span key={stage.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                  D+{stage.daysAfter}: {stage.title.substring(0, 20)}...
                                </span>
                              ))}
                              {msg.stages.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                  +{msg.stages.length - 3}개 더
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenShareModal(msg)}
                              className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                              title="공유하기"
                            >
                              <FiShare2 />
                            </button>
                            <Link
                              href={`/partner/${partnerId}/message-center/scheduled/${msg.id}`}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                              <FiEdit />
                            </Link>
                            <button
                              onClick={() => handleDeleteScheduled(msg.id)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 공유 라이브러리 서브탭 */}
            {scheduledSubTab === 'shared' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">공유받은 퍼널</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={sharedTypeFilter}
                      onChange={(e) => setSharedTypeFilter(e.target.value as 'all' | 'sms' | 'email')}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="all">전체</option>
                      <option value="sms">SMS</option>
                      <option value="email">이메일</option>
                    </select>
                  </div>
                </div>

                {isLoadingShared ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FiLoader className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-2" />
                    <p className="text-gray-500">로딩 중...</p>
                  </div>
                ) : sharedFunnels.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FiShare2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-2">공유받은 퍼널이 없습니다.</p>
                    <p className="text-sm text-gray-400">다른 파트너나 관리자가 공유한 퍼널이 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {sharedFunnels.map(funnel => (
                      <div
                        key={funnel.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-gray-900">{funnel.title}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                funnel.messageType === 'sms'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {funnel.messageType === 'sms' ? 'SMS' : '이메일'}
                              </span>
                              {funnel.isCloned && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                                  복제됨
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {funnel.stages.length}단계 | {funnel.description || '설명 없음'}
                            </p>

                            {/* 공유자 정보 */}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {funnel.sharedBy && (
                                <span className="flex items-center gap-1">
                                  <FiUserCheck className="w-3.5 h-3.5" />
                                  공유: {funnel.sharedBy.name}
                                  {funnel.sharedBy.type === 'admin' && ' (관리자)'}
                                </span>
                              )}
                              {funnel.shareInfo && (
                                <span>
                                  {new Date(funnel.shareInfo.sharedAt).toLocaleDateString('ko-KR')}
                                </span>
                              )}
                              {funnel.shareInfo?.shareType && (
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                                  {funnel.shareInfo.shareType === 'ALL' ? '전체 공유' :
                                   funnel.shareInfo.shareType === 'BRANCH_MANAGER' ? '대리점장 공유' :
                                   funnel.shareInfo.shareType === 'SALES_AGENT' ? '판매원 공유' : '개별 공유'}
                                </span>
                              )}
                            </div>

                            {/* 스테이지 미리보기 */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {funnel.stages.slice(0, 3).map(stage => (
                                <span key={stage.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                  D+{stage.daysAfter}: {stage.content.substring(0, 20)}...
                                </span>
                              ))}
                              {funnel.stages.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                  +{funnel.stages.length - 3}개 더
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {!funnel.isCloned ? (
                              <button
                                onClick={() => handleCloneFunnel(funnel.id)}
                                disabled={isCloningFunnel === funnel.id}
                                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {isCloningFunnel === funnel.id ? (
                                  <>
                                    <FiLoader className="w-4 h-4 animate-spin" />
                                    복제 중...
                                  </>
                                ) : (
                                  <>
                                    <FiCopy className="w-4 h-4" />
                                    내 퍼널로 복제
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="px-4 py-2 text-gray-500 text-sm">
                                이미 복제됨
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 발송내역 탭 */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">발송 내역</h2>
              <div className="flex items-center gap-2">
                <select
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value as 'all' | 'sms' | 'email')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">전체</option>
                  <option value="sms">SMS</option>
                  <option value="email">이메일</option>
                </select>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FiLoader className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-2" />
                <p className="text-gray-500">로딩 중...</p>
              </div>
            ) : messageHistory.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FiList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">발송 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">발송일시</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유형</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">발송</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {messageHistory.map(msg => (
                      <tr key={msg.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(msg.sentAt || msg.createdAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            msg.type === 'SMS'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {msg.type === 'SMS' ? 'SMS' : '이메일'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {msg.subject || msg.content?.substring(0, 30) || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {msg.recipientCount || msg.totalRecipients}건
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SMS 설정 모달 */}
      {showSmsConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">SMS 발송 설정</h3>
                <button
                  onClick={() => setShowSmsConfigModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <FiX />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">알리고 API를 연동하여 문자를 발송하세요.</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 설정 가이드 */}
              <details className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <summary className="font-semibold text-blue-900 cursor-pointer flex items-center gap-2">
                  <span className="text-lg">📖</span> 알리고 API 설정 가이드 (클릭하여 펼치기)
                </summary>
                <div className="mt-4 space-y-4 text-sm text-gray-700">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">1단계: 알리고 회원가입</h4>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li><a href="https://smartsms.aligo.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">알리고 홈페이지</a> 접속</li>
                      <li>우측 상단 &quot;회원가입&quot; 클릭</li>
                      <li>사업자 정보 입력 후 가입 완료</li>
                    </ol>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">2단계: API Key 발급</h4>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li>로그인 후 &quot;문자보내기&quot; → &quot;API 연동&quot;</li>
                      <li>&quot;API Key 발급/관리&quot; 메뉴 클릭</li>
                      <li>API Key 생성 후 복사</li>
                      <li>User ID는 알리고 로그인 아이디입니다</li>
                    </ol>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">3단계: 발신번호 등록</h4>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li>&quot;발신번호 관리&quot; 메뉴 접속</li>
                      <li>휴대폰 또는 사업자 전화번호 등록</li>
                      <li>인증 절차 완료 (문자 인증 또는 서류 제출)</li>
                      <li>승인 완료 후 발신번호로 사용 가능</li>
                    </ol>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="font-bold text-amber-800 mb-2">⚠️ 발송 서버 IP 등록 (필수)</h4>
                    <p className="text-amber-700 mb-2">
                      알리고는 등록된 IP에서만 API 호출이 가능합니다.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-amber-700">
                      <li>로그인 후 &quot;문자API&quot; → &quot;인증정보&quot; 메뉴 접속</li>
                      <li>&quot;발송서버 IP&quot; 항목에 아래 IP 등록</li>
                    </ol>
                    <div className="mt-3 p-3 bg-white rounded border-2 border-amber-400">
                      <p className="text-xs text-amber-600 mb-1">크루즈가이드 서버 IP (복사해서 등록)</p>
                      <p className="text-lg font-bold text-gray-900 font-mono select-all">125.132.80.142</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <h4 className="font-bold text-emerald-800 mb-2">💰 요금 안내</h4>
                    <ul className="list-disc list-inside space-y-1 text-emerald-700">
                      <li>SMS (단문 90자): 약 16원/건</li>
                      <li>LMS (장문 2,000자): 약 50원/건</li>
                      <li>선불 충전 방식 (최소 1만원)</li>
                    </ul>
                  </div>
                </div>
              </details>

              {/* 입력 필드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  placeholder="알리고에서 발급받은 API Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={smsUserId}
                  onChange={(e) => setSmsUserId(e.target.value)}
                  placeholder="알리고 로그인 아이디"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발신번호 <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={smsSenderPhone}
                  onChange={(e) => setSmsSenderPhone(e.target.value)}
                  placeholder="01012345678 (하이픈 없이)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
                <p className="text-xs text-gray-500 mt-1">알리고에 등록된 발신번호만 사용 가능</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowSmsConfigModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveSmsConfig}
                disabled={isSavingSmsConfig}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {isSavingSmsConfig ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이메일 설정 모달 */}
      {showEmailConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">이메일 발송 설정</h3>
                <button
                  onClick={() => setShowEmailConfigModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <FiX />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">발신자 정보를 설정하세요.</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 설정 가이드 */}
              <details className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                <summary className="font-semibold text-emerald-900 cursor-pointer flex items-center gap-2">
                  <span className="text-lg">📖</span> 이메일 발송 안내 (클릭하여 펼치기)
                </summary>
                <div className="mt-4 space-y-4 text-sm text-gray-700">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">이메일 발송 방식</h4>
                    <p className="text-gray-600">
                      이메일은 <strong>크루즈가이드 시스템</strong>을 통해 발송됩니다.
                      별도의 SMTP 설정 없이 바로 사용할 수 있습니다.
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">발신자 정보란?</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                      <li><strong>발신자 이름</strong>: 수신자에게 보이는 이름 (예: 홍길동)</li>
                      <li><strong>발신자 이메일</strong>: 회신(답장) 받을 이메일 주소</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-2">💡 수신자가 보는 화면</h4>
                    <div className="bg-white rounded p-3 font-mono text-xs">
                      <p><span className="text-gray-500">보낸사람:</span> <span className="text-gray-900">홍길동</span> &lt;your@email.com&gt;</p>
                      <p><span className="text-gray-500">제목:</span> <span className="text-gray-900">크루즈 여행 안내</span></p>
                    </div>
                    <p className="text-blue-700 text-xs mt-2">
                      수신자가 &quot;답장&quot;을 클릭하면 발신자 이메일로 회신됩니다.
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="font-bold text-amber-800 mb-2">⚠️ 주의사항</h4>
                    <ul className="list-disc list-inside space-y-1 text-amber-700">
                      <li>실제 사용하는 이메일 주소를 입력해주세요</li>
                      <li>고객 회신을 받으려면 정확한 이메일 필수</li>
                      <li>스팸 방지를 위해 과도한 발송은 자제해주세요</li>
                    </ul>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <h4 className="font-bold text-emerald-800 mb-2">💰 요금 안내</h4>
                    <p className="text-emerald-700">
                      이메일 발송은 <strong>무료</strong>입니다.
                      (크루즈가이드 시스템 포함 서비스)
                    </p>
                  </div>
                </div>
              </details>

              {/* 입력 필드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발신자 이름</label>
                <input
                  type="text"
                  value={emailSenderName}
                  onChange={(e) => setEmailSenderName(e.target.value)}
                  placeholder="홍길동 또는 회사명"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
                <p className="text-xs text-gray-500 mt-1">수신자에게 보이는 발신자 이름</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발신자 이메일 (회신용) <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={emailSenderEmail}
                  onChange={(e) => setEmailSenderEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
                <p className="text-xs text-gray-500 mt-1">고객이 답장하면 이 이메일로 수신됩니다</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 서명 (선택)</label>
                <textarea
                  value={emailSignature}
                  onChange={(e) => setEmailSignature(e.target.value)}
                  placeholder="이메일 하단에 추가될 서명&#10;예: 담당자 홍길동 | 010-1234-5678"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 resize-none"
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  이메일 하단에 크루즈닷 회사 정보가 자동으로 추가됩니다.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEmailConfigModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveEmailConfig}
                disabled={isSavingEmailConfig}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {isSavingEmailConfig ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 퍼널 공유 모달 */}
      {selectedFunnelForShare && (
        <FunnelShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedFunnelForShare(null);
          }}
          funnelId={selectedFunnelForShare.id}
          funnelTitle={selectedFunnelForShare.title}
          onShareSuccess={() => {
            loadScheduledMessages();
          }}
        />
      )}

      {/* 이미지 라이브러리 모달 */}
      <ImageLibraryModal
        isOpen={showImageLibrary}
        onClose={() => setShowImageLibrary(false)}
        onSelect={(imageUrl) => {
          if (emailImages.length < 5) {
            setEmailImages([...emailImages, {
              id: Date.now().toString(),
              url: imageUrl,
              name: '이미지'
            }]);
          }
          setShowImageLibrary(false);
        }}
      />
    </div>
  );
}
