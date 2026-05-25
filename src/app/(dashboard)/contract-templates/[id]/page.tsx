"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { showSuccess, showError } from "@/components/ui/Toast";
import { PSYCHOLOGY_LENSES, LENS_LABELS, CATEGORY_LABEL } from "../constants";

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  htmlContent: string | null;
  fieldMapping: Record<string, any>;
  psychologyLenses: string[];
  visibility: string;
  status: string;
  version: number;
  isSystemTemplate: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  ok: boolean;
  data?: ContractTemplate;
  message?: string;
  error?: string;
}

export default function ContractTemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLenses, setSelectedLenses] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "CRUISE",
    htmlContent: "",
    visibility: "ORGANIZATION",
    status: "DRAFT",
  });

  // 템플릿 로드
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/contract-templates/${id}`);
        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "템플릿을 찾을 수 없습니다");
          return;
        }

        if (data.data) {
          setTemplate(data.data);
          setFormData({
            name: data.data.name,
            description: data.data.description || "",
            category: data.data.category,
            htmlContent: data.data.htmlContent || "",
            visibility: data.data.visibility,
            status: data.data.status,
          });
          setSelectedLenses(data.data.psychologyLenses);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchTemplate();
  }, [id]);

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

    if (!formData.name.trim()) {
      setError("템플릿 이름을 입력해주세요");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        htmlContent: formData.htmlContent,
        psychologyLenses: selectedLenses,
        visibility: formData.visibility,
        status: formData.status,
      };

      const res = await fetch(`/api/contract-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        showError(data.error || "수정에 실패했습니다");
        return;
      }

      showSuccess(data.message || "템플릿이 성공적으로 수정되었습니다");
      setIsEditing(false);

      // 템플릿 상태 업데이트
      if (data.data) {
        setTemplate(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12">
        로딩 중...
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/contract-templates" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← 목록으로 돌아가기
        </Link>
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/contract-templates" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← 목록으로 돌아가기
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{template.name}</h1>
            <p className="text-sm text-gray-500 mt-2">
              v{template.version} • 생성일: {new Date(template.createdAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              편집
            </button>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* 뷰 모드 */}
      {!isEditing && (
        <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                카테고리
              </label>
              <p className="text-lg font-semibold">
                {CATEGORY_LABEL[template.category] || template.category}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                상태
              </label>
              <p className="text-lg font-semibold">{template.status}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                공개 범위
              </label>
              <p className="text-lg font-semibold">{template.visibility}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                사용 횟수
              </label>
              <p className="text-lg font-semibold">{template.usageCount}</p>
            </div>
          </div>

          {/* 설명 */}
          {template.description && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                설명
              </label>
              <p className="text-gray-700 whitespace-pre-wrap">{template.description}</p>
            </div>
          )}

          {/* 렌즈 */}
          {template.psychologyLenses.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                심리학 렌즈 ({template.psychologyLenses.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {template.psychologyLenses.map((lens) => (
                  <span
                    key={lens}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm"
                  >
                    {LENS_LABELS[lens] || lens}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* HTML 미리보기 */}
          {template.htmlContent && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                HTML 콘텐츠
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                  {template.htmlContent}
                </pre>
              </div>
            </div>
          )}

          {/* 시스템 템플릿 경고 */}
          {template.isSystemTemplate && (
            <div className="p-4 bg-yellow-100 text-yellow-700 rounded">
              이것은 시스템 템플릿입니다. 수정하거나 삭제할 수 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 편집 모드 */}
      {isEditing && !template.isSystemTemplate && (
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
              rows={8}
            />
            <p className="text-xs text-gray-500 mt-2">
              {'{{변수명}}'} 형식으로 필드를 지정할 수 있습니다
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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
