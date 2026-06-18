"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface AuditLog {
  id: string;
  userEmail: string;
  userName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  duration: number;
  recordCount?: number;
  createdAt: string;
  timestamp: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [resource, setResource] = useState(searchParams.get("resource") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [userId, setUserId] = useState(searchParams.get("userId") || "");
  const [resourceId, setResourceId] = useState(searchParams.get("resourceId") || "");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // 로그 조회
  const fetchLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (action) params.append("action", action);
      if (resource) params.append("resource", resource);
      if (status) params.append("status", status);
      if (userId) params.append("userId", userId);
      if (resourceId) params.append("resourceId", resourceId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", page.toString());
      params.append("limit", "20");

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("로그 조회 실패");

      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [action, resource, status, userId, resourceId, startDate, endDate, page]);

  // CSV 내보내기
  const handleExport = async () => {
    try {
      const res = await fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          resource,
          status,
          startDate,
          endDate,
        }),
      });

      if (!res.ok) throw new Error("내보내기 실패");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch (err) {
      alert(err instanceof Error ? err.message : "내보내기 실패");
    }
  };

  const resetFilters = () => {
    setAction("");
    setResource("");
    setStatus("");
    setUserId("");
    setResourceId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 제목 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">감사 로그</h1>
          <p className="text-gray-600 mt-2">정산, 이의, 검증, 재계산 액션 추적</p>
        </div>

        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* 액션 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                액션
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모두</option>
                <option value="SETTLE">정산</option>
                <option value="DISPUTE">이의</option>
                <option value="VERIFY">검증</option>
                <option value="RECALCULATE">재계산</option>
              </select>
            </div>

            {/* 리소스 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                리소스
              </label>
              <select
                value={resource}
                onChange={(e) => {
                  setResource(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모두</option>
                <option value="COMMISSION">수수료</option>
                <option value="SETTLEMENT">정산</option>
                <option value="CONTACT">연락처</option>
                <option value="SALES">판매</option>
              </select>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모두</option>
                <option value="SUCCESS">성공</option>
                <option value="FAILURE">실패</option>
                <option value="PENDING">대기</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* 시작 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작 날짜
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 종료 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료 날짜
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 리소스 ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                리소스 ID
              </label>
              <input
                type="text"
                value={resourceId}
                onChange={(e) => {
                  setResourceId(e.target.value);
                  setPage(1);
                }}
                placeholder="예: settle_123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              초기화
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
            >
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* 오류 표시 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">사용자</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">액션</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">리소스</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">소요시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">생성일시</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    로드 중...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    감사 로그가 없습니다
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{log.userEmail}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.resource}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-green-100 text-green-800"
                            : log.status === "FAILURE"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {log.status === "SUCCESS" ? "성공" : log.status === "FAILURE" ? "실패" : "대기"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.duration}ms</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              전체 {pagination.total.toLocaleString()}개 중 {((page - 1) * 20 + 1).toLocaleString()}-
              {Math.min(page * 20, pagination.total).toLocaleString()}개 표시
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                이전
              </button>
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const pageNum = Math.max(1, page - 2) + i;
                if (pageNum > pagination.pages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      pageNum === page
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
