'use client';

import React from 'react';
import { z } from 'zod';

// Zod 검증 스키마
const errorSchema = z.object({
  message: z.string().min(1).max(500),
});

interface AffiliateErrorDisplayProps {
  error: string | null;
}

/**
 * AffiliateErrorDisplay - 제휴 링크 검증 오류 메시지
 * 단일 책임: 오류 메시지 렌더링 (XSS 방지)
 *
 * 보안:
 * - 메시지는 500자 이하로 제한
 * - 부모 컴포넌트에서 검증된 문자열만 수용
 * - 직접 HTML 인젝션 불가능 (텍스트 컨텐츠만)
 */
function AffiliateErrorDisplay({ error }: AffiliateErrorDisplayProps) {
  if (!error) return null;

  // 입력 검증
  const validated = errorSchema.safeParse({ message: error });
  if (!validated.success) {
    // 검증 실패: 오류 렌더링 안함
    return null;
  }

  const safeMessage = validated.data.message;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: '16px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        color: '#991b1b',
        marginBottom: '16px',
        fontSize: '14px',
      }}
    >
      {safeMessage}
    </div>
  );
}

export default React.memo(AffiliateErrorDisplay);
