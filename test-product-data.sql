-- 1. CruiseProduct 데이터 완전성 검사
SELECT
  id,
  productCode,
  packageName,
  cruiseLine,
  shipName,
  basePrice,
  maxPrice,
  saleStatus,
  days,
  nights,
  CASE WHEN basePrice IS NULL THEN 'MISSING' ELSE 'OK' END as basePrice_status,
  CASE WHEN description IS NULL THEN 'MISSING' ELSE 'OK' END as description_status,
  isActive,
  createdAt
FROM "CruiseProduct"
ORDER BY createdAt DESC
LIMIT 25;

-- 2. ProductPricePeriod 검사 (기간별 가격 정책)
SELECT
  ppp.id,
  ppp.cruiseProductId,
  cp.packageName,
  ppp.name,
  ppp.startDate,
  ppp.endDate,
  ppp.isActive,
  CASE WHEN ppp.startDate >= ppp.endDate THEN 'ERROR: Start >= End' ELSE 'OK' END as date_logic,
  ppp.discountRate,
  ppp.discountLabel
FROM "ProductPricePeriod" ppp
LEFT JOIN "CruiseProduct" cp ON ppp.cruiseProductId = cp.id
ORDER BY ppp.startDate DESC;

-- 3. ProductCabinPrice 데이터 (객실 유형별 가격)
SELECT
  pcp.id,
  pcp.productPricePeriodId,
  cp.packageName,
  pcp.cabinType,
  pcp.fareCategory,
  pcp.saleAmount,
  pcp.costAmount,
  CASE
    WHEN pcp.costAmount > pcp.saleAmount THEN 'ERROR: Cost > Sale'
    ELSE 'OK'
  END as price_logic
FROM "ProductCabinPrice" pcp
LEFT JOIN "ProductPricePeriod" ppp ON pcp.productPricePeriodId = ppp.id
LEFT JOIN "CruiseProduct" cp ON ppp.cruiseProductId = cp.id
ORDER BY pcp.productPricePeriodId, pcp.cabinType;

-- 4. Contact와 Product 연동 확인
SELECT
  c.id,
  c.phone,
  c.name,
  c.productName,
  c.lensMetadata ->> 'productId' as productId_in_metadata,
  c.departureDate,
  c.cruiseInterest,
  cp.packageName as actual_package_name,
  CASE
    WHEN c.productName IS NULL THEN 'NO_PRODUCT_ASSIGNED'
    WHEN c.productName NOT LIKE '%' THEN 'INVALID_NAME'
    ELSE 'OK'
  END as product_assignment_status
FROM "Contact" c
LEFT JOIN "CruiseProduct" cp ON c.productName = cp.packageName
WHERE c.organizationId IS NOT NULL
LIMIT 15;

-- 5. Cabin Type 가격 순서 검증 (Interior < OceanView < Balcony < Suite)
WITH cabin_prices AS (
  SELECT
    ppp.id as period_id,
    cp.packageName,
    pcp.cabinType,
    pcp.saleAmount,
    ROW_NUMBER() OVER (
      PARTITION BY ppp.id
      ORDER BY CASE pcp.cabinType
        WHEN 'Interior' THEN 1
        WHEN 'OceanView' THEN 2
        WHEN 'Balcony' THEN 3
        WHEN 'Suite' THEN 4
        ELSE 5
      END
    ) as expected_rank,
    ROW_NUMBER() OVER (
      PARTITION BY ppp.id
      ORDER BY pcp.saleAmount ASC
    ) as actual_rank
  FROM "ProductCabinPrice" pcp
  JOIN "ProductPricePeriod" ppp ON pcp.productPricePeriodId = ppp.id
  JOIN "CruiseProduct" cp ON ppp.cruiseProductId = cp.id
)
SELECT
  period_id,
  packageName,
  cabinType,
  saleAmount,
  expected_rank,
  actual_rank,
  CASE
    WHEN expected_rank = actual_rank THEN 'OK'
    ELSE 'PRICE_ORDER_MISMATCH'
  END as status
FROM cabin_prices
ORDER BY period_id, expected_rank;

-- 6. 상품 이미지 데이터 존재 여부
SELECT
  cp.id,
  cp.packageName,
  COUNT(pi.id) as image_count,
  CASE WHEN COUNT(pi.id) = 0 THEN 'NO_IMAGES' ELSE 'HAS_IMAGES' END as image_status
FROM "CruiseProduct" cp
LEFT JOIN "ProductImage" pi ON pi.cruiseProductId = cp.id
GROUP BY cp.id, cp.packageName
ORDER BY image_count ASC;

-- 7. 가격 정책 활성화 상태
SELECT
  cp.packageName,
  cp.saleStatus,
  cp.isActive,
  COUNT(DISTINCT ppp.id) as active_periods,
  MIN(ppp.startDate) as earliest_start,
  MAX(ppp.endDate) as latest_end
FROM "CruiseProduct" cp
LEFT JOIN "ProductPricePeriod" ppp ON ppp.cruiseProductId = cp.id AND ppp.isActive = true
WHERE cp.isActive = true
GROUP BY cp.id, cp.packageName, cp.saleStatus
ORDER BY cp.createdAt DESC;

-- 8. Contact 분배 현황 (상품별 할당 고객 수)
SELECT
  c.productName,
  COUNT(c.id) as contact_count,
  COUNT(DISTINCT c.lensMetadata ->> 'productId') as unique_product_ids
FROM "Contact" c
WHERE c.productName IS NOT NULL AND c.organizationId IS NOT NULL
GROUP BY c.productName
ORDER BY contact_count DESC;

-- 9. Day 0-3 SMS 발송 준비 상태
SELECT
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN smsDay0Sent = true THEN 1 END) as day0_sent,
  COUNT(CASE WHEN smsDay1Sent = true THEN 1 END) as day1_sent,
  COUNT(CASE WHEN smsDay2Sent = true THEN 1 END) as day2_sent,
  COUNT(CASE WHEN smsDay3Sent = true THEN 1 END) as day3_sent,
  COUNT(CASE WHEN departureDate IS NULL THEN 1 END) as missing_departure_date,
  COUNT(CASE WHEN productName IS NULL THEN 1 END) as missing_product_name
FROM "Contact"
WHERE organizationId IS NOT NULL;

-- 10. 메타데이터 검증
SELECT
  id,
  phone,
  name,
  productName,
  lensMetadata,
  CASE
    WHEN lensMetadata IS NULL THEN 'NO_METADATA'
    WHEN lensMetadata::text = '{}' THEN 'EMPTY_METADATA'
    WHEN lensMetadata ? 'productId' THEN 'HAS_PRODUCT_ID'
    ELSE 'INCOMPLETE_METADATA'
  END as metadata_status
FROM "Contact"
WHERE organizationId IS NOT NULL
LIMIT 15;
