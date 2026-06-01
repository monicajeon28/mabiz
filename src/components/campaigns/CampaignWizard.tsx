'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { showSuccess, showError } from '@/components/ui/Toast';
import StepOne from './StepOne';
import StepTwo from './StepTwo';
import StepThree from './StepThree';
import StepFour from './StepFour';
import StepFive from './StepFive';

interface ContactGroup {
  id: string;
  name: string;
  _count: { members: number };
}

interface FormData {
  title: string;
  groupId: string;
  sendSms: boolean;
  smsBody: string;
  sendEmail: boolean;
  emailSubject: string;
  emailBody: string;
  sendAt: string;
  repeatRule: string;
}

export default function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groups, setGroups] = useState<ContactGroup[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    groupId: '',
    sendSms: true,
    smsBody: '',
    sendEmail: false,
    emailSubject: '',
    emailBody: '',
    sendAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    repeatRule: 'ONCE',
  });

  // 그룹 목록 로드
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('그룹을 불러올 수 없습니다.');

      const data = await res.json();
      const groupList = data.groups || data.data || [];

      // _count 필드가 없으면 보충
      const processedGroups = groupList.map((g: any) => ({
        ...g,
        _count: g._count || { members: 0 },
      }));

      setGroups(processedGroups);
    } catch (err) {
      logger.error('[fetchGroups]', { err });
      showError('그룹을 불러올 수 없습니다.');
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // 최종 검증
      if (!formData.groupId || !formData.title) {
        showError('캠페인명과 그룹을 확인해주세요.');
        return;
      }

      if (!formData.sendSms && !formData.sendEmail) {
        showError('최소 하나의 채널을 선택해주세요.');
        return;
      }

      if (formData.sendSms && !formData.smsBody.trim()) {
        showError('SMS 본문을 입력해주세요.');
        return;
      }

      if (formData.sendEmail && (!formData.emailSubject.trim() || !formData.emailBody.trim())) {
        showError('이메일 제목과 본문을 입력해주세요.');
        return;
      }

      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '캠페인 생성 실패');
      }

      const data = await res.json();
      showSuccess('캠페인이 생성되었습니다!');
      router.push(`/marketing/campaigns/${data.campaign.id}`);
    } catch (err) {
      logger.error('[handleSubmit]', { err });
      showError(err instanceof Error ? err.message : '캠페인 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const selectedGroup = groups.find((g) => g.id === formData.groupId);

  if (groupsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">그룹을 로드 중입니다...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">새 캠페인 만들기</h1>
        <p className="text-gray-600 mt-2">
          5단계 마법사로 쉽게 메시지 캠페인을 만들고 발송하세요.
        </p>
      </div>

      {/* 진행 바 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium text-gray-600 mb-2">
          <span>1단계: 캠페인 설정</span>
          <span>2단계: 채널 선택</span>
          <span>3단계: 메시지</span>
          <span>4단계: 일정</span>
          <span>5단계: 검토</span>
        </div>
        <div className="flex gap-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`flex-1 transition-colors ${
                s <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="text-right text-sm text-gray-500">
          {step}/5 단계
        </div>
      </div>

      {/* 각 단계별 컴포넌트 */}
      {step === 1 && (
        <StepOne
          formData={{ title: formData.title, groupId: formData.groupId }}
          groups={groups}
          loading={loading}
          onNext={handleNext}
          onChange={handleChange}
        />
      )}

      {step === 2 && (
        <StepTwo
          formData={{ sendSms: formData.sendSms, sendEmail: formData.sendEmail }}
          onBack={handleBack}
          onNext={handleNext}
          onChange={handleChange}
          loading={loading}
        />
      )}

      {step === 3 && (
        <StepThree
          formData={{
            sendSms: formData.sendSms,
            smsBody: formData.smsBody,
            sendEmail: formData.sendEmail,
            emailSubject: formData.emailSubject,
            emailBody: formData.emailBody,
          }}
          onBack={handleBack}
          onNext={handleNext}
          onChange={handleChange}
          loading={loading}
        />
      )}

      {step === 4 && (
        <StepFour
          formData={{
            sendAt: formData.sendAt,
            repeatRule: formData.repeatRule,
          }}
          onBack={handleBack}
          onNext={handleNext}
          onChange={handleChange}
          loading={loading}
        />
      )}

      {step === 5 && selectedGroup && (
        <StepFive
          formData={formData}
          groupName={selectedGroup.name}
          memberCount={selectedGroup._count.members}
          onBack={handleBack}
          onSubmit={handleSubmit}
          loading={loading}
        />
      )}
    </div>
  );
}
