"use client";

import React, { useState, useCallback } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { SmsPreviewPanel } from "./SmsPreviewPanel";
import { SmsLensPreview } from "./SmsLensPreview";
import { SmsTestSend } from "./SmsTestSend";

const VARIABLE_FORMAT = "{{variable}}";

/**
 * SMS 작성 & 미리보기 통합 컴포넌트
 * - 좌측: 템플릿 + 변수 입력
 * - 우측: 미리보기 3가지 (기본 / 렌즈별 / 테스트발송)
 */
export function SmsComposer() {
  // 기본 템플릿
  const defaultTemplate = `안녕하세요 {{name}}님!
{{destination}} 특가 {{discount}}% 할인 + {{benefit}}

지금 신청하면 무료 여행보험 포함!
다른 분들도 이미 예약하셨습니다. 👥

{{cta_button}} [링크]`;

  const defaultVariables: Record<string, string> = {
    name: "김철수",
    destination: "일본 오키나와",
    discount: "30",
    benefit: "항공료 포함",
    cta_button: "지금 예약하기",
  };

  const [template, setTemplate] = useState(defaultTemplate);
  const [variables, setVariables] = useState<Record<string, string>>(defaultVariables);
  const [varKey, setVarKey] = useState("");

  // 변수 추가
  const handleAddVariable = useCallback(() => {
    if (varKey.trim() && !variables.hasOwnProperty(varKey)) {
      setVariables((prev) => ({ ...prev, [varKey]: "" }));
      setVarKey("");
    }
  }, [varKey, variables]);

  // 변수 제거
  const handleRemoveVariable = useCallback(
    (key: string) => {
      setVariables((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    },
    []
  );

  // 변수 값 변경
  const handleVariableChange = useCallback(
    (key: string, value: string) => {
      setVariables((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // 템플릿 초기화
  const handleResetTemplate = useCallback(() => {
    setTemplate(defaultTemplate);
    setVariables(defaultVariables);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Template + Variables */}
      <div className="lg:col-span-1 space-y-4">
        {/* SMS 템플릿 섹션 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <label className="block text-sm font-semibold text-gray-900">
              SMS 템플릿
            </label>
          </div>

          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={VARIABLE_FORMAT + " 형식으로 변수를 입력하세요"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={8}
          />

          <p className="text-xs text-gray-500 mt-2">
            💡 변수를 입력하면 자동으로 치환됩니다
          </p>

          <button
            onClick={handleResetTemplate}
            className="w-full mt-3 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            기본 템플릿으로 초기화
          </button>
        </div>

        {/* 변수 추가 섹션 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            변수 추가
          </label>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="변수명 (예: name)"
              value={varKey}
              onChange={(e) => setVarKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleAddVariable}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>

          {/* 변수 목록 */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {Object.entries(variables).map(([key, value]) => (
              <div
                key={key}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <code className="text-xs font-semibold text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded">
                    {`{{${key}}}`}
                  </code>
                  <button
                    onClick={() => handleRemoveVariable(key)}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleVariableChange(key, e.target.value)}
                  placeholder={`${key} 값 입력`}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>

          {Object.keys(variables).length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">
              아직 변수가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* Right: Previews (3 types) */}
      <div className="lg:col-span-2 space-y-4">
        <SmsPreviewPanel template={template} variables={variables} />
        <SmsLensPreview />
        <SmsTestSend message={template} variables={variables} />
      </div>
    </div>
  );
}
