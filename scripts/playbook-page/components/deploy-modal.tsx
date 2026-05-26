"use client";

import { useEffect, useState } from "react";
import { X, Send, Users } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";
import useSWR from "swr";
import { SequenceDetails, DeploySequenceRequest } from "@/lib/types/sequence";

interface DeployModalProps {
  sequenceId: string;
  isOpen: boolean;
  onClose: () => void;
  onDeployed?: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TargetType = "all" | "segment" | "lens" | "custom";

export function DeployModal({
  sequenceId,
  isOpen,
  onClose,
  onDeployed,
}: DeployModalProps) {
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [selectedLens, setSelectedLens] = useState("");
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState("");

  const { data: sequenceData } = useSWR(
    sequenceId ? `/api/tools/day0-3-sequences/${sequenceId}` : null,
    fetcher
  );

  const sequence: SequenceDetails | undefined = sequenceData?.sequence;

  const SEGMENTS = [
    { code: "GOLD", label: "골드회원" },
    { code: "PREMIER", label: "프리미어" },
    { code: "ACTIVE", label: "활성 고객" },
    { code: "INACTIVE", label: "부재중" },
  ];

  const LENSES = [
    { code: "L0", label: "L0 - 부재중 복원" },
    { code: "L1", label: "L1 - 가격 이의" },
    { code: "L2", label: "L2 - 준비 복잡" },
    { code: "L3", label: "L3 - 차별성" },
    { code: "L6", label: "L6 - 타이밍" },
    { code: "L10", label: "L10 - 즉시 구매" },
  ];

  // Simulate count estimation based on target
  useEffect(() => {
    const counts: Record<TargetType, number> = {
      all: 2543,
      segment: selectedSegment ? Math.floor(Math.random() * 1000) + 100 : 0,
      lens: selectedLens ? Math.floor(Math.random() * 800) + 50 : 0,
      custom: contactIds.length,
    };
    setEstimatedCount(counts[targetType] || 0);
  }, [targetType, selectedSegment, selectedLens, contactIds]);

  const handleDeploy = async () => {
    if (estimatedCount === 0) {
      showError("배포 대상을 선택하세요.");
      return;
    }

    if (!confirm(`${estimatedCount}명의 고객에게 배포하시겠습니까?`)) {
      return;
    }

    setIsDeploying(true);
    try {
      const payload: DeploySequenceRequest = {
        deployMessage: deployMessage || "Day 0-3 자동화 시퀀스 배포",
      };

      if (targetType === "segment") payload.segmentCode = selectedSegment;
      if (targetType === "lens") payload.segmentCode = `LENS_${selectedLens}`;
      if (targetType === "custom") payload.contactIds = contactIds;

      const response = await fetch(
        `/api/tools/day0-3-sequences/${sequenceId}/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to deploy sequence");

      const result = await response.json();
      showSuccess(`${result.deployed || 0}명에게 배포되었습니다.`);
      onDeployed?.();
    } catch (err) {
      showError("배포 실패");
      console.error(err);
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 md:p-0">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">시퀀스 배포</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Sequence Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-1">{sequence?.name}</h3>
            <p className="text-sm text-blue-700">
              {sequence?.description || "Day 0-3 SMS 자동화 시퀀스"}
            </p>
          </div>

          {/* Target Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              배포 대상 선택
            </label>

            {/* Option 1: All Contacts */}
            <button
              onClick={() => {
                setTargetType("all");
                setSelectedSegment("");
                setSelectedLens("");
                setContactIds([]);
              }}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                targetType === "all"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">전체 고객</div>
                  <div className="text-xs text-gray-500">모든 활성 고객에게 배포</div>
                </div>
              </div>
            </button>

            {/* Option 2: By Segment */}
            <button
              onClick={() => setTargetType("segment")}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                targetType === "segment"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">고객 세그먼트</div>
              <div className="text-xs text-gray-500">특정 세그먼트만 선택</div>
            </button>
            {targetType === "segment" && (
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">세그먼트 선택</option>
                {SEGMENTS.map((seg) => (
                  <option key={seg.code} value={seg.code}>
                    {seg.label}
                  </option>
                ))}
              </select>
            )}

            {/* Option 3: By Psychology Lens */}
            <button
              onClick={() => setTargetType("lens")}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                targetType === "lens"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">심리학 렌즈</div>
              <div className="text-xs text-gray-500">렌즈별로 고객 필터링</div>
            </button>
            {targetType === "lens" && (
              <select
                value={selectedLens}
                onChange={(e) => setSelectedLens(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">렌즈 선택</option>
                {LENSES.map((lens) => (
                  <option key={lens.code} value={lens.code}>
                    {lens.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Deployment Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              배포 메모 (선택)
            </label>
            <textarea
              value={deployMessage}
              onChange={(e) => setDeployMessage(e.target.value)}
              placeholder="배포 사유나 메모를 입력하세요."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Estimated Count */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs font-medium text-green-600 mb-1">배포 예상 대상</div>
            <div className="text-3xl font-bold text-green-900">{estimatedCount}</div>
            <div className="text-xs text-green-700 mt-2">
              명의 고객에게 Day 0-3 시퀀스가 시작됩니다.
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              배포 후 선택된 고객들은 Day 0부터 Day 3까지 자동으로 SMS를 받게 됩니다. 취소할 수 없으니 신중히 선택하세요.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 p-6 border-t border-gray-200 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDeploy}
            disabled={isDeploying || estimatedCount === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isDeploying ? "배포 중..." : "배포"}
          </button>
        </div>
      </div>
    </div>
  );
}
