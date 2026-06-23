'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface GoldMemberData {
  ok: boolean;
  data?: {
    goldMemberCount: number;
    newInquiries: number;
    paymentRate: number;
    members: Array<{
      id: string;
      name: string;
      course: string;
      paidCount: number;
      totalCount: number;
      status: string;
    }>;
    recentConsultations: Array<{
      id: string;
      memberName: string;
      content: string;
      date: string;
    }>;
  };
  error?: string;
}

interface GoldMemberTabProps {
  selectedMonth: string;
}

export function GoldMemberTab({ selectedMonth }: GoldMemberTabProps) {
  const [data, setData] = useState<GoldMemberData['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/partner/dashboard/gold?month=${selectedMonth}`);

        if (!res.ok) {
          setError(
            res.status === 403
              ? '골드회원 데이터를 볼 권한이 없습니다.'
              : res.status === 404
              ? '데이터를 찾을 수 없습니다.'
              : '서버 오류가 발생했습니다.'
          );
          return;
        }

        const json = (await res.json()) as GoldMemberData;
        if (json.ok && json.data) {
          setData(json.data);
        } else {
          setError(json.error || '데이터 로드 실패');
        }
      } catch (err) {
        logger.error('[GoldMemberTab]', { err });
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-base text-gray-700">로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-semibold text-red-900">오류</h3>
          <p className="text-base text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-base text-gray-500">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ KPI 카드 4개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">👑 골드회원</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{data.goldMemberCount}명</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">🆕 신규 상담</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{data.newInquiries}건</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">💳 납부율</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{data.paymentRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">📈 회원 목록</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{data.members.length}명</p>
        </div>
      </div>

      {/* ✅ 회원 목록 테이블 */}
      {data.members && data.members.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900">최근 회원 목록</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">이름</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">상품</th>
                  <th className="text-center px-6 py-3 text-sm font-semibold text-gray-700">결제건수</th>
                  <th className="text-center px-6 py-3 text-sm font-semibold text-gray-700">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.members.slice(0, 10).map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-base text-gray-900 font-medium">{member.name}</td>
                    <td className="px-6 py-4 text-base text-gray-600">{member.course}</td>
                    <td className="px-6 py-4 text-base text-gray-900 font-semibold text-center">
                      {member.paidCount}/{member.totalCount}
                    </td>
                    <td className="px-6 py-4 text-base text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          member.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.status === 'ACTIVE' ? '활성' : '비활성'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ✅ 최근 상담 섹션 */}
      {data.recentConsultations && data.recentConsultations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900">최근 상담 기록</h3>
          </div>

          <div className="divide-y divide-gray-100">
            {data.recentConsultations.slice(0, 5).map((consultation) => (
              <div key={consultation.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-base font-medium text-gray-900">{consultation.memberName}</p>
                    <p className="text-base text-gray-600 mt-1">{consultation.content}</p>
                  </div>
                  <p className="text-sm text-gray-500 shrink-0">{consultation.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
