'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiPlus, FiTrash2, FiLoader, FiArrowLeft, FiMessageSquare, FiMail } from 'react-icons/fi';
import Link from 'next/link';

type FunnelStage = {
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

export default function NewScheduledMessagePage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.partnerId as string;
  const messageType = params.type as 'sms' | 'email';

  const [isLoading, setIsLoading] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);

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
    stages: [
      {
        stageNumber: 1,
        daysAfter: 0,
        sendTime: '09:00',
        title: '1회차',
        content: '',
      },
    ] as FunnelStage[],
  });

  // SMS 설정 로드
  const loadSmsConfig = useCallback(async () => {
    if (messageType !== 'sms') return;
    try {
      const res = await fetch('/api/partner/settings/sms', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.config?.senderPhone) {
        setFormData(prev => ({ ...prev, senderPhone: data.config.senderPhone }));
      }
    } catch (error) {
      console.error('SMS 설정 로드 실패:', error);
    }
  }, [messageType]);

  // 이메일 설정 로드
  const loadEmailConfig = useCallback(async () => {
    if (messageType !== 'email') return;
    try {
      const res = await fetch('/api/partner/settings/email', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.config?.senderEmail) {
        setFormData(prev => ({ ...prev, senderEmail: data.config.senderEmail }));
      }
    } catch (error) {
      console.error('이메일 설정 로드 실패:', error);
    }
  }, [messageType]);

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
    loadCustomerGroups();
    loadSmsConfig();
    loadEmailConfig();
  }, [loadCustomerGroups, loadSmsConfig, loadEmailConfig]);

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
          daysAfter: formData.stages[formData.stages.length - 1].daysAfter + 1,
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

    setIsLoading(true);
    try {
      const response = await fetch('/api/partner/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          sendMethod: messageType,
          category: '예약메시지',
          startDate: formData.startDate || null,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        alert(`${messageType === 'sms' ? '퍼널 문자' : '퍼널 이메일'}가 생성되었습니다.`);
        router.push(`/partner/${partnerId}/message-center`);
      } else {
        alert(data.error || '예약 메시지 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('예약 메시지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className={`bg-gradient-to-r ${messageType === 'sms' ? 'from-emerald-800 to-emerald-700' : 'from-blue-800 to-blue-700'} text-white`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
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
                <h1 className="text-2xl font-bold">{typeLabel} 작성</h1>
                <p className="text-white/70 text-sm mt-1">
                  {messageType === 'sms' ? '고객에게 자동으로 문자를 발송하세요' : '고객에게 자동으로 이메일을 발송하세요'}
                </p>
              </div>
            </div>
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
                  placeholder={`예: ${messageType === 'sms' ? '크루즈 문의 고객 문자 시퀀스' : '크루즈 상담 고객 이메일 시퀀스'}`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{typeLabel} 설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="이 퍼널에 대한 설명"
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
                    placeholder="01012345678"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">SMS 설정에서 등록한 발신번호가 자동으로 입력됩니다</p>
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
                    placeholder="example@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">이메일 설정에서 등록한 발신이메일이 자동으로 입력됩니다</p>
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
                  {typeLabel} 추가
                </button>
              </div>

              <p className="text-sm text-gray-500">
                고객이 등록되면 지정된 일수 후에 {messageType === 'sms' ? '문자' : '이메일'}가 자동 발송됩니다.
              </p>

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
                      <p className="text-xs text-gray-500 mt-1">
                        {stage.daysAfter === 0 ? '등록 당일 발송' : `등록 후 ${stage.daysAfter}일 후 발송`}
                      </p>
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
                      placeholder={messageType === 'sms'
                        ? '{이름}님, 안녕하세요! 크루즈 문의 주셔서 감사합니다.'
                        : '{이름}님께,\n\n안녕하세요! 크루즈 문의 주셔서 감사합니다.\n\n...'}
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
                disabled={isLoading}
                className={`flex-1 px-6 py-3 ${messageType === 'sms' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-700 hover:bg-blue-800'} text-white rounded-lg disabled:opacity-50 font-medium flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <FiLoader className="animate-spin" />
                    저장 중...
                  </>
                ) : (
                  `${typeLabel} 저장`
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">발송 일정</h3>
                <div className="space-y-2">
                  {formData.stages.map((stage, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <span className={`w-14 font-mono ${messageType === 'sms' ? 'text-emerald-600' : 'text-blue-600'}`}>D+{stage.daysAfter}</span>
                      <span className="text-gray-400">{stage.sendTime}</span>
                      <span className="text-gray-700 truncate flex-1">
                        {stage.content.substring(0, 25)}
                        {stage.content.length > 25 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
