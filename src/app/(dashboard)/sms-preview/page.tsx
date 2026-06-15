import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SmsComposer } from "./SmsComposer";

export const metadata = {
  title: "SMS 작성 & 미리보기 | 마비즈 CRM",
  description: "템플릿 작성 → 변수 입력 → 미리보기 → 테스트 발송",
};

/**
 * SMS 미리보기 페이지
 * - 렌즈별 Day 0-3 템플릿
 * - 실시간 미리보기
 * - 테스트 발송
 */
export default async function SmsPreviewPage() {
  const session = await getSession();
  if (!session?.organizationId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            SMS 작성 & 미리보기
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            템플릿 작성 → 변수 입력 → 실시간 미리보기 → 테스트 발송까지 한 곳에서!
          </p>
        </div>

        {/* 주요 기능 안내 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="text-sm font-semibold text-blue-900">📝 템플릿</div>
            <p className="text-xs text-blue-700 mt-1">
              변수 형식으로 동적 텍스트 입력
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
            <div className="text-sm font-semibold text-purple-900">✨ 렌즈</div>
            <p className="text-xs text-purple-700 mt-1">
              심리학 렌즈별 Day 0-3 시퀀스
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
            <div className="text-sm font-semibold text-green-900">👁️ 미리보기</div>
            <p className="text-xs text-green-700 mt-1">
              실시간 문자 길이 + SMS/LMS 판정
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
            <div className="text-sm font-semibold text-orange-900">📱 테스트</div>
            <p className="text-xs text-orange-700 mt-1">
              본인 휴대폰으로 실제 발송 (10회/일)
            </p>
          </div>
        </div>

        {/* 메인 컴포저 */}
        <SmsComposer />
      </div>
    </div>
  );
}
