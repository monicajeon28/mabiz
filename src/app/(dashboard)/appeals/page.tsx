'use client';

/**
 * 이의 제기 페이지
 * 신뢰도 이의 제기 신청 및 현황 조회
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { SubmitAppealResponse, TrustAppeal } from '@/types/trust-score';

const APPEAL_REASONS = {
  PRODUCT_DEFECT: '상품이 나빴어요',
  CUSTOMER_REQUESTED: '고객이 환불해달라고 했어요',
  LOGISTICS_ERROR: '배송 문제였어요',
  MISUNDERSTANDING: '착오가 있었어요',
  SPECIAL_REQUEST: '특별한 사정이 있었어요',
};

export default function AppealsPage() {
  const { data: session, status } = useSession();
  const [appeals, setAppeals] = useState<TrustAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    reason: '',
    evidenceUrls: [''],
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/login');
    }

    if (!session?.user?.email) return;

    // 이의 목록 조회 (향후 API 구현)
    setLoading(false);
  }, [session?.user?.email, status]);

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, reason: e.target.value });
  };

  const handleEvidenceChange = (
    index: number,
    value: string
  ) => {
    const newUrls = [...formData.evidenceUrls];
    newUrls[index] = value;
    setFormData({ ...formData, evidenceUrls: newUrls });
  };

  const handleAddEvidence = () => {
    setFormData({
      ...formData,
      evidenceUrls: [...formData.evidenceUrls, ''],
    });
  };

  const handleRemoveEvidence = (index: number) => {
    const newUrls = formData.evidenceUrls.filter((_, i) => i !== index);
    setFormData({ ...formData, evidenceUrls: newUrls });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 유효성 확인
    if (!formData.reason) {
      setError('이유를 선택해주세요');
      return;
    }

    const validUrls = formData.evidenceUrls.filter((url) => url.trim());
    if (validUrls.length === 0) {
      setError('최소 1개 이상의 증거 자료를 첨부해주세요');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/trust-score/${session?.user?.email}/appeal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: formData.reason,
            evidenceUrls: validUrls,
            requestedAction: 'RESTORE',
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'API 오류');
      }

      const data = (await res.json()) as SubmitAppealResponse;
      setSuccess(data.message);
      setFormData({ reason: '', evidenceUrls: [''] });
    } catch (err) {
      console.error('이의 제기 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-32px font-bold text-gray-900">이의 제기</h1>
        <p className="text-16px text-gray-600 mt-2">
          신뢰도에 대해 의견이 있으신가요? 이의를 제기해주세요.
        </p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">오류</p>
          <p className="text-red-600 text-14px mt-1">{error}</p>
        </div>
      )}

      {/* 성공 메시지 */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 font-medium">✅ 성공</p>
          <p className="text-green-600 text-14px mt-1">{success}</p>
        </div>
      )}

      {/* 이의 제기 폼 */}
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-8 space-y-6">
        {/* 이유 선택 */}
        <div>
          <label className="block text-16px font-semibold text-gray-900 mb-3">
            이의 사유 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.reason}
            onChange={handleReasonChange}
            className="w-full px-4 py-3 border rounded-lg text-16px focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          >
            <option value="">선택해주세요</option>
            {Object.entries(APPEAL_REASONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 증거 자료 */}
        <div>
          <label className="block text-16px font-semibold text-gray-900 mb-3">
            증거 자료 <span className="text-red-500">*</span>
          </label>
          <p className="text-14px text-gray-600 mb-4">
            Google Drive 링크, 메시지 스크린샷, 이메일 등을 첨부해주세요.
          </p>

          <div className="space-y-3">
            {formData.evidenceUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleEvidenceChange(index, e.target.value)}
                  placeholder={`증거 자료 URL ${index + 1}`}
                  className="flex-1 px-4 py-3 border rounded-lg text-16px focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
                {formData.evidenceUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidence(index)}
                    className="px-4 py-3 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                    disabled={submitting}
                  >
                    제거
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddEvidence}
            className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-14px font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
            disabled={submitting}
          >
            + 자료 추가
          </button>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={submitting || !formData.reason}
          className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg text-16px font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? '제출 중...' : '이의 제기'}
        </button>
      </form>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
        <h2 className="text-18px font-semibold text-gray-900">이의 제기 가이드</h2>
        <ul className="space-y-2 text-14px text-gray-700">
          <li>
            ✅ <strong>명확한 이유</strong>: 왜 그 환불이 발생했는지 설명해주세요
          </li>
          <li>
            📎 <strong>증거 자료</strong>: 가능한 구체적인 증거를 첨부해주세요
          </li>
          <li>
            ⏱️ <strong>검토 기간</strong>: 일반적으로 1-3일이 소요됩니다
          </li>
          <li>
            💬 <strong>알림</strong>: 검토 완료 후 메일로 결과를 알려드립니다
          </li>
        </ul>
      </div>

      {/* 이의 목록 (향후 구현) */}
      {appeals.length > 0 && (
        <div>
          <h2 className="text-20px font-semibold text-gray-900 mb-4">
            최근 이의 제기
          </h2>
          <div className="space-y-3">
            {appeals.map((appeal) => (
              <div
                key={appeal.id}
                className="border rounded-lg p-4 bg-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-16px font-semibold text-gray-900">
                      {APPEAL_REASONS[appeal.reason as keyof typeof APPEAL_REASONS] || appeal.reason}
                    </p>
                    <p className="text-14px text-gray-600 mt-1">
                      {new Date(appeal.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-12px font-semibold ${
                      appeal.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : appeal.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {appeal.status === 'PENDING'
                      ? '검토 중'
                      : appeal.status === 'APPROVED'
                        ? '승인됨'
                        : '거부됨'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
