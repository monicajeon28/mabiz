'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateContactSchema, CreateContactInput } from '@/lib/schemas/contact';
import { getFieldConfig, hasAnyError, formatFormErrors } from '@/lib/form-helpers';
import { useState } from 'react';

/**
 * Contact 생성 폼 예제
 *
 * Level 2 통합: Zod + React Hook Form 수동통합
 * - 한글 에러 메시지 자동 표시
 * - 필드별 실시간 검증
 * - 타입 안전성 (z.infer<T>)
 */
export function ContactFormExample() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
  } = useForm({
    resolver: zodResolver(CreateContactSchema),
    mode: 'onBlur', // Blur 시점에 검증 (실시간 검증)
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      residentNum: '',
      contactType: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      notes: '',
      tags: [],
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      // API 호출 예시
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('고객 저장에 실패했습니다.');
      }

      setSubmitMessage({
        type: 'success',
        text: '고객이 저장되었습니다.',
      });

      reset(); // 폼 초기화
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = hasAnyError(errors, ['name', 'phone', 'email']);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">고객 등록</h1>

      {submitMessage && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            submitMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {submitMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ─── 이름 필드 ─── */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            이름 <span className="text-red-500">*</span>
          </label>
          {(() => {
            const field = getFieldConfig(register, 'name', errors, f => dirtyFields[f as keyof typeof dirtyFields] as boolean);
            return (
              <>
                <input
                  id="name"
                  {...field.register}
                  type="text"
                  placeholder="예: 김철수"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                />
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 전화번호 필드 ─── */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            전화번호
          </label>
          {(() => {
            const field = getFieldConfig(register, 'phone', errors, f => dirtyFields[f as keyof typeof dirtyFields] as boolean);
            return (
              <>
                <input
                  id="phone"
                  {...field.register}
                  type="tel"
                  placeholder="예: 010-1234-5678"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                />
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 이메일 필드 ─── */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            이메일
          </label>
          {(() => {
            const field = getFieldConfig(register, 'email', errors, f => dirtyFields[f as keyof typeof dirtyFields] as boolean);
            return (
              <>
                <input
                  id="email"
                  {...field.register}
                  type="email"
                  placeholder="예: kim@example.com"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                />
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 주민번호 필드 ─── */}
        <div>
          <label htmlFor="residentNum" className="block text-sm font-medium mb-1">
            주민번호
          </label>
          {(() => {
            const field = getFieldConfig(register, 'residentNum', errors, f => dirtyFields[f as keyof typeof dirtyFields] as boolean);
            return (
              <>
                <input
                  id="residentNum"
                  {...field.register}
                  type="text"
                  placeholder="예: 000000-0000000"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                />
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 고객 유형 필드 ─── */}
        <div>
          <label htmlFor="contactType" className="block text-sm font-medium mb-1">
            고객 유형 <span className="text-red-500">*</span>
          </label>
          {(() => {
            const field = getFieldConfig(register, 'contactType', errors);
            return (
              <>
                <select
                  id="contactType"
                  {...field.register}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                >
                  <option value="">선택하세요</option>
                  <option value="CUSTOMER">기존 고객</option>
                  <option value="PROSPECT">신규 전망 고객</option>
                  <option value="INQUIRY">문의자</option>
                  <option value="PARTNER">파트너</option>
                </select>
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 상태 필드 ─── */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">
            상태 <span className="text-red-500">*</span>
          </label>
          {(() => {
            const field = getFieldConfig(register, 'status', errors);
            return (
              <>
                <select
                  id="status"
                  {...field.register}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                >
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="LOST">손실</option>
                </select>
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 메모 필드 ─── */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            메모
          </label>
          {(() => {
            const field = getFieldConfig(register, 'notes', errors);
            return (
              <>
                <textarea
                  id="notes"
                  {...field.register}
                  placeholder="고객에 대한 추가 정보를 입력하세요."
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${field.className} ${
                    field.error ? 'focus:ring-red-200' : 'focus:ring-blue-200'
                  }`}
                />
                {field.error && <p className="mt-1 text-sm text-red-500">{field.error}</p>}
              </>
            );
          })()}
        </div>

        {/* ─── 제출 버튼 ─── */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || isDisabled}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
        </div>
      </form>

      {/* ─── 개발용 디버그 정보 (프로덕션에서 제거) ─── */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-mono text-xs font-bold mb-2">에러 상태:</h2>
        <pre className="text-xs overflow-auto max-h-40">
          {Object.keys(errors).length === 0 ? '없음' : JSON.stringify(errors, null, 2)}
        </pre>
      </div>
    </div>
  );
}
