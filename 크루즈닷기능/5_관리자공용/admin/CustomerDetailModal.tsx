'use client';

import { useState, useEffect } from 'react';
import { FiX, FiUser, FiPhone, FiMail, FiCalendar, FiLock, FiUnlock, FiPackage, FiShoppingCart, FiDollarSign, FiFileText, FiPlus, FiSave, FiInfo, FiCheckCircle, FiMessageSquare, FiSend, FiBell, FiUpload, FiMic, FiUsers, FiEdit2, FiTrash2, FiClock, FiChevronDown, FiChevronUp } from 'react-icons/fi';

// Google Drive URL을 프록시 다운로드 URL로 변환 (403 권한 문제 해결)
const getProxyAudioUrl = (url: string | null): string => {
  if (!url) return '';

  // 이미 프록시 URL인 경우 그대로 반환
  if (url.includes('/api/drive/download/')) {
    return url;
  }

  // Google Drive file ID 추출 - file/d/{FILE_ID}/view 형식
  const match = url.match(/\/file\/d\/([^\/]+)/);
  if (match && match[1]) {
    return `/api/drive/download/${match[1]}`;
  }

  // uc?export=download&id= 형식에서 ID 추출
  const ucMatch = url.match(/[?&]id=([^&]+)/);
  if (ucMatch && ucMatch[1]) {
    return `/api/drive/download/${ucMatch[1]}`;
  }

  return url;
};

// 상담기록 타입
interface ConsultationNote {
  id: number;
  content: string;
  consultedAt: string;
  nextActionDate: string | null;
  nextActionNote: string | null;
  statusAfter: string | null;
  audioFileUrl: string | null;
  createdByName: string;
  createdByLabel: string;
  createdAt: string;
}

// 담당자 정보 타입
interface ManagerInfo {
  id: number;
  displayName: string | null;
  type: string;
  contactPhone: string | null;
  affiliateCode: string | null;
}

interface CustomerDetail {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  isLocked: boolean;
  isHibernated: boolean;
  customerStatus: string | null;
  customerSource: string | null;
  role: string | null;
  mallUserId: string | null;
  mallNickname: string | null;
  kakaoChannelAdded: boolean;
  kakaoChannelAddedAt: string | null;
  pwaGenieInstalledAt: string | null;
  pwaMallInstalledAt: string | null;
  currentPassword: string | null;
  // 추가 필드
  nextActionDate: string | null;
  nextActionNote: string | null;
  customerGroupId: number | null;
  customerGroupName: string | null;
  assignedManager: ManagerInfo | null;
  consultationNotes: ConsultationNote[];
  trips: Array<{
    id: number;
    cruiseName: string | null;
    companionType: string | null;
    destination: any;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
    Reservation?: Array<{
      id: number;
      tripId: number;
      totalPeople: number;
      passportStatus: string;
      Traveler?: Array<{
        id: number;
        engGivenName: string | null;
        engSurname: string | null;
        korName: string | null;
        passportNo: string | null;
        birthDate: string | null;
        expiryDate: string | null;
      }>;
    }>;
  }>;
  reservations?: Array<{
    id: number;
    tripId: number;
    totalPeople: number;
    passportStatus: string;
    Traveler?: Array<{
      id: number;
      engGivenName: string | null;
      engSurname: string | null;
      korName: string | null;
      passportNo: string | null;
      birthDate: string | null;
      expiryDate: string | null;
    }>;
  }>;
  refundHistory?: Array<{
    id: number;
    amount: number;
    reason: string;
    createdAt: string;
    productName?: string;
    tripId?: number;
  }>;
  apisInfo?: {
    spreadsheetId: string | null;
    googleFolderId: string | null;
    tripId: number | null;
  };
}

interface Props {
  customerId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerDetailModal({ customerId, isOpen, onClose }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassportForm, setShowPassportForm] = useState(false);
  const [passportForm, setPassportForm] = useState({
    korName: '',
    engGivenName: '',
    engSurname: '',
    passportNo: '',
    sex: '', // 성별 추가
    birthDate: '',
    issueDate: '', // 발급일 추가
    expiryDate: '',
    reservationId: null as number | null,
  });
  const [passportScanned, setPassportScanned] = useState(false); // 여권 스캔 완료 여부
  const [isScanning, setIsScanning] = useState(false); // 스캔 중 상태

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'info' | 'consultation'>('info');

  // 상태 변경 관련
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // 다음 조치 알람 관련
  const [showNextActionForm, setShowNextActionForm] = useState(false);
  const [nextActionForm, setNextActionForm] = useState({
    date: '',
    note: '',
  });
  const [isSavingNextAction, setIsSavingNextAction] = useState(false);

  // 상담기록 관련
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [consultationForm, setConsultationForm] = useState({
    content: '',
    consultedAt: new Date().toISOString().slice(0, 16),
    nextActionDate: '',
    nextActionNote: '',
    statusAfter: '',
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState<ConsultationNote[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<number>>(new Set()); // 확장된 상담기록 ID 목록
  const [selectedNote, setSelectedNote] = useState<ConsultationNote | null>(null); // 상세 모달용 선택된 노트

  // 문자 보내기 관련
  const [showSmsForm, setShowSmsForm] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // 여권보내기 모달 관련
  const [showPassportSendModal, setShowPassportSendModal] = useState(false);
  const [passportSendMessage, setPassportSendMessage] = useState('');
  const [isSendingPassport, setIsSendingPassport] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomerDetail();
    }
  }, [isOpen, customerId]);

  const loadCustomerDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${customerId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('고객 정보를 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!data.ok || !data.user) {
        throw new Error(data.error || '고객 정보를 불러올 수 없습니다.');
      }

      // 디버깅: 여권 정보 확인
      if (process.env.NODE_ENV === 'development') {
        const tripsWithReservations = data.user.trips?.map((trip: any) => ({
          id: trip.id,
          cruiseName: trip.cruiseName,
          reservationsCount: trip.Reservation?.length || 0,
          reservations: trip.Reservation?.map((res: any) => ({
            id: res.id,
            totalPeople: res.totalPeople,
            travelersCount: res.Traveler?.length || 0,
            travelersWithPassport: res.Traveler?.filter((t: any) => t.passportNo && t.passportNo.trim() !== '')?.length || 0,
            travelers: res.Traveler?.map((t: any) => ({
              id: t.id,
              korName: t.korName,
              engName: `${t.engGivenName || ''} ${t.engSurname || ''}`.trim(),
              passportNo: t.passportNo,
              passportImage: t.passportImage, // 여권 이미지 포함
              hasPassport: !!(t.passportNo && t.passportNo.trim() !== ''),
            })),
          })) || [],
        })) || [];

        console.log('[CustomerDetailModal] Customer data:', {
          id: data.user.id,
          tripsCount: data.user.trips?.length || 0,
          reservationsCount: data.user.reservations?.length || 0,
          reservations: data.user.reservations?.map((res: any) => ({
            id: res.id,
            totalPeople: res.totalPeople,
            travelersCount: res.Traveler?.length || 0,
            travelersWithPassport: res.Traveler?.filter((t: any) => t.passportNo && t.passportNo.trim() !== '')?.length || 0,
            travelers: res.Traveler?.map((t: any) => ({
              id: t.id,
              korName: t.korName,
              engName: `${t.engGivenName || ''} ${t.engSurname || ''}`.trim(),
              passportNo: t.passportNo,
              passportImage: t.passportImage, // 여권 이미지 포함
              hasPassport: !!(t.passportNo && t.passportNo.trim() !== ''),
            })),
          })),
          tripsWithReservations,
        });
      }

      setCustomer(data.user);
    } catch (err) {
      console.error('[CustomerDetailModal] Error loading customer:', err);
      setError(err instanceof Error ? err.message : '고객 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-brand-red text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">고객 상세 정보</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'info'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiUser className="inline mr-2" />
            기본정보
          </button>
          <button
            onClick={() => setActiveTab('consultation')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'consultation'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiMessageSquare className="inline mr-2" />
            상담기록
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && customer && activeTab === 'info' && (
            <div className="space-y-6">
              {/* 기본 정보 + 액션 버튼 */}
              <section className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FiUser size={20} />
                    기본 정보
                  </h3>
                  <div className="flex gap-2">
                    {/* 여권 보내기 버튼 */}
                    <button
                      onClick={() => {
                        if (customer.phone) {
                          // 기본 메시지 설정
                          const passportUrl = `${window.location.origin}/customer/passport/${customer.id}`;
                          setPassportSendMessage(`[크루즈가이드] ${customer.name || '고객'}님, 여권 정보 등록을 위해 아래 링크를 클릭해주세요.\n\n${passportUrl}\n\n* 여권 사진을 촬영하시면 자동으로 정보가 입력됩니다.`);
                          setShowPassportSendModal(true);
                        } else {
                          alert('연락처가 없습니다.');
                        }
                      }}
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors flex items-center gap-1"
                    >
                      <FiFileText size={14} />
                      여권보내기
                    </button>
                    {/* 문자 보내기 버튼 */}
                    <button
                      onClick={() => setShowSmsForm(true)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      <FiSend size={14} />
                      문자보내기
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">이름</label>
                    <p className="font-medium">{customer.name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">전화번호</label>
                    <p className="font-medium">{customer.phone || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">이메일</label>
                    <p className="font-medium">{customer.email || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">비밀번호</label>
                    <p className="font-medium font-mono">{customer.currentPassword || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">역할</label>
                    <p className="font-medium">
                      {customer.role === 'community' ? '크루즈몰' : customer.role === 'user' ? '크루즈가이드' : customer.role || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">크루즈몰 ID</label>
                    <p className="font-medium">{customer.mallUserId || '-'}</p>
                  </div>

                  {/* 상태 변경 */}
                  <div>
                    <label className="text-sm text-gray-600">상태</label>
                    {isChangingStatus ? (
                      <div className="flex items-center gap-2 mt-1">
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="">선택</option>
                          <option value="active">활성</option>
                          <option value="locked">잠금</option>
                          <option value="dormant">동면</option>
                          <option value="purchase_confirmed">구매확정</option>
                          <option value="refunded">환불</option>
                        </select>
                        <button
                          onClick={async () => {
                            if (!newStatus) return;
                            try {
                              const response = await fetch(`/api/admin/users/${customerId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ customerStatus: newStatus }),
                              });
                              const data = await response.json();
                              if (data.ok) {
                                alert('상태가 변경되었습니다.');
                                loadCustomerDetail();
                              } else {
                                alert(data.error || '상태 변경에 실패했습니다.');
                              }
                            } catch (err) {
                              alert('상태 변경 중 오류가 발생했습니다.');
                            }
                            setIsChangingStatus(false);
                          }}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setIsChangingStatus(false)}
                          className="px-2 py-1 bg-gray-300 rounded text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {customer.isLocked ? '🔒 잠금' : customer.isHibernated ? '💤 동면' : customer.customerStatus || '활성'}
                        </p>
                        <button
                          onClick={() => {
                            setNewStatus(customer.customerStatus || 'active');
                            setIsChangingStatus(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          변경
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 담당 판매원/대리점장 */}
                  <div>
                    <label className="text-sm text-gray-600">담당자 (DB소유자)</label>
                    {customer.assignedManager ? (
                      <div className="font-medium">
                        <span className={`px-2 py-0.5 rounded text-xs mr-2 ${
                          customer.assignedManager.type === 'BRANCH_MANAGER'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {customer.assignedManager.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'}
                        </span>
                        {customer.assignedManager.displayName}
                        {customer.assignedManager.contactPhone && (
                          <span className="text-gray-500 text-sm ml-2">({customer.assignedManager.contactPhone})</span>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium text-gray-400">본사 직속</p>
                    )}
                  </div>

                  {/* 고객 그룹 */}
                  <div>
                    <label className="text-sm text-gray-600">고객 그룹</label>
                    <p className="font-medium">{customer.customerGroupName || '-'}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">가입일</label>
                    <p className="font-medium">{new Date(customer.createdAt).toLocaleString('ko-KR')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">최근 활동</label>
                    <p className="font-medium">
                      {customer.lastActiveAt ? new Date(customer.lastActiveAt).toLocaleString('ko-KR') : '-'}
                    </p>
                  </div>
                </div>

                {/* 다음 조치 알람 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <FiBell size={14} />
                      다음 조치 알람
                    </label>
                    <button
                      onClick={() => setShowNextActionForm(!showNextActionForm)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showNextActionForm ? '취소' : '설정'}
                    </button>
                  </div>
                  {customer.nextActionDate ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="font-medium text-yellow-800">
                        📅 {new Date(customer.nextActionDate).toLocaleDateString('ko-KR')}
                      </p>
                      {customer.nextActionNote && (
                        <p className="text-sm text-yellow-700 mt-1">{customer.nextActionNote}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">설정된 알람이 없습니다.</p>
                  )}
                  {showNextActionForm && (
                    <div className="mt-3 bg-white border rounded-lg p-3 space-y-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">알람 날짜</label>
                        <input
                          type="date"
                          value={nextActionForm.date}
                          onChange={(e) => setNextActionForm({ ...nextActionForm, date: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">메모</label>
                        <input
                          type="text"
                          value={nextActionForm.note}
                          onChange={(e) => setNextActionForm({ ...nextActionForm, note: e.target.value })}
                          placeholder="다음 조치 내용..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!nextActionForm.date) {
                            alert('날짜를 선택해주세요.');
                            return;
                          }
                          setIsSavingNextAction(true);
                          try {
                            const response = await fetch(`/api/admin/users/${customerId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                nextActionDate: nextActionForm.date,
                                nextActionNote: nextActionForm.note,
                              }),
                            });
                            const data = await response.json();
                            if (data.ok) {
                              alert('다음 조치 알람이 설정되었습니다.');
                              setShowNextActionForm(false);
                              setNextActionForm({ date: '', note: '' });
                              loadCustomerDetail();
                            } else {
                              alert(data.error || '설정에 실패했습니다.');
                            }
                          } catch (err) {
                            alert('설정 중 오류가 발생했습니다.');
                          } finally {
                            setIsSavingNextAction(false);
                          }
                        }}
                        disabled={isSavingNextAction}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingNextAction ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* 문자 보내기 모달 */}
              {showSmsForm && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[1100]">
                  <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-4">문자 보내기</h3>
                    <p className="text-sm text-gray-600 mb-2">받는 사람: {customer.name} ({customer.phone})</p>
                    <textarea
                      value={smsContent}
                      onChange={(e) => setSmsContent(e.target.value)}
                      placeholder="문자 내용을 입력하세요..."
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                      rows={4}
                    />
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={async () => {
                          if (!smsContent.trim()) {
                            alert('내용을 입력해주세요.');
                            return;
                          }
                          setIsSendingSms(true);
                          try {
                            // SMS 발송 API 호출 (실제 구현 필요)
                            const response = await fetch('/api/admin/sms/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                phone: customer.phone,
                                message: smsContent,
                                customerId: customer.id,
                              }),
                            });
                            const data = await response.json();
                            if (data.ok) {
                              alert('문자가 발송되었습니다.');
                              setShowSmsForm(false);
                              setSmsContent('');
                            } else {
                              // 임시: 웹 기본 SMS 앱으로 열기
                              window.open(`sms:${customer.phone}?body=${encodeURIComponent(smsContent)}`, '_blank');
                              setShowSmsForm(false);
                              setSmsContent('');
                            }
                          } catch (err) {
                            // 임시: 웹 기본 SMS 앱으로 열기
                            window.open(`sms:${customer.phone}?body=${encodeURIComponent(smsContent)}`, '_blank');
                            setShowSmsForm(false);
                            setSmsContent('');
                          } finally {
                            setIsSendingSms(false);
                          }
                        }}
                        disabled={isSendingSms}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSendingSms ? '발송 중...' : '발송'}
                      </button>
                      <button
                        onClick={() => {
                          setShowSmsForm(false);
                          setSmsContent('');
                        }}
                        className="px-4 py-2 bg-gray-300 rounded-lg font-medium hover:bg-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 여권보내기 모달 */}
              {showPassportSendModal && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[1100]">
                  <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FiFileText size={20} className="text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">여권 등록 링크 보내기</h3>
                        <p className="text-sm text-gray-500">고객에게 여권 등록 링크를 문자로 발송합니다</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">받는 사람:</span> {customer.name} ({customer.phone})
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">문자 내용</label>
                      <textarea
                        value={passportSendMessage}
                        onChange={(e) => setPassportSendMessage(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                        rows={6}
                      />
                      <p className="text-xs text-gray-500 mt-1">* 링크 클릭 시 고객이 직접 여권 사진을 촬영하여 등록할 수 있습니다.</p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
                      <div className="font-medium text-blue-800 mb-1">여권 등록 링크 안내</div>
                      <ul className="text-blue-700 space-y-1">
                        <li>• 고객이 링크를 클릭하면 여권 촬영 페이지로 이동</li>
                        <li>• AI가 여권을 스캔하여 자동으로 정보 입력</li>
                        <li>• 등록 완료 시 알림을 받을 수 있습니다</li>
                      </ul>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!passportSendMessage.trim()) {
                            alert('메시지 내용을 입력해주세요.');
                            return;
                          }
                          setIsSendingPassport(true);
                          try {
                            // SMS 발송 API 호출
                            const response = await fetch('/api/admin/sms/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                phone: customer.phone,
                                message: passportSendMessage,
                                customerId: customer.id,
                                type: 'passport_request',
                              }),
                            });
                            const data = await response.json();
                            if (data.ok) {
                              alert('여권 등록 링크가 발송되었습니다.');
                              setShowPassportSendModal(false);
                              setPassportSendMessage('');
                            } else {
                              // API 실패 시 기본 SMS 앱으로 fallback
                              window.open(`sms:${customer.phone}?body=${encodeURIComponent(passportSendMessage)}`, '_blank');
                              setShowPassportSendModal(false);
                              setPassportSendMessage('');
                            }
                          } catch (err) {
                            // 오류 시 기본 SMS 앱으로 fallback
                            window.open(`sms:${customer.phone}?body=${encodeURIComponent(passportSendMessage)}`, '_blank');
                            setShowPassportSendModal(false);
                            setPassportSendMessage('');
                          } finally {
                            setIsSendingPassport(false);
                          }
                        }}
                        disabled={isSendingPassport}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FiSend size={16} />
                        {isSendingPassport ? '발송 중...' : '문자 발송'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPassportSendModal(false);
                          setPassportSendMessage('');
                        }}
                        className="px-4 py-2 bg-gray-300 rounded-lg font-medium hover:bg-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 서비스 이용 정보 */}
              <section className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiPackage size={20} />
                  서비스 이용 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">카카오 채널</label>
                    <p className="font-medium">
                      {customer.kakaoChannelAdded ? (
                        <span className="text-green-600">
                          ✓ 추가됨 {customer.kakaoChannelAddedAt && `(${new Date(customer.kakaoChannelAddedAt).toLocaleDateString('ko-KR')})`}
                        </span>
                      ) : (
                        <span className="text-gray-400">미추가</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">PWA 설치</label>
                    <div className="font-medium">
                      {customer.pwaGenieInstalledAt && (
                        <div className="text-pink-600">
                          📲 크루즈닷: {new Date(customer.pwaGenieInstalledAt).toLocaleDateString('ko-KR')}
                        </div>
                      )}
                      {customer.pwaMallInstalledAt && (
                        <div className="text-blue-600">
                          📲 몰: {new Date(customer.pwaMallInstalledAt).toLocaleDateString('ko-KR')}
                        </div>
                      )}
                      {!customer.pwaGenieInstalledAt && !customer.pwaMallInstalledAt && (
                        <span className="text-gray-400">미설치</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* APIS 정보 */}
              {customer.apisInfo && (customer.apisInfo.spreadsheetId || customer.apisInfo.googleFolderId) && (
                <section className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiFileText size={20} />
                    APIS 등록 정보
                  </h3>
                  <div className="space-y-2">
                    {customer.apisInfo.spreadsheetId && (
                      <div>
                        <label className="text-sm text-gray-600">스프레드시트 ID</label>
                        <p className="font-mono text-sm break-all">{customer.apisInfo.spreadsheetId}</p>
                      </div>
                    )}
                    {customer.apisInfo.googleFolderId && (
                      <div>
                        <label className="text-sm text-gray-600">구글 폴더 ID</label>
                        <p className="font-mono text-sm break-all">{customer.apisInfo.googleFolderId}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 구매 상품 정보 */}
              {(customer.reservations && customer.reservations.length > 0) ||
                (customer.trips && customer.trips.some(t => t.Reservation && t.Reservation.length > 0)) ? (
                <section className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiShoppingCart size={20} />
                    구매 상품 정보
                  </h3>
                  <div className="space-y-4">
                    {customer.trips?.map((trip) => {
                      const reservations = trip.Reservation || [];
                      if (reservations.length === 0) return null;

                      return (
                        <div key={trip.id} className="border border-green-200 rounded-lg p-4 bg-white">
                          <div className="font-semibold mb-2">{trip.cruiseName || '여행 정보'}</div>
                          <div className="text-sm text-gray-600 mb-3">
                            {trip.startDate && trip.endDate && (
                              <div>
                                {new Date(trip.startDate).toLocaleDateString('ko-KR')} ~ {new Date(trip.endDate).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                            {trip.destination && (
                              <div>
                                목적지: {Array.isArray(trip.destination) ? trip.destination.join(', ') : trip.destination}
                              </div>
                            )}
                            {trip.companionType && (
                              <div>동반자: {trip.companionType}</div>
                            )}
                          </div>
                          {reservations.map((res) => (
                            <div key={res.id} className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-sm">
                                <div className="font-medium">예약 ID: {res.id}</div>
                                <div>인원: {res.totalPeople}명</div>
                                <div>여권 상태: {res.passportStatus}</div>
                                {res.Traveler && res.Traveler.length > 0 && (
                                  <div className="mt-2">
                                    <div className="font-medium mb-1">여행자 정보:</div>
                                    {res.Traveler.map((traveler: any) => (
                                      <div key={traveler.id} className="ml-4 text-xs text-gray-600 mb-2">
                                        {traveler.korName || `${traveler.engGivenName || ''} ${traveler.engSurname || ''}`.trim() || '이름 없음'}
                                        {traveler.passportNo && ` (여권: ${traveler.passportNo})`}
                                        {traveler.passportImage && (
                                          <div className="mt-1 flex gap-1">
                                            <button
                                              onClick={() => {
                                                const img = new Image();
                                                img.src = traveler.passportImage;
                                                const w = window.open();
                                                if (w) {
                                                  w.document.write(`<img src="${traveler.passportImage}" style="max-width: 100%; height: auto;" />`);
                                                }
                                              }}
                                              className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                            >
                                              이미지 보기
                                            </button>
                                            <button
                                              onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = traveler.passportImage;
                                                link.download = `passport_${traveler.passportNo || 'unknown'}.jpg`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                              }}
                                              className="px-2 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                            >
                                              다운로드
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {customer.reservations?.map((res) => (
                      <div key={res.id} className="border border-green-200 rounded-lg p-4 bg-white">
                        <div className="font-semibold mb-2">예약 ID: {res.id}</div>
                        <div className="text-sm">
                          <div>인원: {res.totalPeople}명</div>
                          <div>여권 상태: {res.passportStatus}</div>
                          {res.Traveler && res.Traveler.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium mb-1">여행자 정보:</div>
                              {res.Traveler.map((traveler: any) => (
                                <div key={traveler.id} className="ml-4 text-xs text-gray-600 mb-2">
                                  {traveler.korName || `${traveler.engGivenName || ''} ${traveler.engSurname || ''}`.trim() || '이름 없음'}
                                  {traveler.passportNo && ` (여권: ${traveler.passportNo})`}
                                  {traveler.passportImage && (
                                    <div className="mt-1 flex gap-1">
                                      <button
                                        onClick={() => {
                                          const img = new Image();
                                          img.src = traveler.passportImage;
                                          const w = window.open();
                                          if (w) {
                                            w.document.write(`<img src="${traveler.passportImage}" style="max-width: 100%; height: auto;" />`);
                                          }
                                        }}
                                        className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                      >
                                        이미지 보기
                                      </button>
                                      <button
                                        onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = traveler.passportImage;
                                          link.download = `passport_${traveler.passportNo || 'unknown'}.jpg`;
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                        }}
                                        className="px-2 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                      >
                                        다운로드
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiShoppingCart size={20} />
                    구매 상품 정보
                  </h3>
                  <p className="text-gray-500">구매한 상품이 없습니다.</p>
                </section>
              )}

              {/* 환불 이력 */}
              {customer.refundHistory && customer.refundHistory.length > 0 ? (
                <section className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiDollarSign size={20} />
                    환불 이력
                  </h3>
                  <div className="space-y-3">
                    {customer.refundHistory.map((refund) => (
                      <div key={refund.id} className="border border-red-200 rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-red-600">
                              {refund.productName || `여행 ID: ${refund.tripId || 'N/A'}`}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              환불 금액: {refund.amount.toLocaleString('ko-KR')}원
                            </div>
                            {refund.reason && (
                              <div className="text-sm text-gray-700 mt-2">
                                사유: {refund.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(refund.createdAt).toLocaleString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiDollarSign size={20} />
                    환불 이력
                  </h3>
                  <p className="text-gray-500">환불 이력이 없습니다.</p>
                </section>
              )}

              {/* 여권 정보 (문자기록) */}
              <section className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiFileText size={20} />
                  여권 정보
                </h3>
                {(() => {
                  // 모든 여행의 Reservation에서 Traveler 정보 수집
                  const allTravelers: Array<{
                    name: string;
                    passportNo: string | null;
                    birthDate: string | null;
                    expiryDate: string | null;
                    tripName: string;
                    reservationId: number;
                  }> = [];

                  // 디버깅: trips의 Reservation 확인
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[CustomerDetailModal] Collecting passport info:', {
                      tripsCount: customer.trips?.length || 0,
                      trips: customer.trips?.map((trip: any) => ({
                        id: trip.id,
                        cruiseName: trip.cruiseName,
                        reservationsCount: trip.Reservation?.length || 0,
                        reservations: trip.Reservation?.map((res: any) => ({
                          id: res.id,
                          totalPeople: res.totalPeople,
                          travelersCount: res.Traveler?.length || 0,
                          travelers: res.Traveler?.map((t: any) => ({
                            id: t.id,
                            korName: t.korName,
                            engName: `${t.engGivenName || ''} ${t.engSurname || ''}`.trim(),
                            passportNo: t.passportNo,
                            hasPassport: !!(t.passportNo && t.passportNo.trim() !== ''),
                          })),
                        })),
                      })),
                    });
                  }

                  // trips에서 여권 정보 수집 (passportNo가 있는 Traveler만)
                  customer.trips?.forEach((trip) => {
                    if (trip.Reservation && Array.isArray(trip.Reservation)) {
                      trip.Reservation.forEach((res) => {
                        if (res.Traveler && Array.isArray(res.Traveler)) {
                          res.Traveler.forEach((traveler) => {
                            // passportNo가 있는 Traveler만 수집
                            if (traveler.passportNo && traveler.passportNo.trim() !== '') {
                              const name = traveler.korName ||
                                `${traveler.engGivenName || ''} ${traveler.engSurname || ''}`.trim() ||
                                '이름 없음';
                              allTravelers.push({
                                name,
                                passportNo: traveler.passportNo,
                                birthDate: traveler.birthDate,
                                expiryDate: traveler.expiryDate,
                                tripName: trip.cruiseName || '여행 정보',
                                reservationId: res.id,
                              });
                            }
                          });
                        }
                      });
                    }
                  });

                  // reservations에서 여권 정보 수집 (passportNo가 있는 Traveler만)
                  customer.reservations?.forEach((res) => {
                    res.Traveler?.forEach((traveler) => {
                      // passportNo가 있는 Traveler만 수집
                      if (traveler.passportNo && traveler.passportNo.trim() !== '') {
                        const name = traveler.korName ||
                          `${traveler.engGivenName || ''} ${traveler.engSurname || ''}`.trim() ||
                          '이름 없음';
                        allTravelers.push({
                          name,
                          passportNo: traveler.passportNo,
                          birthDate: traveler.birthDate,
                          expiryDate: traveler.expiryDate,
                          tripName: '예약 정보',
                          reservationId: res.id,
                        });
                      }
                    });
                  });

                  if (allTravelers.length === 0) {
                    return <p className="text-gray-500">등록된 여권 정보가 없습니다.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {allTravelers.map((traveler, index) => {
                        const expiryDate = traveler.expiryDate ? new Date(traveler.expiryDate) : null;
                        const now = new Date();
                        const sixMonthsLater = new Date();
                        sixMonthsLater.setMonth(now.getMonth() + 6);

                        let statusColor = 'text-gray-700';
                        let statusText = '';
                        if (expiryDate) {
                          if (expiryDate < now) {
                            statusColor = 'text-red-600 font-bold';
                            statusText = ' (만료됨)';
                          } else if (expiryDate < sixMonthsLater) {
                            statusColor = 'text-orange-600 font-semibold';
                            statusText = ' (만료 임박)';
                          } else {
                            statusColor = 'text-green-600';
                            statusText = ' (유효)';
                          }
                        }

                        return (
                          <div key={index} className="bg-white border border-yellow-200 rounded-lg p-4">
                            <div className="font-medium text-gray-800 mb-2">
                              {traveler.name} - {traveler.tripName} (예약 ID: {traveler.reservationId})
                            </div>
                            <div className="text-sm space-y-1 text-gray-600">
                              {traveler.passportNo ? (
                                <div>여권번호: <span className="font-mono">{traveler.passportNo}</span></div>
                              ) : (
                                <div className="text-red-600">여권번호: 미등록</div>
                              )}
                              {traveler.birthDate && (
                                <div>생년월일: {new Date(traveler.birthDate).toLocaleDateString('ko-KR')}</div>
                              )}
                              {expiryDate && (
                                <div className={statusColor}>
                                  만료일: {expiryDate.toLocaleDateString('ko-KR')}{statusText}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 수동 여권 등록 버튼 */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowPassportForm(!showPassportForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiPlus size={16} />
                    {showPassportForm ? '취소' : '수동 여권 등록'}
                  </button>
                </div>

                {/* 수동 여권 등록 폼 */}
                {showPassportForm && (
                  <div className="mt-4 bg-white border-2 border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-4">여권 스캔 및 정보 입력</h4>

                    {/* 여권 스캔 필수 안내 */}
                    {!passportScanned && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                          <FiInfo size={18} />
                          <span>여권 스캔 필수 (OCR 자동 인식)</span>
                        </div>
                        <p className="text-sm text-yellow-700 mb-2">
                          수동 여권 등록은 반드시 여권 이미지를 스캔하여 정보를 추출해야 합니다.
                          Jaminai AI가 자동으로 여권 정보를 읽어 입력합니다.
                        </p>
                        <div className="text-xs text-yellow-600 space-y-1">
                          <div>💡 <strong>촬영 팁:</strong></div>
                          <ul className="ml-4 list-disc space-y-0.5">
                            <li>밝은 곳에서 촬영하세요</li>
                            <li>여권을 평평하게 놓고 정면에서 촬영하세요</li>
                            <li>반사광이 텍스트를 가리지 않도록 주의하세요</li>
                            <li>모든 텍스트가 보이도록 전체를 촬영하세요</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* 여권 이미지 업로드 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        여권 이미지 업로드 * (필수)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          try {
                            setIsScanning(true);

                            // FormData 생성
                            const formData = new FormData();
                            formData.append('file', file);

                            // Jaminai (Gemini) API로 여권 스캔
                            const response = await fetch('/api/passport/scan', {
                              method: 'POST',
                              body: formData,
                            });

                            const data = await response.json();

                            if (data.ok && data.data) {
                              // 스캔 성공 - 폼에 데이터 자동 입력
                              setPassportForm({
                                ...passportForm,
                                korName: data.data.korName || '',
                                engGivenName: data.data.engGivenName || '',
                                engSurname: data.data.engSurname || '',
                                passportNo: data.data.passportNo || '',
                                sex: data.data.sex || '', // 성별
                                birthDate: data.data.dateOfBirth || '',
                                issueDate: data.data.dateOfIssue || '', // 발급일
                                expiryDate: data.data.passportExpiryDate || '',
                              });
                              setPassportScanned(true);

                              // 경고 메시지 표시 (일부 정보 누락 시)
                              if (data.warnings) {
                                alert(`✅ 여권 스캔 완료!\n\n⚠️ ${data.warnings}\n\n아래 정보를 확인하고 누락된 부분을 입력해주세요.`);
                              } else {
                                alert('✅ 여권 스캔 완료! 모든 정보가 추출되었습니다.\n\n정보를 확인하고 필요시 수정하세요.');
                              }
                            } else {
                              // 에러 메시지 표시
                              const errorMsg = data.error || '여권 스캔에 실패했습니다. 선명한 이미지를 업로드해주세요.';
                              alert(`❌ 스캔 실패\n\n${errorMsg}`);
                            }
                          } catch (err) {
                            console.error('[Passport Scan Error]', err);
                            alert('여권 스캔 중 오류가 발생했습니다.');
                          } finally {
                            setIsScanning(false);
                          }
                        }}
                        disabled={isScanning}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      {isScanning && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-700">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <div>
                              <div className="font-medium">Jaminai AI로 여권 스캔 중...</div>
                              <div className="text-xs text-blue-600 mt-0.5">OCR 자동 인식 처리 중입니다</div>
                            </div>
                          </div>
                        </div>
                      )}
                      {passportScanned && (
                        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-green-700">
                            <FiCheckCircle size={18} />
                            <div>
                              <div className="font-medium">여권 스캔 완료 ✓</div>
                              <div className="text-xs text-green-600 mt-0.5">
                                아래 정보를 확인하고 누락된 부분이 있으면 수정해주세요
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">한국 이름 *</label>
                        <input
                          type="text"
                          value={passportForm.korName}
                          onChange={(e) => setPassportForm({ ...passportForm, korName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="홍길동"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">영문 이름 (Given Name)</label>
                        <input
                          type="text"
                          value={passportForm.engGivenName}
                          onChange={(e) => setPassportForm({ ...passportForm, engGivenName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Gildong"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">영문 성 (Surname) *</label>
                        <input
                          type="text"
                          value={passportForm.engSurname}
                          onChange={(e) => setPassportForm({ ...passportForm, engSurname: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="HONG"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">여권번호 *</label>
                        <input
                          type="text"
                          value={passportForm.passportNo}
                          onChange={(e) => setPassportForm({ ...passportForm, passportNo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="M12345678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                        <select
                          value={passportForm.sex}
                          onChange={(e) => setPassportForm({ ...passportForm, sex: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">선택</option>
                          <option value="M">남성 (M)</option>
                          <option value="F">여성 (F)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">생년월일 *</label>
                        <input
                          type="date"
                          value={passportForm.birthDate}
                          onChange={(e) => setPassportForm({ ...passportForm, birthDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">여권 발급일</label>
                        <input
                          type="date"
                          value={passportForm.issueDate}
                          onChange={(e) => setPassportForm({ ...passportForm, issueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">만료일 *</label>
                        <input
                          type="date"
                          value={passportForm.expiryDate}
                          onChange={(e) => setPassportForm({ ...passportForm, expiryDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={async () => {
                          // 여권 스캔 필수 체크
                          if (!passportScanned) {
                            alert('⚠️ 여권 이미지를 먼저 스캔해주세요. 수동 여권 등록은 반드시 여권 스캔이 필요합니다.');
                            return;
                          }

                          // 여권 등록 API 호출
                          try {
                            const response = await fetch(`/api/admin/customers/${customerId}/passport`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify(passportForm),
                            });
                            const data = await response.json();
                            if (data.ok) {
                              alert('✅ 여권 정보가 등록되었습니다.');
                              setShowPassportForm(false);
                              setPassportForm({
                                korName: '',
                                engGivenName: '',
                                engSurname: '',
                                passportNo: '',
                                sex: '',
                                birthDate: '',
                                issueDate: '',
                                expiryDate: '',
                                reservationId: null,
                              });
                              setPassportScanned(false);
                              loadCustomerDetail(); // 정보 다시 로드
                            } else {
                              alert(data.error || '여권 등록에 실패했습니다.');
                            }
                          } catch (err) {
                            console.error('[CustomerDetailModal] Passport registration error:', err);
                            alert('여권 등록 중 오류가 발생했습니다.');
                          }
                        }}
                        disabled={!passportScanned}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${passportScanned
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        <FiSave size={16} />
                        저장 {!passportScanned && '(여권 스캔 필수)'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPassportForm(false);
                          setPassportForm({
                            korName: '',
                            engGivenName: '',
                            engSurname: '',
                            passportNo: '',
                            sex: '',
                            birthDate: '',
                            issueDate: '',
                            expiryDate: '',
                            reservationId: null,
                          });
                          setPassportScanned(false);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 상담기록 탭 */}
          {!loading && !error && customer && activeTab === 'consultation' && (
            <div className="space-y-6">
              {/* 상담기록 추가 버튼 */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FiMessageSquare size={20} />
                  상담기록
                </h3>
                <button
                  onClick={() => setShowConsultationForm(!showConsultationForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  {showConsultationForm ? '취소' : '상담기록 추가'}
                </button>
              </div>

              {/* 상담기록 작성 폼 */}
              {showConsultationForm && (
                <div className="bg-white border-2 border-blue-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-gray-800">새 상담기록 작성</h4>

                  {/* 상담일시 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FiClock className="inline mr-1" />
                      상담일시 *
                    </label>
                    <input
                      type="datetime-local"
                      value={consultationForm.consultedAt}
                      onChange={(e) => setConsultationForm({ ...consultationForm, consultedAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* 상담내용 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      상담내용 *
                    </label>
                    <textarea
                      value={consultationForm.content}
                      onChange={(e) => setConsultationForm({ ...consultationForm, content: e.target.value })}
                      placeholder="상담 내용을 상세히 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* 다음 조치 알람 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <FiBell className="inline mr-1" />
                        다음 조치 날짜
                      </label>
                      <input
                        type="date"
                        value={consultationForm.nextActionDate}
                        onChange={(e) => setConsultationForm({ ...consultationForm, nextActionDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    {/* 상담 후 상태 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        상담 후 상태
                      </label>
                      <select
                        value={consultationForm.statusAfter}
                        onChange={(e) => setConsultationForm({ ...consultationForm, statusAfter: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">선택 (상태 변경 없음)</option>
                        <option value="active">활성</option>
                        <option value="locked">잠금</option>
                        <option value="dormant">동면</option>
                        <option value="purchase_confirmed">구매확정</option>
                        <option value="potential">잠재고객</option>
                        <option value="lost">이탈</option>
                      </select>
                    </div>
                  </div>

                  {/* 다음 조치 메모 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      다음 조치 메모
                    </label>
                    <input
                      type="text"
                      value={consultationForm.nextActionNote}
                      onChange={(e) => setConsultationForm({ ...consultationForm, nextActionNote: e.target.value })}
                      placeholder="다음에 해야 할 일..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* 녹음 파일 업로드 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FiMic className="inline mr-1" />
                      녹음 파일 업로드 (선택)
                    </label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Vercel 제한: 4.5MB, 안전하게 4MB로 제한
                          const maxSize = 4 * 1024 * 1024; // 4MB
                          if (file.size > maxSize) {
                            alert(`파일 크기가 너무 큽니다.\n현재: ${(file.size / 1024 / 1024).toFixed(1)}MB\n최대: 4MB\n\n만능 압축기에서 오디오 파일을 압축해주세요.`);
                            e.target.value = '';
                            setAudioFile(null);
                            return;
                          }
                          setAudioFile(file);
                        } else {
                          setAudioFile(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    {audioFile && (
                      <p className="text-sm text-green-600 mt-1">✓ {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)}MB) 선택됨</p>
                    )}
                  </div>

                  {/* 저장 버튼 */}
                  <button
                    onClick={async () => {
                      if (!consultationForm.content.trim()) {
                        alert('상담 내용을 입력해주세요.');
                        return;
                      }
                      setIsSavingConsultation(true);
                      try {
                        // 오디오 파일이 있으면 먼저 업로드
                        let audioUrl = null;
                        if (audioFile) {
                          const formData = new FormData();
                          formData.append('file', audioFile);
                          formData.append('customerId', customerId.toString());
                          const uploadRes = await fetch('/api/admin/upload/audio', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include',
                          });
                          const uploadData = await uploadRes.json();
                          if (uploadData.ok) {
                            audioUrl = uploadData.url;
                          }
                        }

                        // 상담기록 저장 API 호출
                        const response = await fetch(`/api/admin/customers/${customerId}/consultations`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            ...consultationForm,
                            audioFileUrl: audioUrl,
                          }),
                        });
                        const data = await response.json();
                        if (data.ok) {
                          alert('상담기록이 저장되었습니다.');
                          setShowConsultationForm(false);
                          setConsultationForm({
                            content: '',
                            consultedAt: new Date().toISOString().slice(0, 16),
                            nextActionDate: '',
                            nextActionNote: '',
                            statusAfter: '',
                          });
                          setAudioFile(null);
                          // 고객 정보 다시 로드 (상담기록 목록 갱신)
                          loadCustomerDetail();
                        } else {
                          alert(data.error || '저장에 실패했습니다.');
                        }
                      } catch (err) {
                        console.error('[Consultation Save Error]', err);
                        alert('저장 중 오류가 발생했습니다.');
                      } finally {
                        setIsSavingConsultation(false);
                      }
                    }}
                    disabled={isSavingConsultation}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FiSave size={18} />
                    {isSavingConsultation ? '저장 중...' : '상담기록 저장 (자동 Google 백업)'}
                  </button>
                </div>
              )}

              {/* 기존 상담기록 목록 - 블록 형태 */}
              <div className="space-y-2">
                {customer.consultationNotes && customer.consultationNotes.length > 0 ? (
                  customer.consultationNotes.map((note) => {
                    const isExpanded = expandedNoteIds.has(note.id);
                    const contentPreview = note.content.length > 50
                      ? note.content.slice(0, 50) + '...'
                      : note.content;

                    return (
                      <div
                        key={note.id}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                      >
                        {/* 헤더 영역 - 클릭으로 확장/축소 */}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedNoteIds);
                            if (isExpanded) {
                              newExpanded.delete(note.id);
                            } else {
                              newExpanded.add(note.id);
                            }
                            setExpandedNoteIds(newExpanded);
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* 작성자 배지 */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                              note.createdByLabel === '본사' ? 'bg-gray-100 text-gray-700' :
                              note.createdByLabel === '대리점장' ? 'bg-purple-100 text-purple-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {note.createdByLabel}
                            </span>

                            {/* 날짜 */}
                            <span className="text-sm text-gray-500 flex-shrink-0">
                              {new Date(note.consultedAt).toLocaleDateString('ko-KR')}
                            </span>

                            {/* 내용 미리보기 */}
                            <span className="text-sm text-gray-700 truncate">
                              {contentPreview}
                            </span>

                            {/* 다음 조치 표시 */}
                            {note.nextActionDate && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 flex-shrink-0">
                                다음 조치
                              </span>
                            )}

                            {/* 녹음 파일 표시 */}
                            {note.audioFileUrl && (
                              <FiMic className="text-blue-500 flex-shrink-0" size={14} />
                            )}
                          </div>

                          {/* 확장/축소 아이콘 */}
                          <div className="flex-shrink-0 ml-2 text-gray-400">
                            {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                          </div>
                        </button>

                        {/* 확장된 상세 내용 */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                            {/* 작성자 정보 */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm">
                                <span className="text-gray-500">작성자:</span>{' '}
                                <span className="font-medium text-gray-700">{note.createdByName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* 상세 보기 버튼 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNote(note);
                                  }}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                                >
                                  상세 보기
                                </button>
                                <div className="text-xs text-gray-400">
                                  등록: {new Date(note.createdAt).toLocaleString('ko-KR')}
                                </div>
                              </div>
                            </div>

                            {/* 상담 내용 (미리보기 - 긴 내용은 잘림) */}
                            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed line-clamp-4">
                                {note.content}
                              </p>
                              {note.content.length > 200 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNote(note);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm mt-2 font-medium"
                                >
                                  ... 전체 내용 보기
                                </button>
                              )}
                            </div>

                            {/* 다음 조치 정보 */}
                            {note.nextActionDate && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <FiClock size={14} className="text-yellow-600" />
                                  <span className="text-yellow-800 font-medium text-sm">다음 조치</span>
                                </div>
                                <p className="text-yellow-700 text-sm">
                                  {new Date(note.nextActionDate).toLocaleDateString('ko-KR')}
                                  {note.nextActionNote && (
                                    <span className="block mt-1">{note.nextActionNote}</span>
                                  )}
                                </p>
                              </div>
                            )}

                            {/* 상태 변경 정보 */}
                            {note.statusAfter && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                <span className="text-sm text-blue-800">
                                  <span className="font-medium">상담 후 상태 변경:</span> {note.statusAfter}
                                </span>
                              </div>
                            )}

                            {/* 녹음 파일 */}
                            {note.audioFileUrl && (
                              <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <FiMic size={14} />
                                    녹음 파일
                                  </span>
                                  <a
                                    href={getProxyAudioUrl(note.audioFileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FiUpload size={12} className="rotate-180" />
                                    다운로드
                                  </a>
                                </div>
                                <audio controls className="w-full h-10" onClick={(e) => e.stopPropagation()}>
                                  <source src={getProxyAudioUrl(note.audioFileUrl)} type="audio/mpeg" />
                                </audio>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FiMessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>등록된 상담기록이 없습니다.</p>
                    <p className="text-sm mt-1">상담기록 추가 버튼을 클릭하여 첫 기록을 작성하세요.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 상담기록 상세 모달 */}
        {selectedNote && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
              {/* 모달 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiMessageSquare size={24} />
                  <div>
                    <h3 className="text-lg font-bold">상담기록 상세</h3>
                    <p className="text-sm text-blue-100">
                      {new Date(selectedNote.consultedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-white hover:text-gray-200 transition-colors p-1"
                >
                  <FiX size={24} />
                </button>
              </div>

              {/* 모달 본문 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* 작성자 정보 */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedNote.createdByLabel === '본사' ? 'bg-gray-200 text-gray-700' :
                      selectedNote.createdByLabel === '대리점장' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <FiUser size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{selectedNote.createdByName}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        selectedNote.createdByLabel === '본사' ? 'bg-gray-100 text-gray-700' :
                        selectedNote.createdByLabel === '대리점장' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedNote.createdByLabel}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>상담일: {new Date(selectedNote.consultedAt).toLocaleString('ko-KR')}</p>
                    <p>등록일: {new Date(selectedNote.createdAt).toLocaleString('ko-KR')}</p>
                  </div>
                </div>

                {/* 상담 내용 */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <FiMessageSquare size={16} />
                    상담 내용
                  </h4>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-base">
                      {selectedNote.content}
                    </p>
                  </div>
                </div>

                {/* 다음 조치 정보 */}
                {selectedNote.nextActionDate && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                      <FiClock size={16} />
                      다음 조치 예정
                    </h4>
                    <p className="text-yellow-700 font-medium">
                      {new Date(selectedNote.nextActionDate).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </p>
                    {selectedNote.nextActionNote && (
                      <p className="text-yellow-700 mt-2 whitespace-pre-wrap">
                        {selectedNote.nextActionNote}
                      </p>
                    )}
                  </div>
                )}

                {/* 상태 변경 정보 */}
                {selectedNote.statusAfter && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      <span className="font-semibold">상담 후 상태 변경:</span>{' '}
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        selectedNote.statusAfter === 'active' ? 'bg-green-100 text-green-800' :
                        selectedNote.statusAfter === 'purchase_confirmed' ? 'bg-blue-100 text-blue-800' :
                        selectedNote.statusAfter === 'lost' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedNote.statusAfter}
                      </span>
                    </p>
                  </div>
                )}

                {/* 녹음 파일 */}
                {selectedNote.audioFileUrl && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FiMic size={16} />
                      녹음 파일
                    </h4>
                    <audio controls className="w-full mb-3">
                      <source src={getProxyAudioUrl(selectedNote.audioFileUrl)} type="audio/mpeg" />
                      브라우저가 오디오를 지원하지 않습니다.
                    </audio>
                    <div className="flex gap-2">
                      <a
                        href={getProxyAudioUrl(selectedNote.audioFileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 flex items-center gap-1"
                      >
                        <FiUpload size={14} className="rotate-180" />
                        새 탭에서 열기
                      </a>
                      <a
                        href={getProxyAudioUrl(selectedNote.audioFileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200 flex items-center gap-1"
                      >
                        <FiUpload size={14} className="rotate-180" />
                        다운로드
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* 모달 푸터 */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

