"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContractManager } from "./components/ContractManager";
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

interface Partner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commissionRate?: number;
  status: string;
  createdAt: string;
  totalRevenue?: number;
  monthlyRevenue?: number;
  automationRate?: number;
}

interface PartnerMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  totalCommission: number;
  transactionCount: number;
  automationRate: number;
  lastActivityAt?: string;
}

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const { toast } = useToast();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [metrics, setMetrics] = useState<PartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 파트너 정보 로드
  useEffect(() => {
    if (!partnerId) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;

    const fetchPartnerData = async () => {
      try {
        setLoading(true);
        setError(null);

        const partnerRes = await fetch(`/api/partner/${partnerId}`, { signal });
        if (!partnerRes.ok) {
          throw new Error("파트너 정보를 불러올 수 없습니다");
        }
        const partnerData = await partnerRes.json();
        setPartner(partnerData.data);

        try {
          const metricsRes = await fetch(`/api/partners/metrics/${partnerId}`, { signal });
          if (metricsRes.ok) {
            const metricsData = await metricsRes.json();
            setMetrics(metricsData.data);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          logger.error("Failed to fetch metrics", { error: err instanceof Error ? err.message : String(err) });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : "오류가 발생했습니다";
        setError(message);
        toast({
          title: "로드 실패",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    fetchPartnerData();
    return () => ctrl.abort();
  }, [partnerId, toast]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Link
          href="/partner"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-red-700">오류</div>
            <p className="text-sm text-red-600 mt-1">{error || "파트너 정보를 찾을 수 없습니다"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/partner"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{partner.name}</h1>
              <p className="text-gray-500 text-sm mt-1">파트너 ID: {partner.id}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                partner.status === "ACTIVE"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {partner.status === "ACTIVE" ? "활성" : "비활성"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            {partner.email && (
              <div>
                <p className="text-sm text-gray-500">이메일</p>
                <p className="text-gray-900 font-medium">{partner.email}</p>
              </div>
            )}
            {partner.phone && (
              <div>
                <p className="text-sm text-gray-500">연락처</p>
                <p className="text-gray-900 font-medium">{partner.phone}</p>
              </div>
            )}
            {partner.commissionRate !== undefined && (
              <div>
                <p className="text-sm text-gray-500">수수료율</p>
                <p className="text-gray-900 font-medium">{partner.commissionRate}%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">전체 매출</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₩{(metrics.totalRevenue / 1000000).toFixed(1)}M
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">월 매출</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₩{(metrics.monthlyRevenue / 1000000).toFixed(1)}M
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">지급 수수료</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₩{(metrics.totalCommission / 1000000).toFixed(1)}M
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">자동화율</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {metrics.automationRate}%
            </p>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="border-b border-gray-200 bg-transparent p-0 w-full justify-start">
            <TabsTrigger
              value="info"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              기본 정보
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              매출
            </TabsTrigger>
            <TabsTrigger
              value="commission"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              수수료
            </TabsTrigger>
            <TabsTrigger
              value="contracts"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              계약서
            </TabsTrigger>
          </TabsList>

          {/* 기본 정보 탭 */}
          <TabsContent value="info" className="py-6 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700">파트너명</label>
                <p className="text-gray-900 mt-1">{partner.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">상태</label>
                <p className="text-gray-900 mt-1">
                  {partner.status === "ACTIVE" ? "활성" : "비활성"}
                </p>
              </div>
              {partner.email && (
                <div>
                  <label className="text-sm font-medium text-gray-700">이메일</label>
                  <p className="text-gray-900 mt-1">{partner.email}</p>
                </div>
              )}
              {partner.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-700">연락처</label>
                  <p className="text-gray-900 mt-1">{partner.phone}</p>
                </div>
              )}
              {partner.commissionRate !== undefined && (
                <div>
                  <label className="text-sm font-medium text-gray-700">수수료율</label>
                  <p className="text-gray-900 mt-1">{partner.commissionRate}%</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">가입일</label>
                <p className="text-gray-900 mt-1">
                  {new Date(partner.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* 매출 탭 */}
          <TabsContent value="sales" className="py-6">
            {metrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">전체 매출</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      ₩{(metrics.totalRevenue / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">월 평균 매출</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      ₩{(metrics.monthlyRevenue / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">거래 건수</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {metrics.transactionCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">마지막 활동</p>
                    <p className="text-gray-900 mt-2">
                      {metrics.lastActivityAt
                        ? new Date(metrics.lastActivityAt).toLocaleDateString('ko-KR')
                        : "없음"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">성과 데이터를 불러올 수 없습니다</p>
            )}
          </TabsContent>

          {/* 수수료 탭 */}
          <TabsContent value="commission" className="py-6">
            {metrics ? (
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">지급 수수료</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ₩{(metrics.totalCommission / 1000000).toFixed(1)}M
                  </p>
                </div>
                {partner.commissionRate && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">수수료율</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {partner.commissionRate}%
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-4">
                  수수료는 매월 자동으로 계산되며, 정산 내역은 정산 관리 페이지에서 확인할 수 있습니다.
                </p>
              </div>
            ) : (
              <p className="text-gray-500">수수료 데이터를 불러올 수 없습니다</p>
            )}
          </TabsContent>

          {/* 계약서 탭 */}
          <TabsContent value="contracts" className="py-6">
            <ContractManager partnerId={partnerId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
