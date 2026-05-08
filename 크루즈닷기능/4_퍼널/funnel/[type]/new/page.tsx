'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiPlus, FiX, FiTrash2, FiLoader } from 'react-icons/fi';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';
import EmojiPicker from '@/components/ui/EmojiPicker';

type FunnelStage = {
  stageNumber: number;
  daysAfter: number;
  sendTime: string;
  content: string;
  imageUrl?: string;
};

export default function NewFunnelMessagePage() {
  const router = useRouter();
  const params = useParams();
  const messageType = params.type as string;

  const [isLoading, setIsLoading] = useState(false);
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
    // 카카오톡 전용 설정
    kakaoChannelId: '',
    kakaoTemplateCode: '',
    kakaoButtonType: 'none' as 'none' | 'webLink' | 'appLink' | 'botKeyword',
    kakaoButtonName: '',
    kakaoButtonUrl: '',
    stages: [
      {
        stageNumber: 1,
        daysAfter: 0,
        sendTime: '',
        content: '',
        imageUrl: '',
      },
    ] as FunnelStage[],
  });

  useEffect(() => {
    loadCustomerGroups();
  }, []);

  const loadCustomerGroups = async () => {
    try {
      const response = await fetch('/api/admin/customer-groups', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setCustomerGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load customer groups:', error);
    }
  };

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
          daysAfter: 0,
          sendTime: '',
          content: '',
          imageUrl: '',
        },
      ],
    });
  };

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

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showWarning('제목을 입력해주세요.');
      return;
    }

    if (formData.stages.some((stage) => !stage.content.trim())) {
      showWarning('모든 단계의 메시지 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/funnel-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          messageType,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        showSuccess('퍼널 메시지가 생성되었습니다.');
        router.push('/admin/funnel');
      } else {
        showError(data.error || '퍼널 메시지 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save funnel message:', error);
      showError('퍼널 메시지 저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (!confirm('입력한 내용을 모두 초기화하시겠습니까?')) {
      return;
    }
    setFormData({
      title: '',
      category: '',
      groupName: '',
      description: '',
      senderPhone: '',
      senderEmail: '',
      sendTime: '',
      optOutNumber: '080-888-1003',
      autoAddOptOut: true,
      groupId: null,
      kakaoChannelId: '',
      kakaoTemplateCode: '',
      kakaoButtonType: 'none',
      kakaoButtonName: '',
      kakaoButtonUrl: '',
      stages: [
        {
          stageNumber: 1,
          daysAfter: 0,
          sendTime: '',
          content: '',
          imageUrl: '',
        },
      ],
    });
  };

  const getPreviewContent = (stage: FunnelStage) => {
    let content = stage.content;
    // 이메일에는 무료수신거부 추가하지 않음
    if (messageType !== 'email' && formData.autoAddOptOut && formData.optOutNumber) {
      content += `\n\n무료수신거부: ${formData.optOutNumber}`;
    }
    return content;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {messageType === 'sms' ? '퍼널문자' : messageType === 'email' ? '퍼널메일' : '퍼널카톡'} 작성
        </h1>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  대분류
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {messageType === 'sms' ? '퍼널문자' : messageType === 'email' ? '퍼널메일' : '퍼널카톡'} 묶음
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {messageType === 'sms' ? '퍼널문자' : messageType === 'email' ? '퍼널메일' : '퍼널카톡'} 설명
              </label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    발신번호
                  </label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    발신 이메일
                  </label>
                  <input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  발송시간
                </label>
                <input
                  type="time"
                  value={formData.sendTime}
                  onChange={(e) => setFormData({ ...formData, sendTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* 무료수신거부 - SMS에만 표시 */}
            {messageType === 'sms' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  무료수신거부 번호
                </label>
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

            {/* 카카오톡 전용 설정 */}
            {messageType === 'kakao' && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#FEE500] rounded flex items-center justify-center text-xs">K</span>
                  카카오톡 알림톡 설정
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      카카오 채널 ID
                    </label>
                    <input
                      type="text"
                      value={formData.kakaoChannelId}
                      onChange={(e) => setFormData({ ...formData, kakaoChannelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="@채널ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      템플릿 코드
                    </label>
                    <input
                      type="text"
                      value={formData.kakaoTemplateCode}
                      onChange={(e) => setFormData({ ...formData, kakaoTemplateCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="TMP0001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    버튼 타입
                  </label>
                  <select
                    value={formData.kakaoButtonType}
                    onChange={(e) => setFormData({ ...formData, kakaoButtonType: e.target.value as 'none' | 'webLink' | 'appLink' | 'botKeyword' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="none">버튼 없음</option>
                    <option value="webLink">웹 링크</option>
                    <option value="appLink">앱 링크</option>
                    <option value="botKeyword">봇 키워드</option>
                  </select>
                </div>

                {formData.kakaoButtonType !== 'none' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        버튼 이름
                      </label>
                      <input
                        type="text"
                        value={formData.kakaoButtonName}
                        onChange={(e) => setFormData({ ...formData, kakaoButtonName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="자세히 보기"
                      />
                    </div>
                    {formData.kakaoButtonType !== 'botKeyword' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          버튼 URL
                        </label>
                        <input
                          type="text"
                          value={formData.kakaoButtonUrl}
                          onChange={(e) => setFormData({ ...formData, kakaoButtonUrl: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 메시지 단계 */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">메시지 단계</h2>
              <button
                onClick={addStage}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <FiPlus />
                {messageType === 'sms' ? '퍼널문자' : messageType === 'email' ? '퍼널메일' : '퍼널카톡'} 추가하기
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      발송일 (일 후)
                    </label>
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {stage.daysAfter === 0 ? '즉시 발송' : `본 메시지는 ${stage.daysAfter}일 후에 발송됩니다.`}
                    </p>
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
                          const textarea = document.querySelector(`textarea[data-funnel-stage-index="${index}"]`) as HTMLTextAreaElement;
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const text = newStages[index].content;
                            const newText = text.substring(0, start) + emoji + text.substring(end);
                            newStages[index].content = newText;
                            setFormData({ ...formData, stages: newStages });
                            // 커서 위치 조정
                            setTimeout(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                            }, 0);
                          } else {
                            newStages[index].content += emoji;
                            setFormData({ ...formData, stages: newStages });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    data-funnel-stage-index={index}
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
                </div>
              </div>
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              초기화
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? <FiLoader className="animate-spin inline" /> : '저장'}
            </button>
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">미리보기</h2>

            {messageType === 'email' ? (
              /* 이메일 미리보기 */
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">이메일 미리보기</h3>
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
                  <div className="bg-white rounded-lg shadow-sm">
                    {/* 이메일 헤더 */}
                    <div className="border-b border-gray-200 p-4">
                      <div className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">발신자:</span> {formData.senderEmail || '발신 이메일을 입력하세요'}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">제목:</span> {formData.title || '제목을 입력하세요'}
                      </div>
                    </div>
                    {/* 이메일 본문 */}
                    <div className="p-4">
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
              </div>
            ) : messageType === 'kakao' ? (
              /* 카카오톡 미리보기 */
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">카카오톡 미리보기</h3>
                <div className="bg-[#B2C7D9] rounded-lg p-4 border-2 border-gray-300">
                  <div className="bg-[#FEE500] rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-[#3B1E1E] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">K</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">알림톡</span>
                        {formData.kakaoChannelId && (
                          <span className="text-xs text-gray-600 ml-2">{formData.kakaoChannelId}</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg overflow-hidden">
                      {formData.stages[0]?.content ? (
                        <div className="whitespace-pre-wrap text-sm p-3">
                          {getPreviewContent(formData.stages[0])}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm p-3">메시지 내용을 입력하세요</p>
                      )}
                      {/* 카카오 버튼 미리보기 */}
                      {formData.kakaoButtonType !== 'none' && formData.kakaoButtonName && (
                        <div className="border-t border-gray-200 p-2">
                          <button className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700">
                            {formData.kakaoButtonName}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* 카카오 설정 정보 */}
                {(formData.kakaoChannelId || formData.kakaoTemplateCode) && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-xs text-gray-600">
                    {formData.kakaoChannelId && <div>채널: {formData.kakaoChannelId}</div>}
                    {formData.kakaoTemplateCode && <div>템플릿: {formData.kakaoTemplateCode}</div>}
                    {formData.kakaoButtonType !== 'none' && (
                      <div>버튼: {formData.kakaoButtonType === 'webLink' ? '웹 링크' : formData.kakaoButtonType === 'appLink' ? '앱 링크' : '봇 키워드'}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* SMS 미리보기 - 기본 */
              <>
                {/* 아이폰 미리보기 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">아이폰</h3>
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

                {/* 삼성폰 미리보기 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">삼성폰</h3>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

