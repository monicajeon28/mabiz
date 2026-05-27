'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function TeamStatementsPage() {
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [page, setPage] = useState(1);

  const url = `/api/team-statements?period=${period}&page=${page}&limit=50`;
  const { data, isLoading, error } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });

  const rowData = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">팀 정산</h1>
        <p className="text-gray-500 mt-1">팀 멤버별 정산 현황</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div>
              <label className="text-sm font-medium block mb-2">기간</label>
              <input
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md"
              />
            </div>
            <Button onClick={() => setPage(1)} variant="outline" className="mt-6">
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>팀 멤버별 정산</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">오류</div>
          ) : rowData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">데이터 없음</div>
          ) : (
            <div className="space-y-3">
              {rowData.map((row: any, idx: number) => (
                <div key={row.id} className="flex justify-between p-3 border rounded-md hover:bg-gray-50">
                  <span className="font-medium">{idx + 1}. {row.memberName}</span>
                  <span className="text-right">¥{row.amount?.toLocaleString()}K</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            variant="outline"
          >
            이전
          </Button>

          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <Button
              key={p}
              onClick={() => setPage(p)}
              variant={page === p ? 'default' : 'outline'}
            >
              {p}
            </Button>
          ))}

          <Button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
            variant="outline"
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
