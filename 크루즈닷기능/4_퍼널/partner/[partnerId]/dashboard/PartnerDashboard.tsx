'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ContractInviteModal from '@/components/admin/ContractInviteModal';
import {
  FiSend,
  FiEye,
  FiEyeOff,
  FiTrendingUp,
  FiUsers,
  FiLink,
  FiShoppingCart,
  FiRefreshCw,
  FiArrowRight,
  FiUser,
  FiBriefcase,
  FiMessageSquare,
  FiClock,
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiTrash2,
  FiSearch,
  FiX,
  FiExternalLink,
  FiDollarSign,
  FiLayers,
  FiPlus,
  FiCalendar,
  FiPhone,
  FiGlobe,
  FiImage,
  FiMail,
  FiSettings,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import CompressorModal from '@/components/common/CompressorModal';
import SalesConfirmationModal from '@/components/affiliate/SalesConfirmationModal';
import { leadStatusOptions } from '@/app/api/partner/constants';
import { getAffiliateTerm, getProxyImageUrl } from '@/lib/utils';
import NotificationBell from '@/components/admin/NotificationBell';
import { canUseFeatureClient, getFeatureRestrictionMessageClient } from '@/lib/subscription-limits-client';

type PartnerDashboardProps = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: any;
  trialInfo?: {
    trialEndDate: string | null;
    daysRemaining: number | null;
  } | null;
};

interface DashboardStats {
  totalLinks: number;
  totalLeads: number;
  totalSales: number;
  teamMembers: number;
  recentLeads: Array<{
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    status: string;
    createdAt: string;
  }>;
  recentSales: Array<{
    id: number;
    saleAmount: number;
    status: string;
    saleDate: string | null;
    createdAt: string;
  }>;
  monthlySales: Array<{
    date: string | null;
    count: number;
    totalAmount: number;
  }>;
  currentMonth?: string;
  selectedMonth?: string;
}

export default function PartnerDashboard({ user, profile, trialInfo }: PartnerDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const affiliateTerm = getAffiliateTerm(pathname || undefined);
  const [showContractInviteModal, setShowContractInviteModal] = useState(false);
  const [showContractTypeModal, setShowContractTypeModal] = useState(false);
  const [selectedContractType, setSelectedContractType] = useState<string>('SALES_AGENT');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [mallFullUrl, setMallFullUrl] = useState<string>('');
  // 월별 필터링 상태 (YYYY-MM 형식)
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [showCompressorModal, setShowCompressorModal] = useState(false);

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);
  const [showCustomerRegisterModal, setShowCustomerRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    customerName: '',
    customerPhone: '',
    productCode: '',
    isCompanion: false,
    mainCustomerPhone: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoadingProductCode, setIsLoadingProductCode] = useState(false);
  // 자동완성 상태
  const [customerNameSuggestions, setCustomerNameSuggestions] = useState<Array<{ id: number; name: string; phone: string; displayName: string }>>([]);
  const [customerPhoneSuggestions, setCustomerPhoneSuggestions] = useState<Array<{ id: number; name: string; phone: string; displayName: string }>>([]);
  const [mainCustomerPhoneSuggestions, setMainCustomerPhoneSuggestions] = useState<Array<{ id: number; name: string; phone: string; displayName: string }>>([]);
  const [showCustomerNameSuggestions, setShowCustomerNameSuggestions] = useState(false);
  const [showCustomerPhoneSuggestions, setShowCustomerPhoneSuggestions] = useState(false);
  const [showMainCustomerPhoneSuggestions, setShowMainCustomerPhoneSuggestions] = useState(false);
  const customerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contracts, setContracts] = useState<Array<{
    id: number;
    name: string;
    phone: string;
    email: string | null;
    status: string;
    submittedAt: string | null;
    completedAt: string | null;
    mentor?: {
      id: number;
      displayName: string | null;
      affiliateCode: string;
      branchLabel: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
    } | null;
  }>>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [completingContractId, setCompletingContractId] = useState<number | null>(null);
  const [sendingPdfContractId, setSendingPdfContractId] = useState<number | null>(null);
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'submitted' | 'completed' | 'rejected'>('all');

  // 판매원별 DB 현황
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
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [showContractDetail, setShowContractDetail] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<number | null>(null);
  const [showSendContractModal, setShowSendContractModal] = useState(false);
  const [contractType, setContractType] = useState<string>('SALES_AGENT');
  const [myContract, setMyContract] = useState<any | null>(null);
  const [loadingMyContract, setLoadingMyContract] = useState(false);
  const [completedAgentContracts, setCompletedAgentContracts] = useState<Array<{
    id: number;
    name: string;
    phone: string;
    email: string | null;
    status: string;
    submittedAt: string | null;
    completedAt: string | null;
    accountInfo?: any;
    user?: any;
  }>>([]);
  // 계약서 열람 확인 추적 (계약서 ID Set)
  const [viewedContractIds, setViewedContractIds] = useState<Set<number>>(new Set());
  const [showEducationContractModal, setShowEducationContractModal] = useState(false);
  const [educationContractType, setEducationContractType] = useState<string>('SALES_AGENT');
  const [mySales, setMySales] = useState<Array<{
    id: number;
    productCode: string | null;
    saleAmount: number;
    status: string;
    audioFileGoogleDriveUrl: string | null;
    saleDate: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
  }>>([]);
  const [loadingMySales, setLoadingMySales] = useState(false);

  // 팀원 판매 현황 (대리점장용)
  const [teamSales, setTeamSales] = useState<Array<{
    id: number;
    productCode: string | null;
    saleAmount: number;
    status: string;
    saleDate: string | null;
    agentName: string | null;
    agentId: number | null;
    customerName: string | null;
    branchCommission: number;
    salesCommission: number;
    overrideCommission: number;
  }>>([]);
  const [loadingTeamSales, setLoadingTeamSales] = useState(false);
  const [showSalesConfirmationModal, setShowSalesConfirmationModal] = useState(false);
  const [selectedSaleForConfirmation, setSelectedSaleForConfirmation] = useState<{
    id: number;
    productCode: string | null;
    saleAmount: number;
    status: string;
    audioFileGoogleDriveUrl: string | null;
    saleDate: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
  } | null>(null);

  // 고객 탭 상태 (전체 고객 / 전화상담고객)
  const [customerTab, setCustomerTab] = useState<'all' | 'inquiries'>('all');

  // 구매고객관리 상태
  const [purchasedReservations, setPurchasedReservations] = useState<Array<{
    id: number;
    totalPeople: number;
    pnrStatus: string;
    createdAt: string;
    user: {
      id: number;
      name: string | null;
      phone: string | null;
      email: string | null;
    };
    trip: {
      id: number;
      departureDate: string | null;
      product: {
        cruiseLine: string | null;
        shipName: string | null;
        packageName: string | null;
      } | null;
    } | null;
  }>>([]);
  const [loadingPurchasedReservations, setLoadingPurchasedReservations] = useState(false);
  const [purchasedSearchTerm, setPurchasedSearchTerm] = useState('');
  const [selectedPurchasedReservation, setSelectedPurchasedReservation] = useState<any | null>(null);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [passportMessage, setPassportMessage] = useState('');
  const [passportPhone, setPassportPhone] = useState('');
  const [sendingPassport, setSendingPassport] = useState(false);
  const [passportPreviewDevice, setPassportPreviewDevice] = useState<'iphone' | 'samsung' | null>(null);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [chatbotLink, setChatbotLink] = useState('');
  const [chatbotMessage, setChatbotMessage] = useState('');
  const [sendingChatbot, setSendingChatbot] = useState(false);
  const [showPurchasedDetailModal, setShowPurchasedDetailModal] = useState(false);
  const [purchasedReservationDetail, setPurchasedReservationDetail] = useState<any>(null);
  const [loadingPurchasedDetail, setLoadingPurchasedDetail] = useState(false);
  const [inquiryCustomers, setInquiryCustomers] = useState<Array<{
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    status: string;
    createdAt: string;
    productCode?: string | null;
    productName?: string | null;
  }>>([]);
  const [loadingInquiryCustomers, setLoadingInquiryCustomers] = useState(false);

  // 관리자가 생성한 공통 상품 링크
  const [commonProductLinks, setCommonProductLinks] = useState<Array<{
    id: number;
    code: string;
    title: string | null;
    productCode: string | null;
    url: string;
    product: {
      id: number;
      productCode: string;
      title: string;
    } | null;
  }>>([]);
  const [loadingCommonLinks, setLoadingCommonLinks] = useState(false);

  // 랜딩페이지 목록
  const [recentLandingPages, setRecentLandingPages] = useState<Array<{
    id: number;
    title: string;
    category: string | null;
    viewCount: number;
    slug: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [loadingLandingPages, setLoadingLandingPages] = useState(false);

  // 정액제 구독 정보
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    isTrial: boolean;
    status: 'trial' | 'active' | 'expired' | 'cancelled';
    trialEndDate?: string;
    endDate?: string;
  } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFeatureRestrictionModal, setShowFeatureRestrictionModal] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState<string>('');
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<(() => void) | null>(null);
  const [paymentForm, setPaymentForm] = useState({ name: '', phone: '' });

  // 실시간 카운트다운 상태
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // PWA 설치 상태
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // 계약서 타입 목록 (API에서 동적으로 로드)
  const [availableContractTypes, setAvailableContractTypes] = useState<Array<{
    code: string;
    title: string;
    price?: string;
    icon: string;
    description?: string;
    isCustom: boolean;
    isDefault: boolean;
  }>>([]);
  const [loadingContractTypes, setLoadingContractTypes] = useState(false);

  // 프로필 타입 확인 (useEffect보다 먼저 선언)
  const isBranchManager = profile?.type === 'BRANCH_MANAGER';
  const isSalesAgent = profile?.type === 'SALES_AGENT';

  // 정액제 구독 정보 로드 및 결제 완료 확인
  const loadSubscriptionInfo = useCallback(async (showSuccessMessage = false) => {
    try {
      const res = await fetch('/api/partner/subscription/check', {
        credentials: 'include',
        cache: 'no-store', // 항상 최신 정보 가져오기
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.subscription) {
          const newSubscriptionInfo = {
            isTrial: json.subscription.isTrial || false,
            status: json.subscription.status || 'expired',
            trialEndDate: json.subscription.trialEndDate,
            endDate: json.subscription.endDate,
          };
          setSubscriptionInfo(newSubscriptionInfo);

          // 결제 완료 후 성공 메시지 표시
          if (showSuccessMessage && newSubscriptionInfo.status === 'active' && !newSubscriptionInfo.isTrial) {
            showSuccess('시스템 이용이 활성화되었습니다! 이제 더 많은 기능을 사용할 수 있습니다.');
          }

          // 정액제 판매원인 경우 튜토리얼 자동 표시 (첫 로그인 시에만)
          if (newSubscriptionInfo.status === 'active' || newSubscriptionInfo.isTrial) {
            const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${user.id}`);
            if (!hasSeenTutorial) {
              setShowTutorial(true);
            }
          }
        } else {
          setSubscriptionInfo(null);
        }
      }
    } catch (error) {
      logger.error('[PartnerDashboard] Failed to load subscription info:', error);
      setSubscriptionInfo(null);
    }
  }, [user.id]);

  useEffect(() => {
    // 결제 완료 확인 (URL 파라미터)
    const paymentSuccess = searchParams?.get('payment');
    if (paymentSuccess === 'success') {
      // URL에서 파라미터 제거
      router.replace(pathname || '', { scroll: false });
      // 구독 정보 재로드 (성공 메시지와 함께)
      loadSubscriptionInfo(true);
    } else {
      // 일반 로드
      loadSubscriptionInfo(false);
    }
  }, [searchParams, router, pathname, loadSubscriptionInfo]);

  // 결제 시작 함수
  const handleInitiatePayment = useCallback(() => {
    // 이름과 연락처 초기화 (사용자 정보로)
    setPaymentForm({
      name: user.name || '',
      phone: user.phone || '',
    });
    setPendingPaymentAction(async () => {
      try {
        const res = await fetch('/api/partner/subscription/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: paymentForm.name.trim(),
            phone: paymentForm.phone.trim().replace(/[^0-9]/g, ''),
          }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.payurl) {
          window.location.href = data.payurl;
        } else {
          showError(data.message || '결제 요청에 실패했습니다.');
        }
      } catch (error) {
        logger.error('[Subscription Payment] Error:', error);
        showError('결제 요청 중 오류가 발생했습니다.');
      }
    });
    setShowPaymentConfirmModal(true);
  }, [user.name, user.phone, paymentForm]);

  // 실시간 카운트다운 업데이트 및 무료 체험 종료 시 결제 모달 표시
  useEffect(() => {
    if (!subscriptionInfo) {
      setCountdown(null);
      return;
    }

    // 무료 체험 중이면 trialEndDate 사용, 아니면 endDate 사용
    const targetDate = subscriptionInfo.isTrial && subscriptionInfo.trialEndDate
      ? new Date(subscriptionInfo.trialEndDate)
      : subscriptionInfo.endDate
        ? new Date(subscriptionInfo.endDate)
        : null;

    if (!targetDate) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });

        // 무료 체험 종료 시 자동으로 결제 모달 표시
        if (subscriptionInfo.isTrial && subscriptionInfo.status === 'trial') {
          // 이미 결제 모달이 표시되지 않은 경우에만 표시
          if (!showPaymentConfirmModal && !showFeatureRestrictionModal) {
            handleInitiatePayment();
          }
        }
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    // 즉시 한 번 실행
    updateCountdown();

    // 1초마다 업데이트
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [subscriptionInfo, showPaymentConfirmModal, showFeatureRestrictionModal, handleInitiatePayment]);

  useEffect(() => {
    if (user.mallUserId && typeof window !== 'undefined') {
      setMallFullUrl(`${window.location.protocol}//${window.location.host}/${user.mallUserId}/shop`);
    }
  }, [user.mallUserId]);

  // PWA 설치 프롬프트 이벤트 핸들러
  useEffect(() => {
    // 이미 앱으로 실행 중인지 확인
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
      showSuccess('앱이 설치되었습니다! 홈화면에서 바로 접속하세요.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const loadLandingPages = useCallback(async () => {
    try {
      setLoadingLandingPages(true);
      const res = await fetch('/api/partner/landing-pages', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          // 최근 5개만 표시
          const allPages = [...(json.ownedPages || []), ...(json.sharedPages || [])];
          setRecentLandingPages(allPages.slice(0, 5));
        }
      }
    } catch (error) {
      logger.error('[Partner Dashboard] Failed to load landing pages:', error);
    } finally {
      setLoadingLandingPages(false);
    }
  }, []);

  // 랜딩페이지 목록 로드 (대리점장만)
  useEffect(() => {
    if (isBranchManager) {
      loadLandingPages();
    }
  }, [isBranchManager, loadLandingPages]);

  // 계약서 타입 목록 로드 (대리점장만)
  const loadContractTypes = useCallback(async () => {
    if (!isBranchManager) return;
    try {
      setLoadingContractTypes(true);
      const res = await fetch('/api/public/contract-types');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.contractTypes) {
          // AFFILIATE 계약서는 제외 (공통 계약서이므로)
          const filteredTypes = json.contractTypes.filter((ct: any) => ct.code !== 'AFFILIATE');
          setAvailableContractTypes(filteredTypes);
        }
      }
    } catch (error) {
      logger.error('[Partner Dashboard] Failed to load contract types:', error);
    } finally {
      setLoadingContractTypes(false);
    }
  }, [isBranchManager]);

  useEffect(() => {
    if (isBranchManager) {
      loadContractTypes();
    }
  }, [isBranchManager, loadContractTypes]);

  // 관리자가 생성한 공통 상품 링크 로드
  useEffect(() => {
    const loadCommonLinks = async () => {
      try {
        setLoadingCommonLinks(true);
        const res = await fetch('/api/partner/links?status=ACTIVE');
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.links) {
            // 공통 링크만 필터링 (isCommonLink가 true인 링크)
            const commonLinks = json.links
              .filter((link: any) => link.isCommonLink && link.productCode && link.status === 'ACTIVE')
              .map((link: any) => ({
                id: link.id,
                code: link.code,
                title: link.title,
                productCode: link.productCode,
                url: typeof window !== 'undefined'
                  ? `${window.location.origin}${link.url}`
                  : link.url,
                product: link.product,
              }));
            setCommonProductLinks(commonLinks);
          }
        }
      } catch (error) {
        logger.error('[Partner Dashboard] Failed to load common links:', error);
      } finally {
        setLoadingCommonLinks(false);
      }
    };

    loadCommonLinks();
  }, []);
  // 정액제 판매원 확인
  const isSubscriptionAgent = subscriptionInfo !== null;
  const roleLabel = isSubscriptionAgent ? '시스템 이용자' : (isBranchManager ? '대리점장' : isSalesAgent ? '판매원' : '파트너');
  const roleColor = isSubscriptionAgent
    ? 'from-yellow-500 via-yellow-400 to-yellow-600'
    : (isBranchManager ? 'from-purple-600 via-indigo-600 to-blue-600' : 'from-blue-600 via-cyan-600 to-teal-600');
  const roleIcon = isSubscriptionAgent ? <FiUser className="text-2xl" /> : (isBranchManager ? <FiBriefcase className="text-2xl" /> : <FiUser className="text-2xl" />);

  const partnerId = user.phone || user.mallUserId;
  const isBossId = partnerId?.startsWith('boss');

  // 이미지 URL 추출 헬퍼 함수
  const extractImageUrl = (image: any): string | null => {
    if (!image) return null;
    let url = '';
    if (typeof image === 'string') url = image;
    else if (typeof image === 'object') {
      // 객체인 경우 url 필드나 id 필드 확인
      if (image.url) url = String(image.url);
      else if (image.id) {
        // Google Drive ID인 경우 URL 생성
        url = `https://drive.google.com/uc?export=view&id=${String(image.id)}`;
      }
    }

    // getProxyImageUrl을 사용하여 공용 프록시 URL로 변환
    return getProxyImageUrl(url);
  };

  // 완전히 직렬화 가능한 객체로 변환
  const partnerContext = {
    mallUserId: String(user.mallUserId || ''),
    profileTitle: profile?.profileTitle
      ? String(profile.profileTitle)
      : user.mallNickname
        ? String(user.mallNickname)
        : profile?.displayName
          ? String(profile.displayName)
          : `파트너 ${user.mallUserId}`,
    landingAnnouncement: profile?.landingAnnouncement
      ? String(profile.landingAnnouncement)
      : null,
    welcomeMessage: profile?.welcomeMessage
      ? String(profile.welcomeMessage)
      : null,
    profileImage: extractImageUrl(profile?.profileImage),
    coverImage: extractImageUrl(profile?.coverImage),
  };

  // partnerBase는 user.mallUserId를 사용하되, 없으면 phone을 사용
  const partnerBase = `/partner/${user.mallUserId || user.phone || partnerId}`;

  const loadMyContract = useCallback(async () => {
    try {
      setLoadingMyContract(true);
      logger.log('[PartnerDashboard] Loading my contract...');
      const res = await fetch('/api/affiliate/my-contract', { credentials: 'include' });
      const json = await res.json();
      logger.log('[PartnerDashboard] My contract response:', { ok: json.ok, hasContract: !!json.contract, contract: json.contract, completedAgentContracts: json.completedAgentContracts?.length || 0 });
      if (res.ok && json.ok) {
        setMyContract(json.contract);
        // 대리점장인 경우 완료된 판매원 계약서 목록도 저장
        if (json.completedAgentContracts && Array.isArray(json.completedAgentContracts)) {
          setCompletedAgentContracts(json.completedAgentContracts);
        }
        logger.log('[PartnerDashboard] My contract set:', json.contract ? { id: json.contract.id, status: json.contract.status, name: json.contract.name } : 'null');
      } else {
        logger.warn('[PartnerDashboard] Failed to load contract:', json.message);
        setMyContract(null);
        setCompletedAgentContracts([]);
      }
    } catch (error: any) {
      logger.error('[PartnerDashboard] Failed to load my contract:', error);
      setMyContract(null);
    } finally {
      setLoadingMyContract(false);
    }
  }, []);

  const loadMySales = async (month?: string) => {
    try {
      setLoadingMySales(true);
      const monthParam = month || selectedMonth;
      const res = await fetch(`/api/affiliate/sales/my-sales?month=${monthParam}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '판매 목록을 불러오지 못했습니다');
      }
      setMySales(json.sales || []);
    } catch (error: any) {
      logger.error('[PartnerDashboard] Load my sales error:', error);
      showError(error.message || '판매 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoadingMySales(false);
    }
  };

  // 팀원 판매 현황 로드 (대리점장용)
  const loadTeamSales = useCallback(async () => {
    if (!isBranchManager) return;

    try {
      setLoadingTeamSales(true);
      const res = await fetch('/api/partner/sales', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        // 팀원들의 판매만 필터링 (본인 판매 제외)
        const teamOnlySales = (json.sales || [])
          .filter((sale: any) => sale.agentId && sale.agentId !== json.profileId)
          .map((sale: any) => ({
            id: sale.id,
            productCode: sale.productCode,
            saleAmount: sale.saleAmount || 0,
            status: sale.status,
            saleDate: sale.saleDate,
            agentName: sale.AffiliateProfile_agentIdToAffiliateProfile?.displayName ||
                       sale.AffiliateProfile_agentIdToAffiliateProfile?.User?.name || '알 수 없음',
            agentId: sale.agentId,
            customerName: sale.AffiliateLead?.customerName || null,
            branchCommission: sale.branchCommission || 0,
            salesCommission: sale.salesCommission || 0,
            overrideCommission: sale.overrideCommission || 0,
          }));
        setTeamSales(teamOnlySales);
      }
    } catch (error) {
      logger.error('[PartnerDashboard] Failed to load team sales:', error);
    } finally {
      setLoadingTeamSales(false);
    }
  }, [isBranchManager]);

  // 판매원별 DB 현황 로드
  const loadAgentDbStats = useCallback(async () => {
    if (!isBranchManager) return;

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
      logger.error('[PartnerDashboard] Failed to load agent DB stats:', error);
    } finally {
      setLoadingAgentDbStats(false);
    }
  }, [isBranchManager]);

  // 월 변경 핸들러
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    loadStats(month);
    loadMySales(month);
  };

  // 월 목록 생성 (현재 달부터 최근 12개월)
  const getAvailableMonths = (): string[] => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
    }
    return months;
  };

  // 구매고객 목록 로드 함수
  const loadPurchasedReservations = useCallback(async () => {
    if (!isBranchManager) {
      return;
    }
    try {
      setLoadingPurchasedReservations(true);
      const response = await fetch('/api/partner/reservations', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setPurchasedReservations(data.reservations || []);
      } else {
        showError(data.message || '예약 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      logger.error('[PartnerDashboard] 예약 목록 로드 실패:', error);
      showError('예약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingPurchasedReservations(false);
    }
  }, [isBranchManager]);

  // 통계 데이터 로드
  useEffect(() => {
    logger.log('[PartnerDashboard] useEffect triggered, isBranchManager:', isBranchManager);
    // loadStats()와 loadMySales()는 selectedMonth 변경 시 호출되므로 여기서는 제거 (중복 호출 방지)
    loadMyContract(); // 나의 계약서 로드
    if (isBranchManager) {
      loadContracts();
      loadAgentDbStats();
      loadTeamSales(); // 팀원 판매 현황 로드
      loadPurchasedReservations(); // 구매고객 목록 로드
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBranchManager, loadMyContract, loadAgentDbStats, loadTeamSales, loadPurchasedReservations]);

  // 선택된 달이 변경되면 데이터 다시 로드
  useEffect(() => {
    loadStats(selectedMonth);
    loadMySales(selectedMonth);
  }, [selectedMonth]);

  const loadStats = async (month?: string) => {
    try {
      setLoadingStats(true);
      const monthParam = month || selectedMonth;
      const res = await fetch(`/api/partner/dashboard/stats?month=${monthParam}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setStats(json.stats);
        // API에서 반환된 currentMonth로 업데이트 (다음 달로 넘어간 경우)
        if (json.stats.currentMonth && !month) {
          setSelectedMonth(json.stats.currentMonth);
        }
      }
    } catch (error) {
      logger.error('[PartnerDashboard] Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // 전화상담고객 로드 함수
  const loadInquiryCustomers = useCallback(async () => {
    try {
      setLoadingInquiryCustomers(true);
      const res = await fetch('/api/partner/customers?source=mall&limit=10', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setInquiryCustomers(json.leads || []);
      }
    } catch (error) {
      logger.error('[PartnerDashboard] Failed to load inquiry customers:', error);
    } finally {
      setLoadingInquiryCustomers(false);
    }
  }, []);

  // 전화상담고객 로드 (탭이 inquiries일 때)
  useEffect(() => {
    if (customerTab === 'inquiries') {
      loadInquiryCustomers();
    }
  }, [customerTab, loadInquiryCustomers]);

  const loadContracts = useCallback(async () => {
    if (!isBranchManager) {
      logger.log('[PartnerDashboard] Not a branch manager, skipping loadContracts');
      return;
    }
    try {
      setLoadingContracts(true);
      logger.log('[PartnerDashboard] Loading contracts...');
      const res = await fetch('/api/partner/contracts', {
        credentials: 'include',
      });
      const json = await res.json();
      logger.log('[PartnerDashboard] Contracts response:', { ok: res.ok, jsonOk: json.ok, contractsCount: json.contracts?.length || 0 });
      if (res.ok && json.ok) {
        setContracts(json.contracts || []);
        logger.log('[PartnerDashboard] Contracts loaded:', json.contracts?.length || 0);
      } else {
        logger.error('[PartnerDashboard] Failed to load contracts:', json.message || 'Unknown error');
        showError(json.message || '계약서 목록을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      logger.error('[PartnerDashboard] Failed to load contracts:', error);
      showError('계약서 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingContracts(false);
    }
  }, [isBranchManager]);

  // 구매고객관리 핸들러 함수들
  const handleOpenPassportModal = (reservation: any) => {
    setSelectedPurchasedReservation(reservation);
    const passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/customer/passport/${reservation.id}`;
    const customerName = reservation.user?.name || '고객';
    const defaultMessage = `안녕하세요 ${customerName}님. 여권 정보를 등록해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n${passportUrl}`;
    setPassportMessage(defaultMessage);
    setPassportPhone(reservation.user?.phone || '');
    setShowPassportModal(true);
  };

  const handleSendPassportMessage = async () => {
    if (!passportPhone || !passportMessage.trim() || !selectedPurchasedReservation) {
      showError('전화번호와 메시지를 입력해주세요.');
      return;
    }

    try {
      setSendingPassport(true);
      const response = await fetch('/api/partner/customers/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: passportPhone.replace(/[^0-9]/g, ''),
          message: passportMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || '문자 발송에 실패했습니다.');
      }

      showSuccess('여권 등록 링크가 발송되었습니다.');
      setShowPassportModal(false);
      setPassportPreviewDevice(null);
    } catch (error: any) {
      logger.error('여권 메시지 발송 오류:', error);
      showError(error.message || '문자 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingPassport(false);
    }
  };

  const handleCopyPassportLink = async () => {
    if (!selectedPurchasedReservation) return;
    const passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/customer/passport/${selectedPurchasedReservation.id}`;
    try {
      await navigator.clipboard.writeText(passportUrl);
      showSuccess('링크가 복사되었습니다.');
    } catch (error) {
      showError('링크 복사에 실패했습니다.');
    }
  };

  const handleOpenChatbotModal = async (reservation: any) => {
    setSelectedPurchasedReservation(reservation);

    try {
      // 파트너용 챗봇 플로우 API 사용
      const response = await fetch('/api/partner/chat-bot/passport-flow', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok || !data.ok || !data.shareToken) {
        throw new Error(data.error || '여권 챗봇 플로우를 조회할 수 없습니다.');
      }

      const chatbotUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/chat-bot/share/${data.shareToken}`;
      setChatbotLink(chatbotUrl);

      const customerName = reservation.user?.name || '고객';
      const defaultMessage = `안녕하세요 ${customerName}님. 여권 등록을 도와드리는 챗봇입니다. 아래 링크를 클릭하여 여권 이미지를 업로드해주세요.\n\n${chatbotUrl}`;
      setChatbotMessage(defaultMessage);
      setShowChatbotModal(true);
    } catch (error: any) {
      logger.error('챗봇 모달 열기 오류:', error);
      showError(error.message || '챗봇 링크를 생성하는 중 오류가 발생했습니다.');
    }
  };

  const handleSendChatbotMessage = async () => {
    if (!chatbotMessage.trim() || !selectedPurchasedReservation) {
      showError('메시지를 입력해주세요.');
      return;
    }

    try {
      setSendingChatbot(true);
      const response = await fetch('/api/partner/customers/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: (selectedPurchasedReservation.user?.phone || '').replace(/[^0-9]/g, ''),
          message: chatbotMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || '문자 발송에 실패했습니다.');
      }

      showSuccess('여권 챗봇 링크가 발송되었습니다.');
      setShowChatbotModal(false);
      setPassportPreviewDevice(null);
    } catch (error: any) {
      logger.error('챗봇 메시지 발송 오류:', error);
      showError(error.message || '문자 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingChatbot(false);
    }
  };

  const handleCopyChatbotLink = async () => {
    try {
      await navigator.clipboard.writeText(chatbotLink);
      showSuccess('챗봇 링크가 복사되었습니다.');
    } catch (error) {
      showError('링크 복사에 실패했습니다.');
    }
  };

  const handleOpenPurchasedDetailModal = async (reservation: any) => {
    try {
      setLoadingPurchasedDetail(true);
      setSelectedPurchasedReservation(reservation);
      const response = await fetch(`/api/partner/reservations/${reservation.id}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setPurchasedReservationDetail(data.reservation);
        setShowPurchasedDetailModal(true);
      } else {
        showError(data.error || '예약 상세 정보를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      logger.error('예약 상세 정보 로드 실패:', error);
      showError('예약 상세 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoadingPurchasedDetail(false);
    }
  };

  const filteredPurchasedReservations = purchasedReservations.filter((reservation) => {
    if (!purchasedSearchTerm) return true;
    const search = purchasedSearchTerm.toLowerCase();
    return (
      reservation.user?.name?.toLowerCase().includes(search) ||
      reservation.user?.phone?.includes(search) ||
      reservation.user?.email?.toLowerCase().includes(search) ||
      reservation.trip?.product?.packageName?.toLowerCase().includes(search)
    );
  });

  // PWA 앱 설치 핸들러
  const handleInstallApp = async () => {
    if (!installPrompt) {
      // iOS 또는 설치 불가능한 경우 안내
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        showError('Safari에서 공유 버튼 → "홈 화면에 추가"를 눌러주세요.');
      } else {
        showError('이 브라우저에서는 앱 설치가 지원되지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      }
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === 'accepted') {
        showSuccess('앱 설치가 시작되었습니다!');
      }
      setInstallPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      logger.error('[PWA Install] Error:', error);
      showError('앱 설치 중 오류가 발생했습니다.');
    }
  };

  const handleCompleteContract = async (contractId: number) => {
    // 계약서 열람 확인 체크
    if (!viewedContractIds.has(contractId)) {
      showError('계약서를 완료하기 전에 반드시 계약서를 열어서 확인해주세요. 계약서 상세 보기 또는 PDF 보기를 통해 계약서를 확인할 수 있습니다.');
      return;
    }

    if (!confirm('이 계약서를 완료하여 PDF를 이메일로 전송하시겠습니까?')) return;

    try {
      setCompletingContractId(contractId);
      const res = await fetch(`/api/partner/contracts/${contractId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!text) {
        throw new Error('Empty response');
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (parseError) {
        logger.error('[PartnerDashboard] JSON parse error:', parseError, 'Response text:', text);
        throw new Error('Invalid JSON response from server');
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || '계약서 완료 처리에 실패했습니다.');
      }

      // 이메일 전송 성공 여부에 따라 메시지 표시
      if (json.emailSent) {
        showSuccess(json.message || '계약서가 완료되었고 이메일로 전송되었습니다.');
      } else {
        showSuccess(json.message || '계약서가 완료되었으나 이메일 전송에 실패했습니다.');
      }

      // 모달 닫기
      setShowContractDetail(false);
      setSelectedContract(null);

      // 목록 새로고침
      loadContracts(); // 목록 새로고침
      loadMyContract(); // 나의 계약서도 새로고침 (대리점장 자신의 계약서가 완료된 경우)

      // 완료 페이지로 리다이렉트 (새 창에서 열기) - 이메일 전송 실패해도 redirectUrl이 있으면 이동
      if (json.redirectUrl) {
        window.open(json.redirectUrl, '_blank');
      }
    } catch (error: any) {
      logger.error('[PartnerDashboard] Complete contract error:', error);
      showError(error.message || '계약서 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setCompletingContractId(null);
    }
  };

  const handleSendPdf = async (contractId: number) => {
    if (!confirm('계약서 PDF를 계약자 이메일 주소로 전송하시겠습니까? (본사 이메일은 참조로 추가됩니다)')) return;
    try {
      setSendingPdfContractId(contractId);
      logger.log('[PartnerDashboard] Starting PDF send for contract:', contractId);

      // 타임아웃 설정 (60초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch(`/api/partner/contracts/${contractId}/send-pdf`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          let errorJson;
          try {
            if (!errorText) {
              throw new Error('Empty response');
            }
            errorJson = JSON.parse(errorText);
          } catch (parseError) {
            logger.error('[PartnerDashboard] JSON parse error:', parseError, 'Response text:', errorText);
            errorJson = { message: errorText || '서버 오류가 발생했습니다.' };
          }
          throw new Error(errorJson.message || errorJson.error || `서버 오류 (${res.status})`);
        }

        const text = await res.text();
        if (!text) {
          throw new Error('Empty response');
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          logger.error('[PartnerDashboard] JSON parse error:', parseError, 'Response text:', text);
          throw new Error('Invalid JSON response from server');
        }

        logger.log('[PartnerDashboard] PDF send response:', json);

        if (!json.ok) {
          throw new Error(json.message || json.error || 'PDF 전송에 실패했습니다.');
        }

        showSuccess(json.message || 'PDF가 성공적으로 전송되었습니다.');
        loadContracts();
        // PDF 보기를 통한 계약서 열람 확인 추가
        setViewedContractIds(prev => new Set(prev).add(contractId));
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('PDF 전송 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      logger.error('[PartnerDashboard] Send PDF error:', error);
      showError(error.message || 'PDF 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingPdfContractId(null);
    }
  };

  const handleReject = async (contractId: number) => {
    const reason = prompt('거부 사유를 입력하세요:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/partner/contracts/${contractId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약 거부에 실패했습니다.');
      }
      showSuccess('계약이 거부되었습니다.');
      loadContracts();
    } catch (error: any) {
      logger.error('[PartnerDashboard] reject error', error);
      showError(error.message || '계약 거부 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (contractId: number) => {
    if (!confirm('정말로 이 계약서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      setDeletingContractId(contractId);
      const res = await fetch(`/api/partner/contracts/${contractId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '삭제에 실패했습니다.');
      }
      showSuccess('계약서가 삭제되었습니다.');
      loadContracts();
    } catch (error: any) {
      logger.error('[PartnerDashboard] delete error', error);
      showError(error.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleViewDetail = async (contractId: number) => {
    try {
      setLoadingContractDetail(true);
      const res = await fetch(`/api/partner/contracts/${contractId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약서 정보를 불러오지 못했습니다.');
      }
      setSelectedContract(json.contract);
      setShowContractDetail(true);
      // 계약서 열람 확인 추가
      setViewedContractIds(prev => new Set(prev).add(contractId));
    } catch (error: any) {
      logger.error('[PartnerDashboard] view detail error', error);
      showError(error.message || '계약서 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingContractDetail(false);
    }
  };

  // 고객 검색 함수
  const searchCustomers = useCallback(async (query: string, type: 'name' | 'phone' | 'mainPhone') => {
    if (!query || query.trim().length < 1) {
      if (type === 'name') {
        setCustomerNameSuggestions([]);
        setShowCustomerNameSuggestions(false);
      } else if (type === 'phone') {
        setCustomerPhoneSuggestions([]);
        setShowCustomerPhoneSuggestions(false);
      } else {
        setMainCustomerPhoneSuggestions([]);
        setShowMainCustomerPhoneSuggestions(false);
      }
      return;
    }

    try {
      const response = await fetch(`/api/affiliate/customers/search?q=${encodeURIComponent(query)}&limit=10`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok) {
          const customers = result.customers || [];
          if (type === 'name') {
            setCustomerNameSuggestions(customers);
            setShowCustomerNameSuggestions(customers.length > 0);
          } else if (type === 'phone') {
            setCustomerPhoneSuggestions(customers);
            setShowCustomerPhoneSuggestions(customers.length > 0);
          } else {
            setMainCustomerPhoneSuggestions(customers);
            setShowMainCustomerPhoneSuggestions(customers.length > 0);
          }
        }
      }
    } catch (error) {
      logger.error('[Customer Search] Error:', error);
    }
  }, []);

  // 고객 이름 입력 핸들러
  const handleCustomerNameChange = (value: string) => {
    setRegisterForm({ ...registerForm, customerName: value });

    if (customerSearchTimeoutRef.current) {
      clearTimeout(customerSearchTimeoutRef.current);
    }

    if (value.trim().length >= 1) {
      setShowCustomerNameSuggestions(true);
      customerSearchTimeoutRef.current = setTimeout(() => {
        searchCustomers(value, 'name');
      }, 300);
    } else {
      setCustomerNameSuggestions([]);
      setShowCustomerNameSuggestions(false);
    }
  };

  // 고객 전화번호 입력 핸들러
  const handleCustomerPhoneChange = (value: string) => {
    setRegisterForm({ ...registerForm, customerPhone: value });

    if (customerSearchTimeoutRef.current) {
      clearTimeout(customerSearchTimeoutRef.current);
    }

    if (value.trim().length >= 1) {
      setShowCustomerPhoneSuggestions(true);
      customerSearchTimeoutRef.current = setTimeout(() => {
        searchCustomers(value, 'phone');
      }, 300);
    } else {
      setCustomerPhoneSuggestions([]);
      setShowCustomerPhoneSuggestions(false);
    }
  };

  // 메인 고객 전화번호로 상품 코드 자동 조회
  const handleMainCustomerPhoneChange = async (phone: string) => {
    setRegisterForm({ ...registerForm, mainCustomerPhone: phone });

    // 전화번호 정규화 (숫자만 추출)
    const normalizedPhone = phone.replace(/\D/g, '');

    // 자동완성 검색 - 정규화된 전화번호로 검색 (3자 이상이면 검색)
    if (customerSearchTimeoutRef.current) {
      clearTimeout(customerSearchTimeoutRef.current);
    }

    if (normalizedPhone.length >= 3) {
      setShowMainCustomerPhoneSuggestions(true);
      customerSearchTimeoutRef.current = setTimeout(() => {
        searchCustomers(normalizedPhone, 'mainPhone');
      }, 300);
    } else if (normalizedPhone.length === 0) {
      setMainCustomerPhoneSuggestions([]);
      setShowMainCustomerPhoneSuggestions(false);
    }

    // 전화번호가 10자 이상일 때만 API 호출
    if (normalizedPhone.length >= 10) {
      setIsLoadingProductCode(true);
      try {
        const response = await fetch(
          `/api/affiliate/customers/product-code?phone=${encodeURIComponent(normalizedPhone)}`,
          {
            credentials: 'include',
          }
        );

        const data = await response.json();

        if (response.ok && data.ok && data.productCode) {
          setRegisterForm((prev) => ({
            ...prev,
            productCode: data.productCode,
          }));
          showSuccess(`상품 코드가 자동으로 입력되었습니다: ${data.productCode}`);
        } else if (data.message) {
          // 상품 코드를 찾을 수 없는 경우는 조용히 처리 (에러 표시 안 함)
          // showError(data.message);
        }
      } catch (error: any) {
        logger.error('[Load Product Code] Error:', error);
        // 에러 발생 시 조용히 처리 (사용자 경험 개선)
      } finally {
        setIsLoadingProductCode(false);
      }
    } else {
      // 전화번호가 너무 짧으면 상품 코드 초기화
      if (normalizedPhone.length < 10) {
        setRegisterForm((prev) => ({
          ...prev,
          productCode: '',
        }));
      }
    }
  };

  const handleRegisterCustomer = async () => {
    if (!registerForm.customerName || !registerForm.customerPhone) {
      showError('고객 이름과 전화번호는 필수입니다.');
      return;
    }
    if (registerForm.isCompanion && !registerForm.mainCustomerPhone) {
      showError('동행인 등록 시 메인 고객 전화번호는 필수입니다.');
      return;
    }

    setIsRegistering(true);
    try {
      const response = await fetch('/api/affiliate/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showError(data.error || '동행인 등록에 실패했습니다.');
        return;
      }

      showSuccess('동행인이 등록되었습니다.');
      setShowCustomerRegisterModal(false);
      setRegisterForm({
        customerName: '',
        customerPhone: '',
        productCode: '',
        isCompanion: false,
        mainCustomerPhone: '',
      });
      loadStats(); // 통계 새로고침
    } catch (error: any) {
      showError('동행인 등록 중 오류가 발생했습니다.');
      logger.error('[Register Customer] Error:', error);
    } finally {
      setIsRegistering(false);
    }
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 리드 상태를 한글로 변환 (모든 가능한 상태값 처리)
  const formatLeadStatus = (status: string) => {
    // leadStatusOptions에서 먼저 찾기
    const statusOption = leadStatusOptions.find(option => option.value === status);
    if (statusOption) {
      return statusOption.label;
    }

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

    return statusMap[status] || status;
  };

  // 리드 상태에 따른 스타일 반환 (모든 가능한 상태값 처리)
  const getLeadStatusStyle = (status: string) => {
    // leadStatusOptions에서 먼저 찾기
    const statusOption = leadStatusOptions.find(option => option.value === status);
    if (statusOption) {
      return statusOption.theme;
    }

    // leadStatusOptions에 없는 상태값들 처리
    const styleMap: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-700',
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

    return styleMap[status] || 'bg-gray-100 text-gray-700';
  };

  // 판매 상태를 한국어로 변환
  const formatSaleStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '대기 중';
      case 'PENDING_APPROVAL':
        return '승인 대기';
      case 'APPROVED':
        return '승인됨';
      case 'REJECTED':
        return '거부됨';
      case 'CONFIRMED':
        return '확정됨';
      default:
        return '알 수 없음';
    }
  };

  // B2B 랜딩페이지 링크 섹션 - Hydration 오류 방지를 위해 state 사용
  const [b2bLandingUrl, setB2bLandingUrl] = useState<string>('');
  const [trialDashboardUrl, setTrialDashboardUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setB2bLandingUrl(`${window.location.origin}/b2b/${user.mallUserId || user.phone}`);
      setTrialDashboardUrl(`${window.location.origin}/trial/dashboard`);
    }
  }, [user.mallUserId, user.phone]);

  const copyB2BLink = () => {
    if (!b2bLandingUrl) return;
    navigator.clipboard.writeText(b2bLandingUrl).then(() => {
      showSuccess('B2B 랜딩페이지 링크가 복사되었습니다.');
    });
  };

  const copyTrialDashboardLink = () => {
    if (!trialDashboardUrl) return;
    navigator.clipboard.writeText(trialDashboardUrl).then(() => {
      showSuccess('체험 대시보드 링크가 복사되었습니다.');
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 정액제 구독 정보 고정 배너 */}
      {subscriptionInfo && countdown && (
        <div className={`fixed top-0 left-0 right-0 z-50 ${subscriptionInfo.isTrial
          ? 'bg-gradient-to-r from-slate-800 to-slate-900'
          : subscriptionInfo.status === 'active'
            ? 'bg-gradient-to-r from-slate-900 to-slate-800'
            : 'bg-gradient-to-r from-slate-700 to-slate-800'
          } text-white shadow-lg shadow-slate-900/10`}>
          <div className="mx-auto max-w-7xl px-4 py-2.5 md:py-3">
            <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
              {subscriptionInfo.isTrial ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                    <span className="text-sm font-semibold md:text-base">무료 체험 중</span>
                    {(countdown.days > 0 || countdown.hours > 0 || countdown.minutes > 0 || countdown.seconds > 0) && (
                      <span className="text-xs md:text-sm font-mono font-bold bg-white/20 px-3 py-1 rounded-full">
                        D-{countdown.days} {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:<span className="text-emerald-400">{String(countdown.seconds).padStart(2, '0')}</span>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setPendingPaymentAction(async () => {
                        try {
                          const res = await fetch('/api/partner/subscription/payment', {
                            method: 'POST',
                            credentials: 'include',
                          });
                          const data = await res.json();
                          if (res.ok && data.ok && data.payurl) {
                            window.location.href = data.payurl;
                          } else {
                            alert(data.message || '결제 요청에 실패했습니다.');
                          }
                        } catch (error) {
                          logger.error('[Subscription Payment] Error:', error);
                          alert('결제 요청 중 오류가 발생했습니다.');
                        }
                      });
                      setShowPaymentConfirmModal(true);
                    }}
                    className="px-3 py-1.5 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition-colors text-xs md:text-sm"
                  >
                    시스템 문의
                  </button>
                </>
              ) : subscriptionInfo.status === 'active' ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                    <span className="text-sm font-semibold md:text-base flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      정식 구독 중
                    </span>
                    {(countdown.days > 0 || countdown.hours > 0 || countdown.minutes > 0 || countdown.seconds > 0) && (
                      <span className="text-xs md:text-sm font-mono font-bold bg-white/20 px-3 py-1 rounded-full">
                        D-{countdown.days} {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold md:text-base flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    구독 만료
                  </span>
                  <button
                    onClick={() => {
                      setPendingPaymentAction(async () => {
                        try {
                          const res = await fetch('/api/partner/subscription/payment', {
                            method: 'POST',
                            credentials: 'include',
                          });
                          const data = await res.json();
                          if (res.ok && data.ok && data.payurl) {
                            window.location.href = data.payurl;
                          } else {
                            alert(data.message || '결제 요청에 실패했습니다.');
                          }
                        } catch (error) {
                          logger.error('[Subscription Payment] Error:', error);
                          alert('결제 요청 중 오류가 발생했습니다.');
                        }
                      });
                      setShowPaymentConfirmModal(true);
                    }}
                    className="px-3 py-1.5 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition-colors text-xs md:text-sm"
                  >
                    시스템 문의
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}



      <div className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:gap-8 md:px-6 ${subscriptionInfo ? (isInstallable || (!isStandalone && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''))) && !isStandalone ? 'pt-32 md:pt-36' : 'pt-20 md:pt-24' : 'pt-6 md:pt-10'
        }`}>
        {/* 헤더 - 역할 명확하게 표시 */}
        <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl md:rounded-3xl shadow-xl shadow-slate-900/20 overflow-hidden">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          </div>
          <div className="relative z-10 flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-10">
            {/* 알림 종 (오른쪽 상단) */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[100]">
              <div className="bg-white/15 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
                <NotificationBell />
              </div>
            </div>
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
                  {roleIcon}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 md:text-xs font-medium">Partner Dashboard</p>
                  <h1 className="text-xl font-bold leading-snug md:text-3xl tracking-tight">
                    {roleLabel} 대시보드
                  </h1>
                </div>
              </div>
              <p className="max-w-xl text-xs text-slate-300 md:text-sm leading-relaxed">
                {isSubscriptionAgent
                  ? '시스템 이용자 대시보드입니다. 사용 가능한 기능은 빨간색 테두리로 표시됩니다.'
                  : (isBranchManager
                    ? '팀 관리, 판매 실적, 고객 관리 등 모든 업무를 한 곳에서 관리하세요.'
                    : '나의 판매 실적, 고객 관리, 링크 관리를 한 곳에서 확인하세요.')}
              </p>
              <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white text-slate-900 px-3 py-1.5 font-semibold">
                  {roleLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-medium text-slate-300 border border-white/10">
                  ID: {partnerId}
                  {isSubscriptionAgent && <span className="ml-1 text-slate-400 text-[10px]">(시스템 이용자)</span>}
                  {!isSubscriptionAgent && isBranchManager && <span className="ml-1 text-slate-400 text-[10px]">(대리점장)</span>}
                  {!isSubscriptionAgent && isSalesAgent && <span className="ml-1 text-slate-400 text-[10px]">(판매원)</span>}
                  {!isSubscriptionAgent && !isBranchManager && !isSalesAgent && <span className="ml-1 text-slate-400 text-[10px]">(파트너)</span>}
                </span>
                {profile.branchLabel && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-medium text-slate-300 border border-white/10">
                    {profile.branchLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 월별 필터링 UI */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-900/5 border border-slate-100 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <FiClock className="text-lg text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">월별 조회</h2>
                <p className="text-xs text-slate-500 mt-1">하단의 최근 리드, 최근 판매, 내 판매 목록만 월별로 조회됩니다</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="month-select" className="text-sm font-medium text-slate-600">
                선택 월:
              </label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {getAvailableMonths().map((month) => {
                  const [year, monthNum] = month.split('-');
                  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                  const monthName = `${year}년 ${monthNames[parseInt(monthNum) - 1]}`;
                  const isCurrentMonth = month === stats?.currentMonth;
                  return (
                    <option key={month} value={month}>
                      {monthName} {isCurrentMonth ? '(현재)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          {stats?.selectedMonth && (
            <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              선택된 월: {(() => {
                const [year, month] = stats.selectedMonth.split('-');
                const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                return `${year}년 ${monthNames[parseInt(month) - 1]}`;
              })()}의 최근 리드, 최근 판매, 내 판매 목록을 표시하고 있습니다. (상단 통계는 전체 누적 데이터입니다)
            </p>
          )}
        </div>

        {/* B2B 유입 링크 섹션 */}
        {isBranchManager && (
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-900/5 border border-slate-100 p-4 md:p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <FiLink className="text-slate-600" />
                </div>
                B2B 유입 링크
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                B2B 랜딩페이지와 체험 대시보드 링크를 복사하여 사용하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* B2B 랜딩페이지 링크 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">나만의 B2B 유입 랜딩페이지</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">파트너 B2B</span>
                </div>
                <p className="text-xs text-slate-600 mb-3">이 링크로 유입된 고객은 자동으로 내 B2B 유입으로 분류됩니다.</p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 mb-3">
                  <code className="text-xs text-slate-600 break-all">{b2bLandingUrl || '로딩 중...'}</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyB2BLink}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <FiLink className="w-4 h-4" /> 링크 복사
                  </button>
                  <a
                    href={b2bLandingUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors ${!b2bLandingUrl ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={(e) => !b2bLandingUrl && e.preventDefault()}
                  >
                    <FiEye className="w-4 h-4" /> 미리보기
                  </a>
                </div>
              </div>

              {/* 체험 대시보드 링크 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">체험 대시보드</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">신청 후 리다이렉트</span>
                </div>
                <p className="text-xs text-slate-600 mb-3">이름/연락처 입력 후 이동되는 3일 무료체험 대시보드입니다.</p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 mb-3">
                  <code className="text-xs text-slate-600 break-all">{trialDashboardUrl || '로딩 중...'}</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyTrialDashboardLink}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <FiLink className="w-4 h-4" /> 링크 복사
                  </button>
                  <a
                    href={trialDashboardUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors ${!trialDashboardUrl ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={(e) => !trialDashboardUrl && e.preventDefault()}
                  >
                    <FiEye className="w-4 h-4" /> 미리보기
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 통계 카드 - 모바일 최적화 */}
        {loadingStats ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="animate-spin text-3xl text-slate-400" />
          </div>
        ) : stats && (
          <section className={`grid grid-cols-2 gap-3 ${isBranchManager ? 'md:grid-cols-4' : 'md:grid-cols-3'} md:gap-6`}>
            {isBranchManager && (
              <div className="rounded-xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-2xl md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <FiLink className="text-lg text-slate-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">대리점장</span>
                </div>
                <p className="text-xs text-slate-500 mb-1 md:text-sm">총 링크</p>
                <p className="text-2xl font-bold text-slate-900 md:text-3xl">{stats.totalLinks.toLocaleString()}</p>
              </div>
            )}

            <div className="rounded-xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-2xl md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="text-lg text-slate-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-1 md:text-sm">총 잠재고객 (누적)</p>
              <p className="text-2xl font-bold text-slate-900 md:text-3xl">{stats.totalLeads.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">전체 기간 합계</p>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-2xl md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FiShoppingCart className="text-lg text-slate-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-1 md:text-sm">총 판매 (누적)</p>
              <p className="text-2xl font-bold text-slate-900 md:text-3xl">{stats.totalSales.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">전체 기간 합계</p>
            </div>

            {isBranchManager && (
              <div className="rounded-xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-2xl md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <FiTrendingUp className="text-lg text-slate-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1 md:text-sm">팀원 수</p>
                <p className="text-2xl font-bold text-slate-900 md:text-3xl">{stats.teamMembers.toLocaleString()}</p>
              </div>
            )}
          </section>
        )}

        {/* 개인 링크 - 모바일 최적화 (대리점장/판매원은 빠른메뉴의 링크 관리에서 확인 가능하므로 숨김) */}
        {!isBranchManager && !isSalesAgent && (
          <section className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-3xl md:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <FiLink className="text-slate-600" />
              </div>
              나의 개인 링크
            </h2>
            <p className="mb-4 text-sm text-slate-500">모든 링크는 파트너 아이디에 맞춰 자동 생성됩니다.</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">대시보드</span>
                </div>
                <Link
                  href={`${partnerBase}/dashboard`}
                  className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                >
                  {partnerBase}/dashboard
                </Link>
              </div>
              {user.mallUserId && (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">판매몰</span>
                    <button
                      onClick={() => {
                        if (mallFullUrl) {
                          navigator.clipboard.writeText(mallFullUrl);
                          showSuccess('판매몰 링크가 복사되었습니다!');
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      복사
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 break-all">
                    <a
                      href={`/${user.mallUserId}/shop`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-slate-900"
                    >
                      {mallFullUrl || `/${user.mallUserId}/shop`}
                    </a>
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">결제 페이지</span>
                </div>
                <Link
                  href={`${partnerBase}/payment`}
                  className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                >
                  {partnerBase}/payment
                </Link>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {isBranchManager ? '나의 고객' : isSalesAgent ? '나의 고객관리' : '고객 관리'}
                  </span>
                </div>
                <Link
                  href={`${partnerBase}/customers`}
                  className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                >
                  {partnerBase}/customers
                </Link>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">프로필</span>
                </div>
                <Link
                  href={`${partnerBase}/profile`}
                  className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                >
                  {partnerBase}/profile
                </Link>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">SNS 프로필</span>
                </div>
                <Link
                  href={`${partnerBase}/sns-profile`}
                  className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                >
                  {partnerBase}/sns-profile
                </Link>
              </div>

              {/* 관리자가 생성한 공통 상품 링크 자동 표시 */}
              {commonProductLinks.map((link) => (
                <div key={link.id} className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {link.product?.title || link.title || `상품 ${link.productCode}`}
                    </span>
                    <button
                      onClick={() => {
                        if (link.url) {
                          navigator.clipboard.writeText(link.url);
                          showSuccess('상품 링크가 복사되었습니다!');
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      복사
                    </button>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-600 break-all hover:text-slate-900 cursor-pointer"
                  >
                    {link.url}
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* 빠른 메뉴 - 모바일 최적화 */}
        <section className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 md:rounded-3xl md:p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-xl">빠른 메뉴</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {/* 만능 압축기 (공통) */}
            <button
              onClick={() => setShowCompressorModal(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-900 p-4 text-center transition-all hover:bg-slate-800 hover:shadow-lg md:p-6 text-white"
            >
              <FiLayers className="text-2xl md:text-3xl" />
              <span className="text-xs font-bold md:text-sm">만능 압축기</span>
            </button>
            {/* B2B 유입 랜딩 (대리점장 전용) */}
            {isBranchManager && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/b2b/${user.mallUserId || user.phone || partnerId}`;
                  window.open(url, '_blank');
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-800 p-4 text-center transition-all hover:bg-slate-700 hover:shadow-lg md:p-6 text-white"
              >
                <FiGlobe className="text-2xl md:text-3xl" />
                <span className="text-xs font-bold md:text-sm">B2B 유입<br />랜딩</span>
              </button>
            )}
            {/* 이미지 관리 (대리점장 및 판매원) */}
            {(isBranchManager || isSalesAgent) && (
              <button
                onClick={() => router.push(`${partnerBase}/images`)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-700 p-4 text-center transition-all hover:bg-slate-600 hover:shadow-lg md:p-6 text-white"
              >
                <FiImage className="text-2xl md:text-3xl" />
                <span className="text-xs font-bold md:text-sm">이미지<br />관리</span>
              </button>
            )}
            {(user.mallUserId || user.phone) && (
              subscriptionInfo ? (
                <button
                  onClick={() => {
                    if (canUseFeatureClient('my-mall', subscriptionInfo)) {
                      window.open(`/${user.mallUserId || user.phone || partnerId}/shop`, '_blank');
                    } else {
                      const message = getFeatureRestrictionMessageClient('my-mall', subscriptionInfo);
                      setRestrictionMessage(message);
                      setShowFeatureRestrictionModal(true);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-all hover:shadow-lg md:p-6 bg-slate-100 hover:bg-slate-200 ${subscriptionInfo && canUseFeatureClient('my-mall', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''}`}
                >
                  <span className="text-2xl md:text-3xl">🛍️</span>
                  <span className="text-xs font-semibold md:text-sm text-slate-700">나의 판매몰</span>
                </button>
              ) : (
                <Link
                  href={`/${user.mallUserId || user.phone || partnerId}/shop`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-all hover:shadow-lg md:p-6 bg-slate-100 hover:bg-slate-200"
                >
                  <span className="text-2xl md:text-3xl">🛍️</span>
                  <span className="text-xs font-semibold md:text-sm text-slate-700">나의 판매몰</span>
                </Link>
              )
            )}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('link-create', subscriptionInfo)) {
                    router.push(`${partnerBase}/links`);
                  } else {
                    const message = getFeatureRestrictionMessageClient('link-create', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('link-create', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiLink className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">링크 관리</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/links`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiLink className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">링크 관리</span>
              </Link>
            )}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('customer-management', subscriptionInfo)) {
                    router.push(`${partnerBase}/customers`);
                  } else {
                    const message = getFeatureRestrictionMessageClient('customer-management', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('customer-management', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiUsers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">나의 고객관리</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/customers`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiUsers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">
                  {isBranchManager ? '나의 고객' : isSalesAgent ? '나의 고객관리' : '고객 관리'}
                </span>
              </Link>
            )}
            {/* 구매고객관리 (대리점장/판매원 모두) */}
            {(isBranchManager || isSalesAgent) && (
              <Link
                href={`${partnerBase}/purchased-customers`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiShoppingCart className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">구매고객관리</span>
              </Link>
            )}
            {/* B2B 잠재고객 관리 (대리점장 전용) */}
            {isBranchManager && (
              <button
                onClick={() => router.push(`${partnerBase}/b2b-prospects`)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <span className="text-2xl md:text-3xl">🏢</span>
                <span className="text-xs font-semibold text-slate-700 md:text-sm">B2B<br />잠재고객</span>
              </button>
            )}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('companion-registration', subscriptionInfo)) {
                    setShowCustomerRegisterModal(true);
                  } else {
                    const message = getFeatureRestrictionMessageClient('companion-registration', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('companion-registration', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiUser className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">크루즈가이드<br />동행인 등록</span>
              </button>
            ) : (
              <button
                onClick={() => setShowCustomerRegisterModal(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiUser className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">크루즈가이드<br />동행인 등록</span>
              </button>
            )}
            {/* 고객 그룹 관리 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('customer-group-management', subscriptionInfo)) {
                    router.push(`${partnerBase}/customer-groups`);
                  } else {
                    const message = getFeatureRestrictionMessageClient('customer-group-management', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('customer-group-management', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiUsers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">고객 그룹<br />관리</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/customer-groups`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiUsers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">고객 그룹<br />관리</span>
              </Link>
            )}

            {/* 메시지 센터 (문자, 이메일, 예약발송 통합) */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('sms-send', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-center text-white shadow-md transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg md:p-6"
              >
                <FiSend className="text-2xl md:text-3xl" />
                <span className="text-xs font-semibold md:text-sm">메시지 센터</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/message-center`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-center text-white shadow-md transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg md:p-6"
              >
                <FiSend className="text-2xl md:text-3xl" />
                <span className="text-xs font-semibold md:text-sm">메시지 센터</span>
              </Link>
            )}

            {/* 결제/정산 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('payment-settlement', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiShoppingCart className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">결제/정산</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/payment`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiShoppingCart className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">결제/정산</span>
              </Link>
            )}

            {/* 서류관리 */}
            {!isBranchManager && !isSalesAgent && !canUseFeatureClient('document-management', subscriptionInfo) ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('document-management', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <span className="text-2xl md:text-3xl">📄</span>
                <span className="text-xs font-semibold text-slate-700 md:text-sm">서류관리</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/documents`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <span className="text-2xl md:text-3xl">📄</span>
                <span className="text-xs font-semibold text-slate-700 md:text-sm">서류관리</span>
              </Link>
            )}

            {/* 수동여권 등록 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('manual-passport', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiFileText className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">수동여권<br />등록</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/reservation/new`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiFileText className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">수동여권<br />등록</span>
              </Link>
            )}
            {/* 대리점장 전용 기능 (정액제 판매원도 표시하되 제한) */}
            {/* 랜딩페이지 관리 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('team-management', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiLayers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">랜딩페이지<br />관리</span>
              </button>
            ) : isBranchManager ? (
              <Link
                href={`${partnerBase}/landing-pages`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiLayers className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">랜딩페이지<br />관리</span>
              </Link>
            ) : null}

            {/* 팀 관리 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('team-management', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiTrendingUp className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">팀 관리</span>
              </button>
            ) : isBranchManager ? (
              <Link
                href={`${partnerBase}/team`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiTrendingUp className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">팀 관리</span>
              </Link>
            ) : null}

            {/* 팀원 명세서 (대리점장 전용) */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-center transition-all hover:from-emerald-100 hover:to-teal-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('team-management', subscriptionInfo) ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
                  }`}
              >
                <FiDollarSign className="text-2xl text-emerald-600 md:text-3xl" />
                <span className="text-xs font-semibold text-emerald-700 md:text-sm">팀원 명세서</span>
              </button>
            ) : isBranchManager ? (
              <Link
                href={`${partnerBase}/team-statements`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-center transition-all hover:from-emerald-100 hover:to-teal-200 hover:shadow-lg md:p-6"
              >
                <FiDollarSign className="text-2xl text-emerald-600 md:text-3xl" />
                <span className="text-xs font-semibold text-emerald-700 md:text-sm">팀원 명세서</span>
              </Link>
            ) : null}

            {/* 계약서 보내기 */}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('contract-invite', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('contract-invite', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiSend className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">계약서 보내기</span>
              </button>
            ) : isBranchManager ? (
              <button
                onClick={() => setShowContractTypeModal(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiSend className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">계약서 보내기</span>
              </button>
            ) : null}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('profile-edit', subscriptionInfo)) {
                    router.push(`${partnerBase}/profile`);
                  } else {
                    const message = getFeatureRestrictionMessageClient('profile-edit', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('profile-edit', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiUser className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">프로필 수정</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/profile`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiUser className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">프로필 수정</span>
              </Link>
            )}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  if (canUseFeatureClient('sns-profile', subscriptionInfo)) {
                    router.push(`${partnerBase}/sns-profile`);
                  } else {
                    const message = getFeatureRestrictionMessageClient('sns-profile', subscriptionInfo);
                    setRestrictionMessage(message);
                    setShowFeatureRestrictionModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6 ${canUseFeatureClient('sns-profile', subscriptionInfo) ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                  }`}
              >
                <FiLink className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">나의 SNS<br />프로필</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/sns-profile`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiLink className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">나의 SNS<br />프로필</span>
              </Link>
            )}
            {subscriptionInfo ? (
              <button
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('view-contract', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiFileText className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">나의 계약서<br />보기</span>
              </button>
            ) : (
              <Link
                href={`${partnerBase}/contract`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
              >
                <FiFileText className="text-2xl text-slate-600 md:text-3xl" />
                <span className="text-xs font-semibold text-slate-700 md:text-sm">나의 계약서<br />보기</span>
              </Link>
            )}

            {/* 나의 판매 실적 */}
            <Link
              href={`${partnerBase}/sales`}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 p-4 text-center transition-all hover:from-amber-100 hover:to-orange-200 hover:shadow-lg md:p-6"
            >
              <FiTrendingUp className="text-2xl text-amber-600 md:text-3xl" />
              <span className="text-xs font-semibold text-amber-700 md:text-sm">나의<br />판매 실적</span>
            </Link>

            {/* 설정 */}
            <Link
              href={`${partnerBase}/settings`}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 hover:shadow-lg md:p-6"
            >
              <FiSettings className="text-2xl text-slate-600 md:text-3xl" />
              <span className="text-xs font-semibold text-slate-700 md:text-sm">설정</span>
            </Link>
          </div>
        </section>

        {/* 최근 활동 - 모바일 최적화 */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* 고객 관리 (탭: 전체 고객 / 전화상담고객) */}
            <div className="block rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/5 border border-slate-100 transition-all hover:shadow-xl md:rounded-3xl md:p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl">고객 관리</h2>
                  {subscriptionInfo ? (
                    <button
                      onClick={() => {
                        if (canUseFeatureClient('customer-management', subscriptionInfo)) {
                          router.push(`${partnerBase}/customers${customerTab === 'inquiries' ? '?tab=inquiries' : ''}`);
                        } else {
                          const message = getFeatureRestrictionMessageClient('customer-management', subscriptionInfo);
                          setRestrictionMessage(message);
                          setShowFeatureRestrictionModal(true);
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium md:text-sm"
                    >
                      전체보기 <FiArrowRight className="inline ml-1" />
                    </button>
                  ) : (
                    <Link
                      href={`${partnerBase}/customers${customerTab === 'inquiries' ? '?tab=inquiries' : ''}`}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium md:text-sm"
                    >
                      전체보기 <FiArrowRight className="inline ml-1" />
                    </Link>
                  )}
                </div>
                {/* 탭 버튼 */}
                <div className="flex gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setCustomerTab('all')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${customerTab === 'all'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    전체 고객
                  </button>
                  <button
                    onClick={() => setCustomerTab('inquiries')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${customerTab === 'inquiries'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    전화상담고객
                  </button>
                </div>
              </div>

              {/* 전체 고객 탭 */}
              {customerTab === 'all' && (
                <>
                  {stats.recentLeads.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentLeads.map((lead) => {
                        const content = (
                          <>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-sm md:text-base">
                                  {lead.customerName || '이름 없음'}
                                </p>
                                <p className="text-xs text-gray-500 md:text-sm">{lead.customerPhone || '-'}</p>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getLeadStatusStyle(lead.status)}`}>
                                {formatLeadStatus(lead.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{formatDate(lead.createdAt)}</p>
                          </>
                        );

                        return subscriptionInfo ? (
                          <button
                            key={lead.id}
                            onClick={() => {
                              if (canUseFeatureClient('customer-management', subscriptionInfo)) {
                                router.push(`${partnerBase}/customers?leadId=${lead.id}`);
                              } else {
                                const message = getFeatureRestrictionMessageClient('customer-management', subscriptionInfo);
                                setRestrictionMessage(message);
                                setShowFeatureRestrictionModal(true);
                              }
                            }}
                            className="w-full text-left block rounded-lg border border-gray-200 p-3 md:p-4 hover:border-blue-300 transition-colors"
                          >
                            {content}
                          </button>
                        ) : (
                          <Link
                            key={lead.id}
                            href={`${partnerBase}/customers?leadId=${lead.id}`}
                            className="block rounded-lg border border-gray-200 p-3 md:p-4 hover:border-blue-300 transition-colors"
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-gray-500">리드가 없습니다.</p>
                  )}
                </>
              )}

              {/* 전화상담고객 탭 */}
              {customerTab === 'inquiries' && (
                <>
                  {loadingInquiryCustomers ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-600 mx-auto mb-2"></div>
                      전화상담고객을 불러오는 중...
                    </div>
                  ) : inquiryCustomers.length > 0 ? (
                    <div className="space-y-3">
                      {inquiryCustomers.map((customer) => {
                        const content = (
                          <>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-900 text-sm md:text-base">
                                    {customer.customerName || '이름 없음'}
                                  </p>
                                  <span className="px-2 py-0.5 bg-pink-100 text-pink-800 rounded-full text-xs font-semibold">
                                    전화상담
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 md:text-sm">{customer.customerPhone || '-'}</p>
                                {customer.productName && (
                                  <p className="text-xs text-pink-600 font-semibold mt-1 truncate">
                                    {customer.productName}
                                  </p>
                                )}
                              </div>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getLeadStatusStyle(customer.status)}`}>
                                {formatLeadStatus(customer.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{formatDate(customer.createdAt)}</p>
                          </>
                        );

                        return subscriptionInfo ? (
                          <button
                            key={customer.id}
                            onClick={() => {
                              if (canUseFeatureClient('customer-management', subscriptionInfo)) {
                                router.push(`${partnerBase}/customers?leadId=${customer.id}&tab=inquiries`);
                              } else {
                                const message = getFeatureRestrictionMessageClient('customer-management', subscriptionInfo);
                                setRestrictionMessage(message);
                                setShowFeatureRestrictionModal(true);
                              }
                            }}
                            className="w-full text-left block rounded-lg border border-pink-200 bg-pink-50 p-3 md:p-4 hover:border-pink-300 hover:bg-pink-100 transition-colors"
                          >
                            {content}
                          </button>
                        ) : (
                          <Link
                            key={customer.id}
                            href={`${partnerBase}/customers?leadId=${customer.id}&tab=inquiries`}
                            className="block rounded-lg border border-pink-200 bg-pink-50 p-3 md:p-4 hover:border-pink-300 hover:bg-pink-100 transition-colors"
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-gray-500">전화상담고객이 없습니다.</p>
                  )}
                </>
              )}
            </div>

            {/* 판매원별 DB 관리 현황 (대리점장만 / 정액제 판매원은 제한) */}
            {(isBranchManager || subscriptionInfo) && (
              <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                    <FiUsers className="text-purple-600" />
                    판매원별 DB 관리 현황
                  </h2>
                  <div className="flex items-center gap-2">
                    {subscriptionInfo ? (
                      <>
                        <button
                          onClick={() => {
                            const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                            setRestrictionMessage(message);
                            setShowFeatureRestrictionModal(true);
                          }}
                          className="text-xs text-purple-600 hover:text-purple-700 md:text-sm font-semibold"
                        >
                          전체보기 <FiArrowRight className="inline ml-1" />
                        </button>
                        <button
                          onClick={() => {
                            const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                            setRestrictionMessage(message);
                            setShowFeatureRestrictionModal(true);
                          }}
                          className="text-xs text-purple-600 hover:text-purple-700 md:text-sm font-semibold"
                        >
                          DB 보내기 <FiArrowRight className="inline ml-1" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`${partnerBase}/customers`}
                          className="text-xs text-purple-600 hover:text-purple-700 md:text-sm font-semibold"
                        >
                          전체보기 <FiArrowRight className="inline ml-1" />
                        </Link>
                        <Link
                          href={`${partnerBase}/customers/send-db`}
                          className="text-xs text-purple-600 hover:text-purple-700 md:text-sm font-semibold"
                        >
                          DB 보내기 <FiArrowRight className="inline ml-1" />
                        </Link>
                      </>
                    )}
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

                      const content = (
                        <>
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
                        </>
                      );

                      return subscriptionInfo ? (
                        <button
                          key={agent.agentId}
                          onClick={() => {
                            const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                            setRestrictionMessage(message);
                            setShowFeatureRestrictionModal(true);
                          }}
                          className="w-full text-left block rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:bg-purple-50 transition-all"
                        >
                          {content}
                        </button>
                      ) : (
                        <Link
                          key={agent.agentId}
                          href={`${partnerBase}/customers?agentId=${agent.agentId}`}
                          className="block rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:bg-purple-50 transition-all"
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 구매고객관리 (대리점장만 / 정액제 판매원은 제한) */}
            {(isBranchManager || subscriptionInfo) && (
              <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                      <FiShoppingCart className="text-orange-600" />
                      구매고객관리
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 md:text-sm">
                      예약한 고객들의 정보를 관리하고 여권 등록 링크를 발송할 수 있습니다.
                    </p>
                  </div>
                </div>

                {/* 검색 */}
                <div className="mb-6">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={purchasedSearchTerm}
                      onChange={(e) => setPurchasedSearchTerm(e.target.value)}
                      placeholder="고객명, 전화번호, 이메일, 상품명으로 검색..."
                      className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                </div>

                {/* 예약 목록 */}
                {loadingPurchasedReservations ? (
                  <div className="flex items-center justify-center rounded-lg bg-gray-50 p-12">
                    <div className="text-center">
                      <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
                      <p className="text-gray-600">예약 목록을 불러오는 중...</p>
                    </div>
                  </div>
                ) : filteredPurchasedReservations.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 p-12 text-center">
                    <p className="text-gray-600">예약 정보가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPurchasedReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-3">
                              <h3 className="text-base md:text-lg font-semibold text-gray-900">
                                {reservation.user?.name || '이름 없음'}
                              </h3>
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                                {reservation.pnrStatus || '예약'}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <FiPhone className="text-gray-400" />
                                <span>{reservation.user?.phone || '전화번호 없음'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FiUser className="text-gray-400" />
                                <span>{reservation.user?.email || '이메일 없음'}</span>
                              </div>
                              {reservation.trip && (
                                <div className="flex items-center gap-2">
                                  <FiCalendar className="text-gray-400" />
                                  <span>
                                    {reservation.trip.product?.cruiseLine} {reservation.trip.product?.shipName}
                                    {reservation.trip.departureDate && (
                                      <> • {new Date(reservation.trip.departureDate).toLocaleDateString('ko-KR')}</>
                                    )}
                                  </span>
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                총 {reservation.totalPeople}명 • 예약일: {new Date(reservation.createdAt).toLocaleDateString('ko-KR')}
                              </div>
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => handleOpenPurchasedDetailModal(reservation)}
                              className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs md:text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
                            >
                              <FiUser />
                              <span>상세정보</span>
                            </button>
                            <button
                              onClick={() => handleOpenPassportModal(reservation)}
                              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs md:text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                              <FiSend />
                              <span>여권 보내기</span>
                            </button>
                            <button
                              onClick={() => handleOpenChatbotModal(reservation)}
                              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs md:text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                            >
                              <FiMessageSquare />
                              <span>챗봇 보내기</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 랜딩페이지 목록 (대리점장만 / 정액제 판매원은 제한) */}
            {(isBranchManager || subscriptionInfo) && (
              <div className="block rounded-2xl bg-white p-4 shadow-lg transition-all hover:shadow-xl md:rounded-3xl md:p-6">
                {subscriptionInfo ? (
                  <button
                    onClick={() => {
                      const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                      setRestrictionMessage(message);
                      setShowFeatureRestrictionModal(true);
                    }}
                    className="w-full text-left block"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                        <FiLayers className="text-amber-600" />
                        최근 랜딩페이지
                      </h2>
                      <span className="text-xs text-amber-600 hover:text-amber-700 md:text-sm">
                        전체보기 <FiArrowRight className="inline ml-1" />
                      </span>
                    </div>
                  </button>
                ) : (
                  <Link
                    href={`${partnerBase}/landing-pages`}
                    className="block"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                        <FiLayers className="text-amber-600" />
                        최근 랜딩페이지
                      </h2>
                      <span className="text-xs text-amber-600 hover:text-amber-700 md:text-sm">
                        전체보기 <FiArrowRight className="inline ml-1" />
                      </span>
                    </div>
                  </Link>
                )}
                {loadingLandingPages ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    랜딩페이지를 불러오는 중입니다...
                  </div>
                ) : recentLandingPages.length > 0 ? (
                  <div className="space-y-3">
                    {recentLandingPages.map((page) => {
                      const pageContent = (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 text-sm md:text-base">
                                {page.title}
                              </p>
                              {!page.isActive && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">비활성</span>
                              )}
                            </div>
                            {page.category && (
                              <p className="text-xs text-gray-500 md:text-sm">{page.category}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <p className="text-xs text-gray-400">조회수: {page.viewCount.toLocaleString()}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(page.updatedAt).toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <FiArrowRight className="text-gray-400" />
                        </div>
                      );

                      return subscriptionInfo ? (
                        <button
                          key={page.id}
                          onClick={() => {
                            const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                            setRestrictionMessage(message);
                            setShowFeatureRestrictionModal(true);
                          }}
                          className="w-full text-left block rounded-lg border border-gray-200 p-3 md:p-4 hover:border-amber-300 transition-colors"
                        >
                          {pageContent}
                        </button>
                      ) : (
                        <Link
                          key={page.id}
                          href={`${partnerBase}/landing-pages/${page.id}/edit`}
                          className="block rounded-lg border border-gray-200 p-3 md:p-4 hover:border-amber-300 transition-colors"
                        >
                          {pageContent}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500 mb-3">랜딩페이지가 없습니다.</p>
                    {subscriptionInfo ? (
                      <button
                        onClick={() => {
                          const message = getFeatureRestrictionMessageClient('team-management', subscriptionInfo);
                          setRestrictionMessage(message);
                          setShowFeatureRestrictionModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold"
                      >
                        <FiPlus />
                        새 랜딩페이지 만들기
                      </button>
                    ) : (
                      <Link
                        href={`${partnerBase}/landing-pages/new`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiPlus />
                        새 랜딩페이지 만들기
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 담당 멘토 정보 (판매원만) */}
            {isSalesAgent && profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile?.[0]?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile && (
              <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                    <FiUser className="text-purple-600" />
                    담당 멘토
                  </h2>
                </div>
                {(() => {
                  const mentor = profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
                  return (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="rounded-full bg-purple-600 p-2">
                            <FiUser className="text-white text-lg" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-purple-900 text-base md:text-lg">
                              {mentor.displayName || '정보 없음'}
                            </p>
                            {mentor.branchLabel && (
                              <p className="text-sm text-purple-700">{mentor.branchLabel}</p>
                            )}
                          </div>
                        </div>
                        {mentor.affiliateCode && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <p className="text-xs text-purple-600 mb-1">{affiliateTerm} 코드</p>
                            <p className="text-sm font-semibold text-purple-900">{mentor.affiliateCode}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* 내 판매 목록 */}
            <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                  <FiShoppingCart className="text-green-600" />
                  내 판매 목록
                </h2>
                <button
                  onClick={() => loadMySales(selectedMonth)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                >
                  <FiRefreshCw className="text-base" />
                  새로고침
                </button>
              </div>
              {loadingMySales ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  판매 목록을 불러오는 중입니다...
                </div>
              ) : mySales.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  판매 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {mySales.map((sale) => {
                    const getStatusInfo = () => {
                      switch (sale.status) {
                        case 'PENDING':
                          return {
                            label: '대기 중',
                            color: 'text-gray-600',
                            bgColor: 'bg-gray-50',
                            icon: <FiClock className="text-base" />,
                          };
                        case 'PENDING_APPROVAL':
                          return {
                            label: '승인 대기',
                            color: 'text-yellow-600',
                            bgColor: 'bg-yellow-50',
                            icon: <FiClock className="text-base" />,
                          };
                        case 'APPROVED':
                          return {
                            label: '승인됨',
                            color: 'text-green-600',
                            bgColor: 'bg-green-50',
                            icon: <FiCheckCircle className="text-base" />,
                          };
                        case 'REJECTED':
                          return {
                            label: '거부됨',
                            color: 'text-red-600',
                            bgColor: 'bg-red-50',
                            icon: <FiXCircle className="text-base" />,
                          };
                        default:
                          return {
                            label: '알 수 없음',
                            color: 'text-gray-600',
                            bgColor: 'bg-gray-50',
                            icon: <FiClock className="text-base" />,
                          };
                      }
                    };
                    const statusInfo = getStatusInfo();
                    return (
                      <div
                        key={sale.id}
                        className="rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-gray-900">
                                {sale.productCode || '상품 코드 없음'}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}
                              >
                                {statusInfo.icon}
                                {statusInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>
                                {formatCurrency(sale.saleAmount)}
                              </span>
                              {sale.saleDate && (
                                <span>
                                  <FiClock className="inline mr-1" />
                                  {new Date(sale.saleDate).toLocaleDateString('ko-KR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(sale.status === 'PENDING' || sale.status === 'REJECTED' || sale.status === 'PENDING_APPROVAL') && (
                              <button
                                onClick={() => {
                                  setSelectedSaleForConfirmation(sale);
                                  setShowSalesConfirmationModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                {sale.status === 'PENDING_APPROVAL' ? '상세 보기' : sale.status === 'REJECTED' ? '다시 확정 요청' : '확정 요청'}
                              </button>
                            )}
                            {sale.status === 'APPROVED' && (
                              <button
                                onClick={() => {
                                  setSelectedSaleForConfirmation(sale);
                                  setShowSalesConfirmationModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                              >
                                상세 보기
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 팀원 판매 현황 (대리점장만) */}
            {isBranchManager && (
              <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                    <FiUsers className="text-purple-600" />
                    팀원 판매 현황
                  </h2>
                  <button
                    onClick={loadTeamSales}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    <FiRefreshCw className="text-base" />
                    새로고침
                  </button>
                </div>
                {loadingTeamSales ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    팀원 판매 현황을 불러오는 중입니다...
                  </div>
                ) : teamSales.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    팀원 판매 내역이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamSales.map((sale) => {
                      const getStatusLabel = () => {
                        switch (sale.status) {
                          case 'PENDING': return { label: '확정 대기', color: 'text-gray-600', bg: 'bg-gray-100' };
                          case 'PENDING_APPROVAL': return { label: '승인 심사중', color: 'text-yellow-700', bg: 'bg-yellow-100' };
                          case 'APPROVED': return { label: '승인 완료', color: 'text-green-700', bg: 'bg-green-100' };
                          case 'REJECTED': return { label: '승인 거부', color: 'text-red-700', bg: 'bg-red-100' };
                          case 'CONFIRMED': return { label: '구매 확정', color: 'text-blue-700', bg: 'bg-blue-100' };
                          default: return { label: sale.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                        }
                      };
                      const statusInfo = getStatusLabel();
                      return (
                        <div
                          key={sale.id}
                          className="rounded-lg border border-purple-200 p-4 hover:border-purple-400 hover:shadow-md transition-all bg-purple-50/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700">
                                  <FiUser className="text-xs" />
                                  {sale.agentName}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.color} ${statusInfo.bg}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <div className="font-semibold text-gray-900 mb-1">
                                {sale.productCode || '상품 코드 없음'}
                                {sale.customerName && (
                                  <span className="ml-2 text-sm text-gray-500 font-normal">
                                    (고객: {sale.customerName})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(sale.saleAmount)}
                                </span>
                                {sale.saleDate && (
                                  <span>
                                    <FiClock className="inline mr-1" />
                                    {new Date(sale.saleDate).toLocaleDateString('ko-KR')}
                                  </span>
                                )}
                                {sale.overrideCommission > 0 && (
                                  <span className="text-purple-600 font-medium">
                                    오버라이드: {formatCurrency(sale.overrideCommission)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {teamSales.length > 0 && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-700 font-medium">총 팀원 판매: {teamSales.length}건</span>
                      <span className="text-purple-700 font-semibold">
                        총 오버라이드 수당: {formatCurrency(teamSales.reduce((sum, s) => sum + s.overrideCommission, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 계약서 관리 (대리점장만) */}
            {isBranchManager && (
              <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                    <FiFileText className="text-indigo-600" />
                    계약서 관리
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadContracts}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      <FiRefreshCw className="text-base" />
                      새로고침
                    </button>
                  </div>
                </div>

                {/* 검색 및 필터 */}
                <div className="mb-4 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1 max-w-md">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="이름, 전화번호, 이메일 검색..."
                        value={contractSearch}
                        onChange={(e) => setContractSearch(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <select
                      value={contractStatusFilter}
                      onChange={(e) => setContractStatusFilter(e.target.value as 'all' | 'submitted' | 'completed' | 'rejected')}
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="all">전체</option>
                      <option value="submitted">제출됨</option>
                      <option value="completed">완료됨</option>
                      <option value="rejected">거부됨</option>
                    </select>
                  </div>
                </div>

                {/* 계약 목록 테이블 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">신청자 정보</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">상태</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">제출일</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loadingContracts ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                            계약 목록을 불러오는 중입니다...
                          </td>
                        </tr>
                      ) : (() => {
                        // 필터링된 계약서 목록
                        const filteredContracts = contracts.filter((contract) => {
                          const matchesSearch = !contractSearch ||
                            contract.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
                            contract.phone.includes(contractSearch) ||
                            (contract.email && contract.email.toLowerCase().includes(contractSearch.toLowerCase()));
                          const matchesStatus = contractStatusFilter === 'all' || contract.status === contractStatusFilter;
                          return matchesSearch && matchesStatus;
                        });

                        if (filteredContracts.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                                {contractSearch || contractStatusFilter !== 'all'
                                  ? '검색 조건에 맞는 계약서가 없습니다.'
                                  : '계약서가 없습니다.'}
                              </td>
                            </tr>
                          );
                        }

                        return filteredContracts.map((contract) => (
                          <tr key={contract.id} className="hover:bg-blue-50/40">
                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-gray-900">{contract.name}</div>
                              <div className="text-xs text-gray-500">{contract.phone}</div>
                              {contract.email && <div className="text-xs text-gray-500">{contract.email}</div>}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${contract.status === 'completed' ? 'bg-purple-50 text-purple-700' :
                                contract.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                                  contract.status === 'rejected' ? 'bg-red-50 text-red-700' :
                                    'bg-gray-50 text-gray-700'
                                }`}>
                                {contract.status === 'completed' ? <FiCheckCircle className="text-base" /> :
                                  contract.status === 'submitted' ? <FiClock className="text-base" /> :
                                    contract.status === 'rejected' ? <FiXCircle className="text-base" /> :
                                      <FiFileText className="text-base" />}
                                {contract.status === 'completed' ? '완료됨' :
                                  contract.status === 'submitted' ? '제출됨' :
                                    contract.status === 'rejected' ? '거부됨' :
                                      contract.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {contract.submittedAt
                                ? new Date(contract.submittedAt).toLocaleDateString('ko-KR')
                                : '-'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewDetail(contract.id)}
                                  disabled={loadingContractDetail}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <FiEye className="text-xs" />
                                  상세
                                </button>
                                {contract.status === 'submitted' && (
                                  <>
                                    <button
                                      onClick={() => handleCompleteContract(contract.id)}
                                      disabled={completingContractId === contract.id}
                                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                      title="계약서 완료 승인 (PDF 전송)"
                                    >
                                      <FiFileText className="text-xs" />
                                      완료 승인
                                    </button>
                                    <button
                                      onClick={() => handleReject(contract.id)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                    >
                                      <FiXCircle className="text-xs" />
                                      거부
                                    </button>
                                  </>
                                )}
                                {contract.status === 'completed' && (
                                  <button
                                    onClick={() => handleSendPdf(contract.id)}
                                    disabled={sendingPdfContractId === contract.id}
                                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <FiFileText className="text-xs" />
                                    PDF 보내기
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(contract.id)}
                                  disabled={deletingContractId === contract.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  <FiTrash2 className="text-xs" />
                                  {deletingContractId === contract.id ? '삭제 중...' : '삭제'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 계약서 보내기 모달 */}
            {isBranchManager && (
              <ContractInviteModal
                isOpen={showSendContractModal}
                onClose={() => setShowSendContractModal(false)}
                contractType={contractType}
                onSuccess={() => {
                  setShowSendContractModal(false);
                  loadContracts();
                }}
              />
            )}

            {/* 계약서 상세보기 모달 */}
            {isBranchManager && showContractDetail && selectedContract && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-900">계약서 상세</h2>
                    <button
                      onClick={() => {
                        setShowContractDetail(false);
                        setSelectedContract(null);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiEyeOff className="text-xl text-gray-600" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">이름</p>
                        <p className="text-base text-gray-900">{selectedContract.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">전화번호</p>
                        <p className="text-base text-gray-900">{selectedContract.phone}</p>
                      </div>
                      {selectedContract.email && (
                        <div className="col-span-2">
                          <p className="text-sm font-semibold text-gray-500 mb-1">이메일</p>
                          <p className="text-base text-gray-900">{selectedContract.email}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">상태</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${selectedContract.status === 'completed' ? 'bg-green-100 text-green-700' :
                          selectedContract.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                          {selectedContract.status === 'completed' ? '완료됨' : '제출됨'}
                        </span>
                      </div>
                      {selectedContract.submittedAt && (
                        <div>
                          <p className="text-sm font-semibold text-gray-500 mb-1">제출일</p>
                          <p className="text-base text-gray-900">{formatDate(selectedContract.submittedAt)}</p>
                        </div>
                      )}
                      {selectedContract.completedAt && (
                        <div>
                          <p className="text-sm font-semibold text-gray-500 mb-1">완료일</p>
                          <p className="text-base text-gray-900">{formatDate(selectedContract.completedAt)}</p>
                        </div>
                      )}
                    </div>
                    {selectedContract.mentor && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-700 mb-2">담당 멘토</p>
                        <p className="text-base text-blue-900 mb-1">{selectedContract.mentor.displayName || '정보 없음'}</p>
                        {selectedContract.mentor.branchLabel && (
                          <p className="text-sm text-blue-600">{selectedContract.mentor.branchLabel}</p>
                        )}
                        {selectedContract.mentor.contactPhone && (
                          <p className="text-sm text-blue-600">{selectedContract.mentor.contactPhone}</p>
                        )}
                      </div>
                    )}
                    {/* 계약서 싸인 섹션 */}
                    {(selectedContract.metadata?.signatures || selectedContract.metadata?.signature) && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">계약서 싸인</h3>
                        <div className="space-y-4">
                          {selectedContract.metadata?.signatures && (
                            <>
                              {/* 교육 계약서 싸인 */}
                              {selectedContract.metadata.signatures.education?.url && (
                                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-blue-700">교육 계약서 싸인</h4>
                                    <button
                                      onClick={() => {
                                        const contractType = selectedContract.metadata?.contractType || 'SALES_AGENT';
                                        setEducationContractType(contractType);
                                        setShowEducationContractModal(true);
                                        // 계약서 열람 확인 추가
                                        if (selectedContract) {
                                          setViewedContractIds(prev => new Set(prev).add(selectedContract.id));
                                        }
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                    >
                                      교육계약서 전문보기
                                    </button>
                                  </div>
                                  {selectedContract.metadata.signatures.education.originalName && (
                                    <p className="text-xs text-blue-600 mb-2">
                                      파일명: {selectedContract.metadata.signatures.education.originalName}
                                    </p>
                                  )}
                                  <img
                                    src={selectedContract.metadata.signatures.education.url}
                                    alt="교육 계약서 서명"
                                    className="max-w-full h-auto"
                                  />
                                </div>
                              )}
                              {/* B2B 계약서 싸인 (대리점장 전용) */}
                              {selectedContract.metadata.signatures.b2b?.url && (
                                <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                                  <h4 className="text-sm font-semibold text-purple-700 mb-2">B2B 계약서 싸인</h4>
                                  {selectedContract.metadata.signatures.b2b.originalName && (
                                    <p className="text-xs text-purple-600 mb-2">
                                      파일명: {selectedContract.metadata.signatures.b2b.originalName}
                                    </p>
                                  )}
                                  <img
                                    src={selectedContract.metadata.signatures.b2b.url}
                                    alt="B2B 계약서 서명"
                                    className="max-w-full h-auto"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-4 border-t">
                      {selectedContract.status === 'submitted' && (
                        <button
                          onClick={() => {
                            setShowContractDetail(false);
                            handleCompleteContract(selectedContract.id);
                          }}
                          disabled={completingContractId === selectedContract.id}
                          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {completingContractId === selectedContract.id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              처리 중...
                            </>
                          ) : (
                            <>
                              <FiCheckCircle />
                              완료 승인 (PDF 전송)
                            </>
                          )}
                        </button>
                      )}
                      {selectedContract.status === 'completed' && (
                        <button
                          onClick={() => {
                            setShowContractDetail(false);
                            handleSendPdf(selectedContract.id);
                          }}
                          disabled={sendingPdfContractId === selectedContract.id}
                          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {sendingPdfContractId === selectedContract.id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              전송 중...
                            </>
                          ) : (
                            <>
                              <FiFileText />
                              PDF 보내기
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowContractDetail(false);
                          setSelectedContract(null);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 최근 판매 */}
            {subscriptionInfo ? (
              <div
                onClick={() => {
                  const message = getFeatureRestrictionMessageClient('payment-settlement', subscriptionInfo);
                  setRestrictionMessage(message);
                  setShowFeatureRestrictionModal(true);
                }}
                className="block rounded-2xl bg-white p-4 shadow-lg transition-all hover:shadow-xl md:rounded-3xl md:p-6 cursor-pointer"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl">최근 판매</h2>
                  <span className="text-xs text-blue-600 hover:text-blue-700 md:text-sm">
                    전체보기 <FiArrowRight className="inline ml-1" />
                  </span>
                </div>
                {stats.recentSales.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentSales.map((sale) => (
                      <div key={sale.id} className="rounded-lg border border-gray-200 p-3 md:p-4 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-base md:text-lg">
                              {formatCurrency(sale.saleAmount)}
                            </p>
                            <p className="text-xs text-gray-500 md:text-sm">
                              {formatDate(sale.saleDate || sale.createdAt)}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sale.status === 'CONFIRMED' || sale.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            sale.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              sale.status === 'PENDING_APPROVAL' ? 'bg-blue-100 text-blue-700' :
                                sale.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                            }`}>
                            {formatSaleStatus(sale.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">판매 기록이 없습니다.</p>
                )}
              </div>
            ) : (
              <div
                onClick={() => router.push(`${partnerBase}/payment`)}
                className="block rounded-2xl bg-white p-4 shadow-lg transition-all hover:shadow-xl md:rounded-3xl md:p-6 cursor-pointer"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 md:text-xl">최근 판매</h2>
                  <span className="text-xs text-blue-600 hover:text-blue-700 md:text-sm">
                    전체보기 <FiArrowRight className="inline ml-1" />
                  </span>
                </div>
                {stats.recentSales.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentSales.map((sale) => (
                      <div key={sale.id} className="rounded-lg border border-gray-200 p-3 md:p-4 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-base md:text-lg">
                              {formatCurrency(sale.saleAmount)}
                            </p>
                            <p className="text-xs text-gray-500 md:text-sm">
                              {formatDate(sale.saleDate || sale.createdAt)}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sale.status === 'CONFIRMED' || sale.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            sale.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              sale.status === 'PENDING_APPROVAL' ? 'bg-blue-100 text-blue-700' :
                                sale.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                            }`}>
                            {formatSaleStatus(sale.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">판매 기록이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 계약서 타입 선택 모달 */}
      {isBranchManager && showContractTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">계약서 타입 선택</h2>
              <p className="text-sm text-gray-600 mt-1">
                보낼 계약서 타입을 선택해주세요.
              </p>
            </div>

            {loadingContractTypes ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">계약서 목록 로딩 중...</span>
              </div>
            ) : availableContractTypes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>사용 가능한 계약서가 없습니다.</p>
                <p className="text-sm mt-2">관리자에게 문의해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {availableContractTypes.map((ct) => {
                  // 계약서 타입별 색상 설정
                  const colorMap: Record<string, { border: string; bg: string; hover: string; badge: string; text: string }> = {
                    SALES_AGENT: { border: 'border-blue-200', bg: 'bg-blue-50', hover: 'hover:border-blue-400 hover:bg-blue-100', badge: 'bg-blue-100', text: 'text-blue-700' },
                    BRANCH_MANAGER: { border: 'border-purple-200', bg: 'bg-purple-50', hover: 'hover:border-purple-400 hover:bg-purple-100', badge: 'bg-purple-100', text: 'text-purple-700' },
                    CRUISE_STAFF: { border: 'border-green-200', bg: 'bg-green-50', hover: 'hover:border-green-400 hover:bg-green-100', badge: 'bg-green-100', text: 'text-green-700' },
                    PRIMARKETER: { border: 'border-orange-200', bg: 'bg-orange-50', hover: 'hover:border-orange-400 hover:bg-orange-100', badge: 'bg-orange-100', text: 'text-orange-700' },
                  };
                  const defaultColor = { border: 'border-gray-200', bg: 'bg-gray-50', hover: 'hover:border-gray-400 hover:bg-gray-100', badge: 'bg-gray-100', text: 'text-gray-700' };
                  const colors = colorMap[ct.code] || (ct.isCustom ? { border: 'border-indigo-200', bg: 'bg-indigo-50', hover: 'hover:border-indigo-400 hover:bg-indigo-100', badge: 'bg-indigo-100', text: 'text-indigo-700' } : defaultColor);

                  // 계약서 타입별 라벨
                  const labelMap: Record<string, string> = {
                    SALES_AGENT: '판매원',
                    BRANCH_MANAGER: '대리점장',
                    CRUISE_STAFF: '크루즈스탭',
                    PRIMARKETER: '프리마케터',
                  };
                  const label = labelMap[ct.code] || ct.title.replace(/계약서/g, '').trim();

                  return (
                    <button
                      key={ct.code}
                      onClick={() => {
                        setSelectedContractType(ct.code);
                        setShowContractTypeModal(false);
                        setShowContractInviteModal(true);
                      }}
                      className={`flex flex-col items-start gap-3 rounded-xl border-2 ${colors.border} ${colors.bg} p-4 text-left transition-all ${colors.hover} hover:shadow-md`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ct.icon}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full ${colors.badge} px-2 py-1 text-xs font-semibold ${colors.text}`}>
                          {label}
                          {ct.isCustom && <span className="ml-1 text-[10px]">✨</span>}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{ct.title}</h3>
                        {ct.price && <p className="text-xs text-gray-600 mt-1">{ct.price}</p>}
                        {ct.description && <p className="text-xs text-gray-500 mt-0.5">{ct.description}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowContractTypeModal(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계약서 보내기 모달 */}
      {isBranchManager && (
        <ContractInviteModal
          isOpen={showContractInviteModal}
          onClose={() => {
            setShowContractInviteModal(false);
            setSelectedContractType('SALES_AGENT');
          }}
          currentProfileId={profile.id}
          contractType={selectedContractType}
          onSuccess={() => {
            setShowContractInviteModal(false);
            setSelectedContractType('SALES_AGENT');
          }}
        />
      )}


      {/* 고객 등록 모달 */}
      {showCustomerRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-white rounded-t-2xl">
              <h2 className="text-2xl font-bold">크루즈가이드 동행인 등록</h2>
              <p className="text-sm text-white/90 mt-1">
                등록된 동행인은 비밀번호 3800으로 크루즈닷AI에 로그인할 수 있습니다.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={registerForm.isCompanion}
                    onChange={(e) => setRegisterForm({ ...registerForm, isCompanion: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-700">동행인으로 등록</span>
                </label>
              </div>

              {registerForm.isCompanion && (
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    메인 고객 전화번호 <span className="text-red-500">*</span>
                    {isLoadingProductCode && (
                      <span className="ml-2 text-xs text-gray-500">상품 코드 조회 중...</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    value={registerForm.mainCustomerPhone}
                    onChange={(e) => handleMainCustomerPhoneChange(e.target.value)}
                    onFocus={() => {
                      if (mainCustomerPhoneSuggestions.length > 0) {
                        setShowMainCustomerPhoneSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // 클릭 이벤트가 발생할 시간을 주기 위해 약간의 지연
                      setTimeout(() => setShowMainCustomerPhoneSuggestions(false), 200);
                    }}
                    placeholder="010-1234-5678"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                    disabled={isLoadingProductCode}
                  />
                  {showMainCustomerPhoneSuggestions && mainCustomerPhoneSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {mainCustomerPhoneSuggestions.map((customer) => (
                        <li
                          key={customer.id}
                          onClick={() => {
                            handleMainCustomerPhoneChange(customer.phone);
                            setShowMainCustomerPhoneSuggestions(false);
                          }}
                          className="px-4 py-2 cursor-pointer hover:bg-green-50 text-sm border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-xs text-gray-500">{customer.phone}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    💡 메인 고객 전화번호를 입력하면 구매한 상품 코드가 자동으로 입력됩니다.
                  </p>
                </div>
              )}

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  고객 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={registerForm.customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => {
                    if (customerNameSuggestions.length > 0) {
                      setShowCustomerNameSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // 클릭 이벤트가 발생할 시간을 주기 위해 약간의 지연
                    setTimeout(() => setShowCustomerNameSuggestions(false), 200);
                  }}
                  placeholder="홍길동"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                {showCustomerNameSuggestions && customerNameSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {customerNameSuggestions.map((customer) => (
                      <li
                        key={customer.id}
                        onClick={() => {
                          setRegisterForm({
                            ...registerForm,
                            customerName: customer.name,
                            customerPhone: customer.phone,
                          });
                          setShowCustomerNameSuggestions(false);
                        }}
                        className="px-4 py-2 cursor-pointer hover:bg-green-50 text-sm border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.phone}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  고객 전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={registerForm.customerPhone}
                  onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                  onFocus={() => {
                    if (customerPhoneSuggestions.length > 0) {
                      setShowCustomerPhoneSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // 클릭 이벤트가 발생할 시간을 주기 위해 약간의 지연
                    setTimeout(() => setShowCustomerPhoneSuggestions(false), 200);
                  }}
                  placeholder="010-1234-5678"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                {showCustomerPhoneSuggestions && customerPhoneSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {customerPhoneSuggestions.map((customer) => (
                      <li
                        key={customer.id}
                        onClick={() => {
                          setRegisterForm({
                            ...registerForm,
                            customerName: customer.name,
                            customerPhone: customer.phone,
                          });
                          setShowCustomerPhoneSuggestions(false);
                        }}
                        className="px-4 py-2 cursor-pointer hover:bg-green-50 text-sm border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.phone}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  상품 코드 {registerForm.isCompanion ? '(자동 입력됨)' : '(선택사항)'}
                </label>
                <input
                  type="text"
                  value={registerForm.productCode}
                  onChange={(e) => setRegisterForm({ ...registerForm, productCode: e.target.value.toUpperCase() })}
                  placeholder="POP-NEW-001"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  disabled={registerForm.isCompanion && isLoadingProductCode}
                />
                {registerForm.isCompanion && registerForm.productCode && (
                  <p className="mt-1 text-xs text-green-600">
                    ✅ 메인 고객의 상품 코드가 자동으로 입력되었습니다.
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800">
                  <strong>💡 안내:</strong> 등록된 동행인은 이름과 전화번호, 비밀번호 <strong>3800</strong>으로 크루즈닷AI에 로그인할 수 있습니다.
                  <br />
                  비밀번호는 동행인에게 구두로 전달해주세요.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowCustomerRegisterModal(false);
                  setRegisterForm({
                    customerName: '',
                    customerPhone: '',
                    productCode: '',
                    isCompanion: false,
                    mainCustomerPhone: '',
                  });
                }}
                disabled={isRegistering}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleRegisterCustomer}
                disabled={isRegistering}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
              >
                {isRegistering ? '등록 중...' : '동행인 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 판매 확정 모달 */}
      <SalesConfirmationModal
        sale={selectedSaleForConfirmation}
        isOpen={showSalesConfirmationModal}
        onClose={() => {
          setShowSalesConfirmationModal(false);
          setSelectedSaleForConfirmation(null);
        }}
        onSuccess={() => {
          loadMySales();
        }}
      />

      {/* 교육계약서 전문 모달 */}
      {showEducationContractModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => setShowEducationContractModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {educationContractType === 'BRANCH_MANAGER' ? '대리점장' : educationContractType === 'CRUISE_STAFF' ? '크루즈스탭' : educationContractType === 'PRIMARKETER' ? '프리마케터' : '판매원'} 교육 계약서 전문
              </h3>
              <button
                type="button"
                onClick={() => setShowEducationContractModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>
            <div className="h-[70vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-700 space-y-4">
              <p className="text-slate-700 leading-relaxed">
                교육 계약서 전문은 관리자 패널에서 확인하실 수 있습니다.
                <br />
                계약서 상세 정보는 계약서 상세 모달에서 확인하실 수 있습니다.
              </p>
              <p className="text-xs text-slate-500 mt-4">
                ※ 본 교육 계약서는 전자 서명으로 체결되며, 갑(크루즈닷)의 최종 승인을 통해 효력이 발생합니다.
              </p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowEducationContractModal(false)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구매고객관리 - 여권 보내기 모달 */}
      {showPassportModal && selectedPurchasedReservation && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPassportModal(false);
              setPassportPreviewDevice(null);
            }
          }}
        >
          <div
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">여권 보내기</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPassportModal(false);
                  setPassportPreviewDevice(null);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-1">고객 정보</p>
                    <p className="text-sm text-blue-800">{selectedPurchasedReservation.user?.name || '이름 없음'}</p>
                    <p className="text-sm text-blue-800">{selectedPurchasedReservation.user?.phone || '전화번호 없음'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      전화번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={passportPhone}
                      onChange={(e) => setPassportPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      메시지 내용 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={passportMessage}
                      onChange={(e) => setPassportMessage(e.target.value)}
                      rows={10}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="여권 등록 링크가 포함된 메시지를 입력하세요."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPassportLink}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FiLink />
                      <span>링크 복사</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassportPreviewDevice('iphone')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>아이폰 미리보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassportPreviewDevice('samsung')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>삼성 미리보기</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendPassportMessage}
                    disabled={sendingPassport || !passportPhone || !passportMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {sendingPassport ? (
                      <>
                        <FiRefreshCw className="animate-spin" />
                        <span>발송 중...</span>
                      </>
                    ) : (
                      <>
                        <FiSend />
                        <span>문자 보내기</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  {passportPreviewDevice ? (
                    <div className={`relative ${passportPreviewDevice === 'iphone' ? 'w-[375px]' : 'w-[360px]'}`}>
                      <div className={`relative ${passportPreviewDevice === 'iphone' ? 'bg-black rounded-[3rem] p-2' : 'bg-gray-800 rounded-[2.5rem] p-1.5'}`}>
                        {passportPreviewDevice === 'iphone' && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-black rounded-b-[1.5rem] z-10"></div>
                        )}
                        <div className={`bg-white ${passportPreviewDevice === 'iphone' ? 'rounded-[2.5rem]' : 'rounded-[2rem]'} overflow-hidden`}>
                          <div className={`${passportPreviewDevice === 'iphone' ? 'h-11 pt-2' : 'h-8 pt-1'} bg-white flex items-center justify-between px-4 text-xs font-semibold`}>
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                              <span>📶</span>
                              <span>📶</span>
                              <span>🔋</span>
                            </div>
                          </div>
                          <div className="h-[600px] bg-gray-50 p-4 overflow-y-auto">
                            <div className="space-y-3">
                              <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {passportMessage || '메시지 내용을 입력하세요.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 min-h-[400px]">
                      <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">📱</p>
                        <p className="text-sm">미리보기 버튼을 클릭하면</p>
                        <p className="text-sm">스마트폰 화면을 확인할 수 있습니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구매고객관리 - 여권채팅봇 보내기 모달 */}
      {showChatbotModal && selectedPurchasedReservation && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowChatbotModal(false);
              setPassportPreviewDevice(null);
            }
          }}
        >
          <div
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">여권채팅봇 보내기</h3>
              <button
                type="button"
                onClick={() => {
                  setShowChatbotModal(false);
                  setPassportPreviewDevice(null);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="rounded-xl bg-green-50 p-4 border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-1">고객 정보</p>
                    <p className="text-sm text-green-800">{selectedPurchasedReservation.user?.name || '이름 없음'}</p>
                    <p className="text-sm text-green-800">{selectedPurchasedReservation.user?.phone || '전화번호 없음'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      챗봇 링크
                    </label>
                    <div className="mb-3 rounded-lg bg-white border border-green-300 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">링크 URL</p>
                      <p className="text-xs text-gray-900 break-all font-mono">
                        {chatbotLink}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      메시지 내용 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={chatbotMessage}
                      onChange={(e) => setChatbotMessage(e.target.value)}
                      rows={10}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                      placeholder="여권 챗봇 링크가 포함된 메시지를 입력하세요."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyChatbotLink}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FiLink />
                      <span>링크 복사</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassportPreviewDevice('iphone')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>아이폰 미리보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassportPreviewDevice('samsung')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>삼성 미리보기</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendChatbotMessage}
                    disabled={sendingChatbot || !chatbotMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {sendingChatbot ? (
                      <>
                        <FiRefreshCw className="animate-spin" />
                        <span>발송 중...</span>
                      </>
                    ) : (
                      <>
                        <FiSend />
                        <span>문자 보내기</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  {passportPreviewDevice ? (
                    <div className={`relative ${passportPreviewDevice === 'iphone' ? 'w-[375px]' : 'w-[360px]'}`}>
                      <div className={`relative ${passportPreviewDevice === 'iphone' ? 'bg-black rounded-[3rem] p-2' : 'bg-gray-800 rounded-[2.5rem] p-1.5'}`}>
                        {passportPreviewDevice === 'iphone' && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-black rounded-b-[1.5rem] z-10"></div>
                        )}
                        <div className={`bg-white ${passportPreviewDevice === 'iphone' ? 'rounded-[2.5rem]' : 'rounded-[2rem]'} overflow-hidden`}>
                          <div className={`${passportPreviewDevice === 'iphone' ? 'h-11 pt-2' : 'h-8 pt-1'} bg-white flex items-center justify-between px-4 text-xs font-semibold`}>
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                              <span>📶</span>
                              <span>📶</span>
                              <span>🔋</span>
                            </div>
                          </div>
                          <div className="h-[600px] bg-gray-50 p-4 overflow-y-auto">
                            <div className="space-y-3">
                              <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {chatbotMessage || '메시지 내용을 입력하세요.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 min-h-[400px]">
                      <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">📱</p>
                        <p className="text-sm">미리보기 버튼을 클릭하면</p>
                        <p className="text-sm">스마트폰 화면을 확인할 수 있습니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구매고객관리 - 상세정보 (APIS) 모달 */}
      {showPurchasedDetailModal && purchasedReservationDetail && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPurchasedDetailModal(false);
              setPurchasedReservationDetail(null);
            }
          }}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">구매고객 상세정보 (APIS)</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPurchasedDetailModal(false);
                  setPurchasedReservationDetail(null);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="px-6 py-6">
              {loadingPurchasedDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h4 className="mb-3 text-lg font-semibold text-gray-900">고객 정보</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-gray-500">이름</p>
                        <p className="text-base text-gray-900">{purchasedReservationDetail.user?.name || '미입력'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">전화번호</p>
                        <p className="text-base text-gray-900">{purchasedReservationDetail.user?.phone || '미입력'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">이메일</p>
                        <p className="text-base text-gray-900">{purchasedReservationDetail.user?.email || '미입력'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">PNR 상태</p>
                        <p className="text-base text-gray-900">{purchasedReservationDetail.pnrStatus || '미입력'}</p>
                      </div>
                    </div>
                  </div>

                  {purchasedReservationDetail.trip?.product && (
                    <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                      <h4 className="mb-3 text-lg font-semibold text-gray-900">구매 상품 정보</h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-gray-500">크루즈 라인</p>
                          <p className="text-base text-gray-900">{purchasedReservationDetail.trip.product.cruiseLine || '미입력'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">선박명</p>
                          <p className="text-base text-gray-900">{purchasedReservationDetail.trip.product.shipName || '미입력'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">패키지명</p>
                          <p className="text-base text-gray-900">{purchasedReservationDetail.trip.product.packageName || '미입력'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">상품 코드</p>
                          <p className="text-base text-gray-900">{purchasedReservationDetail.trip.product.productCode || '미입력'}</p>
                        </div>
                        {purchasedReservationDetail.trip.departureDate && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">출발일</p>
                            <p className="text-base text-gray-900">
                              {new Date(purchasedReservationDetail.trip.departureDate).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-500">총 인원</p>
                          <p className="text-base text-gray-900">{purchasedReservationDetail.totalPeople}명</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="mb-3 text-lg font-semibold text-gray-900">여행자 정보 (APIS)</h4>
                    {purchasedReservationDetail.travelers && purchasedReservationDetail.travelers.length > 0 ? (
                      <div className="space-y-4">
                        {purchasedReservationDetail.travelers.map((traveler: any, index: number) => (
                          <div key={traveler.id || index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <h5 className="font-semibold text-gray-900">
                                {index === 0 ? '대표자' : `동행자 ${index}`}
                                {traveler.roomNumber && (
                                  <span className="ml-2 text-sm font-normal text-gray-500">
                                    (방 {traveler.roomNumber})
                                  </span>
                                )}
                              </h5>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-sm font-medium text-gray-500">한글 성명</p>
                                <p className="text-base text-gray-900">{traveler.korName || '미입력'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">영문 이름</p>
                                <p className="text-base text-gray-900">
                                  {traveler.engSurname && traveler.engGivenName
                                    ? `${traveler.engSurname} ${traveler.engGivenName}`
                                    : '미입력'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">여권번호</p>
                                <p className="text-base text-gray-900">{traveler.passportNo || '미입력'}</p>
                                {traveler.passportImage && (
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      onClick={() => {
                                        const img = new Image();
                                        img.src = traveler.passportImage;
                                        const w = window.open();
                                        if (w) {
                                          w.document.write(`<img src="${traveler.passportImage}" style="max-width: 100%; height: auto;" />`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                    >
                                      이미지 보기
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">생년월일</p>
                                <p className="text-base text-gray-900">{traveler.dateOfBirth || '미입력'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">여권 만료일</p>
                                <p className="text-base text-gray-900">{traveler.passportExpiryDate || '미입력'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">국적</p>
                                <p className="text-base text-gray-900">{traveler.nationality || '미입력'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">여행자 정보가 없습니다.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowPurchasedDetailModal(false);
                  setPurchasedReservationDetail(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 튜토리얼 모달 */}
      {showTutorial && subscriptionInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">시스템 대시보드 튜토리얼</h2>
              <button
                onClick={() => setShowTutorial(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <h3 className="font-bold text-yellow-900 mb-2">
                  {subscriptionInfo.isTrial ? '🎁 무료 체험 중 (30% 기능)' : '✅ 정식 구독 중 (50% 기능)'}
                </h3>
                {subscriptionInfo.endDate && (
                  <p className="text-sm text-yellow-800">
                    남은 기간: {Math.max(0, Math.ceil((new Date(subscriptionInfo.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}일
                  </p>
                )}
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">사용 가능한 기능</h3>
                <p className="text-sm text-blue-800 mb-2">빨간색 테두리로 표시된 기능을 사용할 수 있습니다:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                  {subscriptionInfo.isTrial ? (
                    <>
                      <li>링크 생성</li>
                      <li>판매 확정</li>
                      <li>기본 대시보드 조회</li>
                      <li>리드 조회</li>
                      <li>프로필 수정</li>
                    </>
                  ) : (
                    <>
                      <li>링크 생성</li>
                      <li>판매 확정</li>
                      <li>기본 대시보드 조회</li>
                      <li>리드 조회</li>
                      <li>기본 통계</li>
                      <li>고객 관리</li>
                      <li>프로필 수정</li>
                    </>
                  )}
                </ul>
              </div>
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-900 mb-2">사용 불가능한 기능</h3>
                <p className="text-sm text-red-800 mb-2">다음 기능들은 클릭 시 제한 메시지가 표시됩니다:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  <li>대리점장 전용 기능 (팀 관리, 판매원별 DB 관리, 랜딩페이지 관리 등)</li>
                  <li>마비즈 VIP 판매원 전용 기능</li>
                  {subscriptionInfo.isTrial && <li>시스템 이용 후 사용 가능한 기능</li>}
                </ul>
              </div>
            </div>
            {subscriptionInfo && subscriptionInfo.isTrial && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-orange-900 mb-2">🎁 시스템 이용하고 더 많은 기능 사용하기</h3>
                <p className="text-sm text-orange-800 mb-3">
                  무료 체험 중이시군요! 시스템 문의로 자세한 안내를 받아보세요.
                </p>
                <button
                  onClick={() => {
                    setPendingPaymentAction(async () => {
                      try {
                        const res = await fetch('/api/partner/subscription/payment', {
                          method: 'POST',
                          credentials: 'include',
                        });
                        const data = await res.json();
                        if (res.ok && data.ok && data.payurl) {
                          window.location.href = data.payurl;
                        } else {
                          alert(data.message || '결제 요청에 실패했습니다.');
                        }
                      } catch (error) {
                        logger.error('[Subscription Payment] Error:', error);
                        alert('결제 요청 중 오류가 발생했습니다.');
                      }
                    });
                    setShowPaymentConfirmModal(true);
                  }}
                  className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors shadow-md"
                >
                  정액제 구독하기 (10만원)
                </button>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTutorial(false)}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기능 제한 모달 */}
      {showFeatureRestrictionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">기능 사용 제한</h2>
              <button
                onClick={() => {
                  setShowFeatureRestrictionModal(false);
                  setRestrictionMessage('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 whitespace-pre-line">
                  {restrictionMessage}
                </p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 더 많은 기능을 사용하려면 담당 점장님과 상의해 주세요.
                </p>
              </div>
              {subscriptionInfo && subscriptionInfo.isTrial && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-800 mb-3">
                    🎁 무료 체험 중이시군요! 시스템 문의로 자세한 안내를 받아보세요.
                  </p>
                  <button
                    onClick={() => {
                      setPendingPaymentAction(async () => {
                        try {
                          const res = await fetch('/api/partner/subscription/payment', {
                            method: 'POST',
                            credentials: 'include',
                          });
                          const data = await res.json();
                          if (res.ok && data.ok && data.payurl) {
                            window.location.href = data.payurl;
                          } else {
                            alert(data.message || '결제 요청에 실패했습니다.');
                          }
                        } catch (error) {
                          logger.error('[Subscription Payment] Error:', error);
                          alert('결제 요청 중 오류가 발생했습니다.');
                        }
                      });
                      setShowPaymentConfirmModal(true);
                    }}
                    className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors shadow-md"
                  >
                    시스템 문의
                  </button>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFeatureRestrictionModal(false);
                  setRestrictionMessage('');
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 결제 확인 모달 */}
      {showPaymentConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">시스템 이용 안내</h2>
              <button
                onClick={() => {
                  setShowPaymentConfirmModal(false);
                  setPendingPaymentAction(null);
                  setPaymentForm({ name: '', phone: '' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              {/* 이름 입력 */}
              <div>
                <label htmlFor="payment-name" className="block text-sm font-semibold text-gray-700 mb-2">
                  이름 *
                </label>
                <input
                  id="payment-name"
                  type="text"
                  value={paymentForm.name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                  required
                />
              </div>

              {/* 연락처 입력 */}
              <div>
                <label htmlFor="payment-phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  연락처 (휴대폰 번호) *
                </label>
                <input
                  id="payment-phone"
                  type="tel"
                  value={paymentForm.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9-]/g, '');
                    setPaymentForm({ ...paymentForm, phone: value });
                  }}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                  required
                />
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-semibold mb-2">
                  ⚠️ 결제 전 확인사항
                </p>
                <p className="text-sm text-blue-800 leading-relaxed">
                  이 플랫폼은 크루즈닷과 함께 하는 <strong>(주)마비즈컴퍼니 마비즈스쿨 원격 평생교육원</strong> 회원으로 가입하며 <strong>마케팅 서비스 제공 회원</strong>으로 가입하게 됩니다.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>결제 금액:</strong> 10만원 (1개월 구독)
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>결제 후:</strong> 정식 구독으로 전환되어 50% 기능을 사용하실 수 있습니다.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>계약서:</strong> 결제 완료 후 자동으로 계약서가 생성되며, 서명 후 개인 아이디와 비밀번호가 발급됩니다.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPaymentConfirmModal(false);
                  setPendingPaymentAction(null);
                  setPaymentForm({ name: '', phone: '' });
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // 유효성 검사
                  if (!paymentForm.name.trim()) {
                    showError('이름을 입력해주세요.');
                    return;
                  }
                  if (!paymentForm.phone.trim() || paymentForm.phone.replace(/[^0-9]/g, '').length < 10) {
                    showError('올바른 연락처를 입력해주세요.');
                    return;
                  }

                  setShowPaymentConfirmModal(false);
                  if (pendingPaymentAction) {
                    // paymentForm을 최신 상태로 사용하기 위해 즉시 실행
                    const executePayment = async () => {
                      try {
                        const res = await fetch('/api/partner/subscription/payment', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                          body: JSON.stringify({
                            name: paymentForm.name.trim(),
                            phone: paymentForm.phone.trim().replace(/[^0-9]/g, ''),
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.ok && data.payurl) {
                          window.location.href = data.payurl;
                        } else {
                          showError(data.message || '결제 요청에 실패했습니다.');
                        }
                      } catch (error) {
                        logger.error('[Subscription Payment] Error:', error);
                        showError('결제 요청 중 오류가 발생했습니다.');
                      }
                    };
                    executePayment();
                  }
                  setPendingPaymentAction(null);
                }}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
              >
                확인하고 결제하기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 압축기 모달 */}
      <CompressorModal
        isOpen={showCompressorModal}
        onClose={() => setShowCompressorModal(false)}
      />
    </div>
  );
}
