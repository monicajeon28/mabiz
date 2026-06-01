"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Users, Target } from "lucide-react";

interface AnalyticsData {
  sourceDistribution: Array<{
    sourceType: string;
    count: number;
    responseRate: number;
    avgLeadScore: number;
  }>;
  topManagers: Array<{ managerId: string; managerName: string; count: number }>;
  topAgents: Array<{ agentId: string; agentName: string; count: number }>;
  summary: {
    totalContacts: number;
    affiliateContacts: number;
    customerContacts: number;
    inquiryContacts: number;
  };
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  user: { label: "구매고객", icon: "🟢", color: "bg-green-100 text-green-700" },
  inquiry: { label: "상품문의", icon: "📋", color: "bg-blue-100 text-blue-700" },
  affiliate: { label: "어필리에이트", icon: "🟡", color: "bg-yellow-100 text-yellow-700" },
  landing_page: { label: "랜딩페이지", icon: "🔵", color: "bg-cyan-100 text-cyan-700" },
  education: { label: "교육", icon: "🎓", color: "bg-purple-100 text-purple-700" },
  gold_member: { label: "골드회원", icon: "👑", color: "bg-amber-100 text-amber-700" },
};

export default function ContactsAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/contacts/analytics");
        const result = await res.json();
        if (result.ok) {
          setData(result);
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p>데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">출처별 분석</h1>
            <p className="text-sm text-gray-500 mt-1">고객 채널별 응답율 및 성과 추적</p>
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">전체 고객</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data.summary.totalContacts}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">어필리에이트</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{data.summary.affiliateContacts}</p>
            </div>
            <Target className="w-10 h-10 text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">구매고객</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{data.summary.customerContacts}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">상품문의</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{data.summary.inquiryContacts}</p>
            </div>
            <Target className="w-10 h-10 text-blue-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* 출처별 성과 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">출처별 성과 지표</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">출처</th>
                <th className="text-right py-3 px-4 text-gray-600 font-semibold">고객 수</th>
                <th className="text-right py-3 px-4 text-gray-600 font-semibold">응답율</th>
                <th className="text-right py-3 px-4 text-gray-600 font-semibold">평균 점수</th>
              </tr>
            </thead>
            <tbody>
              {data.sourceDistribution.map((source) => {
                const label = SOURCE_TYPE_LABELS[source.sourceType || ""];
                return (
                  <tr key={source.sourceType} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${label?.color || "bg-gray-100 text-gray-600"}`}>
                        {label?.icon} {label?.label || source.sourceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{source.count}명</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${source.responseRate}%` }}></div>
                        </div>
                        <span className="text-gray-600 font-medium">{source.responseRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-gray-900 font-medium">{source.avgLeadScore}점</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 본사별 현황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🏢 Top 본사</h2>
          <div className="space-y-3">
            {data.topManagers.map((manager, idx) => (
              <div key={manager.managerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-yellow-600 text-lg">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{manager.managerName}</p>
                    <p className="text-sm text-gray-500">{manager.count}명의 고객</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900">{manager.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">👤 Top 판매원</h2>
          <div className="space-y-3">
            {data.topAgents.map((agent, idx) => (
              <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-green-600 text-lg">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{agent.agentName}</p>
                    <p className="text-sm text-gray-500">{agent.count}명의 고객</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900">{agent.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
