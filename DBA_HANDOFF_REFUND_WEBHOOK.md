# DBA 인수문: 환불 웹훅 DB 스키마 마이그레이션

**Commit:** `fdcdf82` - fix(webhooks): P0 Commission 100% 취소 - 크루즈닷몰/페이앱 환불 연동

## 1. 개요
- 크루즈닷몰(B2C) 환불 및 페이앱(B2B) 결제 취소 시 파트너 수당을 100% 자동 취소하는 기능 구현
- Prisma 스키마 정의 완료, 애플리케이션 코드 배포 준비 완료
- **DB 마이그레이션만 DBA 담당**

## 2. 새로운 필드 (총 8개)

### A. AffiliateSale 테이블 (CrmAffiliateSale)
| 필드명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `refundedAmount` | INTEGER | 0 | 환불된 금액 (원) |
| `refundedAt` | TIMESTAMP | NULL | 환불 처리 일시 |
| `cancelledAt` | TIMESTAMP | NULL | 취소 처리 일시 (이전 호환성용) |
| `cancelReason` | VARCHAR(255) | NULL | 취소 사유 (예: CUSTOMER_REFUND_REQUEST, PAYMENT_CANCELLED_PAYAPP) |

### B. Contact 테이블
| 필드명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `lastPaymentStatus` | VARCHAR(20) | NULL | 최근 결제상태 (paid, cancelled, refunded) |
| `lastPaymentAt` | TIMESTAMP | NULL | 최근 결제 일시 |
| `lastRefundedAt` | TIMESTAMP | NULL | 최근 환불 일시 |
| `paymentStatusNote` | VARCHAR(255) | NULL | 결제상태 메모 (예: "환불완료: 1,500,000원") |

## 3. SQL 마이그레이션 스크립트

```sql
-- ========================================
-- 1. AffiliateSale (CrmAffiliateSale) 테이블 수정
-- ========================================
ALTER TABLE "CrmAffiliateSale"
ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "cancelReason" VARCHAR(255);

-- AffiliateSale 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_refunded_at" ON "CrmAffiliateSale"("refundedAt");

-- ========================================
-- 2. Contact 테이블 수정
-- ========================================
ALTER TABLE "Contact"
ADD COLUMN IF NOT EXISTS "lastPaymentStatus" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "lastRefundedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "paymentStatusNote" VARCHAR(255);

-- Contact 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_contact_org_payment_status" ON "Contact"("organizationId", "lastPaymentStatus");

-- ========================================
-- 3. 마이그레이션 검증
-- ========================================
-- 각 테이블 구조 확인
\d+ "CrmAffiliateSale"
\d+ "Contact"

-- 인덱스 확인
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename IN ('CrmAffiliateSale', 'Contact') 
ORDER BY tablename, indexname;
```

## 4. 마이그레이션 전 체크리스트

- [ ] Neon 프로덕션 DB에 접속 확인
- [ ] 백업 생성 (또는 백업 프로세스 확인)
- [ ] 다른 마이그레이션 진행 중인지 확인
- [ ] 테스트 환경(staging)에서 먼저 실행 (선택사항)

## 5. 마이그레이션 후 검증

```sql
-- 필드 추가 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('CrmAffiliateSale', 'Contact')
  AND column_name IN ('refundedAmount', 'refundedAt', 'cancelReason', 
                       'lastPaymentStatus', 'lastPaymentAt', 'lastRefundedAt', 'paymentStatusNote')
ORDER BY table_name, ordinal_position;

-- 인덱스 생성 확인
SELECT indexname, indexdef FROM pg_indexes 
WHERE indexname LIKE '%refunded_at%' OR indexname LIKE '%payment_status%';

-- 데이터 무결성 확인 (선택)
SELECT COUNT(*) FROM "CrmAffiliateSale" WHERE "refundedAt" IS NOT NULL;
SELECT COUNT(*) FROM "Contact" WHERE "lastPaymentStatus" IS NOT NULL;
```

## 6. 애플리케이션 배포 순서

1. **✅ 완료**: Prisma Client 재생성 (`npx prisma generate`)
2. **✅ 완료**: 코드 커밋 (`fdcdf82`)
3. **⏳ DBA 작업**: DB 마이그레이션 실행
4. **⏳ DevOps 작업**: 애플리케이션 배포 (Vercel 또는 해당 환경)
5. **⏳ QA 작업**: 환불 웹훅 통합 테스트

## 7. 웹훅 동작 흐름 (참고용)

### A. 크루즈닷몰 환불 웹훅 (`POST /api/webhooks/refund`)
```
1. 크루즈닷몰에서 환불 완료 → 웹훅 발송
2. CRM 수신:
   - orderId로 Contact 찾기
   - orderId로 AffiliateSale 찾기
   - 트랜잭션 내에서 동시 처리:
     a) Contact 상태 → REFUNDED, lastPaymentStatus='refunded'
     b) AffiliateSale.commissionAmount → 0 (100% 취소)
     c) AffiliateSale.refundedAmount = saleAmount
     d) AffiliateSale.status = 'REFUNDED'
3. 환불 로그 기록 → 파트너 대시보드에 반영
```

### B. 페이앱 결제 취소 웹훅 (`POST /api/webhooks/payapp`)
```
pay_state = 8, 9, 16, 32, 64 (취소)
→ AffiliateSale.commissionAmount → 0 (100%)

pay_state = 70, 71 (부분 취소)
→ AffiliateSale.commissionAmount -= (환불액 비율 × 원래 수당)
→ AffiliateSale.status = 'PARTIAL_REFUNDED'
```

## 8. 주의사항

1. **중복 필드명 주의**: `cancelledAt` 필드는 이전 코드와의 호환성을 위해 유지 (현재는 사용하지 않음)
2. **인덱스 성능**: `lastPaymentStatus`는 조직별 Contact 필터링에 자주 사용되므로 인덱스 필수
3. **NULL 안전성**: 모든 새 필드는 NULL 가능 (기존 데이터는 NULL, 신규 환불부터 채워짐)
4. **동시성**: 웹훅은 트랜잭션 내에서 처리되므로 레이스 컨디션 우려 없음

## 9. 문의 연락처

- **개발**: monicajeon28@gmail.com
- **코드 리뷰**: Commit `fdcdf82` 참고
- **테스트 시나리오**: P2_REFUND_NOTIFICATION_IMPLEMENTATION.md 참고

---
**최종 업데이트**: 2026-05-20
**상태**: 🟢 DBA 인수 대기
