// components/admin/DashboardCharts.tsx
// 관리자 대시보드 차트 컴포넌트 (동적 임포트용)

'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendData {
  date: string;
  users: number;
  trips: number;
  productViews?: number;
}

interface ProductViewData {
  topCruises: Array<{ name: string; count: number }>;
  topCountries: Array<{ name: string; count: number }>;
}

interface DashboardChartsProps {
  trends: TrendData[];
  productViews?: ProductViewData;
}

export default function DashboardCharts({ trends, productViews }: DashboardChartsProps) {
  return (
    <>
      {/* 최근 7일 트렌드 차트 - 크루즈몰 상품 조회 빈도 */}
      {trends && trends.length > 0 && (
        <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📈</span>
              최근 7일 트렌드
            </h2>
            <span className="text-xs font-bold px-3 py-1 rounded bg-purple-100 text-purple-700 border border-purple-300">
              크루즈몰 상품조회
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends.map(t => ({
              ...t,
              date: new Date(t.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="productViews"
                stroke="#8B5CF6"
                strokeWidth={3}
                name="상품 조회"
                dot={{ fill: '#8B5CF6', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#0088FE"
                strokeWidth={2}
                name="신규 사용자"
                dot={{ fill: '#0088FE', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="trips"
                stroke="#00C49F"
                strokeWidth={2}
                name="신규 여행"
                dot={{ fill: '#00C49F', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 상품 조회 통계 차트 */}
      {productViews && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 인기 크루즈 조회 차트 */}
          {productViews.topCruises && productViews.topCruises.length > 0 && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border-2 border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-3xl">🚢</span>
                  인기 크루즈 조회
                </h2>
                <span className="text-xs font-bold px-3 py-1 rounded bg-purple-100 text-purple-700 border border-purple-300">
                  크루즈몰
                </span>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={productViews.topCruises}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={90}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#0088FE" 
                    name="조회 수"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 인기 국가 조회 차트 */}
          {productViews.topCountries && productViews.topCountries.length > 0 && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border-2 border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-3xl">🌍</span>
                  인기 국가 조회
                </h2>
                <span className="text-xs font-bold px-3 py-1 rounded bg-purple-100 text-purple-700 border border-purple-300">
                  크루즈몰
                </span>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={productViews.topCountries}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={70}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#00C49F" 
                    name="조회 수"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </>
  );
}










