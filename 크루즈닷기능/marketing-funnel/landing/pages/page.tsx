'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FiArrowLeft,
  FiPlus,
  FiCopy,
  FiEdit,
  FiTrash2,
  FiEye,
  FiLink,
  FiDownload,
  FiShare2,
  FiGift,
  FiUsers,
  FiRotateCcw,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

interface LandingPage {
  id: number;
  title: string;
  category: string | null;
  pageGroup: string | null;
  viewCount: number;
  slug: string;
  shortcutUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  CustomerGroup: {
    id: number;
    name: string;
  } | null;
}

interface SharedLandingPage extends LandingPage {
  sharedCategory?: string;
  sharedAt?: string;
}

interface StatsData {
  views: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  registrations: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  conversionRate: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  bounceRate: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
}

interface BranchManagerOption {
  id: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string;
}

interface SharedLandingRecipient {
  managerProfileId: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  category: string | null;
  sharedAt: string;
}

export default function PartnerLandingPagesPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params?.partnerId as string;
  
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [sharedLandingPages, setSharedLandingPages] = useState<SharedLandingPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null);
  const [shortcutUrl, setShortcutUrl] = useState<string>('');
  const [pageCount, setPageCount] = useState(0);
  const [remainingQuota, setRemainingQuota] = useState(20);
  const [bonusShareCount, setBonusShareCount] = useState(0);
  const [remainingBonusQuota, setRemainingBonusQuota] = useState(10);
  const [cloningPageId, setCloningPageId] = useState<number | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalPage, setStatsModalPage] = useState<LandingPage | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetPage, setShareTargetPage] = useState<LandingPage | null>(null);
  const [branchManagers, setBranchManagers] = useState<BranchManagerOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedManagerIds, setSelectedManagerIds] = useState<Set<number>>(new Set());
  const [shareCategory, setShareCategory] = useState('대리점장 보너스');
  const [isSharing, setIsSharing] = useState(false);
  const [shareToAdmin, setShareToAdmin] = useState(false);
  const [shareManagePage, setShareManagePage] = useState<LandingPage | null>(null);
  const [showShareManageModal, setShowShareManageModal] = useState(false);
  const [sharedRecipients, setSharedRecipients] = useState<SharedLandingRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [dataModalPage, setDataModalPage] = useState<LandingPage | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationGroupPrefs, setRegistrationGroupPrefs] = useState<{
    primaryGroupId?: number | null;
    additionalGroupId?: number | null;
  } | null>(null);
  const [releasingMembershipId, setReleasingMembershipId] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataPage, setDataPage] = useState(1);
  const [dataTotal, setDataTotal] = useState(0);

  useEffect(() => {
    loadLandingPages();
  }, [selectedCategory]);

  const loadLandingPages = async () => {
    try {
      setIsLoading(true);
      const url = selectedCategory && selectedCategory !== '전체'
        ? `/api/partner/landing-pages?category=${encodeURIComponent(selectedCategory)}`
        : '/api/partner/landing-pages';
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('랜딩페이지 목록을 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '랜딩페이지 목록을 불러오는 중 오류가 발생했습니다.');
      }

      const ownedPages = data.ownedPages ?? data.landingPages ?? [];
      const sharedPages = (data.sharedPages ?? []).map((page: SharedLandingPage) => ({
        ...page,
        sharedCategory: page.sharedCategory || '관리자 보너스',
      }));
      setLandingPages(ownedPages);
      setSharedLandingPages(sharedPages);
      setPageCount(ownedPages.length);
      setRemainingQuota(Math.max(0, 20 - ownedPages.length));
      
      // 보너스 공유 개수 계산 (자기가 공유한 랜딩페이지 개수)
      try {
        const sharedByMe = await fetch('/api/partner/landing-pages/shared-by-me', {
          credentials: 'include',
        });
        const sharedData = await sharedByMe.json();
        const bonusCount = sharedData.ok ? sharedData.count : 0;
        setBonusShareCount(bonusCount);
        setRemainingBonusQuota(Math.max(0, 10 - bonusCount));
      } catch (err) {
        console.error('Failed to load bonus share count:', err);
        setBonusShareCount(0);
        setRemainingBonusQuota(10);
      }
    } catch (err) {
      console.error('Failed to load landing pages:', err);
      setError(err instanceof Error ? err.message : '랜딩페이지 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneSharedPage = async (pageId: number) => {
    if (pageCount >= 20) {
      showError('이미 최대 20개의 랜딩페이지를 생성했습니다. 기존 페이지를 정리한 뒤 다시 시도해주세요.');
      return;
    }

    if (!confirm('이 랜딩페이지를 내 계정으로 복사해 수정하시겠어요?')) {
      return;
    }

    try {
      setCloningPageId(pageId);
      const response = await fetch(`/api/partner/landing-pages/${pageId}/clone`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '랜딩페이지 복사에 실패했습니다.');
      }

      showSuccess('복사 완료! 곧 편집 화면으로 이동합니다.');
      await loadLandingPages();
      if (data.landingPage?.id) {
        router.push(`/partner/${partnerId}/landing-pages/${data.landingPage.id}/edit`);
      }
    } catch (error) {
      console.error('Failed to clone shared landing page:', error);
      showError(error instanceof Error ? error.message : '랜딩페이지 복사 중 오류가 발생했습니다.');
    } finally {
      setCloningPageId(null);
    }
  };

  const handleGenerateShortcut = async (page: LandingPage, regenerate = false) => {
    try {
      const response = await fetch(`/api/admin/landing-pages/${page.id}/shortcut`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('바로가기 URL 생성에 실패했습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '바로가기 URL 생성에 실패했습니다.');
      }

      if (!regenerate) {
        setSelectedPage(page);
        setShowShortcutModal(true);
      }
      setShortcutUrl(data.shortcutUrl || '');
      
      if (regenerate) {
        showSuccess('URL이 재생성되었습니다.');
        loadLandingPages();
      }
    } catch (err) {
      console.error('Failed to generate shortcut:', err);
      showError(err instanceof Error ? err.message : '바로가기 URL 생성에 실패했습니다.');
    }
  };

  const handleCopyShortcut = async () => {
    try {
      await navigator.clipboard.writeText(shortcutUrl);
      showSuccess('바로가기 URL이 복사되었습니다.');
    } catch (err) {
      console.error('Failed to copy shortcut URL:', err);
      showError('URL 복사에 실패했습니다.');
    }
  };

  const handleDelete = async (pageId: number) => {
    if (!confirm('정말 이 랜딩페이지를 삭제하시겠습니까?\n삭제된 랜딩페이지는 복구할 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/landing-pages/${pageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('랜딩페이지 삭제에 실패했습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '랜딩페이지 삭제에 실패했습니다.');
      }

      showSuccess('랜딩페이지가 삭제되었습니다.');
      loadLandingPages();
    } catch (err) {
      console.error('Failed to delete landing page:', err);
      showError(err instanceof Error ? err.message : '랜딩페이지 삭제에 실패했습니다.');
    }
  };

  // 통계 모달 관련 함수들
  const handleShowStats = async (page: LandingPage) => {
    setStatsModalPage(page);
    setShowStatsModal(true);
    setIsLoadingStats(true);
    
    try {
      const response = await fetch(`/api/partner/landing-pages/${page.id}/stats`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('통계 데이터를 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '통계 데이터를 불러오는 중 오류가 발생했습니다.');
      }

      setStatsData(data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
      showError(err instanceof Error ? err.message : '통계 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 공유 모달 관련 함수들
  const loadBranchManagers = async () => {
    try {
      setLoadingManagers(true);
      const response = await fetch('/api/partner/affiliate/profiles?type=BRANCH_MANAGER&status=ACTIVE', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '대리점장 목록을 불러올 수 없습니다.');
      }
      const options: BranchManagerOption[] = (data.profiles ?? []).map((profile: any) => ({
        id: profile.id,
        displayName: profile.displayName ?? profile.nickname ?? null,
        branchLabel: profile.branchLabel ?? null,
        affiliateCode: profile.affiliateCode,
      }));
      setBranchManagers(options);
    } catch (error: any) {
      console.error('[Partner Landing Pages] Manager load error:', error);
      showError(error.message || '대리점장 목록을 불러올 수 없습니다.');
    } finally {
      setLoadingManagers(false);
    }
  };

  const openShareModal = (page: LandingPage) => {
    setShareTargetPage(page);
    setSelectedManagerIds(new Set());
    setShareCategory('대리점장 보너스');
    setShareToAdmin(false);
    setShowShareModal(true);
    if (branchManagers.length === 0 && !loadingManagers) {
      loadBranchManagers();
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setShareTargetPage(null);
    setSelectedManagerIds(new Set());
    setShareCategory('대리점장 보너스');
    setShareToAdmin(false);
  };

  const toggleManagerSelection = (managerId: number) => {
    setSelectedManagerIds((prev) => {
      const next = new Set(prev);
      if (next.has(managerId)) {
        next.delete(managerId);
      } else {
        next.add(managerId);
      }
      return next;
    });
  };

  const handleShareLandingPage = async () => {
    if (!shareTargetPage) {
      return;
    }

    if (selectedManagerIds.size === 0 && !shareToAdmin) {
      showError('공유할 대상을 선택해주세요.');
      return;
    }

    // 보너스 공유 개수 확인
    if (bonusShareCount >= 10) {
      showError('보너스 공유는 최대 10개까지 가능합니다.');
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch(`/api/partner/landing-pages/${shareTargetPage.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          managerProfileIds: Array.from(selectedManagerIds),
          shareToAdmin: shareToAdmin,
          category: shareCategory?.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '랜딩페이지 공유에 실패했습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '랜딩페이지 공유에 실패했습니다.');
      }

      showSuccess(`랜딩페이지를 ${data.sharedCount ?? selectedManagerIds.size}명에게 공유했습니다.`);
      closeShareModal();
      await loadLandingPages();
    } catch (error: any) {
      console.error('[Partner Landing Pages] Share error:', error);
      showError(error?.message || '랜딩페이지 공유 중 오류가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  // 공유 관리 모달 관련 함수들
  const openShareManageModal = async (page: LandingPage) => {
    setShareManagePage(page);
    setShowShareManageModal(true);
    await fetchShareRecipients(page.id);
  };

  const closeShareManageModal = () => {
    setShowShareManageModal(false);
    setShareManagePage(null);
    setSharedRecipients([]);
    setSelectedRecipientIds(new Set());
  };

  const fetchShareRecipients = async (pageId: number) => {
    try {
      setIsLoadingRecipients(true);
      const response = await fetch(`/api/partner/landing-pages/${pageId}/share`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('공유 현황을 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '공유 현황을 불러오는 중 오류가 발생했습니다.');
      }

      setSharedRecipients(data.sharedLandingPages || []);
    } catch (error: any) {
      console.error('[Partner Landing Pages] Fetch recipients error:', error);
      showError(error?.message || '공유 현황을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  const toggleRecipientSelection = (managerProfileId: number) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(managerProfileId)) {
        next.delete(managerProfileId);
      } else {
        next.add(managerProfileId);
      }
      return next;
    });
  };

  const handleRevokeShare = async (revokeAll = false) => {
    if (!shareManagePage) {
      return;
    }

    if (!revokeAll && selectedRecipientIds.size === 0) {
      showError('회수할 대상을 선택해주세요.');
      return;
    }

    if (!confirm(revokeAll ? '모든 공유를 회수하시겠습니까?' : `선택한 ${selectedRecipientIds.size}개의 공유를 회수하시겠습니까?`)) {
      return;
    }

    setIsRevokingShare(true);
    try {
      const response = await fetch(`/api/partner/landing-pages/${shareManagePage.id}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          revokeAll
            ? { revokeAll: true }
            : { managerProfileIds: Array.from(selectedRecipientIds) }
        ),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || '공유 회수에 실패했습니다.');
      }

      showSuccess(`총 ${data.revokedCount ?? 0}개의 공유를 회수했습니다.`);
      await fetchShareRecipients(shareManagePage.id);
      await loadLandingPages();
    } catch (error: any) {
      console.error('[Partner Landing Pages] Revoke share error:', error);
      showError(error?.message || '공유 회수 중 오류가 발생했습니다.');
    } finally {
      setIsRevokingShare(false);
    }
  };

  // 데이터 조회 모달 관련 함수들
  const handleShowData = async (page: LandingPage) => {
    setDataModalPage(page);
    setShowDataModal(true);
    setDataPage(1);
    await loadRegistrations(page.id, 1);
  };

  const loadRegistrations = async (pageId: number, page: number) => {
    try {
      setIsLoadingData(true);
      const response = await fetch(`/api/partner/landing-pages/${pageId}/registrations?page=${page}&limit=50`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '등록 데이터를 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '등록 데이터를 불러오는 중 오류가 발생했습니다.');
      }

      setRegistrations(data.registrations || []);
      setRegistrationGroupPrefs(data.groupPreferences || null);
      setReleasingMembershipId(null);
      setDataTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load registrations:', err);
      showError(err instanceof Error ? err.message : '등록 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDeleteRegistration = async (registrationId: number) => {
    if (!confirm('정말 이 등록 데이터를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) {
      return;
    }

    if (!dataModalPage) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/landing-pages/${dataModalPage.id}/registrations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ registrationId }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || '등록 데이터 삭제에 실패했습니다.');
      }

      showSuccess('등록 데이터가 삭제되었습니다.');
      await loadRegistrations(dataModalPage.id, dataPage);
    } catch (err) {
      console.error('Failed to delete registration:', err);
      showError(err instanceof Error ? err.message : '등록 데이터 삭제에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <FiArrowLeft className="text-base" />
        이전화면으로
      </button>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">랜딩페이지 관리</h1>
          <p className="text-gray-600">랜딩페이지를 생성하고 관리할 수 있습니다.</p>
          <div className="mt-2 space-y-2">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <p className="text-sm text-blue-800">
                <strong>📊 개인 랜딩페이지:</strong> {pageCount}/20개 생성됨 ({remainingQuota}개 남음)
              </p>
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
              <p className="text-sm text-purple-800">
                <strong>🎁 보너스 공유:</strong> {bonusShareCount}/10개 공유됨 ({remainingBonusQuota}개 남음)
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/partner/${partnerId}/landing-pages/new`)}
          disabled={pageCount >= 20}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            pageCount >= 20
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <FiPlus size={20} />
          새 랜딩페이지
        </button>
      </div>

      {pageCount >= 20 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <p className="text-yellow-800">
            <strong>⚠️ 할당량 초과:</strong> 최대 20개의 랜딩페이지만 생성할 수 있습니다. 기존 페이지를 삭제한 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center justify-between gap-4">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="전체">전체</option>
          {Array.from(new Set(landingPages.map(p => p.category).filter(Boolean))).map(cat => (
            <option key={cat} value={cat || ''}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 랜딩페이지 목록 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">구분</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">조회수</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">숏 URL</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {landingPages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  생성된 랜딩페이지가 없습니다.
                </td>
              </tr>
            ) : (
              landingPages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {page.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {page.category || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {page.viewCount}
                  </td>
                  <td className="px-4 py-3">
                    {page.shortcutUrl ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-600 font-mono px-2 py-1 bg-gray-100 rounded truncate max-w-[120px]">
                          {page.shortcutUrl.split('/i/')[1] || page.shortcutUrl}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(page.shortcutUrl || '');
                            showSuccess('URL이 복사되었습니다.');
                          }}
                          className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                          title="복사"
                        >
                          <FiCopy size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateShortcut(page)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap"
                      >
                        신규 생성
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => router.push(`/partner/${partnerId}/landing-pages/${page.id}/edit`)}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <FiEdit size={18} />
                      </button>
                      <button
                        onClick={() => window.open(`/landing/${page.slug}`, '_blank')}
                        className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                        title="미리보기"
                      >
                        <FiEye size={18} />
                      </button>
                      <button
                        onClick={() => handleShowData(page)}
                        className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                        title="세부 데이터"
                      >
                        <FiLink size={18} />
                      </button>
                      <button
                        onClick={() => openShareModal(page)}
                        className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                        title="공유하기"
                      >
                        <FiGift size={18} />
                      </button>
                      <button
                        onClick={() => handleShowStats(page)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        title="접속현황"
                      >
                        접속현황
                      </button>
                      <button
                        onClick={() => handleDelete(page.id)}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="삭제"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 공유 받은 랜딩페이지 */}
      {sharedLandingPages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">관리자 보너스 랜딩페이지</h2>
            <span className="text-sm text-gray-500">총 {sharedLandingPages.length}개</span>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">제목</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">원본 구분</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">보너스 카테고리</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">숏 URL</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sharedLandingPages.map((page) => (
                  <tr key={`shared-${page.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{page.title}</span>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                          관리자 공유
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {page.category || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {page.sharedCategory || '관리자 보너스'}
                    </td>
                    <td className="px-4 py-3">
                      {page.shortcutUrl ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-600 font-mono px-2 py-1 bg-gray-100 rounded truncate max-w-[120px]">
                            {page.shortcutUrl.split('/i/')[1] || page.shortcutUrl}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(page.shortcutUrl || '');
                              showSuccess('URL이 복사되었습니다.');
                            }}
                            className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                            title="복사"
                          >
                            <FiCopy size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(`/landing/${page.slug}`, '_blank')}
                          className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                          title="미리보기"
                        >
                          <FiEye size={18} />
                        </button>
                        <button
                          onClick={() => handleCloneSharedPage(page.id)}
                          disabled={cloningPageId === page.id}
                          className={`p-1.5 rounded flex items-center gap-1 text-sm ${
                            cloningPageId === page.id
                              ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="내 랜딩페이지로 복사"
                        >
                          <FiDownload size={18} />
                          <span className="text-xs hidden sm:inline">
                            {cloningPageId === page.id ? '복사 중…' : '내 페이지로 복사'}
                          </span>
                        </button>
                        {page.shortcutUrl && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(page.shortcutUrl || '');
                              showSuccess('URL이 복사되었습니다.');
                            }}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="URL 복사"
                          >
                            <FiLink size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 바로가기 URL 모달 */}
      {showShortcutModal && selectedPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">랜딩페이지 바로가기</h2>
              <button
                onClick={() => {
                  setShowShortcutModal(false);
                  setSelectedPage(null);
                  setShortcutUrl('');
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              랜딩페이지 바로가기 URL: 복사해서 사용하세요.
            </p>
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-4">
              <input
                type="text"
                value={shortcutUrl || 'URL 생성 중...'}
                readOnly
                className="w-full px-4 py-3 bg-transparent border-none text-gray-800 font-mono text-sm focus:outline-none"
                onClick={(e) => {
                  (e.target as HTMLInputElement).select();
                  navigator.clipboard.writeText(shortcutUrl);
                  showSuccess('URL이 복사되었습니다.');
                }}
              />
            </div>
            <p className="text-sm text-gray-500 mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
              ※ 카카오톡등 캐시로 인해 변경되지 않으면 재생성버튼을 클릭해 URL을 다시 만들어주세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleGenerateShortcut(selectedPage, true);
                }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                신규생성
              </button>
              <button
                onClick={handleCopyShortcut}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 통계 모달 (접속현황) */}
      {showStatsModal && statsModalPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowStatsModal(false);
            setStatsModalPage(null);
            setStatsData(null);
          }
        }}>
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {statsModalPage.title} - 접속현황
              </h2>
              <button
                onClick={() => {
                  setShowStatsModal(false);
                  setStatsModalPage(null);
                  setStatsData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                title="닫기"
              >
                ×
              </button>
            </div>

            {isLoadingStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : statsData ? (
              <div className="space-y-6">
                {/* 유입 통계 */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">유입 통계</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">전체</div>
                      <div className="text-2xl font-bold text-blue-700">{statsData.views.total.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">오늘</div>
                      <div className="text-2xl font-bold text-blue-700">{statsData.views.today.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 주</div>
                      <div className="text-2xl font-bold text-blue-700">{statsData.views.thisWeek.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 달</div>
                      <div className="text-2xl font-bold text-blue-700">{statsData.views.thisMonth.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">올해</div>
                      <div className="text-2xl font-bold text-blue-700">{statsData.views.thisYear.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* 전환 통계 */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">전환 통계</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">전체</div>
                      <div className="text-2xl font-bold text-green-700">{statsData.registrations.total.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">오늘</div>
                      <div className="text-2xl font-bold text-green-700">{statsData.registrations.today.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 주</div>
                      <div className="text-2xl font-bold text-green-700">{statsData.registrations.thisWeek.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 달</div>
                      <div className="text-2xl font-bold text-green-700">{statsData.registrations.thisMonth.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">올해</div>
                      <div className="text-2xl font-bold text-green-700">{statsData.registrations.thisYear.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* 전환율 */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">전환율</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">전체</div>
                      <div className="text-2xl font-bold text-purple-700">{statsData.conversionRate.total.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">오늘</div>
                      <div className="text-2xl font-bold text-purple-700">{statsData.conversionRate.today.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 주</div>
                      <div className="text-2xl font-bold text-purple-700">{statsData.conversionRate.thisWeek.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 달</div>
                      <div className="text-2xl font-bold text-purple-700">{statsData.conversionRate.thisMonth.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">올해</div>
                      <div className="text-2xl font-bold text-purple-700">{statsData.conversionRate.thisYear.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>

                {/* 이탈율 */}
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">이탈율</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">전체</div>
                      <div className="text-2xl font-bold text-red-700">{statsData.bounceRate.total.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">오늘</div>
                      <div className="text-2xl font-bold text-red-700">{statsData.bounceRate.today.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 주</div>
                      <div className="text-2xl font-bold text-red-700">{statsData.bounceRate.thisWeek.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">이번 달</div>
                      <div className="text-2xl font-bold text-red-700">{statsData.bounceRate.thisMonth.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">올해</div>
                      <div className="text-2xl font-bold text-red-700">{statsData.bounceRate.thisYear.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                통계 데이터를 불러올 수 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공유 모달 */}
      {showShareModal && shareTargetPage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeShareModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">대리점장에게 공유</h2>
              <button
                onClick={closeShareModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                title="닫기"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              <strong className="text-gray-900">{shareTargetPage.title}</strong> 랜딩페이지를 선택한 대리점장에게 보너스 랜딩페이지로 제공할 수 있습니다. 공유된 랜딩페이지는 대리점장 할당량에 포함되지 않습니다.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                보너스 카테고리
              </label>
              <input
                type="text"
                value={shareCategory}
                onChange={(e) => setShareCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="예: 대리점장 추천 랜딩"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={shareToAdmin}
                  onChange={(e) => setShareToAdmin(e.target.checked)}
                  className="w-4 h-4"
                />
                본사에게도 공유
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">대리점장 선택</h3>
                <span className="text-sm text-gray-500">선택된 대리점장: {selectedManagerIds.size}명</span>
              </div>
              <div className="border rounded-lg bg-gray-50 p-3 max-h-72 overflow-y-auto">
                {loadingManagers ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    불러오는 중...
                  </div>
                ) : branchManagers.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    활성화된 대리점장이 없습니다.
                  </div>
                ) : (
                  branchManagers.map((manager) => (
                    <label
                      key={manager.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        checked={selectedManagerIds.has(manager.id)}
                        onChange={() => toggleManagerSelection(manager.id)}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {manager.displayName || manager.branchLabel || '이름 없음'}
                        </p>
                        <p className="text-xs text-gray-500">
                          코드: {manager.affiliateCode}
                          {manager.branchLabel ? ` · ${manager.branchLabel}` : ''}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="text-sm text-gray-500 mt-3">
              ※ 공유된 랜딩페이지는 대리점장 대시보드의 &quot;대리점장 보너스&quot; 카테고리에 나타납니다. 보너스 공유는 최대 10개까지 가능합니다.
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={closeShareModal}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-semibold"
                disabled={isSharing}
              >
                취소
              </button>
              <button
                onClick={handleShareLandingPage}
                disabled={isSharing || (selectedManagerIds.size === 0 && !shareToAdmin)}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? '공유 중...' : '공유하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 관리 모달 */}
      {showShareManageModal && shareManagePage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">공유 현황</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {shareManagePage.title}
                </p>
              </div>
              <button
                onClick={closeShareManageModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
                aria-label="close share manage modal"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isLoadingRecipients ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                  공유 현황을 불러오는 중입니다...
                </div>
              ) : sharedRecipients.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  현재 공유 중인 대리점장이 없습니다.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={sharedRecipients.length > 0 && sharedRecipients.every((recipient) => selectedRecipientIds.has(recipient.managerProfileId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecipientIds(new Set(sharedRecipients.map(r => r.managerProfileId)));
                          } else {
                            setSelectedRecipientIds(new Set());
                          }
                        }}
                      />
                      전체 선택
                    </label>
                    <button
                      onClick={() => handleRevokeShare(false)}
                      disabled={isRevokingShare || selectedRecipientIds.size === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRevokingShare ? '회수 중...' : `선택한 ${selectedRecipientIds.size}개 회수`}
                    </button>
                  </div>
                  <div className="border rounded-lg divide-y">
                    {sharedRecipients.map((recipient) => (
                      <label
                        key={recipient.managerProfileId}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={selectedRecipientIds.has(recipient.managerProfileId)}
                          onChange={() => toggleRecipientSelection(recipient.managerProfileId)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {recipient.displayName || recipient.branchLabel || recipient.affiliateCode || '이름 없음'}
                          </p>
                          <p className="text-xs text-gray-500">
                            코드: {recipient.affiliateCode || '-'}
                            {recipient.branchLabel ? ` · ${recipient.branchLabel}` : ''}
                            {recipient.category ? ` · 카테고리: ${recipient.category}` : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            공유일: {new Date(recipient.sharedAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 등록 데이터 모달 */}
      {showDataModal && dataModalPage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDataModal(false);
              setDataModalPage(null);
              setRegistrations([]);
              setRegistrationGroupPrefs(null);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {dataModalPage.title} - 등록 데이터
              </h2>
              <button
                onClick={() => {
                  setShowDataModal(false);
                  setDataModalPage(null);
                  setRegistrations([]);
                  setRegistrationGroupPrefs(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                title="닫기"
              >
                ×
              </button>
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  총 {dataTotal}건의 등록 데이터
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">고객명</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">고객그룹</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">휴대폰번호</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">이메일</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">등록일시</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registrations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            등록된 데이터가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        registrations.map((reg: any) => (
                          <tr key={reg.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.customerName}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.customerGroup || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.phone}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.email || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">
                              {new Date(reg.registeredAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="px-4 py-2 text-sm border">
                              <button
                                onClick={() => handleDeleteRegistration(reg.id)}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {dataTotal > 50 && (
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={() => {
                        const newPage = dataPage - 1;
                        if (newPage >= 1 && dataModalPage) {
                          setDataPage(newPage);
                          loadRegistrations(dataModalPage.id, newPage);
                        }
                      }}
                      disabled={dataPage === 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <span className="text-sm text-gray-600">
                      {dataPage} / {Math.ceil(dataTotal / 50)}
                    </span>
                    <button
                      onClick={() => {
                        const newPage = dataPage + 1;
                        if (newPage <= Math.ceil(dataTotal / 50) && dataModalPage) {
                          setDataPage(newPage);
                          loadRegistrations(dataModalPage.id, newPage);
                        }
                      }}
                      disabled={dataPage >= Math.ceil(dataTotal / 50)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

