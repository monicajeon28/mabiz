#!/usr/bin/env node

/**
 * B2BLandingPage → CrmLandingPage 데이터 이관 스크립트
 *
 * 실행 방법:
 *   dotenvx run -- node scripts/migrate-b2b-to-landing.mjs
 *
 * 전제 조건:
 *   - DATABASE_URL 환경변수가 설정되어 있어야 함 (.env.local)
 *   - CrmLandingPage, CrmLandingRegistration, ShortLink 테이블이 존재해야 함
 *   - npx prisma generate가 완료된 상태여야 함
 *
 * 이관 대상:
 *   1. CrmB2BLandingPage → CrmLandingPage (slug 자동 생성, b2bEduType="general")
 *   2. CrmB2BLandingRegistration → CrmLandingRegistration (landingPageId 매핑)
 *   3. ShortLink.targetUrl 업데이트 (/b2b-landing/{id} → /landing-pages/{newId})
 *
 * 이관 후 검증:
 *   - 이관된 레코드 수 출력
 *   - 실패한 레코드는 errors 배열에 수집
 *   - 중복 slug 충돌 시 suffix(-2, -3, ...) 자동 부여
 */

import pg from 'pg';
import { createId } from '@paralleldrive/cuid2';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 없습니다. dotenvx run -- node 로 실행하세요.');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

/**
 * 슬러그 생성: 제목 → 소문자-하이픈 형식 (최대 60자)
 */
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'b2b-page';
}

/**
 * 조직 내 slug 중복 방지: 충돌 시 suffix 부여
 */
async function resolveUniqueSlug(baseSlug, organizationId, existingSlugs) {
  const key = `${organizationId}::${baseSlug}`;
  if (!existingSlugs.has(key)) {
    existingSlugs.add(key);
    return baseSlug;
  }
  let counter = 2;
  while (true) {
    const candidate = `${baseSlug}-${counter}`;
    const candidateKey = `${organizationId}::${candidate}`;
    if (!existingSlugs.has(candidateKey)) {
      existingSlugs.add(candidateKey);
      return candidate;
    }
    counter++;
  }
}

async function main() {
  console.log('🚀 B2B → CrmLandingPage 이관 시작...\n');

  await client.connect();

  // ── 1. 기존 CrmLandingPage slug 목록 로드 (중복 방지용)
  const { rows: existingPages } = await client.query(
    'SELECT "organizationId", slug FROM "CrmLandingPage"'
  );
  const existingSlugs = new Set(
    existingPages.map((r) => `${r.organizationId}::${r.slug}`)
  );
  console.log(`📋 기존 CrmLandingPage: ${existingPages.length}개`);

  // ── 2. B2BLandingPage 전체 조회
  const { rows: b2bPages } = await client.query(
    `SELECT * FROM "CrmB2BLandingPage" ORDER BY "createdAt" ASC`
  );
  console.log(`📦 이관 대상 B2BLandingPage: ${b2bPages.length}개\n`);

  if (b2bPages.length === 0) {
    console.log('✅ 이관할 B2BLandingPage 없음. 종료.');
    await client.end();
    return;
  }

  // ── 3. B2BLandingPage → CrmLandingPage 이관
  const idMap = new Map(); // b2bPageId → newCrmPageId
  const pageErrors = [];
  let pageSuccess = 0;

  for (const b2b of b2bPages) {
    try {
      const newId = createId();
      const baseSlug = titleToSlug(b2b.title || 'b2b-page');
      const slug = await resolveUniqueSlug(baseSlug, b2b.organizationId, existingSlugs);

      await client.query(
        `INSERT INTO "CrmLandingPage" (
          id, "organizationId", title, slug,
          "htmlContent", "isActive", "isPublic", "viewCount",
          "autoFunnelId", "groupId", "commentEnabled",
          "editorMode", "formConfig", "footerText",
          "paymentEnabled", "paymentType", "productName",
          "productPrice", "cycleDay", "expireDate",
          "regEmailEnabled", "regEmailSubject", "regEmailContent",
          "exposureTitle", "exposureImage", "buttonTitle",
          "completionPageUrl", "headerScript", description,
          "createdByUserId", "b2bEduType",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, true, $7,
          $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28,
          $29, 'general',
          $30, $31
        )`,
        [
          newId, b2b.organizationId, b2b.title, slug,
          b2b.htmlContent, b2b.isActive, b2b.viewCount,
          b2b.autoFunnelId, b2b.groupId, b2b.commentEnabled,
          b2b.editorMode, b2b.formConfig ? JSON.stringify(b2b.formConfig) : null,
          b2b.footerText,
          b2b.paymentEnabled, b2b.paymentType, b2b.productName,
          b2b.productPrice, b2b.cycleDay, b2b.expireDate,
          b2b.regEmailEnabled, b2b.regEmailSubject, b2b.regEmailContent,
          b2b.exposureTitle, b2b.exposureImage, b2b.buttonTitle,
          b2b.completionPageUrl, b2b.headerScript, b2b.description,
          b2b.createdByUserId,
          b2b.createdAt, b2b.updatedAt,
        ]
      );

      idMap.set(b2b.id, newId);
      pageSuccess++;
      console.log(`  ✅ [${pageSuccess}/${b2bPages.length}] "${b2b.title}" → slug: ${slug}`);
    } catch (err) {
      pageErrors.push({ id: b2b.id, title: b2b.title, error: err.message });
      console.error(`  ❌ "${b2b.title}" 이관 실패: ${err.message}`);
    }
  }

  console.log(`\n📊 LandingPage 이관 결과: 성공 ${pageSuccess}개 / 실패 ${pageErrors.length}개\n`);

  // ── 4. B2BLandingRegistration → CrmLandingRegistration 이관
  const { rows: b2bRegs } = await client.query(
    `SELECT * FROM "CrmB2BLandingRegistration" ORDER BY "createdAt" ASC`
  );
  console.log(`📦 이관 대상 B2BLandingRegistration: ${b2bRegs.length}개`);

  const regErrors = [];
  let regSuccess = 0;

  for (const reg of b2bRegs) {
    const newLandingPageId = idMap.get(reg.landingPageId);
    if (!newLandingPageId) {
      regErrors.push({ id: reg.id, reason: `부모 페이지 이관 실패 (landingPageId: ${reg.landingPageId})` });
      continue;
    }

    try {
      await client.query(
        `INSERT INTO "CrmLandingRegistration" (
          id, "landingPageId", name, phone, email,
          "utmSource", "utmMedium", "utmCampaign",
          metadata, "funnelStarted", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11
        )
        ON CONFLICT ("landingPageId", phone) DO NOTHING`,
        [
          reg.id, newLandingPageId, reg.name, reg.phone, reg.email,
          reg.utmSource, reg.utmMedium, reg.utmCampaign,
          reg.metadata ? JSON.stringify(reg.metadata) : null,
          reg.funnelStarted, reg.createdAt,
        ]
      );
      regSuccess++;
    } catch (err) {
      regErrors.push({ id: reg.id, phone: reg.phone, error: err.message });
      console.error(`  ❌ 신청자 ${reg.phone} 이관 실패: ${err.message}`);
    }
  }

  console.log(`📊 Registration 이관 결과: 성공 ${regSuccess}개 / 실패 ${regErrors.length}개\n`);

  // ── 5. ShortLink targetUrl 업데이트 (/b2b-landing/{id} → /landing-pages/{newId})
  console.log('🔗 ShortLink targetUrl 업데이트 중...');
  let linkUpdated = 0;

  for (const [oldId, newId] of idMap.entries()) {
    const oldPattern = `/b2b-landing/${oldId}`;
    const newUrl = `/landing-pages/${newId}`;

    const { rowCount } = await client.query(
      `UPDATE "ShortLink"
       SET "targetUrl" = REPLACE("targetUrl", $1, $2)
       WHERE "targetUrl" LIKE $3`,
      [oldPattern, newUrl, `%${oldPattern}%`]
    );
    linkUpdated += rowCount ?? 0;
  }

  console.log(`📊 ShortLink 업데이트: ${linkUpdated}건\n`);

  // ── 6. 최종 결과 출력
  console.log('══════════════════════════════════════════');
  console.log('✅ 이관 완료 요약');
  console.log(`   LandingPage  성공: ${pageSuccess}개 / 실패: ${pageErrors.length}개`);
  console.log(`   Registration 성공: ${regSuccess}개 / 실패: ${regErrors.length}개`);
  console.log(`   ShortLink 업데이트: ${linkUpdated}건`);

  if (pageErrors.length > 0) {
    console.log('\n⚠️ LandingPage 이관 실패 목록:');
    pageErrors.forEach((e) => console.log(`  - [${e.id}] ${e.title}: ${e.error}`));
  }
  if (regErrors.length > 0) {
    console.log('\n⚠️ Registration 이관 실패 목록:');
    regErrors.forEach((e) => console.log(`  - [${e.id}]: ${e.reason || e.error}`));
  }

  console.log('\n⚠️ 주의: 이관 후 B2BLandingPage 테이블은 수동으로 아카이브/삭제하세요.');
  console.log('══════════════════════════════════════════');

  await client.end();
}

main().catch((err) => {
  console.error('💥 치명적 오류:', err);
  process.exit(1);
});
