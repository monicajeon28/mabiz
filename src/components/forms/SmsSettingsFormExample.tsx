'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { OrgSmsConfigSchema, UserSmsConfigSchema, SmsTestSchema } from '@/lib/schemas/sms-settings';
import { validateFormData, getFieldError, formatErrorMessage } from '@/lib/validate';
import { useState } from 'react';

type OrgSmsConfigInput = z.infer<typeof OrgSmsConfigSchema>;
type UserSmsConfigInput = z.infer<typeof UserSmsConfigSchema>;
type SmsTestInput = z.infer<typeof SmsTestSchema>;

/**
 * SMS 설정 폼 예제 (조직/사용자 수준)
 *
 * 사용 패턴:
 * - Level 2 (Zod + useForm)로 실시간 검증
 * - 알리고 API 키, 발신번호, 사용자 ID 검증
 * - 테스트 메시지 발송 기능 포함
 */
export function SmsSettingsFormExample() {
  const [activeTab, setActiveTab] = useState<'org' | 'user' | 'test'>('org');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── 조직 SMS 설정 폼 ───
  const orgForm = useForm<OrgSmsConfigInput>({
    resolver: zodResolver(OrgSmsConfigSchema),
    mode: 'onBlur',
    defaultValues: {
      aligoUserId: '',
      senderPhone: '',
      aligoKey: '',
    },
  });

  // ─── 사용자 SMS 설정 폼 ───
  const userForm = useForm<UserSmsConfigInput>({
    resolver: zodResolver(UserSmsConfigSchema),
    mode: 'onBlur',
    defaultValues: {
      aligoUserId: '',
      senderPhone: '',
      aligoKey: '',
    },
  });

  // ─── SMS 테스트 폼 ───
  const testForm = useForm<SmsTestInput>({
    resolver: zodResolver(SmsTestSchema),
    mode: 'onBlur',
    defaultValues: {
      testPhone: '',
      testMessage: '테스트 메시지입니다.',
    },
  });

  const onSubmitOrgConfig = async (data: OrgSmsConfigInput) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/sms/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('조직 설정 저장 실패');

      setMessage({ type: 'success', text: '조직 SMS 설정이 저장되었습니다.' });
      orgForm.reset();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitUserConfig = async (data: UserSmsConfigInput) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/sms/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('사용자 설정 저장 실패');

      setMessage({ type: 'success', text: '사용자 SMS 설정이 저장되었습니다.' });
      userForm.reset();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitTest = async (data: SmsTestInput) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('테스트 메시지 발송 실패');

      setMessage({ type: 'success', text: `${data.testPhone}로 테스트 메시지가 발송되었습니다.` });
      testForm.reset({ testPhone: '', testMessage: '테스트 메시지입니다.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">SMS 설정</h1>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ─── 탭 네비게이션 ─── */}
      <div className="flex gap-2 mb-6 border-b">
        {['org', 'user', 'test'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'org' | 'user' | 'test')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'org' && '조직 설정'}
            {tab === 'user' && '사용자 설정'}
            {tab === 'test' && '테스트 발송'}
          </button>
        ))}
      </div>

      {/* ─── 조직 SMS 설정 탭 ─── */}
      {activeTab === 'org' && (
        <form onSubmit={orgForm.handleSubmit(onSubmitOrgConfig)} className="space-y-6">
          <FormInput
            label="알리고 사용자 ID"
            required
            register={orgForm.register('aligoUserId')}
            error={orgForm.formState.errors.aligoUserId?.message}
            placeholder="example@aligo.co.kr"
            hint="알리고 계정의 이메일 주소를 입력하세요."
          />

          <FormInput
            label="발신번호"
            required
            register={orgForm.register('senderPhone')}
            error={orgForm.formState.errors.senderPhone?.message}
            placeholder="031-1234-5678"
            hint="조직에서 사용할 발신번호를 입력하세요."
          />

          <FormInput
            label="알리고 API KEY"
            required
            register={orgForm.register('aligoKey')}
            error={orgForm.formState.errors.aligoKey?.message}
            placeholder="32자 이상의 영문/숫자"
            hint="알리고 관리 페이지에서 확인 가능합니다."
            type="password"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </form>
      )}

      {/* ─── 사용자 SMS 설정 탭 ─── */}
      {activeTab === 'user' && (
        <form onSubmit={userForm.handleSubmit(onSubmitUserConfig)} className="space-y-6">
          <FormInput
            label="알리고 사용자 ID"
            required
            register={userForm.register('aligoUserId')}
            error={userForm.formState.errors.aligoUserId?.message}
            placeholder="example@aligo.co.kr"
            hint="개인 알리고 계정의 이메일 주소를 입력하세요."
          />

          <FormInput
            label="발신번호"
            required
            register={userForm.register('senderPhone')}
            error={userForm.formState.errors.senderPhone?.message}
            placeholder="010-1234-5678"
            hint="개인이 사용할 발신번호를 입력하세요."
          />

          <FormInput
            label="알리고 API KEY"
            required
            register={userForm.register('aligoKey')}
            error={userForm.formState.errors.aligoKey?.message}
            placeholder="32자 이상의 영문/숫자"
            hint="알리고 관리 페이지에서 확인 가능합니다."
            type="password"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </form>
      )}

      {/* ─── 테스트 발송 탭 ─── */}
      {activeTab === 'test' && (
        <form onSubmit={testForm.handleSubmit(onSubmitTest)} className="space-y-6">
          <FormInput
            label="테스트 전화번호"
            required
            register={testForm.register('testPhone')}
            error={testForm.formState.errors.testPhone?.message}
            placeholder="010-1234-5678"
            hint="테스트 메시지를 받을 전화번호를 입력하세요."
          />

          <div>
            <label htmlFor="testMessage" className="block text-sm font-medium mb-1">
              테스트 메시지
            </label>
            <textarea
              id="testMessage"
              {...testForm.register('testMessage')}
              placeholder="테스트 메시지를 입력하세요."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                testForm.formState.errors.testMessage ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {testForm.formState.errors.testMessage && (
              <p className="mt-1 text-sm text-red-500">{testForm.formState.errors.testMessage.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">최대 90자까지 입력 가능합니다.</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSubmitting ? '발송 중...' : '테스트 발송'}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * 재사용 가능한 폼 입력 컴포넌트
 */
function FormInput({
  label,
  required = false,
  register,
  error,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string;
  required?: boolean;
  register: any;
  error?: string;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register}
        type={type}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
          error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
