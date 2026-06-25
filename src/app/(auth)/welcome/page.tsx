"use client";

/**
 * /welcome — 초대 링크 가입 완료 후 랜딩 페이지
 * join/[token] POST 성공 시 redirect("/welcome?role=AGENT") 등으로 이동
 */

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle, ArrowRight } from "lucide-react";

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  OWNER: {
    title: "지사장으로 등록되었습니다!",
    subtitle: "팀원 초대 링크를 생성하고 대리점장을 관리할 수 있습니다.",
  },
  AGENT: {
    title: "대리점장으로 등록되었습니다!",
    subtitle: "대시보드에서 고객 관리와 판매 현황을 확인하세요.",
  },
  FREE_SALES: {
    title: "마케터로 등록되었습니다!",
    subtitle: "대시보드에서 내 판매 현황을 확인하세요.",
  },
};

function WelcomeContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const role    = params.get("role") ?? "AGENT";
  const copy    = ROLE_COPY[role] ?? ROLE_COPY.AGENT;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e3a5f] to-[#162d4a] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        {/* 헤더 장식 */}
        <div className="h-2 bg-gradient-to-r from-[#1e3a5f] via-blue-400 to-[#1e3a5f]" />

        <div className="p-8 text-center space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">{copy.title}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{copy.subtitle}</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">시작 가이드</p>
            <ul className="text-sm text-blue-700 space-y-1.5 list-none">
              {role === "OWNER" ? (
                <>
                  <li>• 설정 → 팀원 관리에서 대리점장 초대 링크를 생성하세요</li>
                  <li>• 대시보드에서 팀 성과를 실시간 확인하세요</li>
                  <li>• 설정 → 이메일 설정에서 알림 이메일을 연결하세요</li>
                </>
              ) : (
                <>
                  <li>• 대시보드에서 내 판매 현황을 확인하세요</li>
                  <li>• 고객 탭에서 고객을 등록하고 관리하세요</li>
                  <li>• 도구함에서 영업 자료를 활용하세요</li>
                </>
              )}
            </ul>
          </div>

          <button
            onClick={() => router.replace("/dashboard")}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold rounded-xl transition-colors"
          >
            대시보드 시작하기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
