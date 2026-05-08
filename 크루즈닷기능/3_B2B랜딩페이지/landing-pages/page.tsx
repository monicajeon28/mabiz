'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiCopy,
  FiEdit,
  FiTrash2,
  FiEye,
  FiLink,
  FiShare2,
  FiChevronDown,
  FiChevronUp,
  FiGift,
  FiExternalLink,
  FiUsers,
  FiRotateCcw,
} from 'react-icons/fi';

type LandingPageOwnerType =
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'SALES_AGENT'
  | 'HQ'
  | 'CRUISE_STAFF'
  | 'PRIMARKETER'
  | 'OTHER';

interface LandingPageOwner {
  userId: number | null;
  profileId: number | null;
  name: string | null;
  displayName: string | null;
  affiliateCode: string | null;
  branchLabel: string | null;
  role: string | null;
  type: LandingPageOwnerType;
}

interface SharedToManager {
  managerProfileId: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  category: string;
  sharedAt: string;
}

interface LandingPage {
  id: number;
  adminId: number;
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
  owner: LandingPageOwner | null;
  sharedLandingCount: number;
  sharedToManagers?: SharedToManager[];
}

const isBranchManagerOwner = (page: LandingPage) => page.owner?.type === 'BRANCH_MANAGER';

const getOwnerDisplayName = (owner?: LandingPageOwner | null) =>
  owner?.displayName || owner?.name || '대리점장';

interface SharedLandingRecipient {
  managerProfileId: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  category: string | null;
  sharedAt: string;
}

interface GroupedLandingPages {
  [key: string]: LandingPage[];
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

export default function LandingPagesPage() {
  const router = useRouter();
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [groupedPages, setGroupedPages] = useState<GroupedLandingPages>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null);
  const [shortcutUrl, setShortcutUrl] = useState<string>('');
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalPage, setStatsModalPage] = useState<LandingPage | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetPage, setShareTargetPage] = useState<LandingPage | null>(null);
  const [branchManagers, setBranchManagers] = useState<BranchManagerOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedManagerIds, setSelectedManagerIds] = useState<Set<number>>(new Set());
  const [shareCategory, setShareCategory] = useState('관리자 보너스');
  const [isSharing, setIsSharing] = useState(false);
  const [selectedOwnerType, setSelectedOwnerType] = useState<'ALL' | 'ADMIN' | 'BRANCH_MANAGER'>('ALL');
  const [shareManagePage, setShareManagePage] = useState<LandingPage | null>(null);
  const [showShareManageModal, setShowShareManageModal] = useState(false);
  const [sharedRecipients, setSharedRecipients] = useState<SharedLandingRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);

  useEffect(() => {
    loadLandingPages();
  }, [selectedCategory, selectedOwnerType]);

  const loadLandingPages = async () => {
    try {
      setIsLoading(true);
      const url = selectedCategory && selectedCategory !== '전체'
        ? `/api/admin/landing-pages?category=${encodeURIComponent(selectedCategory)}`
        : '/api/admin/landing-pages';
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

      const pages = data.landingPages || [];
      const normalizedPages: LandingPage[] = pages.map((page: LandingPage) => ({
        ...page,
        owner: page.owner ?? null,
      }));
      setLandingPages(normalizedPages);

      // 제작자 필터링: owner가 null이거나 type이 없는 경우도 처리
      const ownerFilteredPages = normalizedPages.filter((page) => {
        if (selectedOwnerType === 'ADMIN') {
          // owner가 null이면 adminId를 가진 경우 본사로 간주 (기존 관리자 랜딩페이지)
          if (!page.owner) {
            // owner가 없으면 기본적으로 관리자로 간주 (기존 데이터 호환성)
            return true;
          }
          return page.owner.type === 'ADMIN';
        }
        if (selectedOwnerType === 'BRANCH_MANAGER') {
          return page.owner?.type === 'BRANCH_MANAGER';
        }
        // 'ALL'인 경우 모든 페이지 표시
        return true;
      });

      // 페이지 그룹별로 그룹화 (리드젠 스타일)
      const grouped: GroupedLandingPages = {};
      ownerFilteredPages.forEach((page: LandingPage) => {
        const groupKey = page.pageGroup || '기타';
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push(page);
      });

      // 그룹별로 정렬 (페이지 번호 기준, 내림차순)
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
          // slug에서 번호 추출 (예: "16_B2B크루즈" -> 16)
          const numA = parseInt(a.slug.split('_')[0]) || parseInt(a.slug.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.slug.split('_')[0]) || parseInt(b.slug.match(/\d+/)?.[0] || '0');
          return numB - numA;
        });
      });

      // 그룹 자체도 번호 순으로 정렬
      const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numB - numA;
      });
      
      const sortedGrouped: GroupedLandingPages = {};
      sortedGroupKeys.forEach(key => {
        sortedGrouped[key] = grouped[key];
      });

      setGroupedPages(sortedGrouped);
      
      // 모든 그룹을 기본적으로 펼침
      setExpandedGroups(new Set(Object.keys(sortedGrouped)));
    } catch (err) {
      console.error('Failed to load landing pages:', err);
      setError(err instanceof Error ? err.message : '랜딩페이지 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleCopyUrl = async (page: LandingPage) => {
    try {
      const url = `${window.location.origin}/landing/${page.slug}`;
      await navigator.clipboard.writeText(url);
      alert('URL이 복사되었습니다.');
    } catch (err) {
      console.error('Failed to copy URL:', err);
      alert('URL 복사에 실패했습니다.');
    }
  };

  const openOwnerProfile = (owner?: LandingPageOwner | null) => {
    if (!owner?.affiliateCode) {
      alert('연결된 대리점장 정보를 찾을 수 없습니다.');
      return;
    }
    const profileUrl = `/admin/affiliate/profiles?search=${encodeURIComponent(owner.affiliateCode)}`;
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  const duplicateLandingPage = async (page: LandingPage) => {
    try {
      const response = await fetch(`/api/admin/landing-pages/${page.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || '복사에 실패했습니다.');
      }

      const successMessage = isBranchManagerOwner(page)
        ? '대리점장 랜딩페이지를 관리자 계정으로 복사했습니다.'
        : '랜딩페이지가 복사되었습니다.';
      alert(successMessage);
      loadLandingPages();
    } catch (error: any) {
      console.error('[Admin Landing Pages] Duplicate error:', error);
      alert(error?.message || '복사 중 오류가 발생했습니다.');
    }
  };

  const fetchShareRecipients = async (pageId: number) => {
    setIsLoadingRecipients(true);
    try {
      const response = await fetch(`/api/admin/landing-pages/${pageId}/share`, {
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || '공유 현황을 불러오지 못했습니다.');
      }

      const recipients: SharedLandingRecipient[] = data.sharedLandingPages || [];
      setSharedRecipients(recipients);
      setSelectedRecipientIds(new Set(recipients.map((recipient) => recipient.managerProfileId)));
    } catch (error: any) {
      console.error('[Admin Landing Pages] Fetch shared recipients error:', error);
      alert(error?.message || '공유 현황을 불러오지 못했습니다.');
      setSharedRecipients([]);
      setSelectedRecipientIds(new Set());
    } finally {
      setIsLoadingRecipients(false);
    }
  };

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
    setIsLoadingRecipients(false);
    setIsRevokingShare(false);
  };

  const toggleRecipientSelection = (managerId: number) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(managerId)) {
        next.delete(managerId);
      } else {
        next.add(managerId);
      }
      return next;
    });
  };

  const handleSelectAllRecipients = (checked: boolean) => {
    if (checked) {
      setSelectedRecipientIds(new Set(sharedRecipients.map((recipient) => recipient.managerProfileId)));
    } else {
      setSelectedRecipientIds(new Set());
    }
  };

  const handleRevokeShares = async (options: { revokeAll?: boolean } = {}) => {
    if (!shareManagePage) {
      return;
    }

    const revokeAll = options.revokeAll ?? false;

    if (!revokeAll && selectedRecipientIds.size === 0) {
      alert('회수할 대리점장을 선택해주세요.');
      return;
    }

    setIsRevokingShare(true);
    try {
      const response = await fetch(`/api/admin/landing-pages/${shareManagePage.id}/share`, {
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

      alert(`총 ${data.revokedCount ?? 0}개의 공유를 회수했습니다.`);
      await fetchShareRecipients(shareManagePage.id);
      await loadLandingPages();
    } catch (error: any) {
      console.error('[Admin Landing Pages] Revoke share error:', error);
      alert(error?.message || '공유 회수 중 오류가 발생했습니다.');
    } finally {
      setIsRevokingShare(false);
    }
  };

  const loadBranchManagers = async () => {
    try {
      setLoadingManagers(true);
      const response = await fetch('/api/admin/affiliate/profiles?type=BRANCH_MANAGER&status=ACTIVE', {
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
      console.error('[Admin Landing Pages] Manager load error:', error);
      alert(error.message || '대리점장 목록을 불러올 수 없습니다.');
    } finally {
      setLoadingManagers(false);
    }
  };

  const openShareModal = async (page: LandingPage) => {
    setShareTargetPage(page);
    setSelectedManagerIds(new Set());
    setShareCategory('관리자 보너스');
    setShowShareModal(true);
    
    // 이미 공유된 대리점장 목록 가져오기
    try {
      const response = await fetch(`/api/admin/landing-pages/${page.id}/share`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.sharedLandingPages) {
          // 이미 공유된 대리점장 ID를 선택된 목록에 추가
          const sharedIds = new Set<number>(data.sharedLandingPages.map((r: any) => r.managerProfileId));
          setSelectedManagerIds(sharedIds);
        }
      }
    } catch (error) {
      console.error('Failed to load shared recipients:', error);
    }
    
    if (branchManagers.length === 0 && !loadingManagers) {
      loadBranchManagers();
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setShareTargetPage(null);
    setSelectedManagerIds(new Set());
    setShareCategory('관리자 보너스');
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

    if (selectedManagerIds.size === 0) {
      alert('공유할 대리점장을 선택해주세요.');
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch(`/api/admin/landing-pages/${shareTargetPage.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          managerProfileIds: Array.from(selectedManagerIds),
          category: shareCategory?.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '랜딩페이지 공유에 실패했습니다.');
      }

      alert(`대리점장 ${data.sharedCount ?? selectedManagerIds.size}명에게 랜딩페이지를 공유했습니다.`);
      closeShareModal();
      await loadLandingPages();
    } catch (error: any) {
      console.error('[Admin Landing Pages] Share error:', error);
      alert(error.message || '랜딩페이지 공유 중 오류가 발생했습니다.');
    } finally {
      setIsSharing(false);
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
        alert('URL이 재생성되었습니다.');
      }
    } catch (err) {
      console.error('Failed to generate shortcut:', err);
      alert(err instanceof Error ? err.message : '바로가기 URL 생성에 실패했습니다.');
    }
  };

  const handleCopyShortcut = async () => {
    try {
      await navigator.clipboard.writeText(shortcutUrl);
      alert('바로가기 URL이 복사되었습니다.');
    } catch (err) {
      console.error('Failed to copy shortcut URL:', err);
      alert('URL 복사에 실패했습니다.');
    }
  };

  const handleShowData = async (page: LandingPage) => {
    setDataModalPage(page);
    setShowDataModal(true);
    setDataPage(1);
    await loadRegistrations(page.id, 1);
  };

  const loadRegistrations = async (pageId: number, page: number) => {
    try {
      setIsLoadingData(true);
      const response = await fetch(`/api/admin/landing-pages/${pageId}/registrations?page=${page}&limit=50`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('등록 데이터를 불러올 수 없습니다.');
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
      alert(err instanceof Error ? err.message : '등록 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const pickPreferredMembership = useCallback(
    (memberships: Array<{ groupId: number; groupName?: string | null; addedAt?: string }> | undefined) => {
      if (!memberships || memberships.length === 0) {
        return null;
      }
      const { primaryGroupId, additionalGroupId } = registrationGroupPrefs || {};
      if (primaryGroupId) {
        const match = memberships.find((member) => member.groupId === primaryGroupId);
        if (match) {
          return match;
        }
      }
      if (additionalGroupId) {
        const addMatch = memberships.find((member) => member.groupId === additionalGroupId);
        if (addMatch) {
          return addMatch;
        }
      }
      return memberships[0];
    },
    [registrationGroupPrefs]
  );

  const getGroupJoinDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('ko-KR');
    } catch {
      return isoString;
    }
  };

  const getGroupDayCount = (isoString?: string) => {
    if (!isoString) return '-';
    const joinedAt = new Date(isoString).getTime();
    if (Number.isNaN(joinedAt)) return '-';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = today.getTime() - new Date(isoString).setHours(0, 0, 0, 0);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    return days < 1 ? '1' : String(days);
  };

  const handleDeleteRegistration = async (registrationId: number) => {
    if (!confirm('정말 이 등록 데이터를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/landing-pages/${dataModalPage?.id}/registrations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ registrationId }),
      });

      if (!response.ok) {
        throw new Error('등록 데이터 삭제에 실패했습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '등록 데이터 삭제에 실패했습니다.');
      }

      alert('등록 데이터가 삭제되었습니다.');
      if (dataModalPage) {
        await loadRegistrations(dataModalPage.id, dataPage);
      }
    } catch (err) {
      console.error('Failed to delete registration:', err);
      alert(err instanceof Error ? err.message : '등록 데이터 삭제에 실패했습니다.');
    }
  };

  const handleReleaseFromGroup = async (registration: any, membership: any) => {
    if (!membership?.groupId || !registration?.userId) {
      alert('그룹 정보를 확인할 수 없습니다.');
      return;
    }

    if (!confirm('이 고객을 그룹에서 해제하시겠습니까?')) {
      return;
    }

    setReleasingMembershipId(registration.id);
    try {
      const response = await fetch(`/api/admin/customer-groups/${membership.groupId}/members?userId=${registration.userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || '그룹 해제에 실패했습니다.');
      }
      if (dataModalPage) {
        await loadRegistrations(dataModalPage.id, dataPage);
      }
    } catch (err) {
      console.error('Failed to release from group:', err);
      alert(err instanceof Error ? err.message : '그룹 해제 중 오류가 발생했습니다.');
    } finally {
      setReleasingMembershipId(null);
    }
  };

  const handleDelete = async (pageId: number) => {
    if (!confirm('정말 이 랜딩페이지를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/landing-pages/${pageId}`, {
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

      alert('랜딩페이지가 삭제되었습니다.');
      loadLandingPages();
    } catch (err) {
      console.error('Failed to delete landing page:', err);
      alert(err instanceof Error ? err.message : '랜딩페이지 삭제에 실패했습니다.');
    }
  };

  const getPageNumber = (slug: string): string => {
    const parts = slug.split('_');
    return parts.length > 1 ? parts[0] + '_' + parts[1] : slug;
  };

  // 체크박스 관련 함수들
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set<number>();
      Object.values(groupedPages).forEach(pages => {
        pages.forEach(page => {
          if (selectedCategory === '전체' || page.pageGroup === selectedCategory) {
            allIds.add(page.id);
          }
        });
      });
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectPage = (pageId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('삭제할 랜딩페이지를 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedIds.size}개의 랜딩페이지를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/landing-pages/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error('일괄 삭제에 실패했습니다.');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '일괄 삭제에 실패했습니다.');
      }

      alert(`${data.deletedCount}개의 랜딩페이지가 삭제되었습니다.`);
      setSelectedIds(new Set());
      loadLandingPages();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      alert(err instanceof Error ? err.message : '일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  // 통계 모달 관련 함수들
  const handleShowStats = async (page: LandingPage) => {
    setStatsModalPage(page);
    setShowStatsModal(true);
    setIsLoadingStats(true);
    
    try {
      const response = await fetch(`/api/admin/landing-pages/${page.id}/stats`, {
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
      alert(err instanceof Error ? err.message : '통계 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 모든 페이지 ID 가져오기 (현재 필터된 페이지들)
  const getAllPageIds = (): number[] => {
    const allIds: number[] = [];
    Object.entries(groupedPages)
      .filter(([groupKey]) => selectedCategory === '전체' || groupKey === selectedCategory)
      .forEach(([, pages]) => {
        pages.forEach(page => allIds.push(page.id));
      });
    return allIds;
  };

  const allPageIds = getAllPageIds();
  const isAllSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const allShareRecipientsSelected =
    sharedRecipients.length > 0 &&
    sharedRecipients.every((recipient) => selectedRecipientIds.has(recipient.managerProfileId));

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
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">랜딩페이지 관리</h1>
          <p className="text-gray-600">랜딩페이지를 생성하고 관리할 수 있습니다.</p>
        </div>
        <button
          onClick={() => router.push('/admin/landing-pages/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={20} />
          새 랜딩페이지
        </button>
      </div>

      {/* 필터 및 일괄 삭제 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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
          <select
            value={selectedOwnerType}
            onChange={(e) => setSelectedOwnerType(e.target.value as 'ALL' | 'ADMIN' | 'BRANCH_MANAGER')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">제작자: 전체</option>
            <option value="ADMIN">제작자: 본사</option>
            <option value="BRANCH_MANAGER">제작자: 대리점장</option>
          </select>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <FiTrash2 size={18} />
            선택한 {selectedIds.size}개 삭제
          </button>
        )}
      </div>

      {/* 랜딩페이지 목록 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">No.</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">구분</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">연결그룹</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">마지막 수정일</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">데이터 조회수</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">링크복사</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">컨텐츠관리</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">공유하기</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">접속현황</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(groupedPages)
              .filter(([groupKey]) => selectedCategory === '전체' || groupKey === selectedCategory)
              .map(([groupKey, pages]) => (
                <React.Fragment key={groupKey}>
                  <tr className="bg-gray-100">
                    <td colSpan={11} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            {expandedGroups.has(groupKey) ? (
                              <FiChevronUp size={20} />
                            ) : (
                              <FiChevronDown size={20} />
                            )}
                          </button>
                          <span className="font-bold text-gray-800">
                            {groupKey}
                          </span>
                          <span className="text-sm text-gray-600">
                            ({pages.length}개의 랜딩페이지가 있습니다.)
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedGroups.has(groupKey) && pages.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={selectedIds.has(page.id)}
                          onChange={(e) => handleSelectPage(page.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getPageNumber(page.slug)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {page.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex flex-col gap-1">
                          <span>{page.title}</span>
                          {page.owner?.type === 'BRANCH_MANAGER' && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                                대리점장 제작
                              </span>
                              <button
                                type="button"
                                onClick={() => openOwnerProfile(page.owner)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-900"
                              >
                                {getOwnerDisplayName(page.owner)}
                                {page.owner?.affiliateCode && (
                                  <span className="font-mono text-[10px] text-gray-500">
                                    ({page.owner.affiliateCode})
                                  </span>
                                )}
                                <FiExternalLink size={12} />
                              </button>
                              {page.owner?.branchLabel && (
                                <span className="text-[10px] text-gray-500">
                                  {page.owner.branchLabel}
                                </span>
                              )}
                            </div>
                          )}
                          {page.owner?.type === 'ADMIN' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 w-fit">
                                본사 제작
                              </span>
                              {page.sharedLandingCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openShareManageModal(page)}
                                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 w-fit hover:bg-sky-100"
                                  title="공유 현황 보기 및 회수"
                                >
                                  <FiUsers size={12} />
                                  공유 {page.sharedLandingCount}명
                                </button>
                              )}
                            </div>
                          )}
                          {(!page.owner || (page.owner?.type !== 'ADMIN' && page.owner?.type !== 'BRANCH_MANAGER')) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 w-fit">
                              기타
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {page.CustomerGroup?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(page.updatedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }).replace(/\./g, '.').replace(/\s/g, '')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {page.viewCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {page.shortcutUrl ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-600 font-mono px-2 py-1 bg-gray-100 rounded truncate max-w-[120px]">
                                {page.shortcutUrl.split('/i/')[1] || page.shortcutUrl}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(page.shortcutUrl || '');
                                  alert('URL이 복사되었습니다.');
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
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/landing-pages/${page.id}/edit`)}
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
                            onClick={() => {
                              // 세부 데이터 보기 모달 열기
                              handleShowData(page);
                            }}
                            className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="세부 데이터"
                          >
                            <FiLink size={18} />
                          </button>
                        <button
                          onClick={() => openShareModal(page)}
                          className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                          title="대리점장에게 공유"
                        >
                          <FiGift size={18} />
                        </button>
                          {page.sharedLandingCount > 0 && (
                            <button
                              onClick={() => openShareManageModal(page)}
                              className="p-1.5 text-gray-600 hover:text-sky-600 hover:bg-sky-50 rounded"
                              title="관리자 공유 회수/현황"
                            >
                              <FiRotateCcw size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => duplicateLandingPage(page)}
                            className={
                              isBranchManagerOwner(page)
                                ? 'px-2 py-1 rounded border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-700 hover:bg-orange-100 flex items-center gap-1'
                                : 'p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded'
                            }
                            title={
                              isBranchManagerOwner(page)
                                ? '대리점장 랜딩페이지를 관리자 계정으로 복사'
                                : '랜딩페이지 복사'
                            }
                          >
                            {isBranchManagerOwner(page) ? (
                              <span className="flex items-center gap-1">
                                <FiCopy size={14} />
                                관리자 복사
                              </span>
                            ) : (
                              <FiCopy size={18} />
                            )}
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleGenerateShortcut(page)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <FiShare2 size={14} />
                          공유
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleShowStats(page)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          접속현황
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {/* 바로가기 URL 모달 (리드젠 스타일) */}
      {showShortcutModal && selectedPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
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
                  alert('URL이 복사되었습니다.');
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

      {/* 등록 데이터 모달 */}
      {showDataModal && dataModalPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  setReleasingMembershipId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
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
                        if (newPage >= 1) {
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
                        if (newPage <= Math.ceil(dataTotal / 50)) {
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

      {/* 통계 모달 */}
      {showStatsModal && statsModalPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {statsModalPage.title} - 통계
              </h2>
              <button
                onClick={() => {
                  setShowStatsModal(false);
                  setStatsModalPage(null);
                  setStatsData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">대리점장에게 공유</h2>
              <button
                onClick={closeShareModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
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
                placeholder="예: 관리자 추천 랜딩"
              />
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
                  branchManagers.map((manager) => {
                    const isCurrentlyShared = shareTargetPage && selectedManagerIds.has(manager.id);
                    return (
                      <label
                        key={manager.id}
                        className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer ${
                          isCurrentlyShared ? 'bg-blue-50 border border-blue-200' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded border-gray-300"
                          checked={selectedManagerIds.has(manager.id)}
                          onChange={() => toggleManagerSelection(manager.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {manager.displayName || manager.branchLabel || '이름 없음'}
                            </p>
                            {isCurrentlyShared && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                공유 중
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            코드: {manager.affiliateCode}
                            {manager.branchLabel ? ` · ${manager.branchLabel}` : ''}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="text-sm text-gray-500 mt-3 space-y-1">
              <p>※ 공유된 랜딩페이지는 대리점장 대시보드의 &quot;관리자 보너스&quot; 카테고리에 나타납니다.</p>
              <p className="text-blue-600 font-semibold">💡 이미 공유된 대리점장은 체크되어 있습니다. 대리점장이 삭제한 경우에도 여기서 다시 공유할 수 있습니다.</p>
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
                disabled={isSharing || selectedManagerIds.size === 0}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? '공유 중...' : '대리점장에게 공유'}
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
                <h2 className="text-xl font-bold text-gray-800">관리자 제공 현황</h2>
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
                  현재 관리자에게 제공 중인 대리점장이 없습니다.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={allShareRecipientsSelected}
                        onChange={(e) => handleSelectAllRecipients(e.target.checked)}
                      />
                      전체 선택
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRevokeShares({ revokeAll: true })}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isRevokingShare || sharedRecipients.length === 0}
                      >
                        전체 회수
                      </button>
                      <button
                        onClick={() => handleRevokeShares()}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isRevokingShare || selectedRecipientIds.size === 0}
                      >
                        선택 회수
                      </button>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-12"></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">대리점장</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">브랜치</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">카테고리</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">공유 일시</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sharedRecipients.map((recipient) => (
                          <tr key={recipient.managerProfileId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4"
                                checked={selectedRecipientIds.has(recipient.managerProfileId)}
                                onChange={() => toggleRecipientSelection(recipient.managerProfileId)}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="flex flex-col">
                                <span>{recipient.displayName || '이름 미등록'}</span>
                                {recipient.affiliateCode && (
                                  <span className="text-xs text-gray-500 font-mono">
                                    {recipient.affiliateCode}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {recipient.branchLabel || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {recipient.category || '관리자 보너스'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(recipient.sharedAt).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

