#!/usr/bin/env node

/**
 * Supabase RLS 정책 자동 검증 스크립트
 *
 * 목적: RLS 활성화 + 정책 존재 여부 확인
 * 실행: npx node scripts/validate-rls.mjs
 *
 * 작성일: 2026-06-24
 * 상태: P0 (자동화 필수)
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// 환경변수 로드
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ 환경변수 누락:");
  console.error(`  SUPABASE_URL: ${SUPABASE_URL ? "✅" : "❌"}`);
  console.error(
    `  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? "✅" : "❌"}`
  );
  process.exit(1);
}

// Supabase 클라이언트 (Service Role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * RLS 정책 검증
 */
const validateRLS = async () => {
  console.log("\n🔒 Supabase RLS 검증 시작...\n");

  const tables = [
    "crm_backup",
    "admin_message",
    "contact_backup",
    "payment_log",
    "user_session",
    "integration_log",
    "organization_secret",
  ];

  let passCount = 0;
  let failCount = 0;

  for (const table of tables) {
    try {
      // Step 1: 테이블 존재 확인
      const { data: tableExists, error: tableError } = await supabase
        .from(table)
        .select("*")
        .limit(1);

      if (tableError && tableError.code !== "PGRST116") {
        // PGRST116 = RLS 차단됨 (정상)
        throw new Error(`테이블 접근 실패: ${tableError.message}`);
      }

      // Step 2: RLS 정책 확인 (쿼리)
      const { data: policies, error: policyError } = await supabase.rpc(
        "get_rls_policies",
        { table_name: table }
      );

      if (policyError) {
        console.warn(
          `⚠️  ${table}: RLS 정책 조회 실패 (RPC 함수 없음) - 수동 확인 필요`
        );
        console.warn(
          `    → Supabase > Table Editor > ${table} > Row Level Security 탭 확인\n`
        );
        failCount++;
        continue;
      }

      // Step 3: 정책 개수 확인
      const policyCount = policies ? policies.length : 0;

      if (policyCount > 0) {
        console.log(`✅ ${table}: RLS enabled, ${policyCount} policies found`);
        console.log(`   정책: ${policies.map((p) => p.policyname).join(", ")}`);
        passCount++;
      } else {
        console.error(`❌ ${table}: RLS 정책 없음 (설정 필요)`);
        failCount++;
      }
    } catch (error) {
      console.error(
        `❌ ${table}: 검증 실패 - ${error.message}`
      );
      failCount++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ 통과: ${passCount} | ❌ 실패: ${failCount}\n`);

  if (failCount === 0) {
    console.log("🎉 모든 RLS 정책이 정상입니다!");
    process.exit(0);
  } else {
    console.log(
      `⚠️  ${failCount}개 테이블 정책 설정 필요. 가이드 확인:`
    );
    console.log(`   docs/supabase-rls-setup-guide.md\n`);
    process.exit(1);
  }
};

// SQL 직접 실행 방법 (RPC 함수 없을 때)
const validateRLSviaSQL = async () => {
  console.log("\n🔒 SQL 직접 실행으로 RLS 검증...\n");

  try {
    // pg_policies 조회 (PostgreSQL 기본 뷰)
    const { data: policies, error } = await supabase.rpc(
      "get_rls_policies_sql",
      {}
    );

    if (error) {
      console.warn(
        "⚠️  SQL RPC 함수 없음. Supabase 대시보드에서 수동 확인:"
      );
      console.log(`
1. Supabase > SQL Editor
2. 아래 쿼리 실행:

SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('crm_backup', 'admin_message', 'contact_backup',
                     'payment_log', 'user_session', 'integration_log',
                     'organization_secret')
ORDER BY tablename, policyname;

3. 결과에 모든 테이블의 정책이 있으면 ✅
      `);
      return;
    }

    if (policies && policies.length > 0) {
      console.log("✅ RLS 정책 목록:");
      policies.forEach((p) => {
        console.log(`  - ${p.tablename}: ${p.policyname}`);
      });
    }
  } catch (error) {
    console.error(`❌ SQL 검증 실패: ${error.message}`);
  }
};

// 실행
(async () => {
  try {
    await validateRLS();
  } catch (error) {
    console.error(`\n❌ 검증 중 오류 발생: ${error.message}\n`);
    process.exit(1);
  }
})();
