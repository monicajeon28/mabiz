"use client";

import React, { useState, useRef } from "react";
import { AlertCircle, Loader, CheckCircle } from "lucide-react";
import { ModificationSummary } from "./ModificationSummary";

interface AutoReSignModalProps {
  isOpen: boolean;
  modification: {
    id: string;
    fieldName: string;
    currentValue: string;
    newValue: string;
    reason?: string;
    appliedLenses: string[];
  };
  contractData?: {
    currentPdf?: string;
    amendedPdf?: string;
  };
  onConfirm: (signature: string) => Promise<void>;
  onCancel: () => void;
  timeRemaining?: number; // seconds
}

type StepType = "review" | "signature" | "confirming" | "success";

export function AutoReSignModal({
  isOpen,
  modification,
  contractData,
  onConfirm,
  onCancel,
  timeRemaining = 604800, // 7일
}: AutoReSignModalProps) {
  const [step, setStep] = useState<StepType>("review");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const formatTimeRemaining = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}일 ${hours}시간`;
    return `${hours}시간`;
  };

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 흰색 배경
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 마우스 다운
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasSignature(true);
    };

    // 마우스 무브
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    // 마우스 업
    const handleMouseUp = () => {
      setIsDrawing(false);
    };

    // 터치 지원
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasSignature(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDrawing) return;

      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleTouchEnd = () => {
      setIsDrawing(false);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseout", handleMouseUp);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchMove);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseout", handleMouseUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  };

  React.useEffect(() => {
    if (step === "signature" && isOpen) {
      setTimeout(() => {
        initializeCanvas();
      }, 100);
    }
  }, [step, isOpen]);

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmitSignature = async () => {
    if (!canvasRef.current) return;
    if (!hasSignature) {
      setError("서명을 입력해주세요");
      return;
    }

    setError("");

    try {
      const signatureImage = canvasRef.current.toDataURL("image/png");
      // Validate that the signature is not blank
      if (!signatureImage || signatureImage.length < 100) {
        setError("유효한 서명을 입력해주세요");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300)); // Short delay for UX
      setStep("confirming");
      await onConfirm(signatureImage);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "재서명 실패");
      setStep("signature");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">재서명이 필요합니다</h2>
            <p className="text-sm text-blue-100 mt-1">
              계약서 변경 사항을 확인하고 재서명해주세요
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-100">⏰ 유효기한</div>
            <div className="text-lg font-bold">
              {formatTimeRemaining(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Step 1: Review */}
        {step === "review" && (
          <div className="p-6 space-y-6">
            <ModificationSummary
              modification={modification}
              contractData={contractData}
            />

            {/* 약관 동의 */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 accent-blue-600 mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  위 변경 사항이 정확하며, 이를 인정하고 재서명하는 것을 동의합니다.
                </span>
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => setStep("signature")}
                disabled={!agreedToTerms}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                재서명하기 →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Signature */}
        {step === "signature" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">서명 입력</h3>
              <p className="text-sm text-gray-600 mb-4">
                아래 박스에 서명하세요 (마우스 또는 터치패드)
              </p>

              {/* Canvas for signature */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair block"
                  style={{ minHeight: "150px", display: "block" }}
                />
              </div>

              <div className="mt-2 flex justify-between items-center">
                <button
                  onClick={handleClearCanvas}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  지우기
                </button>
                <span className="text-xs text-gray-500">
                  {hasSignature ? "✓ 서명이 입력되었습니다" : "서명을 입력해주세요"}
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError("");
                  setStep("review");
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                이전
              </button>
              <button
                onClick={handleSubmitSignature}
                disabled={!hasSignature}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                서명 완료
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirming */}
        {step === "confirming" && (
          <div className="p-12 text-center space-y-4">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <h3 className="font-bold text-gray-900">재서명 처리 중...</h3>
            <p className="text-sm text-gray-600">
              잠시만 기다려주세요. 계약서를 업데이트하고 있습니다.
            </p>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="p-12 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <h3 className="text-xl font-bold text-gray-900">
              ✅ 재서명 완료!
            </h3>
            <p className="text-sm text-gray-600">
              변경된 계약서가 확정되었습니다.
              <br />
              최종 계약서는 이메일로 발송되었습니다.
            </p>
            <button
              onClick={onCancel}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
