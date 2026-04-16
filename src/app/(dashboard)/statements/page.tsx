"use client";

import { useEffect, useState } from "react";

interface Statement {
  id: string;
  saleDate: string;
  externalOrderCode: string | null;
  saleAmount: number;
  commissionRate: number;
  confirmedAmount: number;
  status: string;
}

interface ApiResponse {
  ok: boolean;
  statements: Statement[];
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료",
  APPROVED: "승인",
};

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  APPROVED: "bg-blue-100 text-blue-700",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my/statements")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setStatements(data.statements ?? []);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">내 정산 내역</h1>

      {loading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && statements.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          아직 확정된 정산 내역이 없습니다
        </div>
      )}

      {!loading && !error && statements.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">판매일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">상품명 (주문코드)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">판매액</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">수당율</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">확정금액</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">{formatDate(s.saleDate)}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {s.externalOrderCode ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatAmount(s.saleAmount)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{s.commissionRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatAmount(s.confirmedAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_CLASS[s.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
