'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiClock, FiX, FiArrowLeft, FiLoader } from 'react-icons/fi';
import Link from 'next/link';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';
import SymbolPicker from '@/components/ui/SymbolPicker';
import SmsConfigModal from '@/components/partner/SmsConfigModal';

type ScheduledMessage = {
  id: number;
  title: string;
  category: string;
  groupName: string | null;
  description: string | null;
  sendMethod: string;
  senderName: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  optOutNumber: string | null;
  isAdMessage: boolean;
  autoAddAdTag: boolean;
  autoAddOptOut: boolean;
  startDate: string | null;
  startTime: string | null;
  maxDays: number;
  repeatInterval: number | null;
  isActive: boolean;
  createdAt: string;
  targetGroupId: number | null;
  targetGroup?: {
    id: number;
    name: string;
    _count: { members: number };
  } | null;
  stages: ScheduledMessageStage[];
};

type ScheduledMessageStage = {
  id: number;
  stageNumber: number;
  daysAfter: number;
  sendTime: string | null;
  title: string;
  content: string;
  order: number;
};

export default function PartnerScheduledMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;

  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerGroups, setCustomerGroups] = useState<Array<{ id: number; name: string; _count: { members: number } }>>([]);
  const [smsConfigStatus, setSmsConfigStatus] = useState<{
    isConnected: boolean;
    provider?: string;
    senderPhone?: string;
    profileType?: string;
  } | null>(null);
  const [showSmsConfigModal, setShowSmsConfigModal] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    title: '',
    category: '예약메시지',
    groupName: '',
    description: '',
    sendMethod: 'sms' as 'email' | 'sms',
    senderName: '크루즈닷',
    senderPhone: '',
    senderEmail: '',
    optOutNumber: '080-888-1003',
    isAdMessage: true,
    autoAddAdTag: true,
    autoAddOptOut: true,
    startDate: '',
    startTime: '',
    maxDays: 99999,
    repeatInterval: null as number | null,
    targetGroupId: null as number | null,
    stages: [
      {
        stageNumber: 1,
        daysAfter: 0,
        sendTime: '',
        title: '',
        content: '',
      },
    ] as Array<{
      stageNumber: number;
      daysAfter: number;
      sendTime: string;
      title: string;
      content: string;
    }>,
  });

  // 메시지 목록 로드
  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/partner/scheduled-messages', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setMessages(data.messages || []);
      } else {
        showError(data.error || '예약 메시지를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Failed to load scheduled messages:', error);
      showError('예약 메시지를 불러오는 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 고객 그룹 목록 로드
  const loadCustomerGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/partner/customer-groups', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setCustomerGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load customer groups:', error);
    }
  }, []);

  // SMS API 연결 상태 로드
  const loadSmsConfigStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/partner/sms-config/status', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setSmsConfigStatus({
          isConnected: data.isConnected,
          provider: data.config?.provider,
          senderPhone: data.config?.senderPhone,
          profileType: data.profileType,
        });
      }
    } catch (error) {
      console.error('Failed to load SMS config status:', error);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadCustomerGroups();
    loadSmsConfigStatus();
  }, [loadMessages, loadCustomerGroups, loadSmsConfigStatus]);

  // 새 메시지 작성 모달 열기
  const openCreateModal = () => {
    setEditingMessage(null);
    setFormData({
      title: '',
      category: '예약메시지',
      groupName: '',
      description: '',
      sendMethod: 'sms',
      senderName: '크루즈닷',
      senderPhone: '',
      senderEmail: '',
      optOutNumber: '080-888-1003',
      targetGroupId: null,
      isAdMessage: true,
      autoAddAdTag: true,
      autoAddOptOut: true,
      startDate: '',
      startTime: '',
      maxDays: 99999,
      repeatInterval: null,
      stages: [
        {
          stageNumber: 1,
          daysAfter: 0,
          sendTime: '',
          title: '',
          content: '',
        },
      ],
    });
    setShowModal(true);
  };

  // 메시지 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showWarning('제목을 입력해주세요.');
      return;
    }

    if (formData.sendMethod === 'sms' && !formData.senderPhone.trim()) {
      showWarning('SMS 발송 시 발신번호를 입력해주세요.');
      return;
    }

    if (formData.sendMethod === 'email' && !formData.senderEmail.trim()) {
      showWarning('이메일 발송 시 발신 이메일을 입력해주세요.');
      return;
    }

    if (formData.isAdMessage && formData.autoAddOptOut && !formData.optOutNumber.trim()) {
      showWarning('무료수신거부 번호를 입력해주세요.');
      return;
    }

    // 단계별 유효성 검사
    for (let i = 0; i < formData.stages.length; i++) {
      const stage = formData.stages[i];
      if (!stage.title.trim() || !stage.content.trim()) {
        showWarning(`${i + 1}회차 메시지의 제목과 내용을 모두 입력해주세요.`);
        return;
      }
    }

    try {
      const url = editingMessage
        ? `/api/partner/scheduled-messages/${editingMessage.id}`
        : '/api/partner/scheduled-messages';
      const method = editingMessage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.ok) {
        showSuccess(editingMessage ? '예약 메시지가 수정되었습니다.' : '예약 메시지가 생성되었습니다.');
        setShowModal(false);
        loadMessages();
      } else {
        showError('저장 실패: ' + (data.error || '알 수 없는 오류가 발생했습니다.'));
      }
    } catch (error) {
      console.error('Failed to save scheduled message:', error);
      showError('예약 메시지 저장 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 메시지 삭제
  const handleDelete = async (message: ScheduledMessage) => {
    if (!confirm('정말 이 예약 메시지를 삭제하시겠습니까?\n삭제된 메시지는 복구할 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/scheduled-messages/${message.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.ok) {
        showSuccess('예약 메시지가 삭제되었습니다.');
        loadMessages();
      } else {
        showError('삭제 실패: ' + (data.error || '알 수 없는 오류가 발생했습니다.'));
      }
    } catch (error) {
      console.error('Failed to delete scheduled message:', error);
      showError('예약 메시지 삭제 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 필터링된 메시지 목록
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(
      (msg) =>
        msg.title.toLowerCase().includes(query) ||
        msg.groupName?.toLowerCase().includes(query) ||
        msg.description?.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-xl" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">예약 메시지 관리</h1>
            <p className="text-gray-600 mt-1">고객 그룹에 예약된 시간에 자동으로 발송되는 메시지를 관리합니다.</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="text-lg" />
          예약 메시지 작성
        </button>
      </div>

      {/* SMS API 연결 상태 배너 */}
      {smsConfigStatus && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${smsConfigStatus.isConnected
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
          }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">
                  {smsConfigStatus.isConnected ? '✅' : '⚠️'}
                </span>
                <h3 className={`font-bold text-lg ${smsConfigStatus.isConnected ? 'text-green-900' : 'text-yellow-900'
                  }`}>
                  {smsConfigStatus.isConnected ? 'SMS API 연결됨' : 'SMS API 미연결'}
                </h3>
              </div>
              {smsConfigStatus.isConnected ? (
                <div className="text-sm text-green-800">
                  <p><strong>발신번호:</strong> {smsConfigStatus.senderPhone}</p>
                  <p><strong>서비스:</strong> {smsConfigStatus.provider === 'aligo' ? '알리고' : smsConfigStatus.provider}</p>
                  <p className="mt-1 text-xs text-green-700">
                    SMS 자동 발송 기능을 사용할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-yellow-800">
                  <p className="mb-2">
                    예약 메시지 자동 발송을 위해 SMS API 연결이 필요합니다. 아래 버튼을 클릭하여 설정하세요.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSmsConfigModal(true)}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                    >
                      ⚡ 빠른 설정
                    </button>
                    <button
                      onClick={() => alert('관리자에게 SMS API 연결 요청을 보냈습니다. (개발 중)')}
                      className="px-4 py-2 bg-white border-2 border-yellow-600 text-yellow-900 rounded-lg hover:bg-yellow-100 transition-colors text-sm font-medium"
                    >
                      관리자에게 요청하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white p-4 rounded-xl shadow-md mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 묶음명, 설명으로 검색..."
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 메시지 목록 */}
      {isLoading ? (
        <div className="text-center py-16">
          <FiLoader className="inline-block animate-spin text-4xl text-blue-600 mb-4" />
          <p className="text-lg text-gray-600 font-medium">예약 메시지를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-md text-center">
          <p className="text-gray-500 text-lg">등록된 예약 메시지가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{message.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                        {message.sendMethod === 'sms' ? 'SMS' : message.sendMethod === 'email' ? '이메일' : message.sendMethod}
                      </span>
                      {message.targetGroup && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm font-semibold">
                          👥 {message.targetGroup.name} ({message.targetGroup._count?.members || 0}명)
                        </span>
                      )}
                      {message.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-semibold">
                          활성
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm font-semibold">
                          비활성
                        </span>
                      )}
                    </div>
                  </div>
                  {message.groupName && (
                    <p className="text-sm text-gray-600 mb-1">묶음명: {message.groupName}</p>
                  )}
                  {message.description && (
                    <p className="text-sm text-gray-600 mb-2">{message.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-3">
                    <span>총 {message.stages.length}회차</span>
                    {message.startDate && (
                      <span>시작일: {new Date(message.startDate).toLocaleDateString('ko-KR')}</span>
                    )}
                    {message.startTime && <span>시작 시간: {message.startTime}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditingMessage(message);
                      setFormData({
                        title: message.title,
                        category: message.category,
                        groupName: message.groupName || '',
                        description: message.description || '',
                        sendMethod: message.sendMethod as any,
                        senderName: message.senderName || '',
                        senderPhone: message.senderPhone || '',
                        senderEmail: message.senderEmail || '',
                        optOutNumber: message.optOutNumber || '',
                        isAdMessage: message.isAdMessage,
                        autoAddAdTag: message.autoAddAdTag,
                        autoAddOptOut: message.autoAddOptOut,
                        startDate: message.startDate ? new Date(message.startDate).toISOString().split('T')[0] : '',
                        startTime: message.startTime || '',
                        maxDays: message.maxDays,
                        repeatInterval: message.repeatInterval,
                        targetGroupId: message.targetGroupId,
                        stages: message.stages.map((s) => ({
                          stageNumber: s.stageNumber,
                          daysAfter: s.daysAfter,
                          sendTime: s.sendTime || '',
                          title: s.title,
                          content: s.content,
                        })),
                      });
                      setShowModal(true);
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <FiEdit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(message)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto border-2 border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <span className="text-4xl">📅</span>
                {editingMessage ? '예약 메시지 수정' : '예약 메시지 작성'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold hover:scale-110 transition-transform"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="예약 메시지 제목"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    카테고리
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="예약메시지"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    대상 고객 그룹 <span className="text-blue-600 text-sm">(선택사항)</span>
                  </label>
                  <select
                    value={formData.targetGroupId || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, targetGroupId: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="">전체 고객 (그룹 미지정)</option>
                    {customerGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group._count?.members || 0}명)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 그룹을 선택하면 해당 그룹의 고객들에게만 자동으로 발송됩니다.
                  </p>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    퍼널문자 묶음명
                  </label>
                  <input
                    type="text"
                    value={formData.groupName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, groupName: e.target.value }))}
                    placeholder="동일한 묶음끼리 목록에서 표시"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    발송 방식 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.sendMethod}
                    onChange={(e) => {
                      const method = e.target.value as 'sms' | 'email';
                      setFormData((prev) => ({
                        ...prev,
                        sendMethod: method,
                      }));
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">이메일</option>
                  </select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    설명
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="메시지 설명"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              </div>

              {/* 발신자 정보 */}
              {formData.sendMethod === 'sms' && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    발신번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, senderPhone: e.target.value }))}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              )}

              {formData.sendMethod === 'email' && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    발신 이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, senderEmail: e.target.value }))}
                    placeholder="sender@example.com"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              )}

              {/* 메시지 단계 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  메시지 단계
                </label>
                <div className="space-y-4">
                  {formData.stages.map((stage, index) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            회차
                          </label>
                          <input
                            type="number"
                            value={stage.stageNumber}
                            onChange={(e) => {
                              const newStages = [...formData.stages];
                              newStages[index].stageNumber = parseInt(e.target.value) || 1;
                              setFormData((prev) => ({ ...prev, stages: newStages }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            며칠 후
                          </label>
                          <input
                            type="number"
                            value={stage.daysAfter}
                            onChange={(e) => {
                              const newStages = [...formData.stages];
                              newStages[index].daysAfter = parseInt(e.target.value) || 0;
                              setFormData((prev) => ({ ...prev, stages: newStages }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            발송 시간
                          </label>
                          <input
                            type="time"
                            value={stage.sendTime}
                            onChange={(e) => {
                              const newStages = [...formData.stages];
                              newStages[index].sendTime = e.target.value;
                              setFormData((prev) => ({ ...prev, stages: newStages }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          제목
                        </label>
                        <input
                          type="text"
                          value={stage.title}
                          onChange={(e) => {
                            setFormData((prev) => {
                              const newStages = [...prev.stages];
                              newStages[index].title = e.target.value;
                              return { ...prev, stages: newStages };
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-gray-700">
                            내용
                          </label>
                          <div className="relative">
                            <SymbolPicker
                              onSymbolSelect={(symbol: string) => {
                                setFormData((prev) => {
                                  const newStages = [...prev.stages];
                                  const textarea = document.querySelector(`textarea[data-partner-stage-index="${index}"]`) as HTMLTextAreaElement;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const text = newStages[index].content;
                                    const newText = text.substring(0, start) + symbol + text.substring(end);
                                    newStages[index].content = newText;
                                    setTimeout(() => {
                                      textarea.focus();
                                      textarea.setSelectionRange(start + symbol.length, start + symbol.length);
                                    }, 0);
                                  } else {
                                    newStages[index].content += symbol;
                                  }
                                  return { ...prev, stages: newStages };
                                });
                              }}
                            />
                          </div>
                        </div>
                        <textarea
                          data-partner-stage-index={index}
                          value={stage.content}
                          onChange={(e) => {
                            setFormData((prev) => {
                              const newStages = [...prev.stages];
                              newStages[index].content = e.target.value;
                              return { ...prev, stages: newStages };
                            });
                          }}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      stages: [
                        ...prev.stages,
                        {
                          stageNumber: prev.stages.length + 1,
                          daysAfter: 0,
                          sendTime: '',
                          title: '',
                          content: '',
                        },
                      ],
                    }));
                  }}
                  className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  + 단계 추가
                </button>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  {editingMessage ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMS 설정 모달 */}
      <SmsConfigModal
        isOpen={showSmsConfigModal}
        onClose={() => setShowSmsConfigModal(false)}
        onSuccess={() => {
          loadSmsConfigStatus();
        }}
      />
    </div>
  );
}

