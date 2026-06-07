"use client";

import React, { useState, useEffect } from "react";

// 간단한 toast 함수
const toast = {
  error: (msg: string) => console.error(msg),
  success: (msg: string) => console.log(msg),
  info: (msg: string) => console.info(msg),
};

interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  psychologyLenses: string[];
  usageCount: number;
  lastUsedAt?: string;
  isApplied: boolean;
}

interface PartnerContract {
  id: string;
  templateId: string;
  status: string;
  appliedAt: string;
  template: {
    name: string;
    description?: string;
    category: string;
    psychologyLenses: string[];
  };
  sections: Array<{
    id: string;
    title: string;
    content?: string;
    order: number;
  }>;
}

interface PartnerContractsTabProps {
  partnerId: string;
}

export function PartnerContractsTab({ partnerId }: PartnerContractsTabProps) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [contracts, setContracts] = useState<PartnerContract[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  // 적용 가능한 템플릿 목록 조회
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchTemplates = async () => {
      try {
        const response = await fetch(
          `/api/partners/${partnerId}/contract-templates`,
          { signal: ctrl.signal }
        );
        if (!response.ok) throw new Error("Failed to fetch templates");
        const result = await response.json();
        setTemplates(result.data || []);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error("Error fetching templates:", error);
        toast.error("템플릿 목록을 불러올 수 없습니다");
      }
    };

    fetchTemplates();
    return () => ctrl.abort();
  }, [partnerId]);

  // 적용된 계약서 목록 조회
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/partners/${partnerId}/contracts`, { signal: ctrl.signal });
        if (!response.ok) throw new Error("Failed to fetch contracts");
        const result = await response.json();
        setContracts(result.data || []);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error("Error fetching contracts:", error);
        toast.error("계약서를 불러올 수 없습니다");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };

    fetchContracts();
    return () => ctrl.abort();
  }, [partnerId]);

  // 템플릿 적용
  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error("템플릿을 선택해주세요");
      return;
    }

    try {
      setApplyingId(selectedTemplateId);
      const response = await fetch(`/api/partners/${partnerId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply template");
      }

      const result = await response.json();
      setContracts((prev) => [result.data, ...prev]);
      setSelectedTemplateId("");
      setShowApplyDialog(false);
      toast.success("계약서가 적용되었습니다");

      // 템플릿 목록 새로고침
      const templatesResponse = await fetch(
        `/api/partners/${partnerId}/contract-templates`
      );
      if (templatesResponse.ok) {
        const templatesResult = await templatesResponse.json();
        setTemplates(templatesResult.data || []);
      }
    } catch (error) {
      console.error("Error applying template:", error);
      toast.error(
        error instanceof Error ? error.message : "계약서 적용에 실패했습니다"
      );
    } finally {
      setApplyingId(null);
    }
  };

  // 계약서 삭제
  const handleDeleteContract = async (contractId: string) => {
    if (!confirm("이 계약서를 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(
        `/api/partners/${partnerId}/contracts/${contractId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete contract");

      setContracts((prev) => prev.filter((c) => c.id !== contractId));
      toast.success("계약서가 삭제되었습니다");

      // 템플릿 목록 새로고침
      const templatesResponse = await fetch(
        `/api/partners/${partnerId}/contract-templates`
      );
      if (templatesResponse.ok) {
        const templatesResult = await templatesResponse.json();
        setTemplates(templatesResult.data || []);
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("계약서 삭제에 실패했습니다");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* 템플릿 적용 섹션 */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">계약서 적용</h3>

        <div className="space-y-4">
          {!showApplyDialog ? (
            <button
              onClick={() => setShowApplyDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              새 계약서 적용
            </button>
          ) : (
            <>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.currentTarget.value)}
                className="w-full border rounded-lg p-2"
              >
                <option value="">템플릿을 선택하세요</option>
                {templates
                  .filter((t) => !t.isApplied)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.description ? ` - ${template.description}` : ""}
                    </option>
                  ))}
              </select>

              {selectedTemplateId && (
                <div className="text-sm text-gray-600 space-y-2 p-3 bg-gray-50 rounded">
                  {templates
                    .filter((t) => t.id === selectedTemplateId)
                    .map((t) => (
                      <div key={t.id}>
                        <p>
                          <span className="font-medium">카테고리:</span> {t.category}
                        </p>
                        {t.psychologyLenses.length > 0 && (
                          <p>
                            <span className="font-medium">심리학 렌즈:</span>{" "}
                            {t.psychologyLenses.join(", ")}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">사용 횟수:</span> {t.usageCount}회
                        </p>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplateId || applyingId === selectedTemplateId}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {applyingId === selectedTemplateId ? "적용 중..." : "적용"}
                </button>
                <button
                  onClick={() => {
                    setShowApplyDialog(false);
                    setSelectedTemplateId("");
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 적용된 계약서 목록 */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">적용된 계약서</h3>

        {loading ? (
          <p className="text-gray-500">로드 중...</p>
        ) : contracts.length === 0 ? (
          <p className="text-gray-500">적용된 계약서가 없습니다</p>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="rounded-lg border p-4 flex items-start justify-between hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{contract.template.name}</h4>
                  {contract.template.description && (
                    <p className="text-sm text-gray-600">
                      {contract.template.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                      {contract.template.category}
                    </span>
                    <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-800 text-xs">
                      {contract.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    적용일: {new Date(contract.appliedAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      toast.info("편집 기능은 준비 중입니다");
                    }}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteContract(contract.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
