import { Suspense } from "react";
import { ErrorBoundary } from '@/components/error-boundary';
import { RecommendationWidget } from "../components/RecommendationWidget";
import { DashboardClient } from "../dashboard-client";

export default async function DashboardPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <DashboardClient />

      {/* 고객 세그먼트 추천 분석 */}
      <div className="mt-8 mb-8">
        <h2 className="text-xl font-bold text-navy-900 mb-4">고객 세그먼트 추천 분석</h2>
        <ErrorBoundary fallback={
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center text-gray-500">
              <p className="text-sm">데이터를 불러올 수 없습니다</p>
            </div>
          </div>
        }>
          <Suspense fallback={
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center text-gray-500">
                <p className="text-sm">분석 데이터 로딩 중...</p>
              </div>
            </div>
          }>
            <RecommendationWidget />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
