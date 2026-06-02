'use client';

import { loadCruisedotConfig } from '@/lib/constants/cruisedot-config';

/**
 * 가격 및 서비스 비교표
 * 크루즈닷 vs 경쟁사 vs 개인 판매자
 */

export default function PriceComparison() {
  const config = loadCruisedotConfig();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <th className="border p-4 text-left font-bold">항목</th>
            <th className="border p-4 text-center font-bold">
              🌟 크루즈닷<br />
              <span className="text-sm">(추천)</span>
            </th>
            <th className="border p-4 text-center font-bold">경쟁사 A</th>
            <th className="border p-4 text-center font-bold">개인 판매자</th>
          </tr>
        </thead>
        <tbody>
          {/* 가격 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">가격 ({config.pricing.japan.nights}박 일본)</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="font-bold text-green-600">{(config.pricing.japan.totalPrice / 1000000).toFixed(1)}만원</span>
            </td>
            <td className="border p-4 text-center">145만원</td>
            <td className="border p-4 text-center text-red-600">99만원</td>
          </tr>

          {/* 인솔자 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">인솔자 동반</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">✅ 포함</span>
            </td>
            <td className="border p-4 text-center">추가 비용</td>
            <td className="border p-4 text-center text-red-600">❌ 없음</td>
          </tr>

          {/* 환불 보장 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">환불 보장</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">100%</span>
            </td>
            <td className="border p-4 text-center">70%</td>
            <td className="border p-4 text-center text-red-600">0%</td>
          </tr>

          {/* 24/7 지원 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">24/7 지원</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">✅ 가능</span>
            </td>
            <td className="border p-4 text-center">평일만</td>
            <td className="border p-4 text-center text-red-600">❌ 불가능</td>
          </tr>

          {/* 선사 직결 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">선사 직결</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">✅ 직결</span>
            </td>
            <td className="border p-4 text-center">중간대리점</td>
            <td className="border p-4 text-center text-red-600">❌ 관계 없음</td>
          </tr>

          {/* 할부 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">월 할부</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">월 {config.pricing.japan.monthly.toLocaleString()}원</span>
            </td>
            <td className="border p-4 text-center">월 48,000원</td>
            <td className="border p-4 text-center text-red-600">❌ 불가능</td>
          </tr>

          {/* 신청금 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">신청금</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">0원</span>
            </td>
            <td className="border p-4 text-center">50만원</td>
            <td className="border p-4 text-center">30만원</td>
          </tr>

          {/* 사진 편집 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">사진 편집</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">✅ 무료</span>
            </td>
            <td className="border p-4 text-center">추가 비용</td>
            <td className="border p-4 text-center text-red-600">❌ 없음</td>
          </tr>

          {/* 건강검진 */}
          <tr className="hover:bg-gray-50">
            <td className="border p-4 font-semibold text-gray-700">건강검진 (골드)</td>
            <td className="border p-4 text-center bg-green-50">
              <span className="text-green-600 font-bold">✅ 연 {config.goldMember.benefits.healthCheckup.frequency}회</span>
            </td>
            <td className="border p-4 text-center">❌ 없음</td>
            <td className="border p-4 text-center text-red-600">❌ 없음</td>
          </tr>

          {/* 총합 평가 */}
          <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
            <td className="border p-4 font-bold text-gray-800">추천 점수</td>
            <td className="border p-4 text-center bg-green-100">
              <span className="font-bold text-green-700">⭐⭐⭐⭐⭐ (5/5)</span>
            </td>
            <td className="border p-4 text-center">⭐⭐⭐ (3/5)</td>
            <td className="border p-4 text-center text-red-600">⭐ (1/5)</td>
          </tr>
        </tbody>
      </table>

      {/* 결론 */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-green-500 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">
          💡 결론: 왜 크루즈닷이 최고인가?
        </h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✅</span>
            <span>
              <strong>가격 + 가치의 완벽한 균형</strong> — 약간 더 비싼 가격이지만, 100배의 가치가 있습니다
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✅</span>
            <span>
              <strong>환불 100% 보장</strong> — 개인 판매자처럼 사기당할 일이 없습니다
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✅</span>
            <span>
              <strong>24/7 매니저 지원</strong> — 문제 발생 시 즉시 해결됩니다
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✅</span>
            <span>
              <strong>평생 고객 관계</strong> — 여행이 끝나도 평생 10-30% 할인, 건강검진, 매칭 서비스
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
