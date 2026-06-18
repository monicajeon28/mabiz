'use client';

/**
 * 관리자 이의 제기 검토 페이지
 * 펜딩 중인 이의 제기 목록 및 검토
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { TrustAppeal } from '@/types/trust-score';

const APPEAL_REASONS = {
  PRODUCT_DEFECT: '상품이 나빴어요',
  CUSTOMER_REQUESTED: '고객이 환불해달라고 했어요',
  LOGISTICS_ERROR: '배송 문제였어요',
  MISUNDERSTANDING: '착오가 있었어요',
  SPECIAL_REQUEST: '특별한 사정이 있었어요',
};

export default function AdminAppealsPage() {
  const { data: session, status } = useSession();
  const [appeals, setAppeals] = useState<TrustAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 검토 폼 상태
  const [reviewData, setReviewData] = useState({
    appealId: '',
    status: 'PENDING',
    adminReview: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/login');
    }

    // 이의 목록 조회 (향후 API 구현)
    setLoading(false);
  }, [session?.user?.email, status]);

  const handleReview = async (appealId: string, approvalStatus: 'APPROVED' | 'REJECTED') => {
    if (!reviewData.adminReview.trim()) {
      setError('검토 의견을 입력해주세요');
      return;
    }

    try {
      setReviewing(appealId);
      const res = await fetch(
        `/api/trust-score/appeal/${appealId}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: approvalStatus,
            adminReview: reviewData.adminReview,
            appliedAction: approvalStatus === 'APPROVED' ? 'RESTORE' : null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'API 오류');
      }

      setSuccess(
        approvalStatus === 'APPROVED'
          ? '이의를 승인했습니다.'
          : '이의를 거부했습니다.'
      );
      setReviewData({ appealId: '', status: 'PENDING', adminReview: '' });

      // 목록 새로고침 (향후 API 연결)
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('검토 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setReviewing(null);
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-32px font-bold text-gray-900">이의 제기 관리</h1>
        <p className="text-16px text-gray-600 mt-2">
          대기 중인 이의를 검토하고 승인 또는 거부하세요
        </p>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">오류</p>
          <p className="text-red-600 text-14px mt-1">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 font-medium">✅ 성공</p>
          <p className="text-green-600 text-14px mt-1">{success}</p>
        </div>
      )}

      {/* 이의 목록 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {appeals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-16px text-gray-600">
              검토 대기 중인 이의가 없습니다.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {appeals
              .filter((a) => a.status === 'PENDING')
              .map((appeal) => (
                <div key={appeal.id} className="p-6 hover:bg-gray-50 transition-colors">
                  {/* 이의 정보 */}
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-18px font-semibold text-gray-900">
                          {APPEAL_REASONS[appeal.reason as keyof typeof APPEAL_REASONS] ||
                            appeal.reason}
                        </p>
                        <p className="text-14px text-gray-600 mt-1">
                          접수일:{' '}
                          {new Date(appeal.createdAt).toLocaleString(
                            'ko-KR'
                          )}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-12px font-semibold">
                        검토 대기
                      </span>
                    </div>

                    {/* 증거 자료 */}
                    {appeal.evidenceUrls && appeal.evidenceUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-14px font-semibold text-gray-700 mb-2">
                          증거 자료 ({appeal.evidenceUrls.length}개)
                        </p>
                        <ul className="space-y-1">
                          {appeal.evidenceUrls.map((url, index) => (
                            <li key={index}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-14px text-blue-600 hover:underline break-all"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 검토 폼 */}
                  {reviewing === appeal.id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4 mt-4">
                      <div>
                        <label className="block text-14px font-semibold text-gray-900 mb-2">
                          검토 의견 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={reviewData.adminReview}
                          onChange={(e) =>
                            setReviewData({
                              ...reviewData,
                              adminReview: e.target.value,
                            })
                          }
                          placeholder="승인 또는 거부 사유를 입력해주세요"
                          className="w-full px-4 py-3 border rounded-lg text-14px focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={4}
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleReview(appeal.id, 'APPROVED')}
                          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                        >
                          ✅ 승인
                        </button>
                        <button
                          onClick={() => handleReview(appeal.id, 'REJECTED')}
                          className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                        >
                          ❌ 거부
                        </button>
                        <button
                          onClick={() => {
                            setReviewing(null);
                            setReviewData({
                              appealId: '',
                              status: 'PENDING',
                              adminReview: '',
                            });
                          }}
                          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 검토 시작 버튼 */}
                  {reviewing !== appeal.id && (
                    <button
                      onClick={() => {
                        setReviewing(appeal.id);
                        setReviewData({
                          appealId: appeal.id,
                          status: 'PENDING',
                          adminReview: '',
                        });
                      }}
                      className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      검토하기
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
        <h2 className="text-18px font-semibold text-gray-900">검토 가이드</h2>
        <ul className="space-y-2 text-14px text-gray-700">
          <li>
            ✅ <strong>증거 검토</strong>: 제공된 증거 자료를 충분히 검토하세요
          </li>
          <li>
            📝 <strong>의견 작성</strong>: 명확한 승인 또는 거부 사유를 작성해주세요
          </li>
          <li>
            ⚡ <strong>신속한 처리</strong>: 가능한 한 빠르게 처리해주세요
          </li>
          <li>
            💬 <strong>투명성</strong>: 판매원에게 상세한 이유를 전달합니다
          </li>
        </ul>
      </div>
    </div>
  );
}
