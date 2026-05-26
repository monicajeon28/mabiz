"use client";

import { useState } from "react";
import { X, Phone, Send } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";

interface TestSendModalProps {
  sequenceId: string;
  day?: number;
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export function TestSendModal({
  sequenceId,
  day = 0,
  isOpen,
  onClose,
  onSent,
}: TestSendModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      showError("전화번호를 입력하세요.");
      return;
    }

    // Validate phone number (basic Korean format)
    if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phoneNumber)) {
      showError("올바른 휴대폰 번호를 입력하세요. (예: 01012345678)");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(
        `/api/tools/day0-3-sequences/${sequenceId}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactPhone: phoneNumber,
            startDay: day,
            delaySeconds: 0,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to send test message");

      const result = await response.json();
      showSuccess("테스트 메시지가 발송되었습니다.");
      setSentMessage(`${phoneNumber}로 30초 이내에 도착합니다.`);
      onSent?.();

      // Reset form after 2 seconds
      setTimeout(() => {
        setPhoneNumber("");
        setSentMessage(null);
        onClose();
      }, 2000);
    } catch (err) {
      showError("테스트 메시지 발송 실패");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">테스트 메시지 발송</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Day {day} 메시지를 테스트하려면 휴대폰 번호를 입력하세요.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              휴대폰 번호 *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d-]/g, ""))}
                placeholder="01012345678"
                disabled={isSending}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">형식: 01012345678 또는 010-1234-5678</p>
          </div>

          {sentMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✓ {sentMessage}
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              테스트 메시지는 실제 고객 통계에 포함되지 않습니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isSending ? "발송 중..." : "발송"}
          </button>
        </div>
      </div>
    </div>
  );
}
