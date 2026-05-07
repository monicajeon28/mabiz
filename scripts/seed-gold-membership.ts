/**
 * seed-gold-membership.ts
 *
 * GMcruise 공유 DB에 GOLD_MEMBERSHIP CruiseProduct 레코드를 생성합니다.
 * ProductInquiry 테이블이 CruiseProduct.productCode에 FK 제약이 있으므로
 * 이 레코드 없이는 골드문의 기능이 동작하지 않습니다.
 *
 * 실행:
 *   npx tsx scripts/seed-gold-membership.ts
 *
 * 이미 존재하면 아무것도 하지 않습니다 (ON CONFLICT DO NOTHING).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 GOLD_MEMBERSHIP 시드 시작...");

  // 이미 존재하는지 확인
  const existing = await prisma.$queryRaw<{ id: number; productCode: string }[]>`
    SELECT id, "productCode"
    FROM "CruiseProduct"
    WHERE "productCode" = 'GOLD_MEMBERSHIP'
    LIMIT 1
  `;

  if (existing.length > 0) {
    console.log(`✅ 이미 존재합니다 (id=${existing[0].id}). 변경 없이 종료.`);
    return;
  }

  // 생성
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO "CruiseProduct" (
      "productCode",
      "cruiseLine",
      "shipName",
      "packageName",
      "nights",
      "days",
      "itineraryPattern",
      "saleStatus",
      "isPopular",
      "isRecommended",
      "isPremium",
      "isGeniePack",
      "isDomestic",
      "isJapan",
      "isBudget",
      "isUrgent",
      "isMainProduct",
      "updatedAt"
    )
    VALUES (
      'GOLD_MEMBERSHIP',
      '크루즈닷',
      '-',
      '골드회원권',
      0,
      0,
      '[]'::jsonb,
      '판매중',
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      NOW()
    )
    ON CONFLICT ("productCode") DO NOTHING
    RETURNING id
  `;

  if (rows.length > 0) {
    console.log(`✅ GOLD_MEMBERSHIP 생성 완료 (id=${rows[0].id})`);
  } else {
    // 경쟁 조건으로 다른 프로세스가 먼저 생성한 경우
    console.log("✅ ON CONFLICT — 이미 다른 프로세스가 생성했습니다.");
  }
}

main()
  .catch((e) => {
    console.error("❌ 시드 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
