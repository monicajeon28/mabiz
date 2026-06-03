/**
 * Supabase RLS 자동 활성화 스크립트
 * 실행: node scripts/enable-supabase-rls.mjs
 * 필요: .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local 읽기
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/)
  if (match) env[match[1]] = match[2]
}

const SUPABASE_URL = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ .env.local 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// pgmeta API로 테이블 목록 조회 후 RLS 활성화
async function enableRLS() {
  console.log(`\n🔐 Supabase RLS 활성화 시작`)
  console.log(`   URL: ${SUPABASE_URL.substring(0, 40)}...`)

  // 방법 1: pgmeta query 엔드포인트
  const pgQueryUrl = `${SUPABASE_URL}/pg/query`
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  }

  // 테이블 목록 조회
  const listRes = await fetch(pgQueryUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    })
  })

  if (!listRes.ok) {
    console.log(`⚠️  pgmeta 직접 쿼리 불가 (${listRes.status}) — Supabase SQL Editor에서 실행 필요`)
    console.log('\n📋 아래 SQL을 Supabase Dashboard → SQL Editor에 붙여넣어 실행하세요:\n')
    console.log('=' .repeat(60))
    console.log(`DO $$
DECLARE tbl text; cnt int := 0;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE 'RLS 활성화 완료: % 개 테이블', cnt;
END $$;

SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`)
    console.log('=' .repeat(60))
    console.log('\n✅ 실행 후 모든 rls_enabled = true 확인하면 완료')
    return
  }

  const tables = await listRes.json()
  const disabledTables = tables.filter(t => !t.rowsecurity)

  console.log(`\n📊 전체 테이블: ${tables.length}개`)
  console.log(`   RLS 꺼진 테이블: ${disabledTables.length}개`)

  if (disabledTables.length === 0) {
    console.log('✅ 모든 테이블에 RLS가 이미 활성화되어 있습니다!')
    return
  }

  // 각 테이블 RLS 활성화
  let success = 0, failed = 0
  for (const table of disabledTables) {
    const res = await fetch(pgQueryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `ALTER TABLE public."${table.tablename}" ENABLE ROW LEVEL SECURITY`
      })
    })
    if (res.ok) {
      console.log(`✅ RLS 활성화: ${table.tablename}`)
      success++
    } else {
      console.log(`❌ 실패: ${table.tablename} (${res.status})`)
      failed++
    }
  }

  console.log(`\n🎉 완료: 성공 ${success}개 / 실패 ${failed}개`)
}

enableRLS().catch(e => {
  console.error('오류:', e.message)
  process.exit(1)
})
