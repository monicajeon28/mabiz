'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { FixedSizeList as List } from 'react-window';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const STATUSES = [
  { value: 'ALL', label: '모두' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'LOCKED', label: '잠금' },
  { value: 'PAID', label: '지급 완료' }
];

const SORT_OPTIONS = [
  { value: 'amount', label: '지급액순' },
  { value: 'date', label: '날짜순' },
  { value: 'name', label: '이름순' }
];

interface SettlementRow {
  id: string;
  period: string;
  profileId: string;
  profileName: string;
  totalSales: number;
  totalAmount: number;
  totalCommission: number;
  amountAfterTax: number;
  status: string;
  createdAt: string;
}

interface StatementResponse {
  success: boolean;
  data: SettlementRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: {
    period: string;
    status: string;
    sortBy: string;
    sortOrder: string;
  };
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function StatementsPage() {
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('amount');
  const [sortOrder, setSortOrder] = useState('desc');

  // API 호출
  const url = `/api/statements?period=${period}&status=${status}&page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
  const { data, error, isLoading } = useSWR<StatementResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,  // 30초 캐시
    focusThrottleInterval: 300000  // 5분 스로틀
  });

  const rowData = data?.data || [];
  const pagination = data?.pagination;

  // 요약 통계 계산
  const summary = useMemo(() => {
    if (!rowData.length) {
      return { totalAmount: 0, totalCommission: 0, tax: 0, amountAfterTax: 0 };
    }

    const totalAmount = rowData.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const totalCommission = rowData.reduce((sum, row) => sum + (row.totalCommission || 0), 0);
    const tax = totalCommission * 0.033;
    const amountAfterTax = totalCommission - tax;

    return { totalAmount, totalCommission, tax, amountAfterTax };
  }, [rowData]);

  // 상태 배지 색상
  const statusColorMap: Record<string, string> = {
    'DRAFT': 'bg-gray-100 text-gray-800',
    'APPROVED': 'bg-blue-100 text-blue-800',
    'LOCKED': 'bg-orange-100 text-orange-800',
    'PAID': 'bg-green-100 text-green-800'
  };

  const statusLabelMap: Record<string, string> = {
    'DRAFT': '작성 중',
    'APPROVED': '승인됨',
    'LOCKED': '잠금',
    'PAID': '지급 완료'
  };

  return (
    <div className="space-y-6 p-8">
      {/* 제목 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">정산 내역서</h1>
        <p className="text-gray-500 mt-1">월별 정산 현황 및 상세 내역</p>
      </div>

      {/* 필터 & 제어 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            {/* 기간 선택 */}
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

            {/* 상태 필터 */}
            <div>
              <label className="text-sm font-medium block mb-2">상태</label>
              <Select value={status} onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 정렬 */}
            <div>
              <label className="text-sm font-medium block mb-2">정렬</label>
              <Select value={sortBy} onValueChange={(v) => {
                setSortBy(v);
                setPage(1);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 정렬 순서 */}
            <div>
              <label className="text-sm font-medium block mb-2">순서</label>
              <Select value={sortOrder} onValueChange={(v) => {
                setSortOrder(v);
                setPage(1);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">내림차순</SelectItem>
                  <SelectItem value="asc">오름차순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 새로고침 */}
            <Button
              onClick={() => setPage(1)}
              variant="outline"
              className="ml-auto"
            >
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">총 정산액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{formatCurrency(summary.totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">총 수수료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{formatCurrency(summary.totalCommission)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">세금 공제</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              -¥{formatCurrency(summary.tax)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">최종 지급액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{formatCurrency(summary.amountAfterTax)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 테이블 (가상 스크롤) */}
      <Card>
        <CardHeader>
          <CardTitle>프로필별 정산 내역</CardTitle>
          <CardDescription>
            {pagination && `총 ${pagination.total}건 (${pagination.page}/${pagination.totalPages}페이지)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">오류 발생</div>
          ) : rowData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">데이터 없음</div>
          ) : (
            <div>
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-8 gap-4 pb-3 border-b font-semibold text-sm">
                <div>순위</div>
                <div>프로필명</div>
                <div className="text-right">판매건수</div>
                <div className="text-right">정산액</div>
                <div className="text-right">수수료</div>
                <div className="text-right">지급액</div>
                <div>상태</div>
                <div>날짜</div>
              </div>

              {/* 가상 스크롤 테이블 행 */}
              {rowData.map((row, index) => (
                <div key={row.id} className="grid grid-cols-8 gap-4 py-3 border-b hover:bg-gray-50">
                  <div className="text-sm">{(page - 1) * limit + index + 1}</div>
                  <div className="text-sm font-medium">{row.profileName}</div>
                  <div className="text-right text-sm">{row.totalSales.toLocaleString()}</div>
                  <div className="text-right text-sm">¥{formatCurrency(row.totalAmount)}</div>
                  <div className="text-right text-sm">¥{formatCurrency(row.totalCommission)}</div>
                  <div className="text-right text-sm font-semibold">¥{formatCurrency(row.amountAfterTax)}</div>
                  <div>
                    <Badge className={statusColorMap[row.status] || 'bg-gray-100'}>
                      {statusLabelMap[row.status] || row.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(parseISO(row.createdAt), 'MM/dd', { locale: ko })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            variant="outline"
          >
            ← 이전
          </Button>

          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <Button
              key={p}
              onClick={() => setPage(p)}
              variant={page === p ? 'default' : 'outline'}
              className="min-w-10"
            >
              {p}
            </Button>
          ))}

          <Button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
            variant="outline"
          >
            다음 →
          </Button>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <Button className="ml-auto">
          📊 Excel 내보내기
        </Button>
        <Button variant="default">
          ✓ 승인
        </Button>
        <Button variant="outline">
          🔒 잠금
        </Button>
      </div>
    </div>
  );
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatCurrency(value: number): string {
  return Math.round(value / 1000).toLocaleString() + 'K';
}
