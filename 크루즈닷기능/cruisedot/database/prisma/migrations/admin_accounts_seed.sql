-- 관리자 계정 생성/업데이트 마이그레이션
-- 모니카 (01024958013) 계정
UPDATE "User" SET
  role = 'admin',
  "deletedAt" = NULL
WHERE phone = '01024958013'
  AND "deletedAt" IS NULL;

-- 저스틴 (01038609161) 계정
UPDATE "User" SET
  role = 'admin',
  "deletedAt" = NULL
WHERE phone = '01038609161'
  AND "deletedAt" IS NULL;

-- 계정이 없으면 생성
INSERT INTO "User" (name, phone, password, email, role, "createdAt", "updatedAt")
SELECT '모니카', '01024958013', 'admin_temp_password', NULL, 'admin', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE phone = '01024958013');

INSERT INTO "User" (name, phone, password, email, role, "createdAt", "updatedAt")
SELECT '저스틴', '01038609161', 'admin_temp_password', NULL, 'admin', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE phone = '01038609161');
