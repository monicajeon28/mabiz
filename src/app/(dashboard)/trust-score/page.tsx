'use client';

/**
 * 신뢰도 대시보드 페이지
 * 본인의 신뢰도 점수 및 상태 조회
 */

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { redirect } from 'next/navigation';
import type { TrustStatus, GetTrustScoreResponse } from '@/types/trust-score';

export default function TrustScorePage() {
  const { userId } = useSession();
  const [trust, setTrust] = useState<GetTrustScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 색상 매핑
  const colorMap: Record<TrustStatus, string> = {
    GOOD: 'bg-green-50 border-green-200',
    WARNING: 'bg-yellow-50 border-yellow-200',
    RESTRICTED: 'bg-orange-50 border-orange-200',
    SUSPENDED: 'bg-red-50 border-red-200',
  };

  const textColorMap: Record<TrustStatus, string> = {
    GOOD: 'text-green-700',
    WARNING: 'text-yellow-700',
    RESTRICTED: 'text-orange-700',
    SUSPENDED: 'text-red-700',
  };

  const badgeMap: Record<TrustStatus, string> = {
    GOOD: '✅ 좋음',
    WARNING: '⚠️ 경고',
    RESTRICTED: '🚫 제한',
    SUSPENDED: '🔒 정지',
  };

  useEffect(() => {
    if (!userId) {
      redirect('/auth/login');
    }

    const fetchTrust = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/trust-score/${userId}`);

        if (!res.ok) {
          if (res.status === 404) {
            // 신뢰도 없음 (초기 상태)
            setTrust({
              id: '',
              userId: userId || '',
              refundRate: 0,
              trustScore: 100,
              status: 'GOOD',
              nextThreshold: 30,
              warningCount: 0,
              message: '훌륭해요! 계속 잘해주세요.',
              lastCalculatedAt: new Date().toISOString(),
            });
            return;
          }
          throw new Error(`API 오류: ${res.status}`);
        }

        const data = await res.json();
        setTrust(data);
        setError(null);
      } catch (err) {
        console.error('신뢰도 조회 실패:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchTrust();

  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">오류가 발생했습니다</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!trust) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700">신뢰도 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-32px font-bold text-gray-900">신뢰도 점수</h1>
        <p className="text-16px text-gray-600 mt-2">
          대리점장으로서의 신뢰도를 한눈에 확인하세요
        </p>
      </div>

      {/* 메인 카드 */}
      <div
        className={`border-2 rounded-lg p-8 ${colorMap[trust.status as TrustStatus]}`}
      >
        {/* 점수 표시 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-16px text-gray-600 mb-2">현재 신뢰도 점수</p>
            <div className="text-48px font-bold">
              <span className={textColorMap[trust.status as TrustStatus]}>
                {trust.trustScore}
              </span>
              <span className="text-24px text-gray-500">/100</span>
            </div>
          </div>

          {/* 상태 배지 */}
          <div className="text-center">
            <div className="text-28px mb-2">
              {badgeMap[trust.status as TrustStatus]}
            </div>
            <p
              className={`text-14px font-semibold ${textColorMap[trust.status as TrustStatus]}`}
            >
              {trust.status === 'GOOD' && '정상'}
              {trust.status === 'WARNING' && '경고'}
              {trust.status === 'RESTRICTED' && '제한'}
              {trust.status === 'SUSPENDED' && '정지'}
            </p>
          </div>
        </div>

        {/* 메시지 */}
        <div className="bg-white bg-opacity-60 rounded p-4 mb-4">
          <p className={`text-16px font-medium ${textColorMap[trust.status as TrustStatus]}`}>
            {trust.message}
          </p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white bg-opacity-40 rounded p-4">
            <p className="text-14px text-gray-600">환불율</p>
            <p className="text-24px font-bold text-gray-900 mt-1">
              {trust.refundRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-white bg-opacity-40 rounded p-4">
            <p className="text-14px text-gray-600">다음 단계</p>
            <p className="text-24px font-bold text-gray-900 mt-1">
              {trust.nextThreshold}%
            </p>
          </div>
          <div className="bg-white bg-opacity-40 rounded p-4">
            <p className="text-14px text-gray-600">경고 횟수</p>
            <p className="text-24px font-bold text-gray-900 mt-1">
              {trust.warningCount}회
            </p>
          </div>
        </div>
      </div>

      {/* 상태별 설명 */}
      {trust.status === 'SUSPENDED' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <p className="text-16px font-semibold text-red-700 mb-2">
            ⚠️ 계정이 일시 중지되었습니다
          </p>
          <p className="text-14px text-red-600 mb-4">
            환불율이 40%를 초과하여 로그인이 차단되었습니다.
            이의를 제기하거나 관리자에게 문의하세요.
          </p>
          <button className="inline-block px-6 py-3 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition-colors">
            이의 제기하기
          </button>
        </div>
      )}

      {trust.status === 'RESTRICTED' && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
          <p className="text-16px font-semibold text-orange-700 mb-2">
            🚫 신상품 등록이 제한되었습니다
          </p>
          <p className="text-14px text-orange-600 mb-4">
            환불율이 35%를 초과했습니다. 기존 상품은 관리 가능하며,
            신상품 등록을 원하시면 환불율을 개선해주세요.
          </p>
          <button className="inline-block px-6 py-3 bg-orange-600 text-white rounded font-semibold hover:bg-orange-700 transition-colors">
            이의 제기하기
          </button>
        </div>
      )}

      {trust.status === 'WARNING' && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <p className="text-16px font-semibold text-yellow-700 mb-2">
            ⚠️ 조금 더 신경 써주세요
          </p>
          <p className="text-14px text-yellow-600 mb-4">
            환불율이 30%를 초과했습니다. 계속 악화되면 새 상품 등록이 제한될 수 있습니다.
          </p>
          <button className="inline-block px-6 py-3 bg-yellow-600 text-white rounded font-semibold hover:bg-yellow-700 transition-colors">
            이의 제기하기
          </button>
        </div>
      )}

      {/* 정보 섹션 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-18px font-semibold text-gray-900 mb-4">신뢰도란?</h2>
        <div className="space-y-3 text-14px text-gray-700">
          <p>
            ✅ <strong>신뢰도</strong>는 대리점장으로서의 신뢰를 점수로 나타낸 것입니다.
          </p>
          <p>
            📊 <strong>계산 방식</strong>: 신뢰도 = 100 - 환불율(%)
          </p>
          <p>
            📈 <strong>목표</strong>: 환불율을 30% 미만으로 유지하여 GOOD 상태를 유지하세요.
          </p>
          <p>
            💬 <strong>의문점</strong>은 이의 제기를 통해 관리자에게 알려주세요.
          </p>
        </div>
      </div>

      {/* 최종 업데이트 */}
      <div className="text-center text-12px text-gray-500">
        <p>
          마지막 업데이트:{' '}
          {new Date(trust.lastCalculatedAt).toLocaleString('ko-KR')}
        </p>
      </div>
    </div>
  );
}
