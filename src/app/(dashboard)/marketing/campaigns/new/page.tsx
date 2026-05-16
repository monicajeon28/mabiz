'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface ContactGroup {
  id: string;
  name: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'group' | 'message' | 'schedule' | 'review'>('group');

  // 폼 상태
  const [formData, setFormData] = useState({
    groupId: '',
    title: '',
    sendEmail: false,
    sendSms: true,
    includeLanding: true,
    sendAt: new Date().toISOString().slice(0, 16),
    repeatRule: '',
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('그룹 목록을 불러올 수 없습니다.');

      const data = await res.json();
      setGroups(data.groups || data.data || []);
    } catch (err) {
      logger.error('[fetchGroups]', { err });
      alert('그룹 목록을 불러올 수 없습니다.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.groupId) {
      alert('그룹을 선택하세요.');
      return;
    }
    if (!formData.title) {
      alert('캠페인명을 입력하세요.');
      return;
    }
    if (!formData.sendEmail && !formData.sendSms && !formData.includeLanding) {
      alert('최소 하나의 메시지 채널을 선택하세요.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('캠페인 생성 실패');

      const data = await res.json();
      alert('캠페인이 생성되었습니다!');
      router.push(`/marketing/campaigns/${data.campaign.id}`);
    } catch (err) {
      logger.error('[handleSubmit]', { err });
      alert('캠페인 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">새 캠페인 만들기</h1>
        <p className="text-gray-600 mt-1">그룹별로 메시지를 발송하고 추적합니다.</p>
      </div>

      {/* 진행 상황 표시 */}
      <div className="flex gap-4 mb-8">
        {['group', 'message', 'schedule', 'review'].map((s, idx) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              step === s ? 'bg-blue-600' : step > s ? 'bg-green-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* 그룹 선택 단계 */}
      {step === 'group' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold">1단계: 그룹 선택</h2>
          <p className="text-gray-600">메시지를 발송할 고객 그룹을 선택하세요.</p>

          <div className="space-y-2">
            {groups.length === 0 ? (
              <p className="text-gray-500">생성된 그룹이 없습니다.</p>
            ) : (
              groups.map((group) => (
                <label key={group.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="groupId"
                    value={group.id}
                    checked={formData.groupId === group.id}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  />
                  <span>{group.name}</span>
                </label>
              ))
            )}
          </div>

          <Button
            onClick={() => setStep('message')}
            disabled={!formData.groupId}
            className="w-full"
          >
            다음
          </Button>
        </div>
      )}

      {/* 메시지 선택 단계 */}
      {step === 'message' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold">2단계: 메시지 선택</h2>
          <p className="text-gray-600">어떤 채널로 메시지를 보낼지 선택하세요. (복수 선택 가능)</p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendEmail}
                onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
              />
              <div>
                <div className="font-medium">📧 이메일</div>
                <div className="text-sm text-gray-600">메일 주소로 메시지 발송</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendSms}
                onChange={(e) => setFormData({ ...formData, sendSms: e.target.checked })}
              />
              <div>
                <div className="font-medium">💬 문자 (SMS)</div>
                <div className="text-sm text-gray-600">휴대폰으로 문자 발송</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.includeLanding}
                onChange={(e) => setFormData({ ...formData, includeLanding: e.target.checked })}
              />
              <div>
                <div className="font-medium">🔗 랜딩 링크</div>
                <div className="text-sm text-gray-600">추적 가능한 랜딩 페이지 링크 포함</div>
              </div>
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep('group')} variant="outline" className="flex-1">
              이전
            </Button>
            <Button
              onClick={() => setStep('schedule')}
              disabled={!formData.sendEmail && !formData.sendSms && !formData.includeLanding}
              className="flex-1"
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 스케줄 단계 */}
      {step === 'schedule' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold">3단계: 캠페인명 + 일정</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">캠페인명</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="예: 5월 VIP 고객 재구매 캠페인"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">발송 시각</label>
              <input
                type="datetime-local"
                value={formData.sendAt}
                onChange={(e) => setFormData({ ...formData, sendAt: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">반복 규칙 (선택사항)</label>
              <input
                type="text"
                value={formData.repeatRule}
                onChange={(e) => setFormData({ ...formData, repeatRule: e.target.value })}
                placeholder="CRON 규칙: 0 9 * * 1 (매주 월 9시)"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">비워두면 일회만 발송합니다.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep('message')} variant="outline" className="flex-1">
              이전
            </Button>
            <Button onClick={() => setStep('review')} className="flex-1">
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 검토 단계 */}
      {step === 'review' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold">4단계: 검토</h2>

          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">캠페인명</p>
              <p className="font-medium">{formData.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">그룹</p>
              <p className="font-medium">{groups.find((g) => g.id === formData.groupId)?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">채널</p>
              <p className="font-medium">
                {[
                  formData.sendEmail && '이메일',
                  formData.sendSms && '문자',
                  formData.includeLanding && '랜딩 링크',
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">발송 시각</p>
              <p className="font-medium">{new Date(formData.sendAt).toLocaleString('ko-KR')}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep('schedule')} variant="outline" className="flex-1">
              이전
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? '생성 중...' : '캠페인 생성'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
