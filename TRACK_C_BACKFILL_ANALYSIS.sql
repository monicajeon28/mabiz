-- Phase 3 Track C: Contact 백필 데이터 분석
-- 기존 고객 2000명 중 필수 필드 미입력 비율 분석

-- 전체 통계: marriageDate 미입력 비율
SELECT
  COUNT(*) as total_contacts,
  SUM(CASE WHEN "marriageDate" IS NULL THEN 1 ELSE 0 END) as missing_marriage_date,
  ROUND(100.0 * SUM(CASE WHEN "marriageDate" IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as missing_marriage_date_percent,
  SUM(CASE WHEN "ageInYears" IS NULL THEN 1 ELSE 0 END) as missing_age_in_years,
  ROUND(100.0 * SUM(CASE WHEN "ageInYears" IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as missing_age_in_years_percent,
  SUM(CASE WHEN "marriageStatus" IS NULL THEN 1 ELSE 0 END) as missing_marriage_status,
  ROUND(100.0 * SUM(CASE WHEN "marriageStatus" IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as missing_marriage_status_percent
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 세그먼트별 필드 완성도 분석
SELECT
  COUNT(*) as total_contacts,
  -- Priority 1: 신혼 (결혼 2년 이내)
  SUM(CASE
    WHEN "marriageStatus" = 'married'
      AND "marriageDate" IS NOT NULL
      AND ("ageInYears" IS NOT NULL OR "age" IS NOT NULL)
    THEN 1 ELSE 0
  END) as potential_segment_A,

  -- Priority 2: 자녀 10-15세
  SUM(CASE
    WHEN "childrenAges" IS NOT NULL
      AND array_length("childrenAges", 1) > 0
      AND ("ageInYears" IS NOT NULL OR "age" IS NOT NULL)
    THEN 1 ELSE 0
  END) as potential_segment_B,

  -- Priority 3: 40-55세 + 자녀 독립/미보유
  SUM(CASE
    WHEN ("ageInYears" IS NOT NULL OR "age" IS NOT NULL)
      AND ("ageInYears" >= 40 AND "ageInYears" <= 55
        OR "age" >= 40 AND "age" <= 55)
    THEN 1 ELSE 0
  END) as potential_segment_C,

  -- Priority 4: 55세 이상
  SUM(CASE
    WHEN ("ageInYears" IS NOT NULL AND "ageInYears" > 55
      OR "age" IS NOT NULL AND "age" > 55)
    THEN 1 ELSE 0
  END) as potential_segment_D,

  -- 분류 불가능 (필수 필드 부족)
  SUM(CASE
    WHEN "marriageStatus" IS NULL
      OR ("ageInYears" IS NULL AND "age" IS NULL)
    THEN 1 ELSE 0
  END) as unclassifiable_contacts
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 조직별 백필 상태 (상위 10개 조직)
SELECT
  org.id,
  org.name,
  COUNT(c.id) as total_contacts,
  SUM(CASE WHEN c."marriageDate" IS NULL THEN 1 ELSE 0 END) as missing_marriage_date,
  SUM(CASE WHEN c."ageInYears" IS NULL THEN 1 ELSE 0 END) as missing_age_in_years,
  SUM(CASE WHEN c."marriageStatus" IS NULL THEN 1 ELSE 0 END) as missing_marriage_status,
  ROUND(100.0 * SUM(CASE WHEN c."marriageDate" IS NULL THEN 1 ELSE 0 END) / COUNT(c.id), 1) as marriage_date_missing_pct
FROM "Organization" org
LEFT JOIN "Contact" c ON c."organizationId" = org.id AND c."deletedAt" IS NULL
GROUP BY org.id, org.name
HAVING COUNT(c.id) > 0
ORDER BY COUNT(c.id) DESC
LIMIT 10;

-- 필드별 채우기 곡선 분석 (월별)
SELECT
  DATE_TRUNC('month', c."createdAt")::date as month,
  COUNT(*) as created_contacts,
  SUM(CASE WHEN c."marriageStatus" IS NOT NULL THEN 1 ELSE 0 END) as with_marriage_status,
  SUM(CASE WHEN c."ageInYears" IS NOT NULL THEN 1 ELSE 0 END) as with_age_in_years,
  SUM(CASE WHEN c."marriageDate" IS NOT NULL THEN 1 ELSE 0 END) as with_marriage_date,
  SUM(CASE WHEN c."childrenAges" IS NOT NULL AND array_length(c."childrenAges", 1) > 0 THEN 1 ELSE 0 END) as with_children_ages
FROM "Contact" c
WHERE c."deletedAt" IS NULL
GROUP BY DATE_TRUNC('month', c."createdAt")
ORDER BY month DESC
LIMIT 12;
