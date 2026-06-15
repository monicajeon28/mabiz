"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Eye, AlertCircle, Copy, Check } from "lucide-react";

interface SmsPreviewPanelProps {
  template: string;
  variables: Record<string, string>;
}

/**
 * SMS 미리보기 패널
 * - 템플릿 + 변수 치환
 * - {{variable}} 형식 지원
 * - 문자 길이 계산 (SMS/LMS 기준)
 * - 누락 변수 경고
 */
export function SmsPreviewPanel({ template, variables }: SmsPreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  // 변수 치환
  const preview = useMemo(() => {
    let result = template;
    const missingVars: string[] = [];

    // {{variable}} 패턴 찾기
    const varPattern = /\{\{(\w+)\}\}/g;
    const matches = template.matchAll(varPattern);

    for (const match of matches) {
      const varName = match[1];
      if (variables[varName]) {
        result = result.replace(`{{${varName}}}`, variables[varName]);
      } else {
        missingVars.push(varName);
      }
    }

    return { text: result, missing: missingVars };
  }, [template, variables]);

  // SMS 길이 계산 (한글 3바이트)
  const calculateLength = useCallback((text: string) => {
    const length = text.length;
    const buildCount = Math.ceil(length / 90);
    return { length, buildCount };
  }, []);

  const { length, buildCount } = calculateLength(preview.text);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-lg">SMS 미리보기</h3>
      </div>

      {/* 미리보기 박스 */}
      <div className="relative mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-300 min-h-[120px]">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {preview.text}
          </p>
        </div>

        {/* 복사 버튼 */}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 bg-white rounded hover:bg-gray-100 transition-colors"
          title="텍스트 복사"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* SMS 길이 정보 */}
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">문자 길이</p>
            <p className="text-lg font-bold text-gray-900">{length}</p>
            <p className="text-xs text-gray-500">자</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">발송 건수</p>
            <p className="text-lg font-bold text-blue-600">{buildCount}</p>
            <p className="text-xs text-gray-500">
              {buildCount === 1 ? "SMS" : "LMS"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">상태</p>
            <p className={`text-lg font-bold ${length > 0 ? "text-green-600" : "text-gray-400"}`}>
              {length > 0 ? "준비됨" : "없음"}
            </p>
          </div>
        </div>
      </div>

      {/* 누락 변수 경고 */}
      {preview.missing.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">누락된 변수</p>
            <p className="text-sm text-yellow-700 mt-1">
              {preview.missing.join(", ")}를 입력해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 성공 상태 */}
      {preview.missing.length === 0 && length > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded flex gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">준비 완료</p>
            <p className="text-sm text-green-700 mt-1">
              모든 변수가 입력되었습니다. 언제든 발송할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
