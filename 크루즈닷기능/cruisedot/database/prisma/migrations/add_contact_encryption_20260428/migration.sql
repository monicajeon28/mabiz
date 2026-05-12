-- Contact 테이블에 암호화 필드 추가 (Lazy migration)
-- Phase 1: 새 암호화 필드 추가 (기존 필드 유지)

ALTER TABLE "Contact" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "Contact" ADD COLUMN "phoneHash" TEXT;
ALTER TABLE "Contact" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "Contact" ADD COLUMN "nameEncrypted" TEXT;

-- phoneHash는 쿼리용 인덱스 (같은 전화번호는 같은 해시값)
CREATE INDEX "Contact_phoneHash_organizationId_idx" ON "Contact"("phoneHash", "organizationId");

-- 데이터 마이그레이션: 기존 plaintext 데이터를 암호화 필드로 복사 (백그라운드 작업)
-- 주석: 프로덕션 배포 후 별도의 background job으로 실행
-- UPDATE "Contact" SET
--   "phoneEncrypted" = ...,  -- 암호화 로직
--   "phoneHash" = ...,       -- 해시 로직
--   "emailEncrypted" = ...,
--   "nameEncrypted" = ...
-- WHERE "phoneEncrypted" IS NULL AND "phone" IS NOT NULL;
