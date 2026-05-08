'use client';

import React, { Dispatch, SetStateAction } from 'react';
import { showSuccess, showError } from '@/components/ui/Toast';
import { maskPhoneNumber } from '@/lib/utils/phone';

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
  _count?: {
    LandingPageRegistration: number;
  };
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
  managerId: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  category: string | null;
  sharedAt: string;
}

interface LandingPageRegistration {
  id: number;
  customerName: string;
  customerGroup: string | null;
  phone: string;
  email: string | null;
  registeredAt: string;
}

interface ModalState<T> {
  isOpen: boolean;
  data: T | null;
  isLoading?: boolean;
  open: (data: T) => void;
  close: () => void;
  setData: (data: T) => void;
  setLoading: (isLoading: boolean) => void;
}

interface LandingPageModalsProps {
  shortcutModal: ModalState<LandingPage>;
  statsModal: ModalState<{ page: LandingPage; stats: StatsData | null }>;
  shareModal: ModalState<LandingPage>;
  shareManageModal: ModalState<LandingPage>;
  dataModal: ModalState<LandingPage>;
  branchManagers: BranchManagerOption[];
  loadingManagers: boolean;
  selectedManagerIds: Set<number>;
  shareCategory: string;
  shareToAdmin: boolean;
  isSharing: boolean;
  sharedRecipients: SharedLandingRecipient[];
  selectedRecipientIds: Set<number>;
  isRevokingShare: boolean;
  isLoadingRecipients: boolean;
  registrations: LandingPageRegistration[];
  dataPage: number;
  dataTotal: number;
  isLoadingData: boolean;
  registrationGroupPrefs: { primaryGroupId?: number | null; additionalGroupId?: number | null } | null;
  onCopyShortcut: () => Promise<void>;
  onGenerateShortcut: (page: LandingPage, regenerate: boolean) => Promise<void>;
  onShareLandingPage: () => Promise<void>;
  onLoadBranchManagers: () => Promise<void>;
  onToggleManagerSelection: (managerId: number) => void;
  onToggleRecipientSelection: (managerId: number) => void;
  onRevokeShare: (revokeAll: boolean) => Promise<void>;
  onDeleteRegistration: (registrationId: number) => Promise<void>;
  onLoadRegistrations: (pageId: number, page: number) => Promise<void>;
  setSelectedManagerIds: Dispatch<SetStateAction<Set<number>>>;
  setShareCategory: Dispatch<SetStateAction<string>>;
  setShareToAdmin: Dispatch<SetStateAction<boolean>>;
  setSelectedRecipientIds: Dispatch<SetStateAction<Set<number>>>;
  setDataPage: Dispatch<SetStateAction<number>>;
  setRegistrations: Dispatch<SetStateAction<LandingPageRegistration[]>>;
  setRegistrationGroupPrefs: Dispatch<SetStateAction<{ primaryGroupId?: number | null; additionalGroupId?: number | null } | null>>;
  closeShareModal: () => void;
  closeShareManageModal: () => void;
}

export function LandingPageModals({
  shortcutModal,
  statsModal,
  shareModal,
  shareManageModal,
  dataModal,
  branchManagers,
  loadingManagers,
  selectedManagerIds,
  shareCategory,
  shareToAdmin,
  isSharing,
  sharedRecipients,
  selectedRecipientIds,
  isRevokingShare,
  isLoadingRecipients,
  registrations,
  dataPage,
  dataTotal,
  isLoadingData,
  registrationGroupPrefs,
  onCopyShortcut,
  onGenerateShortcut,
  onShareLandingPage,
  onLoadBranchManagers,
  onToggleManagerSelection,
  onToggleRecipientSelection,
  onRevokeShare,
  onDeleteRegistration,
  onLoadRegistrations,
  setSelectedManagerIds,
  setShareCategory,
  setShareToAdmin,
  setSelectedRecipientIds,
  setDataPage,
  setRegistrations,
  setRegistrationGroupPrefs,
  closeShareModal,
  closeShareManageModal,
}: LandingPageModalsProps) {
  return (
    <>
      {/* 바로가기 URL 모달 */}
      {shortcutModal.isOpen && shortcutModal.data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">랜딩페이지 바로가기</h2>
              <button
                onClick={shortcutModal.close}
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
                value={(shortcutModal.data as any)?.shortcutUrl || 'URL 생성 중...'}
                readOnly
                className="w-full px-4 py-3 bg-transparent border-none text-gray-800 font-mono text-sm focus:outline-none"
                onClick={(e) => {
                  const url = (shortcutModal.data as any)?.shortcutUrl || '';
                  (e.target as HTMLInputElement).select();
                  navigator.clipboard.writeText(url);
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
                  await onGenerateShortcut(shortcutModal.data as LandingPage, true);
                }}
                className="flex-1 px-4 py-3 bg-gold text-navy rounded-lg hover:bg-gold-light font-semibold transition-colors"
              >
                신규생성
              </button>
              <button
                onClick={onCopyShortcut}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 통계 모달 (접속현황) */}
      {statsModal.isOpen && statsModal.data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => {
          if (e.target === e.currentTarget) {
            statsModal.close();
          }
        }}>
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {(statsModal.data as any)?.page?.title} - 접속현황
              </h2>
              <button
                onClick={statsModal.close}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                title="닫기"
              >
                ×
              </button>
            </div>

            {statsModal.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (statsModal.data as any)?.stats ? (
              <div className="space-y-6">
                {(() => {
                  const statsData = (statsModal.data as any)?.stats;
                  return (
                    <>
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
                    </>
                  );
                })()}
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
      {shareModal.isOpen && shareModal.data && (
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
              <strong className="text-gray-900">{(shareModal.data as LandingPage)?.title}</strong> 랜딩페이지를 선택한 대리점장에게 보너스 랜딩페이지로 제공할 수 있습니다. 공유된 랜딩페이지는 대리점장 할당량에 포함되지 않습니다.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                보너스 카테고리
              </label>
              <input
                type="text"
                value={shareCategory}
                onChange={(e) => setShareCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold"
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
                        onChange={() => onToggleManagerSelection(manager.id)}
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
                onClick={onShareLandingPage}
                disabled={isSharing || (selectedManagerIds.size === 0 && !shareToAdmin)}
                className="flex-1 px-4 py-3 bg-gold text-navy rounded-lg hover:bg-gold-light font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? '공유 중...' : '공유하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 관리 모달 */}
      {shareManageModal.isOpen && shareManageModal.data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">공유 현황</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {(shareManageModal.data as LandingPage)?.title}
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
                        checked={sharedRecipients.length > 0 && sharedRecipients.every((recipient) => selectedRecipientIds.has(recipient.managerId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecipientIds(new Set(sharedRecipients.map(r => r.managerId)));
                          } else {
                            setSelectedRecipientIds(new Set());
                          }
                        }}
                      />
                      전체 선택
                    </label>
                    <button
                      onClick={() => onRevokeShare(false)}
                      disabled={isRevokingShare || selectedRecipientIds.size === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRevokingShare ? '회수 중...' : `선택한 ${selectedRecipientIds.size}개 회수`}
                    </button>
                  </div>
                  <div className="border rounded-lg divide-y">
                    {sharedRecipients.map((recipient) => (
                      <label
                        key={recipient.managerId}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={selectedRecipientIds.has(recipient.managerId)}
                          onChange={() => onToggleRecipientSelection(recipient.managerId)}
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
      {dataModal.isOpen && dataModal.data && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              dataModal.close();
              setRegistrations([]);
              setRegistrationGroupPrefs(null);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {(dataModal.data as LandingPage)?.title} - 등록 데이터
              </h2>
              <button
                onClick={() => {
                  dataModal.close();
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
                        registrations.map((reg: LandingPageRegistration) => (
                          <tr key={reg.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.customerName}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.customerGroup || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{maskPhoneNumber(reg.phone)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">{reg.email || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border">
                              {new Date(reg.registeredAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="px-4 py-2 text-sm border">
                              <button
                                onClick={() => onDeleteRegistration(reg.id)}
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
                        const dataModalPage = dataModal.data as LandingPage | null;
                        if (newPage >= 1 && dataModalPage) {
                          setDataPage(newPage);
                          onLoadRegistrations(dataModalPage.id, newPage);
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
                        const dataModalPage = dataModal.data as LandingPage | null;
                        if (newPage <= Math.ceil(dataTotal / 50) && dataModalPage) {
                          setDataPage(newPage);
                          onLoadRegistrations(dataModalPage.id, newPage);
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
    </>
  );
}
