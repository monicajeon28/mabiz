'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type DailyClickData = {
  date: string;
  clicks: number;
};

export function ShortlinkTrendChart({ data }: { data: DailyClickData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">클릭 추이</h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">클릭 추이</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            stroke="#999"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#999"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
            cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
            formatter={(value: unknown) => [(value as number).toLocaleString(), '클릭']}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
