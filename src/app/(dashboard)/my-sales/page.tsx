"use client";

import { useState, useEffect } from "react";
import { Copy, Check, TrendingUp, Clock, CheckCircle, DollarSign } from "lucide-react";

type Sale = {
  id: string;
  affiliateCode: string;
  productName: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  travelCompletedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  customerPhone: string | null;
};

type SummaryRow = {
  status: string;
  _sum:   { commissionAmount: number | null; saleAmount: number | null };
  _count: { id: number };
};

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: "출발 대기",    color: "bg-yellow-100 text-yellow-700", icon: <Clock      className="w-3.5 h-3.5" /> },
  EARNED:    { label: "수당 확정",    color: "bg-green-100 text-green-700",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  PAID:      { label: "지급 완료",    color: "bg-blue-100 text-blue-700",    icon: <DollarSign  className="w-3.5 h-3.5" /> },
  CANCELLED: { label: "취소",         color: "bg-gray-100 text-gray-500",    icon: <Clock      className="w-3.5 h-3.5" /> },
};

export default function MySalesPage() {
  const [sales,         setSales]         = useState<Sale[]>([]);
  const [summary,       setSummary]       = useState<SummaryRow[]>([]);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [link,          setLink]          = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/my/sales").then((r) => r.json()),
      fetch("/api/my/affiliate").then((r) => r.json()),
    ]).then(([salesData, affiliateData]) => {
      if (salesData.ok) {
        setSales(salesData.sales ?? []);
        setSummary(salesData.summary ?? []);
      }
      if (affiliateData.ok) {
        setAffiliateCode(affiliateData.affiliateCode);
        setLink(affiliateData.cruisemallLink);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 요약 집계
  const totalSale       = summary.reduce((a, r) => a + (r._sum.saleAmount ?? 0), 0);
  const totalCommission = summary.reduce((a, r) => a + (r._sum.commissionAmount ?? 0), 0);
  const earnedRow       = summary.find((r) => r.status === "EARNED");
  const paidRow         = summary.find((r) => r.status === "PAID");
  const earned          = (earnedRow?._sum.commissionAmount ?? 0) + (paidRow?._sum.commissionAmount ?? 0);

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900">내 판매 현황</h1>
        <p className="text-sm text-gray-500 mt-0.5">어필리에이트 링크 판매 실적 및 수당 현황</p>
      </div>

      {/* 내 어필리에이트 링크 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">🔗 내 어필리에이트 링크</p>
        {link ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono truncate">
              {link}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-700 shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">어필리에이트 코드가 등록되지 않았습니다.<br />관리자에게 문의하세요.</p>
        )}
        {affiliateCode && (
          <p className="text-xs text-gray-400 mt-2">코드: <strong>{affiliateCode}</strong></p>
        )}
      </div>

      {/* 수당 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">총 판매액</p>
          <p className="text-lg font-bold text-gray-900">{totalSale.toLocaleString()}원</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">확정 수당</p>
          <p className="text-lg font-bold text-green-700">{earned.toLocaleString()}원</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">예상 수당 합계</p>
          <p className="text-lg font-bold text-blue-700">{totalCommission.toLocaleString()}원</p>
        </div>
      </div>

      {/* 수당 주의사항 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-0.5">
        <p className="font-semibold">📋 수당 지급 조건</p>
        <p>• 수당은 여행 출발 완료 후 확정됩니다 (PENDING → 확정)</p>
        <p>• 3.3% 원천징수 후 지급됩니다</p>
        <p>• 환불 발생 시 수당이 환수될 수 있습니다</p>
      </div>

      {/* 판매 목록 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          <TrendingUp className="w-4 h-4 inline mr-1" />
          판매 내역 ({sales.length}건)
        </p>
        {sales.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">판매 내역이 없습니다.</p>
            <p className="text-xs mt-1">어필리에이트 링크를 공유해보세요!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => {
              const info = STATUS_INFO[sale.status] ?? STATUS_INFO.PENDING;
              return (
                <div key={sale.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{sale.productName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(sale.createdAt).toLocaleDateString("ko-KR")}
                        {sale.customerPhone && ` · ${sale.customerPhone}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {sale.saleAmount.toLocaleString()}원
                      </p>
                      <p className="text-xs text-green-600 font-medium">
                        수당 {sale.commissionAmount.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                      {info.icon} {info.label}
                    </span>
                    {sale.travelCompletedAt && (
                      <span className="text-xs text-gray-400">
                        여행완료: {new Date(sale.travelCompletedAt).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                    {sale.paidAt && (
                      <span className="text-xs text-blue-500">
                        지급: {new Date(sale.paidAt).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
