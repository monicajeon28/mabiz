'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { FiX, FiAlertCircle, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
import ProductDetail from '@/components/mall/ProductDetail';

interface ProductPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
  product?: any; // 상품 데이터 (선택적, 있으면 직접 사용)
}

export default function ProductPreviewModal({ isOpen, onClose, productCode, product: productProp }: ProductPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [product, setProduct] = useState<any>(productProp || null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    if (isOpen && productCode) {
      setIsLoading(true);
      setHasError(false);
      setRefreshKey(prev => prev + 1);
      setForceRefresh(prev => prev + 1);

      // productProp이 없으면 서버에서 로드
      if (!productProp) {
        loadProduct();
      } else {
        setProduct(productProp);
        setIsLoading(false);
      }
    }
  }, [isOpen, productCode, productProp]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProduct = async () => {
    try {
      const res = await fetch(`/api/admin/products/${productCode}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('상품을 불러올 수 없습니다.');
      }

      const data = await res.json();
      if (data.ok && data.product) {
        setProduct(data.product);
        setIsLoading(false);
        setHasError(false);
      } else {
        throw new Error('상품 데이터를 찾을 수 없습니다.');
      }
    } catch (error) {
      logger.error('Failed to load product:', error);
      setIsLoading(false);
      setHasError(true);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(Date.now());
    setForceRefresh(Date.now());
    if (!productProp) {
      loadProduct();
    }
  };

  if (!isOpen || !productCode) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">📱 스마트폰 미리보기</h2>
            <span className="text-sm text-gray-500">({productCode})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-colors"
            >
              <FiRefreshCw size={18} />
              새로고침 (캐시 무시)
            </button>
            <a
              href={`/products/${productCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              <FiExternalLink size={18} />
              새 탭에서 열기
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="닫기"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        {/* 스마트폰 미리보기 컨테이너 */}
        <div className="flex-1 overflow-auto relative bg-gray-100 flex items-center justify-center p-8">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">상품 페이지를 불러오는 중...</p>
                <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center p-8">
                <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">페이지를 불러올 수 없습니다</h3>
                <p className="text-gray-600 mb-4">상품이 저장되지 않았거나 페이지를 찾을 수 없습니다.</p>
                <div className="text-sm text-gray-500 mb-4">
                  <p>상품 코드: <span className="font-mono">{productCode}</span></p>
                </div>
                <a
                  href={`/products/${productCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  <FiExternalLink size={18} />
                  새 창에서 직접 열기
                </a>
              </div>
            </div>
          )}

          {!isLoading && !hasError && product && (
            <div className="bg-gray-800 rounded-[2.5rem] p-2 shadow-2xl" style={{ width: '375px', maxWidth: '100%' }}>
              {/* 아이폰 노치 */}
              <div className="bg-gray-800 rounded-t-[2rem] h-8 flex items-center justify-center">
                <div className="w-32 h-5 bg-black rounded-full"></div>
              </div>

              {/* 화면 */}
              <div className="bg-white rounded-[1.5rem] overflow-hidden relative" style={{ height: '812px', maxHeight: '90vh' }}>
                <div
                  key={`${refreshKey}-${forceRefresh}`}
                  className="w-full h-full overflow-y-auto"
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                  }}
                >
                  <div className="min-h-screen bg-gray-50" style={{ maxWidth: '375px' }}>
                    <div className="mobile-preview-wrapper" key={`preview-${refreshKey}-${forceRefresh}`}>
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
          )}

          {!isLoading && !hasError && !product && (
            <div className="text-center p-8">
              <p className="text-gray-600">상품 데이터를 불러올 수 없습니다.</p>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 font-semibold">📱 스마트폰 미리보기</p>
          <p className="text-xs text-gray-500">아이폰/삼성폰 기준</p>
        </div>
      </div>
    </div>
  );
}

