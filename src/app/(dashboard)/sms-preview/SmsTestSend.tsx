"use client";

import React, { useState } from "react";
import { Send, CheckCircle, AlertCircle, Loader2, Phone } from "lucide-react";

interface SmsTestSendProps {
  message: string;
  variables: Record<string, string>;
}

/**
 * SMS 테스트 발송 컴포넌트
 * - 휴대폰번호 입력 검증
 * - 실제 발송 (일일 제한 10회)
 * - 발송 결과 표시
 */
export function SmsTestSend({ message, variables }: SmsTestSendProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    dailyUsage?: string;
  } | null>(null);

  // 휴대폰번호 포맷팅
  const formatPhone = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 3) return clean;
    if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
  };

  // 휴대폰번호 검증
  const isValidPhone = (value: string) => {
    const clean = value.replace(/\D/g, "");
    return /^(01[0-9])\d{7,8}$/.test(clean);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleTestSend = async () => {
    if (!isValidPhone(phone)) {
      setResult({ ok: false, message: "유효한 휴대폰번호를 입력해주세요." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 변수 치환
      let finalMessage = message;
      Object.entries(variables).forEach(([key, value]) => {
        finalMessage = finalMessage.replace(`{{${key}}}`, value || "");
      });

      const res = await fetch("/api/sms/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          testPhoneNumber: phone.replace(/\D/g, ""),
        }),
      });

      const data = await res.json();
      setResult({
        ok: data.ok,
        message: data.message || (data.ok ? "테스트 발송이 완료되었습니다" : "발송 실패"),
        dailyUsage: data.dailyUsage,
      });

      if (data.ok) {
        setPhone("");
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "오류가 발생했습니다",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading || !phone || !isValidPhone(phone) || !message.trim();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-5 h-5 text-green-600" />
        <h3 className="font-bold text-lg">테스트 발송</h3>
      </div>

      {/* 입력 폼 */}
      <div className="space-y-3 mb-4">
        {/* 휴대폰번호 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            본인 휴대폰번호
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Phone className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={handlePhoneChange}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            실제 발송됩니다. 본인 번호만 입력해주세요.
          </p>
        </div>

        {/* 발송 버튼 */}
        <button
          onClick={handleTestSend}
          disabled={isDisabled}
          className={`w-full py-2.5 px-4 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all ${
            isDisabled
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 active:scale-95"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              발송 중...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              테스트 발송하기
            </>
          )}
        </button>
      </div>

      {/* 성공 메시지 */}
      {result?.ok && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">발송 완료!</p>
            <p className="text-sm text-green-700 mt-1">{result.message}</p>
            {result.dailyUsage && (
              <p className="text-xs text-green-600 mt-1">
                일일 사용량: {result.dailyUsage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {result && !result.ok && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">발송 실패</p>
            <p className="text-sm text-red-700 mt-1">{result.message}</p>
          </div>
        </div>
      )}

      {/* 제한 정보 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <span className="font-medium">일일 제한:</span> 테스트 발송은 하루 10회로 제한됩니다.
        </p>
      </div>
    </div>
  );
}
