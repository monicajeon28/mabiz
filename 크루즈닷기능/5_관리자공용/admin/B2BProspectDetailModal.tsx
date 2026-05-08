'use client';

import { useState, useEffect } from 'react';
import { FiX, FiUser, FiPhone, FiCalendar, FiPlus, FiSave, FiMessageSquare, FiClock, FiMic, FiUpload, FiSend, FiRotateCcw, FiChevronDown, FiChevronUp } from 'react-icons/fi';

// Google Drive URL을 프록시 다운로드 URL로 변환 (403 권한 문제 해결)
const getStreamableAudioUrl = (url: string | null): string => {
  if (!url) return '';

  // 이미 프록시 URL인 경우 그대로 반환
  if (url.includes('/api/drive/download/')) {
    return url;
  }

  // Google Drive file ID 추출
  // 형식: https://drive.google.com/file/d/{FILE_ID}/view
  const match = url.match(/\/file\/d\/([^\/]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    // 프록시 다운로드 URL 반환 (서버에서 서비스 계정으로 다운로드)
    return `/api/drive/download/${fileId}`;
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
  isOwn?: boolean; // 본인 작성 여부
}

interface TrialMetadata {
  trialStartedAt?: string;
  trialExpiresAt?: string;
  trialExtendedAt?: string;
  trialExtendedBy?: string | number;
  trialExtendedDays?: number;
}

interface B2BProspectDetail {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  manager: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  agent: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  consultationNotes: ConsultationNote[];
  metadata?: TrialMetadata;
}

interface Manager {
  id: number;
  displayName: string | null;
  affiliateCode: string | null;
}

interface Props {
  prospectId: number;
  prospectType: 'lead' | 'consultation'; // B2B 유입 or 시스템 상담
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  managers?: Manager[]; // 대리점장 목록 (DB 전송용)
  apiBasePath?: 'admin' | 'partner'; // API 경로 ('admin' = 관리자용, 'partner' = 대리점장용)
}

export default function B2BProspectDetailModal({ prospectId, prospectType, isOpen, onClose, onUpdate, managers: propManagers, apiBasePath = 'admin' }: Props) {
  const [prospect, setProspect] = useState<B2BProspectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'info' | 'consultation'>('info');

  // DB 전송/회수 관련
  const [managers, setManagers] = useState<Manager[]>(propManagers || []);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRecalling, setIsRecalling] = useState(false);

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
  const [isDeletingConsultation, setIsDeletingConsultation] = useState<string | number | null>(null);
  const [consultationNotes, setConsultationNotes] = useState<ConsultationNote[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<number | string>>(new Set()); // 확장된 상담기록 ID 목록
  const [selectedNote, setSelectedNote] = useState<ConsultationNote | null>(null); // 상세 모달용 선택된 노트

  // 노트 수정 관련
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (isOpen && prospectId) {
      loadProspectDetail();
      if (!propManagers || propManagers.length === 0) {
        loadManagers();
      }
    }
  }, [isOpen, prospectId, prospectType]);

  // 대리점장 목록 조회
  const loadManagers = async () => {
    try {
      const res = await fetch('/api/admin/affiliate/profiles?type=BRANCH_MANAGER&status=ACTIVE', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.profiles) {
        setManagers(data.profiles.map((p: any) => ({
          id: p.id,
          displayName: p.displayName,
          affiliateCode: p.affiliateCode,
        })));
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Failed to load managers:', err);
    }
  };

  // DB 전송 (대리점장에게 배정)
  const handleAssign = async () => {
    if (!selectedManagerId) {
      alert('대리점장을 선택해주세요.');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch('/api/admin/affiliate/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          leadIds: [prospectId],
          managerId: parseInt(selectedManagerId),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert('DB가 성공적으로 전송되었습니다.');
        setShowAssignModal(false);
        setSelectedManagerId('');
        loadProspectDetail();
        onUpdate?.();
      } else {
        alert(data.error || 'DB 전송에 실패했습니다.');
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Assign error:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setIsAssigning(false);
    }
  };

  // DB 회수 (본사로)
  const handleRecall = async () => {
    if (!confirm('이 고객의 DB를 본사로 회수하시겠습니까?')) return;

    setIsRecalling(true);
    try {
      const res = await fetch('/api/admin/affiliate/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          leadIds: [prospectId],
          managerId: null, // null = 본사 회수
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert('DB가 본사로 회수되었습니다.');
        loadProspectDetail();
        onUpdate?.();
      } else {
        alert(data.error || 'DB 회수에 실패했습니다.');
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Recall error:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setIsRecalling(false);
    }
  };

  const loadProspectDetail = async () => {
    setLoading(true);
    setError(null);
    // 이전 데이터 초기화 (다른 고객의 데이터가 섞이지 않도록)
    setProspect(null);
    setConsultationNotes([]);
    try {
      // API 경로 결정
      let apiUrl: string;
      let consultationsUrl: string;

      if (prospectType === 'lead') {
        if (apiBasePath === 'partner') {
          apiUrl = `/api/partner/customers/${prospectId}`;
          consultationsUrl = `/api/partner/customers/${prospectId}/consultations`;
        } else {
          apiUrl = `/api/admin/affiliate/leads/${prospectId}`;
          consultationsUrl = `/api/admin/affiliate/leads/${prospectId}/consultations`;
        }
      } else {
        // consultation type (시스템 문의)
        if (apiBasePath === 'partner') {
          apiUrl = `/api/partner/system-inquiries/${prospectId}`;
          consultationsUrl = `/api/partner/system-inquiries/${prospectId}/consultations`;
        } else {
          apiUrl = `/api/system-inquiries/${prospectId}`;
          consultationsUrl = `/api/system-inquiries/${prospectId}/consultations`;
        }
      }

      // 병렬로 API 호출 (성능 최적화 - 로딩 시간 50% 단축)
      const [prospectResponse, consultationsResponse] = await Promise.all([
        fetch(apiUrl, { credentials: 'include' }),
        fetch(consultationsUrl, { credentials: 'include' }).catch(() => null),
      ]);

      if (!prospectResponse.ok) {
        throw new Error('정보를 불러올 수 없습니다.');
      }

      const data = await prospectResponse.json();
      if (!data.ok) {
        throw new Error(data.error || data.message || '정보를 불러올 수 없습니다.');
      }

      // API 응답 형식에 따라 데이터 매핑 (partner API는 customer, admin API는 lead)
      const prospectData = data.customer || data.lead || data.inquiry || data;

      // 상담기록 처리
      let formattedNotes: ConsultationNote[] = [];
      if (consultationsResponse && consultationsResponse.ok) {
        try {
          const consultationsData = await consultationsResponse.json();
          if (consultationsData.ok) {
            formattedNotes = consultationsData.consultationNotes || consultationsData.consultations || [];
          }
        } catch (err) {
          console.error('[B2BProspectDetailModal] Failed to parse consultations:', err);
        }
      } else if (prospectData.consultationNotes) {
        formattedNotes = prospectData.consultationNotes;
      }

      setProspect({
        id: prospectData.id,
        customerName: prospectData.customerName || prospectData.name || null,
        customerPhone: prospectData.customerPhone || prospectData.phone || null,
        status: prospectData.status || 'NEW',
        source: prospectData.source || (prospectType === 'consultation' ? 'SYSTEM_CONSULTATION' : 'UNKNOWN'),
        notes: prospectData.notes || prospectData.message || null,
        createdAt: prospectData.createdAt,
        updatedAt: prospectData.updatedAt || prospectData.createdAt,
        manager: prospectData.manager || null,
        agent: prospectData.agent || null,
        consultationNotes: formattedNotes,
        metadata: prospectData.metadata || null,
      });
      setConsultationNotes(formattedNotes);
      setNotesContent(prospectData.notes || prospectData.message || '');
    } catch (err) {
      console.error('[B2BProspectDetailModal] Error loading prospect:', err);
      setError(err instanceof Error ? err.message : '정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!prospect) return;

    setIsSavingNotes(true);
    try {
      let apiUrl: string;
      if (prospectType === 'lead') {
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/customers/${prospectId}`
          : `/api/admin/affiliate/leads/${prospectId}`;
      } else {
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/system-inquiries/${prospectId}`
          : `/api/system-inquiries/${prospectId}`;
      }

      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: notesContent }),
      });

      const data = await response.json();
      if (data.ok) {
        alert('노트가 저장되었습니다.');
        setEditingNotes(false);
        loadProspectDetail();
        onUpdate?.();
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Error saving notes:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveConsultation = async () => {
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
        // API에서 customerId 또는 leadId 파라미터 사용
        formData.append('customerId', prospectId.toString());
        formData.append('leadId', prospectId.toString());
        // B2B 유입 vs 시스템 상담 구분 (폴더 분리용)
        formData.append('prospectType', prospectType);
        const uploadUrl = apiBasePath === 'partner' ? '/api/partner/upload/audio' : '/api/admin/upload/audio';

        console.log('[B2BProspectDetailModal] Uploading audio file:', audioFile.name, 'size:', audioFile.size);

        try {
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          console.log('[B2BProspectDetailModal] Upload response status:', uploadRes.status);

          // HTTP 에러 체크 (405, 413 등)
          if (!uploadRes.ok) {
            let errorMessage = `HTTP 오류 (${uploadRes.status})`;
            try {
              const errorData = await uploadRes.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              // JSON 파싱 실패 시 기본 메시지 사용
              if (uploadRes.status === 405) {
                errorMessage = 'API 메소드가 지원되지 않습니다. 배포 후 다시 시도해주세요.';
              } else if (uploadRes.status === 413) {
                errorMessage = '파일 크기가 너무 큽니다. 만능 압축기로 압축 후 다시 시도해주세요.';
              }
            }
            console.error('[B2BProspectDetailModal] Audio upload failed:', errorMessage);
            alert(`녹음 파일 업로드 실패: ${errorMessage}\n상담기록은 녹음 없이 저장됩니다.`);
          } else {
            const uploadData = await uploadRes.json();
            console.log('[B2BProspectDetailModal] Audio upload response:', uploadData);

            if (uploadData.ok && uploadData.url) {
              audioUrl = uploadData.url;
              console.log('[B2BProspectDetailModal] Audio uploaded successfully:', audioUrl);
            } else {
              console.error('[B2BProspectDetailModal] Audio upload failed:', uploadData.error);
              alert(`녹음 파일 업로드 실패: ${uploadData.error || '알 수 없는 오류'}\n상담기록은 녹음 없이 저장됩니다.`);
            }
          }
        } catch (uploadError) {
          console.error('[B2BProspectDetailModal] Audio upload error:', uploadError);
          alert(`녹음 파일 업로드 중 오류가 발생했습니다.\n상담기록은 녹음 없이 저장됩니다.`);
        }
      }

      // 상담기록 API (B2B 잠재고객, 시스템 상담 모두 지원)
      let apiUrl: string;
      if (prospectType === 'lead') {
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/customers/${prospectId}/consultations`
          : `/api/admin/affiliate/leads/${prospectId}/consultations`;
      } else {
        // 시스템 상담도 별도 상담기록 테이블(SystemConsultationNote) 사용
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/system-inquiries/${prospectId}/consultations`
          : `/api/system-inquiries/${prospectId}/consultations`;
      }

      const requestBody = {
        content: consultationForm.content.trim(),
        consultedAt: consultationForm.consultedAt || new Date().toISOString(),
        nextActionDate: consultationForm.nextActionDate || null,
        nextActionNote: consultationForm.nextActionNote || null,
        statusAfter: consultationForm.statusAfter || null,
        audioFileUrl: audioUrl,
        interactionType: 'CONSULTATION',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
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
        loadProspectDetail();
        onUpdate?.();
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Consultation Save Error:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingConsultation(false);
    }
  };

  // 상담기록 삭제 핸들러
  const handleDeleteConsultation = async (noteId: string | number) => {
    if (!confirm('이 상담기록을 삭제하시겠습니까?')) {
      return;
    }

    setIsDeletingConsultation(noteId);
    try {
      // API URL 결정
      let apiUrl: string;
      if (prospectType === 'lead') {
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/customers/${prospectId}/consultations?id=${noteId}`
          : `/api/admin/affiliate/leads/${prospectId}/consultations?id=${noteId}`;
      } else {
        apiUrl = apiBasePath === 'partner'
          ? `/api/partner/system-inquiries/${prospectId}/consultations?id=${noteId}`
          : `/api/system-inquiries/${prospectId}/consultations?id=${noteId}`;
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.ok) {
        // 목록에서 삭제된 상담기록 제거
        setConsultationNotes(prev => prev.filter(note => note.id !== noteId));
        alert('상담기록이 삭제되었습니다.');
        onUpdate?.();
      } else {
        alert(data.error || data.message || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('[B2BProspectDetailModal] Consultation Delete Error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingConsultation(null);
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'test-guide':
      case 'B2B_INFLOW':
      case 'TRIAL_DASHBOARD':
        return 'B2B 유입';
      case 'B2B_LANDING':
        return '파트너 B2B 유입';
      case 'B2B_LANDING_ADMIN':
        return '본사 B2B 유입';
      case 'SYSTEM_CONSULTATION':
        return '시스템 상담';
      default:
        return source;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'NEW':
      case '신규':
        return '신규';
      case 'CONTACTED':
      case '연락됨':
        return '연락됨';
      case 'CONVERTED':
      case '전환됨':
        return '전환됨';
      case 'LOST':
      case '이탈':
        return '이탈';
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${prospectType === 'lead' ? 'bg-blue-600' : 'bg-orange-600'} text-white px-6 py-4 flex items-center justify-between`}>
          <h2 className="text-xl font-bold">
            {prospectType === 'lead' ? 'B2B 잠재고객 상세' : '시스템 상담 신청 상세'}
          </h2>
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

          {!loading && !error && prospect && activeTab === 'info' && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <section className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <FiUser size={20} />
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">이름</label>
                    <p className="font-medium">{prospect.customerName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">전화번호</label>
                    <p className="font-medium flex items-center gap-1">
                      <FiPhone size={14} />
                      {prospect.customerPhone || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">구분</label>
                    <p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        prospect.source.includes('B2B') ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {getSourceLabel(prospect.source)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">상태</label>
                    <p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        prospect.status === 'NEW' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(prospect.status)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">담당 대리점장</label>
                    {prospect.manager ? (
                      <p className="font-medium">
                        {prospect.manager.displayName}
                        <span className="text-gray-500 text-sm ml-1">({prospect.manager.affiliateCode})</span>
                      </p>
                    ) : (
                      <p className="text-gray-400">미배정 (본사)</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">담당 판매원</label>
                    {prospect.agent ? (
                      <p className="font-medium">
                        {prospect.agent.displayName}
                        <span className="text-gray-500 text-sm ml-1">({prospect.agent.affiliateCode})</span>
                      </p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">등록일</label>
                    <p className="font-medium flex items-center gap-1">
                      <FiCalendar size={14} />
                      {new Date(prospect.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                {/* B2B 대시보드 체험 정보 */}
                {prospect.metadata?.trialExpiresAt && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FiClock size={16} />
                      B2B 대시보드 무료 체험 정보
                    </h4>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 체험 시작일 */}
                        {prospect.metadata.trialStartedAt && (
                          <div>
                            <label className="text-xs text-gray-500">체험 시작일</label>
                            <p className="text-sm font-medium text-gray-700">
                              {new Date(prospect.metadata.trialStartedAt).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                        )}

                        {/* 체험 만료일 */}
                        <div>
                          <label className="text-xs text-gray-500">체험 만료일</label>
                          <p className={`text-sm font-medium ${
                            new Date(prospect.metadata.trialExpiresAt) < new Date()
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}>
                            {new Date(prospect.metadata.trialExpiresAt).toLocaleDateString('ko-KR')}
                            {new Date(prospect.metadata.trialExpiresAt) < new Date() && (
                              <span className="ml-1 text-xs">(만료됨)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* 연장 정보 */}
                      {prospect.metadata.trialExtendedDays && prospect.metadata.trialExtendedDays > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                              연장됨
                            </span>
                            <span className="text-sm text-gray-600">
                              총 <span className="font-bold text-green-600">{prospect.metadata.trialExtendedDays}일</span> 연장
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {prospect.metadata.trialExtendedAt && (
                              <div>
                                <label className="text-xs text-gray-500">마지막 연장일</label>
                                <p className="text-gray-700">
                                  {new Date(prospect.metadata.trialExtendedAt).toLocaleDateString('ko-KR')}
                                </p>
                              </div>
                            )}
                            {prospect.metadata.trialExtendedBy && (
                              <div>
                                <label className="text-xs text-gray-500">연장한 사람</label>
                                <p className="text-gray-700">
                                  {typeof prospect.metadata.trialExtendedBy === 'string'
                                    ? prospect.metadata.trialExtendedBy
                                    : `ID: ${prospect.metadata.trialExtendedBy}`}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DB 전송/회수 버튼 */}
                {prospectType === 'lead' && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiSend size={16} />
                      DB 전송
                    </button>
                    {(prospect.manager || prospect.agent) && (
                      <button
                        onClick={handleRecall}
                        disabled={isRecalling}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <FiRotateCcw size={16} />
                        {isRecalling ? '회수 중...' : 'DB 회수'}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* 노트/메모 */}
              <section className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FiMessageSquare size={20} />
                    {prospectType === 'consultation' ? '문의 내용' : '노트/메모'}
                  </h3>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      수정
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                      rows={4}
                      placeholder="메모를 입력하세요..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingNotes ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(false);
                          setNotesContent(prospect.notes || '');
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {prospect.notes || '등록된 메모가 없습니다.'}
                  </p>
                )}
              </section>
            </div>
          )}

          {/* 상담기록 탭 */}
          {!loading && !error && prospect && activeTab === 'consultation' && (
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
                    {/* 다음 조치 날짜 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        <option value="연락됨">연락됨</option>
                        <option value="전환됨">전환됨</option>
                        <option value="이탈">이탈</option>
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
                      녹음 파일 업로드 (선택, 최대 4MB)
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
                            alert(`파일 크기가 너무 큽니다.\n현재: ${(file.size / 1024 / 1024).toFixed(1)}MB\n최대: 4MB\n\n파일을 압축하거나 짧은 녹음으로 나눠서 업로드해주세요.`);
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
                      <p className="text-sm text-green-600 mt-1">
                        선택됨: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)}MB)
                      </p>
                    )}
                  </div>

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleSaveConsultation}
                    disabled={isSavingConsultation}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FiSave size={18} />
                    {isSavingConsultation ? '저장 중...' : '상담기록 저장'}
                  </button>
                </div>
              )}

              {/* 기존 상담기록 목록 - 블록 형태 */}
              <div className="space-y-2">
                {consultationNotes.length > 0 ? (
                  consultationNotes.map((note) => {
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
                              <div className="flex items-center gap-2">
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
                                {/* 삭제 버튼 - 본인이 작성한 경우만 표시 */}
                                {note.isOwn && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteConsultation(note.id);
                                    }}
                                    disabled={isDeletingConsultation === note.id}
                                    className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                                  >
                                    {isDeletingConsultation === note.id ? '삭제 중...' : '삭제'}
                                  </button>
                                )}
                                <div className="text-xs text-gray-400 ml-1">
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
                                  <span className="font-medium">상담 후 상태 변경:</span>{' '}
                                  {getStatusLabel(note.statusAfter)}
                                </span>
                              </div>
                            )}

                            {/* 녹음 파일 - 다운로드만 지원 */}
                            {note.audioFileUrl && (
                              <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <FiMic size={14} />
                                    녹음 파일
                                  </span>
                                  <a
                                    href={getStreamableAudioUrl(note.audioFileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                    download
                                  >
                                    <FiUpload size={12} className="rotate-180" />
                                    다운로드
                                  </a>
                                </div>
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
                        selectedNote.statusAfter === 'CONTACTED' ? 'bg-green-100 text-green-800' :
                        selectedNote.statusAfter === 'CONVERTED' ? 'bg-blue-100 text-blue-800' :
                        selectedNote.statusAfter === 'LOST' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(selectedNote.statusAfter)}
                      </span>
                    </p>
                  </div>
                )}

                {/* 녹음 파일 - 다운로드만 지원 */}
                {selectedNote.audioFileUrl && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FiMic size={16} />
                        녹음 파일
                      </h4>
                      <a
                        href={getStreamableAudioUrl(selectedNote.audioFileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                        download
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

        {/* DB 전송 모달 */}
        {showAssignModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold mb-4">DB 전송</h3>
              <p className="text-gray-600 mb-4">이 고객의 DB를 전송할 대리점장을 선택하세요.</p>

              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              >
                <option value="">대리점장 선택...</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.displayName} ({manager.affiliateCode})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={handleAssign}
                  disabled={isAssigning || !selectedManagerId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isAssigning ? '전송 중...' : '전송'}
                </button>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedManagerId('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
