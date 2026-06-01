'use client';

import { useState } from 'react';

interface VerifyResponse {
  timestamp: string;
  queryRange: {
    hours: number;
    cutoffTime: string;
  };
  total: number;
  recentContacts: Array<{
    id: string;
    phone: string;
    name: string;
    email: string;
    organizationId: string;
    assignedUserId: string;
    type: string;
    sourceOrgId?: string;
    affiliateCode?: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
  }>;
  stats: {
    totalCount: number;
    nullOrgCount: number;
    noEmailCount: number;
    inquiryPatternCount: number;
    assignedCount: number;
    unassignedCount: number;
    orgDistribution: Array<{ organizationId: string; count: number }>;
    typeDistribution: Array<{ type: string; count: number }>;
    assignmentDistribution: Array<{ assignedUserId: string; count: number }>;
  };
  status: string;
  recommendations: string[];
}

export default function VerifyPage() {
  const [hours, setHours] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/verify?hours=${hours}`);
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || '검증 실패');
        return;
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Contact 검증</h1>
          <p className="text-slate-400">크루즈닷 문의 신청 레코드 데이터 상태 확인</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                조회 범위 (시간)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={hours}
                onChange={(e) => setHours(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition-colors"
            >
              {loading ? '검증 중...' : '검증'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-8 text-red-300">
            <strong>오류:</strong> {error}
          </div>
        )}

        {/* Data Display */}
        {data && (
          <div className="space-y-6">
            {/* Status */}
            <div className={`rounded-lg p-6 border ${
              data.stats.nullOrgCount === 0 && data.stats.noEmailCount === 0
                ? 'bg-green-900/20 border-green-700'
                : 'bg-yellow-900/20 border-yellow-700'
            }`}>
              <h2 className={`text-lg font-semibold ${
                data.stats.nullOrgCount === 0 && data.stats.noEmailCount === 0
                  ? 'text-green-300'
                  : 'text-yellow-300'
              }`}>
                {data.status}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                조회 시점: {new Date(data.timestamp).toLocaleString('ko-KR')}
              </p>
            </div>

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-3">권장사항</h3>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start gap-2">
                      <span className="text-yellow-400 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="전체 Contact" value={data.stats.totalCount} color="blue" />
              <StatCard label="organizationId NULL" value={data.stats.nullOrgCount} color={data.stats.nullOrgCount > 0 ? "red" : "green"} />
              <StatCard label="이메일 NULL" value={data.stats.noEmailCount} color={data.stats.noEmailCount > 0 ? "red" : "green"} />
              <StatCard label="'문의' 패턴" value={data.stats.inquiryPatternCount} color="purple" />
            </div>

            {/* Distribution Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organization Distribution */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-hidden">
                <h3 className="text-lg font-semibold text-white mb-4">Organization 분포</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 py-2">organizationId</th>
                        <th className="text-right text-slate-400 py-2">개수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stats.orgDistribution.map((org, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-2 text-white font-mono text-sm">
                            {org.organizationId === "NULL" ? (
                              <span className="text-red-400">NULL</span>
                            ) : (
                              org.organizationId.substring(0, 12) + "..."
                            )}
                          </td>
                          <td className="text-right text-slate-300 py-2">{org.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Type Distribution */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-hidden">
                <h3 className="text-lg font-semibold text-white mb-4">Type 분포</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 py-2">Type</th>
                        <th className="text-right text-slate-400 py-2">개수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stats.typeDistribution.map((type, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-2 text-white">{type.type}</td>
                          <td className="text-right text-slate-300 py-2">{type.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent Contacts */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-x-auto">
              <h3 className="text-lg font-semibold text-white mb-4">최근 10개 Contact</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 py-2 px-2">이름</th>
                    <th className="text-left text-slate-400 py-2 px-2">전화</th>
                    <th className="text-left text-slate-400 py-2 px-2">이메일</th>
                    <th className="text-left text-slate-400 py-2 px-2">Organization</th>
                    <th className="text-left text-slate-400 py-2 px-2">Type</th>
                    <th className="text-left text-slate-400 py-2 px-2">생성일시</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentContacts.map((contact, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-2 text-white truncate">{contact.name}</td>
                      <td className="py-2 px-2 text-slate-300 font-mono text-sm">{contact.phone}</td>
                      <td className="py-2 px-2 text-slate-400 truncate">
                        {contact.email === "NULL" ? (
                          <span className="text-red-400">NULL</span>
                        ) : (
                          contact.email
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-400 font-mono text-sm truncate">
                        {contact.organizationId === "NULL" ? (
                          <span className="text-red-400">NULL</span>
                        ) : (
                          contact.organizationId.substring(0, 12) + "..."
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-300">{contact.type}</td>
                      <td className="py-2 px-2 text-slate-400 text-sm whitespace-nowrap">
                        {new Date(contact.createdAt).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "red" | "green" | "purple";
}) {
  const colorMap = {
    blue: "bg-blue-900/20 border-blue-700 text-blue-300",
    red: "bg-red-900/20 border-red-700 text-red-300",
    green: "bg-green-900/20 border-green-700 text-green-300",
    purple: "bg-purple-900/20 border-purple-700 text-purple-300",
  };

  return (
    <div className={`rounded-lg p-4 border ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-75 mt-1">{label}</div>
    </div>
  );
}
