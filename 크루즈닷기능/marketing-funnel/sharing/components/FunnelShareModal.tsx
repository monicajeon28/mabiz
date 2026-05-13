'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiUsers, FiUserCheck, FiUser, FiTrash2, FiLoader, FiSearch, FiShare2 } from 'react-icons/fi';

type ShareType = 'ALL' | 'BRANCH_MANAGER' | 'SALES_AGENT' | 'SPECIFIC';

interface AffiliateProfile {
  id: number;
  displayName: string | null;
  branchLabel: string | null;
  type: string;
  User?: {
    name: string | null;
    email: string | null;
  };
}

interface ExistingShare {
  id: number;
  shareType: string;
  targetProfile?: {
    id: number;
    displayName: string | null;
    branchLabel: string | null;
    type: string;
  } | null;
  sharedAt: string;
  status: string;
}

interface FunnelShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  funnelId: number;
  funnelTitle: string;
  onShareSuccess?: () => void;
}

export function FunnelShareModal({
  isOpen,
  onClose,
  funnelId,
  funnelTitle,
  onShareSuccess,
}: FunnelShareModalProps) {
  const [shareType, setShareType] = useState<ShareType>('ALL');
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [profiles, setProfiles] = useState<AffiliateProfile[]>([]);
  const [existingShares, setExistingShares] = useState<ExistingShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 파트너 프로필 목록 조회
  const fetchProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const response = await fetch('/api/admin/affiliate/monitoring', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  // 기존 공유 목록 조회
  const fetchExistingShares = useCallback(async () => {
    setIsLoadingShares(true);
    try {
      const response = await fetch(`/api/partner/funnel-messages/${funnelId}/share`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setExistingShares(data.shares || []);
      }
    } catch (error) {
      console.error('Failed to fetch existing shares:', error);
    } finally {
      setIsLoadingShares(false);
    }
  }, [funnelId]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingShares();
      if (shareType === 'SPECIFIC') {
        fetchProfiles();
      }
    }
  }, [isOpen, shareType, fetchExistingShares, fetchProfiles]);

  const handleShare = async () => {
    if (shareType === 'SPECIFIC' && selectedProfileIds.length === 0) {
      alert('공유할 대상을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/partner/funnel-messages/${funnelId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shareType,
          targetProfileIds: shareType === 'SPECIFIC' ? selectedProfileIds : undefined,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        alert('퍼널이 성공적으로 공유되었습니다.');
        setSelectedProfileIds([]);
        setShareType('ALL');
        fetchExistingShares();
        onShareSuccess?.();
      } else {
        alert(data.error || '공유에 실패했습니다.');
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('공유 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (shareType?: string, targetProfileId?: number) => {
    if (!confirm('이 공유를 회수하시겠습니까?')) return;

    try {
      const params = new URLSearchParams();
      if (shareType) params.append('shareType', shareType);
      if (targetProfileId) params.append('targetProfileId', targetProfileId.toString());

      const response = await fetch(
        `/api/partner/funnel-messages/${funnelId}/share?${params.toString()}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();
      if (data.ok) {
        alert('공유가 회수되었습니다.');
        fetchExistingShares();
        onShareSuccess?.();
      } else {
        alert(data.error || '회수에 실패했습니다.');
      }
    } catch (error) {
      console.error('Revoke error:', error);
      alert('회수 중 오류가 발생했습니다.');
    }
  };

  const toggleProfileSelection = (profileId: number) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const filteredProfiles = profiles.filter((profile) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const name = profile.displayName || profile.branchLabel || '';
    const email = profile.User?.email || '';
    return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  const shareTypeOptions = [
    { value: 'ALL', label: '전체 공유', icon: FiUsers, description: '모든 파트너에게 공유' },
    { value: 'BRANCH_MANAGER', label: '대리점장만', icon: FiUserCheck, description: '대리점장에게만 공유' },
    { value: 'SALES_AGENT', label: '판매원만', icon: FiUser, description: '판매원에게만 공유' },
    { value: 'SPECIFIC', label: '특정인 지정', icon: FiSearch, description: '특정 파트너 선택' },
  ];

  const getShareTypeLabel = (type: string) => {
    const option = shareTypeOptions.find((opt) => opt.value === type);
    return option?.label || type;
  };

  const getProfileName = (profile: AffiliateProfile) => {
    return profile.displayName || profile.branchLabel || profile.User?.name || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FiShare2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">퍼널 공유</h3>
                <p className="text-sm text-gray-600 mt-0.5">{funnelTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* 공유 타입 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              공유 대상 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              {shareTypeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setShareType(option.value as ShareType)}
                    className={`flex items-start rounded-xl border-2 p-4 text-left transition-all ${
                      shareType === option.value
                        ? 'border-slate-600 bg-slate-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`mr-3 mt-0.5 w-5 h-5 flex-shrink-0 ${
                        shareType === option.value ? 'text-slate-600' : 'text-gray-400'
                      }`}
                    />
                    <div>
                      <div className={`font-medium ${
                        shareType === option.value ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {option.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 특정인 선택 영역 */}
          {shareType === 'SPECIFIC' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                파트너 선택 ({selectedProfileIds.length}명 선택됨)
              </label>

              {/* 검색 */}
              <div className="relative mb-3">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              {/* 파트너 목록 */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {isLoadingProfiles ? (
                  <div className="p-8 text-center text-gray-500">
                    <FiLoader className="w-6 h-6 mx-auto animate-spin mb-2" />
                    파트너 목록을 불러오는 중...
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery ? '검색 결과가 없습니다.' : '파트너가 없습니다.'}
                  </div>
                ) : (
                  filteredProfiles.map((profile) => (
                    <label
                      key={profile.id}
                      className="flex cursor-pointer items-center border-b border-gray-100 px-4 py-3 hover:bg-gray-50 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProfileIds.includes(profile.id)}
                        onChange={() => toggleProfileSelection(profile.id)}
                        className="w-4 h-4 rounded border-gray-300 text-slate-600 focus:ring-2 focus:ring-slate-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {getProfileName(profile)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {profile.User?.email || '-'} · {profile.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 기존 공유 목록 */}
          {existingShares.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                현재 공유 중 ({existingShares.length})
              </label>
              <div className="space-y-2 rounded-lg border border-gray-200 p-4 bg-gray-50">
                {isLoadingShares ? (
                  <div className="p-4 text-center text-gray-500">
                    <FiLoader className="w-5 h-5 mx-auto animate-spin" />
                  </div>
                ) : (
                  existingShares.map((share, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-white px-4 py-3 border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {getShareTypeLabel(share.shareType)}
                        </div>
                        {share.targetProfile && (
                          <div className="mt-0.5 text-xs text-gray-500">
                            {share.targetProfile.displayName || share.targetProfile.branchLabel}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-400">
                          {new Date(share.sharedAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevoke(share.shareType, share.targetProfile?.id)}
                        className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="공유 회수"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={handleShare}
            disabled={isLoading || (shareType === 'SPECIFIC' && selectedProfileIds.length === 0)}
            className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                공유 중...
              </>
            ) : (
              <>
                <FiShare2 className="w-4 h-4" />
                공유하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
