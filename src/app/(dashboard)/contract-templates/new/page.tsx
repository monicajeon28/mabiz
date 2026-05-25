"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { showSuccess, showError } from "@/components/ui/Toast";
import { PSYCHOLOGY_LENSES, LENS_LABELS } from "../constants";

export default function NewContractTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLenses, setSelectedLenses] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "CRUISE",
    htmlContent: "",
    visibility: "ORGANIZATION",
    status: "DRAFT",
  });

  // 렌즈 토글
  const toggleLens = (lens: string) => {
    setSelectedLenses((prev) =>
      prev.includes(lens)
        ? prev.filter((l) => l !== lens)
        : [...prev, lens]
    );
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 기본 검증
    if (!formData.name.trim()) {
      setError("템플릿 이름을 입력해주세요");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        htmlContent: formData.htmlContent,
        fieldMapping: {},
        psychologyLenses: selectedLenses,
        visibility: formData.visibility,
        status: formData.status,
      };

      const res = await fetch("/api/contract-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        showError(data.error || "생성에 실패했습니다");
        return;
      }

      showSuccess(data.message || "템플릿이 성공적으로 생성되었습니다");
      setTimeout(() => router.push(`/contract-templates/${data.data.id}`), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/contract-templates" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← 목록으로 돌아가기
        </Link>
        <h1 className="text-3xl font-bold">새 계약서 템플릿</h1>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
        {/* 이름 */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            템플릿 이름 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 크루즈 확인 계약서"
            required
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-semibold mb-2">설명</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="템플릿의 용도나 설명을 입력하세요"
            rows={3}
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-sm font-semibold mb-2">카테고리 *</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="CRUISE">크루즈</option>
            <option value="RENTAL">렌탈</option>
            <option value="HOTEL">호텔</option>
            <option value="PACKAGE">패키지</option>
            <option value="OTHER">기타</option>
          </select>
        </div>

        {/* HTML 콘텐츠 */}
        <div>
          <label className="block text-sm font-semibold mb-2">HTML 콘텐츠</label>
          <textarea
            value={formData.htmlContent}
            onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder={`<div>
  <h1>계약서 제목</h1>
  <p>{{customerName}} 고객님과의 계약</p>
  <p>계약 내용...</p>
</div>`}
            rows={8}
          />
          <p className="text-xs text-gray-500 mt-2">
            매개변수 형식으로 필드를 지정할 수 있습니다 (예: customerName, contractDate)
          </p>
        </div>

        {/* 심리학 렌즈 */}
        <div>
          <label className="block text-sm font-semibold mb-3">심리학 렌즈</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PSYCHOLOGY_LENSES.map((lens) => (
              <label key={lens} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLenses.includes(lens)}
                  onChange={() => toggleLens(lens)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm">{LENS_LABELS[lens]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 공개 범위 */}
        <div>
          <label className="block text-sm font-semibold mb-2">공개 범위</label>
          <select
            value={formData.visibility}
            onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="PERSONAL">개인</option>
            <option value="MANAGER_ONLY">매니저만</option>
            <option value="ORGANIZATION">조직 전체</option>
          </select>
        </div>

        {/* 상태 */}
        <div>
          <label className="block text-sm font-semibold mb-2">상태</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="DRAFT">임시저장</option>
            <option value="ACTIVE">활성</option>
          </select>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "생성 중..." : "템플릿 생성"}
          </button>
          <Link
            href="/contract-templates"
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
