"use client";

import { useEffect, useState } from "react";

interface Contract {
  id: string;
  contractorName: string;
  status: string;
  submittedAt: string | null;
  mentorCode: string | null;
}

interface ApiResponse {
  ok: boolean;
  contracts: Contract[];
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "제출됨",
  completed: "완료",
  rejected: "거절",
};

const STATUS_CLASS: Record<string, string> = {
  submitted: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my/contracts")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setContracts(data.contracts ?? []);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">계약서 관리</h1>
      <p className="text-sm text-gray-500 mb-6">대리점장 전용 — 초대한 계약서 현황입니다.</p>

      {loading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && contracts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          초대한 계약서가 없습니다 (대리점장 전용)
        </div>
      )}

      {!loading && !error && contracts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">계약자명</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">제출일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">멘토코드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.contractorName}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_CLASS[c.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {formatDate(c.submittedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {c.mentorCode ?? "-"}
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
