"use client";

import { useEffect, useState } from "react";

type Payment = {
  id: string;
  orderId: string;
  productName: string;
  amount: number;
  status: string;
  paidAt: string | null;
  buyerName: string;
  buyerTel: string | null;
};

interface ApiResponse {
  ok: boolean;
  payments: Payment[];
  message?: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString() + "원";
}

function maskTel(tel: string) {
  if (tel.length < 4) return tel;
  return tel.substring(0, 4) + "***";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        결제완료
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my/payments")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setPayments(data.payments ?? []);
        } else {
          setError(data.message ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch(() => {
        setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">결제 내역</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">결제일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품명</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">금액</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">구매자명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">연락처</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {!loading && !error && payments.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  결제 내역이 없습니다
                </td>
              </tr>
            )}
            {!loading &&
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">
                    {p.paidAt ? formatDate(p.paidAt) : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.productName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatAmount(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.buyerName}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.buyerTel ? maskTel(p.buyerTel) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
