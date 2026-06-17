-- AlterTable: CrmLandingPage에 b2bEduType 컬럼 추가
-- 허용값: 'INQUIRER' | 'BUYER' (애플리케이션 레벨에서 제한, NULL 허용)
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "b2bEduType" VARCHAR(20);
