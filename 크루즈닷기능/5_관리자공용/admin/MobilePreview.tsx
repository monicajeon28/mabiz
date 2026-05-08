// components/admin/MobilePreview.tsx
// 스마트폰 미리보기 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import ProductDetail from '@/components/mall/ProductDetail';
import type { ItineraryDay, MallLayout } from '@/lib/types/product-detail';

interface MobilePreviewProps {
  product: {
    id: number;
    productCode: string;
    cruiseLine: string;
    shipName: string;
    packageName: string;
    nights: number;
    days: number;
    basePrice: number | null;
    source: string | null;
    itineraryPattern: ItineraryDay[] | null;
    description: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    tripCount?: number;
    tags?: string[] | null;
    mallProductContent?: {
      thumbnail?: string | null;
      images?: string[] | null;
      videos?: string[] | null;
      layout?: MallLayout | null;
    } | null;
  };
}

export default function MobilePreview({ product }: MobilePreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // product가 변경될 때마다 새로고침 (모든 변경사항 감지)
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [
    product.productCode,
    product.packageName,
    product.cruiseLine,
    product.shipName,
    product.nights,
    product.days,
    product.basePrice,
    product.mallProductContent,
    JSON.stringify(product.mallProductContent?.layout),
    product.mallProductContent?.layout?.refundPolicy,
  ]);

  const productUrl = product.productCode 
    ? `/products/${product.productCode}`
    : '/products';

  return (
    <div className="sticky top-6">
      <div className="bg-gray-800 rounded-[2.5rem] p-2 shadow-2xl" style={{ width: '375px', maxWidth: '100%' }}>
        {/* 아이폰 노치 */}
        <div className="bg-gray-800 rounded-t-[2rem] h-8 flex items-center justify-center">
          <div className="w-32 h-5 bg-black rounded-full"></div>
        </div>
        
        {/* 화면 */}
        <div className="bg-white rounded-[1.5rem] overflow-hidden relative" style={{ height: '812px', maxHeight: '90vh' }}>
          <div 
            key={`${refreshKey}`}
            className="w-full h-full overflow-y-auto"
            style={{
              width: '100%',
              height: '100%',
              transform: 'scale(1)',
              transformOrigin: 'top left',
            }}
          >
            <div className="min-h-screen bg-gray-50" style={{ maxWidth: '375px' }}>
              <div className="mobile-preview-wrapper" key={`preview-${refreshKey}`}>
                <ProductDetail product={product} />
              </div>
            </div>
          </div>
        </div>
        
        {/* 홈 인디케이터 */}
        <div className="bg-gray-800 rounded-b-[2rem] h-6 flex items-center justify-center">
          <div className="w-32 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </div>
      
      {/* 디바이스 라벨 및 컨트롤 */}
      <div className="mt-4 text-center space-y-2">
        <p className="text-sm text-gray-600 font-semibold">📱 스마트폰 미리보기</p>
        <p className="text-xs text-gray-500">아이폰/삼성폰 기준</p>
        <button
          onClick={() => {
            setRefreshKey(Date.now());
          }}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          새로고침 (캐시 무시)
        </button>
        {product.productCode && (
          <div className="mt-2">
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              새 탭에서 열기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

