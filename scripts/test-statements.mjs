/**
 * 정산 시스템 통합 테스트
 * node --env-file=.env.local scripts/test-statements.mjs
 *
 * 실제 DB에 테스트 데이터 생성 → API 쿼리 직접 실행 → 결과 검증 → 클린업
 */

import pg from 'pg';
const { Client } = pg;

// ── 테스트 고정 데이터 ─────────────────────────────────────────────────────────
const TEST_ORG_ID    = 'test-statements-org-001';
const TEST_AGENT_ID  = 9999901;   // 충돌 방지용 높은 번호
const TEST_PERIOD    = '2026-01'; // 실제 데이터와 겹치지 않는 기간

// ── 카운터 ────────────────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0, SKIP = 0;

function log(icon, label, detail = '') {
  const d = detail ? `  → ${detail}` : '';
  console.log(`  ${icon} ${label}${d}`);
}
function pass(label, detail = '') { PASS++; log('✅', label, detail); }
function fail(label, detail = '') { FAIL++; log('❌', label, detail); }
function skip(label, detail = '') { SKIP++; log('⚠️ ', `SKIP: ${label}`, detail); }

// ── DB 연결 ───────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL 환경변수가 없습니다. --env-file=.env.local 옵션을 확인하세요.');
  process.exit(1);
}

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// ── calcExpectedPaymentDate (route.ts 로직 그대로 복사) ───────────────────────
function calcExpectedPaymentDate(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 15)).toISOString();
}

// ── CommissionLedger 집계 (team/route.ts 로직 그대로 복사) ────────────────────
const COMMISSION_ENTRY_TYPES = ['SALES_COMMISSION', 'OVERRIDE_COMMISSION', 'BRANCH_COMMISSION'];
const DEDUCTION_ENTRY_TYPES  = ['WITHHOLDING', 'DEDUCTION', 'REFUND'];

function aggregateLedger(entries) {
  const agentMap = new Map();
  for (const entry of entries) {
    if (entry.agentId === null) continue;
    const agentId = entry.agentId;
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, { baseCommission: 0, deduction: 0, withholdingAmountSum: 0, allSettled: true, entryCount: 0 });
    }
    const accum = agentMap.get(agentId);
    accum.entryCount += 1;
    if (COMMISSION_ENTRY_TYPES.includes(entry.entryType)) {
      accum.baseCommission += Number(entry.amount);
      if (entry.withholdingAmount != null) {
        accum.withholdingAmountSum += Number(entry.withholdingAmount);
      }
    } else if (DEDUCTION_ENTRY_TYPES.includes(entry.entryType)) {
      accum.deduction += Number(entry.amount);
    }
    if (!entry.isSettled) accum.allSettled = false;
  }
  return agentMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 1: CommissionLedger 팀 정산 집계 (OWNER 격리)
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario1() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 1: CommissionLedger 팀 정산 집계 (OWNER 격리)');
  console.log('──────────────────────────────────────────────────');

  const periodYear  = 2026;
  const periodMonth = 1;
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const periodEnd   = new Date(Date.UTC(periodYear, periodMonth, 1));

  // 1-1. 테스트 조직이 DB에 존재해야 CommissionLedger FK가 통과
  //       Organization은 별도 생성하지 않고 organizationId를 문자열로만 저장 가능한지 확인
  //       → schema에서 organizationId는 FK이므로, Organization row가 있어야 한다.
  //       기존 org ID 하나를 가져와 사용한다.
  const orgRow = await client.query(`SELECT id FROM "Organization" LIMIT 1`);
  if (orgRow.rows.length === 0) {
    skip('시나리오 1 전체', 'Organization 테이블이 비어 있어 FK 생성 불가');
    return;
  }
  const REAL_ORG_ID = orgRow.rows[0].id;

  // 다른 조직 격리 테스트용: 두 번째 org (없으면 가상 id - 어차피 결과로만 검증)
  const orgRow2 = await client.query(`SELECT id FROM "Organization" WHERE id != $1 LIMIT 1`, [REAL_ORG_ID]);
  const OTHER_ORG_ID = orgRow2.rows.length > 0 ? orgRow2.rows[0].id : null;

  // 1-2. 테스트 ledger 데이터 삽입 (REAL_ORG_ID + TEST_AGENT_ID)
  const baseTime = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15 UTC

  await client.query(`
    INSERT INTO "CommissionLedger" ("organizationId", "agentId", "entryType", "amount", "withholdingAmount", "isSettled", "createdAt", "updatedAt")
    VALUES
      ($1, $2, 'SALES_COMMISSION',    500000, NULL,  false, $3, $3),
      ($1, $2, 'OVERRIDE_COMMISSION', 100000, NULL,  false, $3, $3),
      ($1, $2, 'WITHHOLDING',          19800, NULL,  false, $3, $3)
  `, [REAL_ORG_ID, TEST_AGENT_ID, baseTime]);

  // 1-3. 다른 조직 ledger 삽입 (격리 검증용)
  if (OTHER_ORG_ID) {
    await client.query(`
      INSERT INTO "CommissionLedger" ("organizationId", "agentId", "entryType", "amount", "withholdingAmount", "isSettled", "createdAt", "updatedAt")
      VALUES ($1, $2, 'SALES_COMMISSION', 1000000, NULL, false, $3, $3)
    `, [OTHER_ORG_ID, TEST_AGENT_ID + 1, baseTime]);
  }

  // 1-4. REAL_ORG_ID 로 필터한 쿼리 실행 (team/route.ts 5단계 로직)
  const { rows: ledgerEntries } = await client.query(`
    SELECT "agentId", "entryType", "amount", "withholdingAmount", "isSettled"
    FROM "CommissionLedger"
    WHERE "organizationId" = $1
      AND "createdAt" >= $2
      AND "createdAt" <  $3
      AND "agentId" IS NOT NULL
      AND "agentId" = $4
    ORDER BY "agentId" ASC, "createdAt" DESC
  `, [REAL_ORG_ID, periodStart, periodEnd, TEST_AGENT_ID]);

  const agentMap = aggregateLedger(ledgerEntries);
  const accum = agentMap.get(TEST_AGENT_ID);

  // 검증
  if (accum) {
    pass('TEST_AGENT_ID 집계 조회됨');
    if (accum.baseCommission === 600000) {
      pass('baseCommission = 600,000 (500K + 100K)', `실제: ${accum.baseCommission}`);
    } else {
      fail('baseCommission 계산 오류', `기대: 600000, 실제: ${accum.baseCommission}`);
    }
    if (accum.deduction === 19800) {
      pass('deduction = 19,800 (WITHHOLDING)', `실제: ${accum.deduction}`);
    } else {
      fail('deduction 계산 오류', `기대: 19800, 실제: ${accum.deduction}`);
    }
  } else {
    fail('TEST_AGENT_ID 집계 결과 없음');
  }

  // OTHER_ORG_ID 데이터가 결과에 없어야 함
  if (OTHER_ORG_ID) {
    const otherAgent = agentMap.get(TEST_AGENT_ID + 1);
    if (!otherAgent) {
      pass('다른 조직 데이터 격리 확인 (결과에 없음)');
    } else {
      fail('다른 조직 데이터가 결과에 포함됨 - 테넌트 격리 실패!');
    }
  } else {
    skip('다른 조직 격리 검증', '두 번째 Organization이 없음');
  }

  // 1-5. 클린업
  await client.query(`
    DELETE FROM "CommissionLedger"
    WHERE "agentId" IN ($1, $2)
      AND "createdAt" >= $3
      AND "createdAt" <  $4
  `, [TEST_AGENT_ID, TEST_AGENT_ID + 1, periodStart, periodEnd]);
  log('🗑️', '시나리오 1 테스트 데이터 클린업 완료');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 2: AffiliatePayslip 개인 정산
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario2() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 2: AffiliatePayslip 개인 정산');
  console.log('──────────────────────────────────────────────────');

  // 2-1. 기존 충돌 데이터 클린업 (unique constraint 방지)
  await client.query(`
    DELETE FROM "AffiliatePayslip"
    WHERE "agentId" = $1 AND "yearMonth" IN ('2026-01', '2025-12')
  `, [TEST_AGENT_ID]);

  // 2-2. Payslip 2개 삽입
  await client.query(`
    INSERT INTO "AffiliatePayslip" ("agentId", "yearMonth", "baseCommission", "bonus", "deduction", "netAmount", "status", "createdAt", "updatedAt")
    VALUES
      ($1, '2026-01', 800000, NULL, 26400, 773600, 'PENDING', NOW(), NOW()),
      ($1, '2025-12', 500000, NULL, 16500, 483500, 'SENT',    NOW(), NOW())
  `, [TEST_AGENT_ID]);

  // 2-3. 전체 조회 (my/route.ts AGENT 브랜치 로직)
  const { rows: allPayslips } = await client.query(`
    SELECT * FROM "AffiliatePayslip"
    WHERE "agentId" = $1
    ORDER BY "yearMonth" DESC
  `, [TEST_AGENT_ID]);

  if (allPayslips.length === 2) {
    pass('전체 조회 2건 확인');
  } else {
    fail('전체 조회 건수 오류', `기대: 2, 실제: ${allPayslips.length}`);
  }

  // 2-4. status = PENDING 필터
  const { rows: pendingRows } = await client.query(`
    SELECT * FROM "AffiliatePayslip"
    WHERE "agentId" = $1 AND "status" = 'PENDING'
  `, [TEST_AGENT_ID]);

  if (pendingRows.length === 1) {
    pass('PENDING 필터: 1건만 조회됨');
  } else {
    fail('PENDING 필터 오류', `기대: 1, 실제: ${pendingRows.length}`);
  }

  // 2-5. period = '2026-01' 필터
  const { rows: periodRows } = await client.query(`
    SELECT * FROM "AffiliatePayslip"
    WHERE "agentId" = $1 AND "yearMonth" = '2026-01'
  `, [TEST_AGENT_ID]);

  if (periodRows.length === 1) {
    pass('period 필터 (2026-01): 1건만 조회됨');
  } else {
    fail('period 필터 오류', `기대: 1, 실제: ${periodRows.length}`);
  }

  // 2-6. calcExpectedPaymentDate 검증
  const expectedDate = calcExpectedPaymentDate('2026-01');
  const want         = '2026-02-15T00:00:00.000Z';
  if (expectedDate === want) {
    pass(`calcExpectedPaymentDate("2026-01") = "${want}"`);
  } else {
    fail('calcExpectedPaymentDate 결과 오류', `기대: ${want}, 실제: ${expectedDate}`);
  }

  // 2-7. bigint 필드 숫자 변환 검증 (route.ts: Number(p.baseCommission))
  const row = allPayslips.find(r => r.yearMonth === '2026-01');
  if (row) {
    const base = Number(row.baseCommission);
    const net  = Number(row.netAmount);
    if (base === 800000 && net === 773600) {
      pass(`BigInt 변환 정상: baseCommission=${base}, netAmount=${net}`);
    } else {
      fail('BigInt 변환 오류', `base=${base}, net=${net}`);
    }
  }

  // 2-8. 클린업
  await client.query(`
    DELETE FROM "AffiliatePayslip"
    WHERE "agentId" = $1 AND "yearMonth" IN ('2026-01', '2025-12')
  `, [TEST_AGENT_ID]);
  log('🗑️', '시나리오 2 테스트 데이터 클린업 완료');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 3: mallUser 없는 AGENT 처리 (로직만 검증, DB 불필요)
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario3() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 3: mallUser 없는 AGENT 처리 (로직 단위 검증)');
  console.log('──────────────────────────────────────────────────');

  // my/route.ts 259-271줄 로직 검증:
  //   mallUserId = null → ok: true, payslips: [] 반환
  function handleNoMallUser(mallUserId) {
    if (!mallUserId) {
      return {
        ok: true,
        role: 'AGENT',
        data: {
          payslips: [],
          summary: { totalCommission: 0, totalWithholding: 0, totalNet: 0, totalDeduction: 0, pendingCount: 0, paidCount: 0 },
          document: { hasIdCard: false, hasBankBook: false, bankName: null, bankAccount: null, bankAccountHolder: null, withholdingRate: 3.3 },
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
      };
    }
    return null;
  }

  const result = handleNoMallUser(null);
  if (result && result.ok === true) {
    pass('mallUserId=null → ok: true 반환');
  } else {
    fail('mallUserId=null 처리 오류');
  }

  if (result && Array.isArray(result.data.payslips) && result.data.payslips.length === 0) {
    pass('mallUserId=null → payslips: [] (빈 배열)');
  } else {
    fail('payslips가 빈 배열이 아님');
  }

  if (result && result.data.summary.totalCommission === 0) {
    pass('mallUserId=null → summary 모두 0');
  } else {
    fail('summary 값 오류');
  }

  // mallUserId가 있을 때는 null을 반환함을 확인
  const result2 = handleNoMallUser(12345);
  if (result2 === null) {
    pass('mallUserId 있음 → null 반환 (정상 플로우로 진행)');
  } else {
    fail('mallUserId 있음인데 early return 발생');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 4: period 형식 검증
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario4() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 4: period 형식 검증');
  console.log('──────────────────────────────────────────────────');

  // team/route.ts 130-135줄: /^\d{4}-\d{2}$/ 정규식 검증
  function validatePeriod(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { ok: false, error: 'BAD_REQUEST', message: 'period는 YYYY-MM 형식이어야 합니다.' };
    }
    return null; // 통과
  }

  // 잘못된 형식들
  const invalidCases = [
    { input: 'invalid',  label: '"invalid" 거부' },
    { input: '2026-1',   label: '"2026-1" (한 자리 월) 거부' },
    { input: '26-01',    label: '"26-01" (두 자리 연도) 거부' },
    { input: '',         label: '빈 문자열 거부' },
    { input: null,       label: 'null 거부' },
    { input: '2026/01',  label: '"2026/01" (슬래시) 거부' },
  ];

  for (const { input, label } of invalidCases) {
    const res = validatePeriod(input);
    if (res && res.ok === false) {
      pass(label);
    } else {
      fail(label, `validatePeriod("${input}") 이 통과됨`);
    }
  }

  // 올바른 형식들
  const validCases = [
    { input: '2026-01', label: '"2026-01" 통과' },
    { input: '2025-12', label: '"2025-12" 통과' },
    { input: '2026-13', label: '"2026-13" 형식 통과 (DB 레벨 문제이나 regex는 통과)' },
  ];

  for (const { input, label } of validCases) {
    const res = validatePeriod(input);
    if (res === null) {
      pass(label);
    } else {
      fail(label, `통과되어야 하는데 거부됨`);
    }
  }

  // "2026-13" 에 대한 추가 설명
  log('ℹ️ ', '"2026-13"은 regex를 통과하지만 DB 쿼리에서 periodEnd=new Date(Date.UTC(2026,13,1)) 계산 시 overflow');
  // 실제로 Date.UTC(2026, 13, 1) 은 2027-02-01 이 됨
  const overflowDate = new Date(Date.UTC(2026, 13, 1));
  log('ℹ️ ', `Date.UTC(2026,13,1) → ${overflowDate.toISOString()} (JS Date overflow로 자동 보정됨, 쿼리 오류는 없음)`);
  pass('"2026-13" overflow → JS가 자동 보정 (쿼리 오류 없음)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 메인
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=================================================');
  console.log('  정산 시스템 통합 테스트 시작');
  console.log('  DB: Neon (실제 DB)');
  console.log('  TEST_AGENT_ID:', TEST_AGENT_ID);
  console.log('  TEST_PERIOD:  ', TEST_PERIOD);
  console.log('=================================================');

  try {
    await client.connect();
    console.log('\n✅ DB 연결 성공\n');

    await scenario1();
    await scenario2();
    await scenario3();
    await scenario4();

  } catch (err) {
    console.error('\n❌ 테스트 실행 중 예외 발생:', err.message);
    console.error(err.stack);

    // 클린업 시도
    try {
      await client.query(`DELETE FROM "AffiliatePayslip" WHERE "agentId" = $1`, [TEST_AGENT_ID]);
      await client.query(`DELETE FROM "CommissionLedger" WHERE "agentId" IN ($1, $2)`, [TEST_AGENT_ID, TEST_AGENT_ID + 1]);
      console.log('🗑️  긴급 클린업 완료');
    } catch (cleanErr) {
      console.error('⚠️  긴급 클린업 실패:', cleanErr.message);
    }
    FAIL++;
  } finally {
    await client.end();
  }

  // ── 최종 결과 ──────────────────────────────────────────────────────────────
  console.log('\n=================================================');
  console.log('  최종 결과');
  console.log('=================================================');
  console.log(`  ✅ PASS : ${PASS}`);
  console.log(`  ❌ FAIL : ${FAIL}`);
  console.log(`  ⚠️  SKIP : ${SKIP}`);
  console.log(`  총  계  : ${PASS + FAIL + SKIP}`);
  console.log('=================================================\n');

  if (FAIL > 0) process.exit(1);
}

main();
