"use client";

import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 팝오버 메뉴 */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-64 z-40 md:bottom-24">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">세일즈봇 도움말</h3>
            <p className="text-gray-600 text-sm">고객 응대에 필요한 Q&A와 판매톤을 선택해 사용하세요.</p>
            <Link
              href="/tools?tab=qa"
              onClick={() => setIsOpen(false)}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Q&A 라이브러리 열기
            </Link>
          </div>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg transition-all duration-200 z-50 flex items-center justify-center ${
          isOpen
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        } text-white`}
        aria-label="세일즈봇 도움말"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
