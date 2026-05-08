'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiPlus, FiTrash2, FiLoader, FiArrowLeft, FiMessageSquare, FiMail, FiSave, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Link from 'next/link';

type FunnelStage = {
  id?: number;
  stageNumber: number;
  daysAfter: number;
  sendTime: string;
  title: string;
  content: string;
};

interface CustomerGroup {
  id: number;
  name: string;
  leadCount?: number;
  _count?: { leads?: number; members?: number };
}

export default function EditScheduledMessagePage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.partnerId as string;
  const messageId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [messageType, setMessageType] = useState<'sms' | 'email'>('sms');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetGroupId: null as number | null,
    optOutNumber: '080-888-1003',
    autoAddOptOut: true,
    senderPhone: '',
    senderEmail: '',
    startDate: '',
    startTime: '09:00',
    isActive: true,
    stages: [] as FunnelStage[],
  });

  // 메시지 데이터 로드
  const loadMessage = useCallback(async () => {
    try {
      const res = await fetch(`/api/partner/scheduled-messages/${messageId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.message) {
        const msg = data.message;
        setMessageType(msg.sendMethod === 'email' ? 'email' : 'sms');
        setFormData({
          title: msg.title || '',
          description: msg.description || '',
          targetGroupId: msg.targetGroupId || null,
          optOutNumber: msg.optOutNumber || '080-888-1003',
          autoAddOptOut: msg.autoAddOptOut !== false,
          senderPhone: msg.senderPhone || '',
          senderEmail: msg.senderEmail || '',
          startDate: msg.startDate ? msg.startDate.split('T')[0] : '',
          startTime: msg.startTime || '09:00',
          isActive: msg.isActive !== false,
          stages: msg.stages?.length > 0 ? msg.stages.map((s: any, i: number) => ({
            id: s.id,
            stageNumber: s.stageNumber || i + 1,
            daysAfter: s.daysAfter || 0,
            sendTime: s.sendTime || '09:00',
            title: s.title || `${i + 1}회차`,
            content: s.content || '',
          })) : [
            {
              stageNumber: 1,
              daysAfter: 0,
              sendTime: '09:00',
              title: '1회차',
              content: '',
            },
          ],
        });
      } else {
        alert('메시지를 찾을 수 없습니다.');
        router.push(`/partner/${partnerId}/message-center`);
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
      alert('메시지 로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [messageId, partnerId, router]);

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

  useEffect(() => {
    loadMessage();
    loadCustomerGroups();
  }, [loadMessage, loadCustomerGroups]);

  // 단계 추가
  const addStage = () => {
    if (formData.stages.length >= 30) {
      alert('최대 30개의 단계까지 추가할 수 있습니다.');
      return;
    }
    const newStageNumber = formData.stages.length + 1;
    setFormData({
      ...formData,
      stages: [
        ...formData.stages,
        {
          stageNumber: newStageNumber,
          daysAfter: formData.stages.length > 0 ? formData.stages[formData.stages.length - 1].daysAfter + 1 : 0,
          sendTime: '09:00',
          title: `${newStageNumber}회차`,
          content: '',
        },
      ],
    });
  };

  // 단계 삭제
  const removeStage = (index: number) => {
    if (formData.stages.length <= 1) {
      alert('최소 1개의 단계가 필요합니다.');
      return;
    }
    const newStages = formData.stages.filter((_, i) => i !== index);
    newStages.forEach((stage, i) => {
      stage.stageNumber = i + 1;
      stage.title = `${i + 1}회차`;
    });
    setFormData({ ...formData, stages: newStages });
  };

  // 저장
  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (formData.stages.some((stage) => !stage.content.trim())) {
      alert('모든 단계의 메시지 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/partner/scheduled-messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          sendMethod: messageType,
          startDate: formData.startDate || null,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        alert('수정되었습니다.');
        router.push(`/partner/${partnerId}/message-center`);
      } else {
        alert(data.error || '수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async () => {
    try {
      const response = await fetch(`/api/partner/scheduled-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !formData.isActive }),
      });

      const data = await response.json();
      if (data.ok) {
        setFormData({ ...formData, isActive: !formData.isActive });
        alert(formData.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
      } else {
        alert(data.error || '상태 변경에 실패했습니다.');
      }
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 미리보기 콘텐츠
  const getPreviewContent = (stage: FunnelStage) => {
    let content = stage.content;
    if (formData.autoAddOptOut && formData.optOutNumber && messageType === 'sms') {
      content += `\n\n무료수신거부: ${formData.optOutNumber}`;
    }
    return content;
  };

  const typeLabel = messageType === 'sms' ? '퍼널문자' : '퍼널이메일';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className={`bg-gradient-to-r ${messageType === 'sms' ? 'from-emerald-800 to-emerald-700' : 'from-blue-800 to-blue-700'} text-white`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/partner/${partnerId}/message-center`}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                {messageType === 'sms' ? (
                  <FiMessageSquare className="w-8 h-8" />
                ) : (
                  <FiMail className="w-8 h-8" />
                )}
                <div>
                  <h1 className="text-2xl font-bold">{typeLabel} 수정</h1>
                  <p className="text-white/70 text-sm mt-1">예약 메시지를 수정합니다</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                formData.isActive
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-100'
                  : 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-200'
              }`}
            >
              {formData.isActive ? <FiToggleRight className="w-5 h-5" /> : <FiToggleLeft className="w-5 h-5" />}
              {formData.isActive ? '활성' : '비활성'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 입력 폼 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">기본 정보</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {typeLabel} 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{typeLabel} 설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* SMS: 발신번호 */}
              {messageType === 'sms' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발신번호</label>
                  <input
                    type="tel"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              )}

              {/* 이메일: 발신이메일 */}
              {messageType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발신 이메일</label>
                  <input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              )}

              {/* 대상 그룹 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대상 고객 그룹</label>
                <select
                  value={formData.targetGroupId || ''}
                  onChange={(e) => setFormData({ ...formData, targetGroupId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">그룹을 선택하세요 (선택사항)</option>
                  {customerGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.leadCount ?? group._count?.leads ?? group._count?.members ?? 0}명)
                    </option>
                  ))}
                </select>
              </div>

              {/* 시작일/시간 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일 (선택)</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 발송 시간</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>

              {/* SMS 전용: 수신거부 */}
              {messageType === 'sms' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">무료수신거부 번호</label>
                  <input
                    type="text"
                    value={formData.optOutNumber}
                    onChange={(e) => setFormData({ ...formData, optOutNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={formData.autoAddOptOut}
                      onChange={(e) => setFormData({ ...formData, autoAddOptOut: e.target.checked })}
                      className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500"
                    />
                    <span className="text-sm text-gray-600">무료수신거부 자동 추가</span>
                  </label>
                </div>
              )}
            </div>

            {/* 메시지 단계 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{typeLabel} 단계</h2>
                <button
                  onClick={addStage}
                  className={`px-4 py-2 ${messageType === 'sms' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg flex items-center gap-2 text-sm`}
                >
                  <FiPlus />
                  단계 추가
                </button>
              </div>

              {formData.stages.map((stage, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{stage.title}</h3>
                    {formData.stages.length > 1 && (
                      <button
                        onClick={() => removeStage(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">발송일 (D+)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">D +</span>
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={stage.daysAfter}
                          onChange={(e) => {
                            const newStages = [...formData.stages];
                            newStages[index].daysAfter = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, stages: newStages });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        />
                        <span className="text-gray-500 text-sm">일</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">발송 시간</label>
                      <input
                        type="time"
                        value={stage.sendTime}
                        onChange={(e) => {
                          const newStages = [...formData.stages];
                          newStages[index].sendTime = e.target.value;
                          setFormData({ ...formData, stages: newStages });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {messageType === 'sms' ? '문자' : '이메일'} 내용 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={stage.content}
                      onChange={(e) => {
                        const newStages = [...formData.stages];
                        newStages[index].content = e.target.value;
                        setFormData({ ...formData, stages: newStages });
                      }}
                      rows={messageType === 'sms' ? 5 : 8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
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

            {/* 저장 버튼 */}
            <div className="flex gap-3">
              <Link
                href={`/partner/${partnerId}/message-center`}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center font-medium"
              >
                취소
              </Link>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex-1 px-6 py-3 ${messageType === 'sms' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-700 hover:bg-blue-800'} text-white rounded-lg disabled:opacity-50 font-medium flex items-center justify-center gap-2`}
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">미리보기</h2>

              <div className={`rounded-lg p-4 ${messageType === 'sms' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {messageType === 'sms' ? (
                    <FiMessageSquare className="text-emerald-600" />
                  ) : (
                    <FiMail className="text-blue-600" />
                  )}
                  <span className={`text-sm font-medium ${messageType === 'sms' ? 'text-emerald-800' : 'text-blue-800'}`}>
                    {messageType === 'sms' ? '문자 메시지' : '이메일'}
                  </span>
                </div>

                <div className={`bg-white rounded-lg p-4 border ${messageType === 'sms' ? 'border-emerald-200' : 'border-blue-200'}`}>
                  {formData.stages[0]?.content ? (
                    <div className="whitespace-pre-wrap text-sm text-gray-700">
                      {getPreviewContent(formData.stages[0])
                        .replace(/{이름}/g, '홍길동')
                        .replace(/{연락처}/g, '010-1234-5678')
                        .replace(/{상품명}/g, '지중해 크루즈')}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">첫 번째 단계의 메시지 내용을 입력하세요</p>
                  )}
                </div>
              </div>

              {/* 발송 일정 요약 */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">발송 일정 ({formData.stages.length}단계)</h3>
                <div className="space-y-2">
                  {formData.stages.map((stage, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <span className={`w-14 font-mono ${messageType === 'sms' ? 'text-emerald-600' : 'text-blue-600'}`}>D+{stage.daysAfter}</span>
                      <span className="text-gray-400">{stage.sendTime}</span>
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
    </div>
  );
}
