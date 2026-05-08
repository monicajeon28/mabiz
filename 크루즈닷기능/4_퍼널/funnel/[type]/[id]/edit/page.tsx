'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiPlus, FiTrash2, FiLoader, FiArrowLeft, FiSave, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';
import EmojiPicker from '@/components/ui/EmojiPicker';
import Link from 'next/link';

type FunnelStage = {
  id?: number;
  stageNumber: number;
  daysAfter: number;
  sendTime: string;
  content: string;
  imageUrl?: string;
};

export default function EditFunnelMessagePage() {
  const router = useRouter();
  const params = useParams();
  const messageType = params.type as string;
  const messageId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<Array<{ id: number; name: string }>>([]);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    groupName: '',
    description: '',
    senderPhone: '',
    senderEmail: '',
    sendTime: '',
    optOutNumber: '080-888-1003',
    autoAddOptOut: true,
    groupId: null as number | null,
    isActive: true,
    stages: [] as FunnelStage[],
  });

  // 메시지 데이터 로드
  const loadMessage = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/funnel-messages/${messageId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.message) {
        const msg = data.message;
        setFormData({
          title: msg.title || '',
          category: msg.category || '',
          groupName: msg.groupName || '',
          description: msg.description || '',
          senderPhone: msg.senderPhone || '',
          senderEmail: msg.senderEmail || '',
          sendTime: msg.sendTime || '',
          optOutNumber: msg.optOutNumber || '080-888-1003',
          autoAddOptOut: msg.autoAddOptOut !== false,
          groupId: msg.groupId || null,
          isActive: msg.isActive !== false,
          stages: msg.FunnelMessageStage?.length > 0 ? msg.FunnelMessageStage.map((s: any, i: number) => ({
            id: s.id,
            stageNumber: s.stageNumber || i + 1,
            daysAfter: s.daysAfter || 0,
            sendTime: s.sendTime || '',
            content: s.content || '',
            imageUrl: s.imageUrl || '',
          })) : [
            {
              stageNumber: 1,
              daysAfter: 0,
              sendTime: '',
              content: '',
              imageUrl: '',
            },
          ],
        });
      } else {
        showError('퍼널 메시지를 찾을 수 없습니다.');
        router.push('/admin/funnel');
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
      showError('퍼널 메시지 로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [messageId, router]);

  // 고객 그룹 로드
  const loadCustomerGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/customer-groups', { credentials: 'include' });
      const data = await response.json();
      if (data.ok) {
        setCustomerGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load customer groups:', error);
    }
  }, []);

  useEffect(() => {
    loadMessage();
    loadCustomerGroups();
  }, [loadMessage, loadCustomerGroups]);

  // 단계 추가
  const addStage = () => {
    if (formData.stages.length >= 9999) {
      showWarning('최대 9999개의 단계까지 추가할 수 있습니다.');
      return;
    }
    setFormData({
      ...formData,
      stages: [
        ...formData.stages,
        {
          stageNumber: formData.stages.length + 1,
          daysAfter: formData.stages.length > 0 ? formData.stages[formData.stages.length - 1].daysAfter + 1 : 0,
          sendTime: '',
          content: '',
          imageUrl: '',
        },
      ],
    });
  };

  // 단계 삭제
  const removeStage = (index: number) => {
    if (formData.stages.length <= 1) {
      showWarning('최소 1개의 단계가 필요합니다.');
      return;
    }
    const newStages = formData.stages.filter((_, i) => i !== index);
    newStages.forEach((stage, i) => {
      stage.stageNumber = i + 1;
    });
    setFormData({ ...formData, stages: newStages });
  };

  // 저장
  const handleSave = async () => {
    if (!formData.title.trim()) {
      showWarning('제목을 입력해주세요.');
      return;
    }

    if (formData.stages.some((stage) => !stage.content.trim())) {
      showWarning('모든 단계의 메시지 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/funnel-messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          messageType,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        showSuccess('퍼널 메시지가 수정되었습니다.');
        router.push('/admin/funnel');
      } else {
        showError(data.error || '퍼널 메시지 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save funnel message:', error);
      showError('퍼널 메시지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async () => {
    try {
      const response = await fetch(`/api/admin/funnel-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !formData.isActive }),
      });

      const data = await response.json();
      if (data.ok) {
        setFormData({ ...formData, isActive: !formData.isActive });
        showSuccess(formData.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
      } else {
        showError(data.error || '상태 변경에 실패했습니다.');
      }
    } catch (error) {
      showError('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 미리보기 콘텐츠
  const getPreviewContent = (stage: FunnelStage) => {
    let content = stage.content;
    if (formData.autoAddOptOut && formData.optOutNumber && messageType !== 'email') {
      content += `\n\n무료수신거부: ${formData.optOutNumber}`;
    }
    return content;
  };

  const typeLabel = messageType === 'sms' ? '퍼널문자' : messageType === 'email' ? '퍼널메일' : '퍼널카톡';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/funnel"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{typeLabel} 수정</h1>
        </div>
        <button
          onClick={handleToggleActive}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            formData.isActive
              ? 'bg-green-100 hover:bg-green-200 text-green-700'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
        >
          {formData.isActive ? <FiToggleRight className="w-5 h-5" /> : <FiToggleLeft className="w-5 h-5" />}
          {formData.isActive ? '활성' : '비활성'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 입력 폼 */}
        <div className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">기본 정보</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">대분류</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{typeLabel} 묶음</label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{typeLabel} 설명</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {messageType !== 'email' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">발신번호</label>
                  <input
                    type="text"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              {messageType === 'email' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">발신 이메일</label>
                  <input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">발송시간</label>
                <input
                  type="time"
                  value={formData.sendTime}
                  onChange={(e) => setFormData({ ...formData, sendTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {messageType !== 'email' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">무료수신거부 번호</label>
                <input
                  type="text"
                  value={formData.optOutNumber}
                  onChange={(e) => setFormData({ ...formData, optOutNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={formData.autoAddOptOut}
                    onChange={(e) => setFormData({ ...formData, autoAddOptOut: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">무료수신거부 자동 추가</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">대상 고객 그룹 (선택)</label>
              <select
                value={formData.groupId || ''}
                onChange={(e) => setFormData({ ...formData, groupId: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">그룹을 선택하세요</option>
                {customerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 메시지 단계 */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">메시지 단계 ({formData.stages.length}개)</h2>
              <button
                onClick={addStage}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <FiPlus />
                단계 추가
              </button>
            </div>

            {formData.stages.map((stage, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{stage.stageNumber}회차</h3>
                  {formData.stages.length > 1 && (
                    <button
                      onClick={() => removeStage(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">발송일 (D+)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">D +</span>
                      <input
                        type="number"
                        min="0"
                        max="99999"
                        value={stage.daysAfter}
                        onChange={(e) => {
                          const newStages = [...formData.stages];
                          newStages[index].daysAfter = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, stages: newStages });
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">발송 시간</label>
                    <input
                      type="time"
                      value={stage.sendTime}
                      onChange={(e) => {
                        const newStages = [...formData.stages];
                        newStages[index].sendTime = e.target.value;
                        setFormData({ ...formData, stages: newStages });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-semibold text-gray-700">
                      메시지 내용 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <EmojiPicker
                        onEmojiSelect={(emoji) => {
                          const newStages = [...formData.stages];
                          newStages[index].content += emoji;
                          setFormData({ ...formData, stages: newStages });
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    value={stage.content}
                    onChange={(e) => {
                      const newStages = [...formData.stages];
                      newStages[index].content = e.target.value;
                      setFormData({ ...formData, stages: newStages });
                    }}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="메시지 내용을 입력하세요"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['{이름}', '{연락처}', '{상품명}'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const newStages = [...formData.stages];
                          newStages[index].content += tag;
                          setFormData({ ...formData, stages: newStages });
                        }}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <Link
              href="/admin/funnel"
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center font-medium"
            >
              취소
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <FiLoader className="animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <FiSave />
                  변경사항 저장
                </>
              )}
            </button>
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">미리보기</h2>

            {/* 미리보기 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">메시지 내용</h3>
              <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  {formData.stages[0]?.content ? (
                    <div className="whitespace-pre-wrap text-sm">
                      {getPreviewContent(formData.stages[0])}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">메시지 내용을 입력하세요</p>
                  )}
                </div>
              </div>
            </div>

            {/* 발송 일정 요약 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">발송 일정 ({formData.stages.length}단계)</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {formData.stages.map((stage, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <span className="w-14 font-mono text-purple-600">D+{stage.daysAfter}</span>
                    <span className="text-gray-400">{stage.sendTime || '--:--'}</span>
                    <span className="text-gray-700 truncate flex-1">
                      {stage.content.substring(0, 20)}
                      {stage.content.length > 20 ? '...' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 상태 표시 */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className={`flex items-center gap-2 ${formData.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                <div className={`w-2 h-2 rounded-full ${formData.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">{formData.isActive ? '활성화됨' : '비활성화됨'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
