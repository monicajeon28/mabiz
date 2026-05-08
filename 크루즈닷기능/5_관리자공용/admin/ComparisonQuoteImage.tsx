'use client';

import { useRef, useEffect } from 'react';

interface ComparisonQuoteImageProps {
  customerName: string;
  productCode: string;
  productName: string;
  ourPrice: number;
  competitorPrices: Array<{
    companyName: string;
    price: number;
    notes?: string;
  }>;
  headcount?: number;
  cabinType?: string;
  fareCategory?: string;
  responsibleName: string;
  responsibleRole: '대리점장' | '판매원';
  date: string;
}

export default function ComparisonQuoteImage({
  customerName,
  productCode,
  productName,
  ourPrice,
  competitorPrices,
  headcount,
  cabinType,
  fareCategory,
  responsibleName,
  responsibleRole,
  date,
}: ComparisonQuoteImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const formattedOurPrice = ourPrice.toLocaleString('ko-KR');
  const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      ref={containerRef}
      className="w-[800px] bg-white p-8"
      style={{ fontFamily: 'Malgun Gothic, sans-serif' }}
    >
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-lg mb-6">
        <h1 className="text-3xl font-extrabold text-center mb-2">타사 비교 견적서</h1>
        <p className="text-center text-blue-100">{customerName}님을 위한 맞춤 견적서</p>
      </div>

      {/* 상품 정보 */}
      <div className="mb-6 p-5 border-l-4 border-blue-500 bg-gray-50 rounded-r-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-4">상품 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 font-semibold">상품명:</span>
            <span className="ml-2 text-gray-900">{productName}</span>
          </div>
          <div>
            <span className="text-gray-600 font-semibold">상품코드:</span>
            <span className="ml-2 text-gray-900">{productCode}</span>
          </div>
          {headcount && (
            <div>
              <span className="text-gray-600 font-semibold">인원수:</span>
              <span className="ml-2 text-gray-900">{headcount}명</span>
            </div>
          )}
          {cabinType && (
            <div>
              <span className="text-gray-600 font-semibold">객실타입:</span>
              <span className="ml-2 text-gray-900">{cabinType}</span>
            </div>
          )}
          {fareCategory && (
            <div>
              <span className="text-gray-600 font-semibold">요금카테고리:</span>
              <span className="ml-2 text-gray-900">{fareCategory}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600 font-semibold">견적일자:</span>
            <span className="ml-2 text-gray-900">{formattedDate}</span>
          </div>
          <div>
            <span className="text-gray-600 font-semibold">담당 {responsibleRole}:</span>
            <span className="ml-2 text-gray-900">{responsibleName}</span>
          </div>
        </div>
      </div>

      {/* 가격 비교 테이블 */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">가격 비교</h2>
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-6 py-4 text-left font-bold">업체명</th>
              <th className="px-6 py-4 text-right font-bold">가격</th>
              <th className="px-6 py-4 text-left font-bold">비고</th>
            </tr>
          </thead>
          <tbody>
            {/* 우리 상품 (강조) */}
            <tr className="bg-green-50 border-b-2 border-green-200">
              <td className="px-6 py-4 font-bold text-gray-900">크루즈닷</td>
              <td className="px-6 py-4 text-right font-bold text-green-700 text-lg">
                {formattedOurPrice}원
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  추천
                </span>
              </td>
            </tr>
            {/* 경쟁사 가격 */}
            {competitorPrices.map((cp, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-900">{cp.companyName}</td>
                <td className="px-6 py-4 text-right text-gray-900 font-semibold">
                  {cp.price.toLocaleString('ko-KR')}원
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">{cp.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 안내 */}
      <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>본 견적서는 {formattedDate} 기준으로 작성되었으며, 가격은 변동될 수 있습니다.</p>
        <p className="mt-2">추가 문의사항이 있으시면 언제든지 연락주세요.</p>
      </div>
    </div>
  );
}



