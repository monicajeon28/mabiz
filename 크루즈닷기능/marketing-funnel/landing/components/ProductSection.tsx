'use client';

import React from 'react';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Zod 검증 스키마
const productPurchaseConfigSchema = z.object({
  enabled: z.boolean().optional(),
  paymentProvider: z.string().optional(),
  productName: z.string().max(100).optional(),
  sellingPrice: z.number().nonnegative().nullable().optional(),
  useQuantity: z.boolean().optional(),
  purchaseQuantity: z.number().int().nonnegative().nullable().optional(),
  paymentType: z.string().optional(),
  paymentGroupId: z.number().int().nullable().optional(),
  dbGroupId: z.number().int().nullable().optional(),
});

type ProductPurchaseConfig = z.infer<typeof productPurchaseConfigSchema>;

interface ProductSectionProps {
  show: boolean;
  productPurchase: ProductPurchaseConfig | null;
}

/**
 * ProductSection - 제품 구매 정보 섹션
 * 단일 책임: 상품 정보 표시
 *
 * 보안:
 * - 모든 입력값 Zod 검증
 * - 수치형 데이터 타입 안전
 */
function ProductSection({ show, productPurchase }: ProductSectionProps) {
  if (!show || !productPurchase) return null;

  // Zod 검증
  const validated = productPurchaseConfigSchema.safeParse(productPurchase);
  if (!validated.success) {
    logger.error('Invalid product config', { error: validated.error.message });
    return null;
  }

  const config = validated.data;

  return (
    <section className="lp-card">
      <div className="lp-section-label">상품</div>
      <h2 className="lp-section-title">{config.productName || '골드회원권'}</h2>

      {/* 가격 표시 */}
      {config.sellingPrice !== undefined && config.sellingPrice !== null && (
        <div className="lp-product-card">
          <div className="lp-product-price">
            {config.sellingPrice.toLocaleString('ko-KR')}원
          </div>
        </div>
      )}

      {/* 추가 정보 */}
      {(config.paymentProvider || config.paymentType) && (
        <dl className="lp-product-meta">
          {config.paymentProvider && (
            <>
              <dt>결제 수단</dt>
              <dd>{config.paymentProvider}</dd>
            </>
          )}
          {config.paymentType && (
            <>
              <dt>결제 유형</dt>
              <dd>{config.paymentType}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

export default React.memo(ProductSection);
