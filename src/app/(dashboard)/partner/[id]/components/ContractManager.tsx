"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2, Edit2, Eye } from "lucide-react";
import { useToast } from "@/lib/api/use-toast";

interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface Contract {
  id: string;
  templateId: string;
  status: string;
  appliedAt: string;
  template: {
    name: string;
    category: string;
    description?: string;
  };
  sections?: Array<{
    id: string;
    title: string;
    content?: string;
    order: number;
  }>;
}

export function ContractManager({ partnerId }: { partnerId: string }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Step 1: 초기 로드 (템플릿 + 적용된 계약서)
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const templatesRes = await fetch(
          `/api/partners/${partnerId}/contract-templates`, { signal }
        );
        if (!templatesRes.ok) throw new Error("Failed to fetch templates");
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.data || []);

        const contractsRes = await fetch(
          `/api/partners/${partnerId}/contracts`, { signal }
        );
        if (!contractsRes.ok) throw new Error("Failed to fetch contracts");
        const contractsData = await contractsRes.json();
        setContracts(contractsData.data || []);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : "An error occurred";
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

    fetchData();
    return () => ctrl.abort();
  }, [partnerId, toast]);

  // Step 2: 템플릿 적용
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setApplying(true);
      setError(null);

      const res = await fetch(`/api/partners/${partnerId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to apply template");
      }

      const result = await res.json();

      // 성공: 계약서 목록 새로고침
      const contractsRes = await fetch(`/api/partners/${partnerId}/contracts`);
      const contractsData = await contractsRes.json();
      setContracts(contractsData.data || []);

      // 입력 초기화
      setSelectedTemplate("");

      toast({
        title: "성공",
        description: "계약서가 적용되었습니다",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply template";
      setError(message);
      toast({
        title: "적용 실패",
        description: message,
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  // Step 3: 계약서 삭제
  const handleDeleteContract = async (contractId: string) => {
    if (!confirm("계약서를 삭제하시겠습니까?")) return;

    try {
      setError(null);

      const res = await fetch(
        `/api/partners/${partnerId}/contracts/${contractId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to delete contract");

      // 목록 새로고침
      setContracts(prev => prev.filter(c => c.id !== contractId));

      toast({
        title: "삭제 완료",
        description: "계약서가 삭제되었습니다",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      setError(message);
      toast({
        title: "삭제 실패",
        description: message,
        variant: "destructive",
      });
    }
  };

  // 렌더링
  return (
    <div className="space-y-6">
      {/* 에러 표시 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* 적용 가능한 템플릿 섹션 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">
          적용 가능한 템플릿
        </h3>

        <div className="flex gap-2">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            disabled={templates.length === 0}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">
              {templates.length === 0 ? "적용 가능한 템플릿이 없습니다" : "템플릿 선택"}
            </option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>

          <Button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate || applying || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {applying ? "적용 중..." : "적용"}
          </Button>
        </div>
      </div>

      {/* 적용된 계약서 목록 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">
          적용된 계약서 ({contracts.length})
        </h3>

        {contracts.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 text-center border rounded-lg border-dashed">
            적용된 계약서가 없습니다
          </p>
        ) : (
          <div className="space-y-2">
            {contracts.map(contract => (
              <div
                key={contract.id}
                className="rounded-lg border border-gray-200 p-4 flex justify-between items-start hover:bg-gray-50 transition"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {contract.template.name}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    카테고리: {contract.template.category} | 적용: {new Date(contract.appliedAt).toLocaleDateString('ko-KR')}
                  </div>
                  {contract.sections && contract.sections.length > 0 && (
                    <div className="text-xs text-gray-400 mt-2">
                      섹션: {contract.sections.length}개
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  {/* 미리보기 버튼 (선택사항) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                    title="미리보기"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  {/* 수정 버튼 (선택사항) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                    title="수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>

                  {/* 삭제 버튼 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-900"
                    title="삭제"
                    onClick={() => handleDeleteContract(contract.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="text-center text-sm text-gray-500">
          로드 중...
        </div>
      )}
    </div>
  );
}
