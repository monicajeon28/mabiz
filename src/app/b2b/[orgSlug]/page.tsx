'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { showError } from '@/components/ui/Toast';
import { ToastContainer, useToast } from '@/components/ui/Toast';

const PACKAGE_OPTIONS = [
  { value: '330', label: '스탠다드 패키지 — 330만원' },
  { value: '540', label: '프리미엄 패키지 — 540만원' },
  { value: '750', label: '럭셔리 패키지 — 750만원' },
];

export default function B2BLandingPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const { toasts, removeToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    company: '',
    email: '',
    packageInterest: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      showError('이름을 입력해 주세요.');
      return;
    }
    if (!form.phone.trim()) {
      showError('연락처를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/b2b/${orgSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data?.message ?? '등록 중 오류가 발생했습니다. 다시 시도해 주세요.');
        return;
      }

      setSubmitted(true);
    } catch {
      showError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
          {/* 헤더 */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">파트너 상담 신청</h1>
            <p className="text-sm text-gray-500">정보를 남겨주시면 담당자가 빠르게 연락드립니다.</p>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">등록 완료!</h2>
              <p className="text-gray-500 text-sm">담당자가 연락드리겠습니다.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* 이름 */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 연락처 */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 회사명 */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  회사명
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="(선택)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 이메일 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@email.com (선택)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 패키지 관심 */}
              <div>
                <label htmlFor="packageInterest" className="block text-sm font-medium text-gray-700 mb-1">
                  관심 패키지
                </label>
                <select
                  id="packageInterest"
                  name="packageInterest"
                  value={form.packageInterest}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                >
                  <option value="">선택 안 함</option>
                  {PACKAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm transition-colors mt-2"
              >
                {submitting ? '처리 중...' : '상담 신청하기'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          입력하신 정보는 상담 목적으로만 사용됩니다.
        </p>
      </div>
    </>
  );
}
