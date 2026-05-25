"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showError, showSuccess } from "@/components/ui/Toast";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_CLASS } from "./constants";

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  psychologyLenses: string[];
  usageCount: number;
  lastUsedAt: string | null;
  status: string;
  visibility: string;
  isSystemTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  ok: boolean;
  data?: ContractTemplate[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
  error?: string;
}

export default function ContractTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 목록 조회
  useEffect(() => {
    const fetchTemplates = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (status) params.append("status", status);
        params.append("limit", "20");

        const res = await fetch(`/api/contract-templates?${params.toString()}`, {
          signal: controller.signal,
        });
        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "템플릿 조회에 실패했습니다");
          return;
        }

        setTemplates(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setError("요청 시간 초과 - 다시 시도해주세요");
        } else {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [category, status]);

  // 삭제 처리
  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/contract-templates/${id}`, {
        method: "DELETE",
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        showError(data.error || "삭제에 실패했습니다");
        return;
      }

      showSuccess(data.message || "템플릿이 삭제되었습니다");
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        showError("요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError(err instanceof Error ? err.message : "오류가 발생했습니다");
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">계약서 템플릿</h1>
        <Link
          href="/contract-templates/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          새 템플릿 만들기
        </Link>
      </div>

      {/* 필터 */}
      <div className="mb-6 flex gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="category-filter" className="text-sm font-semibold">
            카테고리
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">모든 카테고리</option>
            <option value="CRUISE">크루즈</option>
            <option value="RENTAL">렌탈</option>
            <option value="HOTEL">호텔</option>
            <option value="PACKAGE">패키지</option>
            <option value="OTHER">기타</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="status-filter" className="text-sm font-semibold">
            상태
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">모든 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="ARCHIVED">보관됨</option>
            <option value="DRAFT">임시저장</option>
          </select>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          로딩 중...
        </div>
      )}

      {/* 테이블 */}
      {!loading && templates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-sm">이름</th>
                <th className="text-left px-4 py-3 font-semibold text-sm">카테고리</th>
                <th className="text-left px-4 py-3 font-semibold text-sm">상태</th>
                <th className="text-left px-4 py-3 font-semibold text-sm">사용횟수</th>
                <th className="text-left px-4 py-3 font-semibold text-sm">렌즈</th>
                <th className="text-left px-4 py-3 font-semibold text-sm">작업</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contract-templates/${template.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {template.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {CATEGORY_LABEL[template.category] || template.category}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        STATUS_CLASS[template.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABEL[template.status] || template.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">{template.usageCount}</td>
                  <td className="px-4 py-3 text-sm">
                    {template.psychologyLenses.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {template.psychologyLenses.slice(0, 2).map((lens) => (
                          <span
                            key={lens}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                          >
                            {lens}
                          </span>
                        ))}
                        {template.psychologyLenses.length > 2 && (
                          <span className="px-2 py-0.5 text-xs text-gray-600">
                            +{template.psychologyLenses.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Link
                        href={`/contract-templates/${template.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        편집
                      </Link>
                      {!template.isSystemTemplate && (
                        <button
                          onClick={() => setConfirmDeleteId(template.id)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && templates.length === 0 && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">생성된 템플릿이 없습니다</p>
          <Link
            href="/contract-templates/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
          >
            첫 번째 템플릿 만들기
          </Link>
        </div>
      )}

      {/* 총 개수 */}
      {!loading && (
        <div className="mt-4 text-sm text-gray-600">
          총 {totalCount}개 템플릿
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDeleteId && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            aria-hidden="true"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            role="dialog"
            aria-labelledby="delete-modal-title"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-lg">
              <h2 id="delete-modal-title" className="text-lg font-semibold mb-4">
                템플릿 삭제
              </h2>
              <p className="text-gray-700 mb-6">
                이 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  aria-label="템플릿 삭제 확인"
                >
                  삭제
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  aria-label="삭제 취소"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
