"use client";

interface PriceAnchor {
  day: number;
  price: number;
  label: string;
}

interface L6LossAnchorSectionProps {
  priceAnchors: PriceAnchor[];
  hoursUntilIncrease: number;
}

export function L6LossAnchorSection({
  priceAnchors,
  hoursUntilIncrease,
}: L6LossAnchorSectionProps) {
  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-6 md:p-8 mb-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 leading-tight">
        🚢 크루즈 여행, 언제까지 미루실 건가요?
      </h1>

      <div className="flex items-center gap-2 md:gap-3 mb-6 flex-wrap md:flex-nowrap overflow-x-auto pb-2">
        {priceAnchors.map((anchor, index) => (
          <div key={index} className="flex items-center gap-2 md:gap-3">
            <div
              className={`flex flex-col items-center bg-white rounded-xl p-3 md:p-4 border border-gray-200 whitespace-nowrap shrink-0 ${
                index === 0 ? "ring-2 ring-green-500 ring-offset-2" : ""
              }`}
            >
              <span className="text-sm text-gray-500 font-medium">{anchor.label}</span>
              <span className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
                {anchor.price.toLocaleString('ko-KR')}원
                <span className="text-sm font-normal text-gray-500 ml-1">/인</span>
              </span>
              {index === 0 ? (
                <span className="text-[11px] text-green-600 font-semibold mt-1">오늘</span>
              ) : (
                <span className="text-sm font-semibold text-red-600 mt-1">
                  +{(anchor.price - priceAnchors[0].price).toLocaleString('ko-KR')}원
                </span>
              )}
            </div>
            {index < priceAnchors.length - 1 && (
              <svg
                className="text-gray-600 shrink-0 hidden md:block"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-700 bg-white/60 rounded-lg px-4 py-2 border border-orange-200">
        📍 <strong>{hoursUntilIncrease}시간 후 가격 인상</strong> 예정입니다
      </p>
    </div>
  );
}
