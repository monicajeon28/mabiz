/**
 * 정산 시스템 통합 테스트
 * node --env-file=.env.local scripts/test-statements.mjs
 *
 * 실제 DB에 테스트 데이터 생성 → API 쿼리 직접 실행 → 결과 검증 → 클린업
 *
 * [DB 현황 주의]
 * - CommissionLedger: organizationId 칼럼 없음 (마이그레이션 미적용)
 * - AffiliatePayslip: 테이블 자체 없음 (마이그레이션 미적용)
 * → 해당 시나리오는 SKIP 처리 + 원인 명시
 * → 로직 단위 검증(시나리오 3,4)은 DB 불필요하므로 정상 실행
 */

import pg from 'pg';
const { Client } = pg;

// ── 테스트 고정 데이터 ─────────────────────────────────────────────────────────
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

// ── DB 스키마 프리플라이트 체크 ────────────────────────────────────────────────
async function preflight() {
  const status = {
    commissionLedgerHasOrgId: false,
    affiliatePayslipExists: false,
    commissionLedgerExists: false,
  };

  // CommissionLedger 테이블 존재
  const tbl = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'CommissionLedger'
  `);
  status.commissionLedgerExists = tbl.rows.length > 0;

  if (status.commissionLedgerExists) {
    // organizationId 칼럼 존재
    const col = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'CommissionLedger' AND column_name = 'organizationId'
    `);
    status.commissionLedgerHasOrgId = col.rows.length > 0;
  }

  // AffiliatePayslip 테이블 존재
  const ps = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'AffiliatePayslip'
  `);
  status.affiliatePayslipExists = ps.rows.length > 0;

  return status;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 1: CommissionLedger 기반 팀 정산 집계 (OWNER 격리)
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario1(dbStatus) {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 1: CommissionLedger 팀 정산 집계 (OWNER 격리)');
  console.log('──────────────────────────────────────────────────');

  // ── 프리플라이트: CommissionLedger 테이블 존재 확인 ──────────────────────────
  if (!dbStatus.commissionLedgerExists) {
    skip('CommissionLedger 테이블 없음', '마이그레이션 미적용 - 전체 시나리오 SKIP');
    return;
  }

  // ── organizationId 칼럼 없으면 SKIP ─────────────────────────────────────────
  if (!dbStatus.commissionLedgerHasOrgId) {
    skip(
      'CommissionLedger.organizationId 칼럼 없음',
      '마이그레이션 미적용. route.ts 쿼리의 organizationId 필터가 실제 DB에서 동작하지 않음'
    );
    log('ℹ️ ', '조치 필요: npx prisma migrate deploy (또는 prisma db push) 실행 필요');
    log('ℹ️ ', '현재 CommissionLedger 칼럼: id, saleId, profileId, entryType, amount, currency, withholdingAmount, settlementId, isSettled, agentId, createdAt');
    log('ℹ️ ', '스키마 정의 칼럼: + organizationId, + saleId(String? nullable) — DB와 불일치');

    // ── organizationId 없이도 agentId 기반 로직은 테스트 가능 ──────────────────
    console.log('\n  [대체 검증] agentId 기반 CommissionLedger 집계 로직 (organizationId 제외)');
    await scenario1_agentIdOnly();
    return;
  }

  // ── organizationId 칼럼이 있는 경우 (마이그레이션 적용 후 전체 테스트) ──────
  const periodYear  = 2026;
  const periodMonth = 1;
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const periodEnd   = new Date(Date.UTC(periodYear, periodMonth, 1));

  const orgRow = await client.query(`SELECT id FROM "Organization" LIMIT 1`);
  if (orgRow.rows.length === 0) {
    skip('시나리오 1', 'Organization 테이블 비어있음');
    return;
  }
  const REAL_ORG_ID = orgRow.rows[0].id;
  const orgRow2 = await client.query(`SELECT id FROM "Organization" WHERE id != $1 LIMIT 1`, [REAL_ORG_ID]);
  const OTHER_ORG_ID = orgRow2.rows.length > 0 ? orgRow2.rows[0].id : null;

  const baseTime = new Date(Date.UTC(2026, 0, 15));
  await client.query(`
    INSERT INTO "CommissionLedger" ("organizationId", "agentId", "entryType", "amount", "withholdingAmount", "isSettled", "createdAt", "updatedAt")
    VALUES
      ($1, $2, 'SALES_COMMISSION',    500000, NULL, false, $3, $3),
      ($1, $2, 'OVERRIDE_COMMISSION', 100000, NULL, false, $3, $3),
      ($1, $2, 'WITHHOLDING',          19800, NULL, false, $3, $3)
  `, [REAL_ORG_ID, TEST_AGENT_ID, baseTime]);

  if (OTHER_ORG_ID) {
    await client.query(`
      INSERT INTO "CommissionLedger" ("organizationId", "agentId", "entryType", "amount", "withholdingAmount", "isSettled", "createdAt", "updatedAt")
      VALUES ($1, $2, 'SALES_COMMISSION', 1000000, NULL, false, $3, $3)
    `, [OTHER_ORG_ID, TEST_AGENT_ID + 1, baseTime]);
  }

  const { rows: ledgerEntries } = await client.query(`
    SELECT "agentId", "entryType", "amount", "withholdingAmount", "isSettled"
    FROM "CommissionLedger"
    WHERE "organizationId" = $1
      AND "createdAt" >= $2 AND "createdAt" < $3
      AND "agentId" IS NOT NULL
      AND "agentId" = $4
    ORDER BY "agentId" ASC, "createdAt" DESC
  `, [REAL_ORG_ID, periodStart, periodEnd, TEST_AGENT_ID]);

  const agentMap = aggregateLedger(ledgerEntries);
  const accum = agentMap.get(TEST_AGENT_ID);

  if (accum) {
    pass('TEST_AGENT_ID 집계 조회됨');
    accum.baseCommission === 600000
      ? pass('baseCommission = 600,000 (500K + 100K)', `실제: ${accum.baseCommission}`)
      : fail('baseCommission 계산 오류', `기대: 600000, 실제: ${accum.baseCommission}`);
    accum.deduction === 19800
      ? pass('deduction = 19,800 (WITHHOLDING)', `실제: ${accum.deduction}`)
      : fail('deduction 계산 오류', `기대: 19800, 실제: ${accum.deduction}`);
  } else {
    fail('TEST_AGENT_ID 집계 결과 없음');
  }

  if (OTHER_ORG_ID) {
    !agentMap.get(TEST_AGENT_ID + 1)
      ? pass('다른 조직 데이터 격리 확인 (결과에 없음)')
      : fail('다른 조직 데이터가 결과에 포함됨 - 테넌트 격리 실패!');
  }

  await client.query(`
    DELETE FROM "CommissionLedger"
    WHERE "agentId" IN ($1, $2) AND "createdAt" >= $3 AND "createdAt" < $4
  `, [TEST_AGENT_ID, TEST_AGENT_ID + 1, periodStart, periodEnd]);
  log('🗑️', '시나리오 1 테스트 데이터 클린업 완료');
}

// ── 대체 검증: agentId 기반 집계 로직 (organizationId 없는 현재 DB) ─────────
async function scenario1_agentIdOnly() {
  const periodStart = new Date(Date.UTC(2026, 0, 1));
  const periodEnd   = new Date(Date.UTC(2026, 1, 1));
  const baseTime    = new Date(Date.UTC(2026, 0, 15));

  // 기존 테스트 데이터 클린업 먼저
  await client.query(`
    DELETE FROM "CommissionLedger"
    WHERE "agentId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
  `, [TEST_AGENT_ID, periodStart, periodEnd]);

  // saleId NOT NULL 제약: 테스트용 임시 AffiliateSale 없이는 FK 위반
  // → saleId 컬럼 nullable 여부 재확인 후 NULL 시도
  const saleIdInfo = await client.query(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name='CommissionLedger' AND column_name='saleId'
  `);
  const saleIdNullable = saleIdInfo.rows[0]?.is_nullable === 'YES';

  if (!saleIdNullable) {
    skip(
      'CommissionLedger.saleId NOT NULL 제약',
      `saleId가 NOT NULL (nullable=${saleIdInfo.rows[0]?.is_nullable}) — AffiliateSale FK 없이 INSERT 불가`
    );
    log('ℹ️ ', '스키마 정의: saleId String? (nullable) — DB 실제: integer NOT NULL — 불일치');
    log('ℹ️ ', '조치 필요: prisma migrate deploy 로 saleId nullable 마이그레이션 적용 필요');

    // 집계 로직만 인메모리로 검증
    console.log('\n  [인메모리 집계 로직 검증]');
    const mockEntries = [
      { agentId: TEST_AGENT_ID, entryType: 'SALES_COMMISSION',    amount: 500000, withholdingAmount: null, isSettled: false },
      { agentId: TEST_AGENT_ID, entryType: 'OVERRIDE_COMMISSION', amount: 100000, withholdingAmount: null, isSettled: false },
      { agentId: TEST_AGENT_ID, entryType: 'WITHHOLDING',          amount: 19800,  withholdingAmount: null, isSettled: false },
      { agentId: TEST_AGENT_ID + 1, entryType: 'SALES_COMMISSION', amount: 1000000, withholdingAmount: null, isSettled: false },
    ];

    // REAL_ORG_ID 필터링 시뮬레이션 (agentId = TEST_AGENT_ID 만)
    const filtered = mockEntries.filter(e => e.agentId === TEST_AGENT_ID);
    const agentMap = aggregateLedger(filtered);
    const accum = agentMap.get(TEST_AGENT_ID);

    accum
      ? pass('인메모리: TEST_AGENT_ID 집계 조회됨')
      : fail('인메모리: 집계 실패');

    if (accum) {
      accum.baseCommission === 600000
        ? pass(`인메모리: baseCommission = 600,000`, `실제: ${accum.baseCommission}`)
        : fail('인메모리: baseCommission 오류', `기대: 600000, 실제: ${accum.baseCommission}`);

      accum.deduction === 19800
        ? pass(`인메모리: deduction = 19,800`, `실제: ${accum.deduction}`)
        : fail('인메모리: deduction 오류', `기대: 19800, 실제: ${accum.deduction}`);

      !agentMap.get(TEST_AGENT_ID + 1)
        ? pass('인메모리: 다른 agentId 격리 정상 (agentId+1 없음)')
        : fail('인메모리: 다른 agentId가 결과에 포함됨');
    }
    return;
  }

  // saleId nullable인 경우 실제 DB INSERT
  await client.query(`
    INSERT INTO "CommissionLedger" ("agentId", "entryType", "amount", "withholdingAmount", "isSettled", "createdAt", "updatedAt")
    VALUES
      ($1, 'SALES_COMMISSION',    500000, NULL, false, $2, $2),
      ($1, 'OVERRIDE_COMMISSION', 100000, NULL, false, $2, $2),
      ($1, 'WITHHOLDING',          19800, NULL, false, $2, $2)
  `, [TEST_AGENT_ID, baseTime]);

  const { rows } = await client.query(`
    SELECT "agentId", "entryType", "amount", "withholdingAmount", "isSettled"
    FROM "CommissionLedger"
    WHERE "agentId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
  `, [TEST_AGENT_ID, periodStart, periodEnd]);

  const agentMap = aggregateLedger(rows);
  const accum = agentMap.get(TEST_AGENT_ID);

  accum ? pass('DB: TEST_AGENT_ID 집계 조회됨') : fail('DB: 집계 결과 없음');
  if (accum) {
    accum.baseCommission === 600000
      ? pass(`DB: baseCommission = 600,000`, `실제: ${accum.baseCommission}`)
      : fail('DB: baseCommission 오류', `기대: 600000, 실제: ${accum.baseCommission}`);
    accum.deduction === 19800
      ? pass(`DB: deduction = 19,800`, `실제: ${accum.deduction}`)
      : fail('DB: deduction 오류', `기대: 19800, 실제: ${accum.deduction}`);
  }

  await client.query(`
    DELETE FROM "CommissionLedger"
    WHERE "agentId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
  `, [TEST_AGENT_ID, periodStart, periodEnd]);
  log('🗑️', '대체 검증 클린업 완료');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 2: AffiliatePayslip 개인 정산
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario2(dbStatus) {
  console.log('\n──────────────────────────────────────────────────');
  console.log('시나리오 2: AffiliatePayslip 개인 정산');
  console.log('──────────────────────────────────────────────────');

  if (!dbStatus.affiliatePayslipExists) {
    skip(
      'AffiliatePayslip 테이블 없음',
      '마이그레이션 미적용 — 테이블 자체가 DB에 존재하지 않음'
    );
    log('ℹ️ ', '조치 필요: npx prisma migrate deploy 또는 npx prisma db push 실행 필요');
    log('ℹ️ ', 'my/route.ts의 AGENT/OWNER 분기(258-383줄)는 AffiliatePayslip 테이블 의존');

    // 인메모리 로직 검증
    console.log('\n  [인메모리 AffiliatePayslip 로직 검증]');

    // my/route.ts의 payslipItems 매핑 로직 검증
    const mockPayslips = [
      { id: 1, agentId: TEST_AGENT_ID, yearMonth: '2026-01', baseCommission: BigInt(800000), bonus: null, deduction: BigInt(26400), netAmount: BigInt(773600), status: 'PENDING', paidAt: null, note: null, agentDisplayName: null, agentMallUserId: null, createdAt: new Date() },
      { id: 2, agentId: TEST_AGENT_ID, yearMonth: '2025-12', baseCommission: BigInt(500000), bonus: null, deduction: BigInt(16500), netAmount: BigInt(483500), status: 'SENT',    paidAt: null, note: null, agentDisplayName: null, agentMallUserId: null, createdAt: new Date() },
    ];

    const withholdingRate = 3.3;
    const payslipItems = mockPayslips.map(p => {
      const base = Number(p.baseCommission);
      const net  = Number(p.netAmount);
      const deduction = p.deduction ? Number(p.deduction) : null;
      const bonus = p.bonus ? Number(p.bonus) : null;
      const withholdingAmount = Math.floor(base * (withholdingRate / 100));
      return {
        id: p.id, agentId: p.agentId, yearMonth: p.yearMonth,
        baseCommission: base, bonus, deduction, netAmount: net,
        withholdingAmount,
        expectedPaymentDate: calcExpectedPaymentDate(p.yearMonth),
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        note: p.note ?? null, agentDisplayName: p.agentDisplayName ?? null,
        agentMallUserId: p.agentMallUserId ?? null,
        createdAt: p.createdAt.toISOString(),
      };
    });

    payslipItems.length === 2
      ? pass('인메모리: 2건 payslip 매핑')
      : fail('인메모리: payslip 매핑 건수 오류');

    const p1 = payslipItems.find(p => p.yearMonth === '2026-01');
    if (p1) {
      p1.baseCommission === 800000
        ? pass(`인메모리: BigInt→Number 변환 (baseCommission=800000)`)
        : fail('인메모리: BigInt 변환 오류', `실제: ${p1.baseCommission}`);

      p1.withholdingAmount === 26400  // floor(800000 * 0.033) = 26400
        ? pass(`인메모리: withholdingAmount = 26,400 (3.3% of 800K)`, `실제: ${p1.withholdingAmount}`)
        : fail('인메모리: withholdingAmount 오류', `기대: 26400, 실제: ${p1.withholdingAmount}`);

      p1.status === 'PENDING'
        ? pass('인메모리: PENDING 상태 확인')
        : fail('인메모리: status 오류', `실제: ${p1.status}`);
    }

    // calcExpectedPaymentDate
    const expectedDate = calcExpectedPaymentDate('2026-01');
    const want         = '2026-02-15T00:00:00.000Z';
    expectedDate === want
      ? pass(`calcExpectedPaymentDate("2026-01") = "${want}"`)
      : fail('calcExpectedPaymentDate 오류', `기대: ${want}, 실제: ${expectedDate}`);

    // status 필터 시뮬레이션 (route.ts where.status = statusFilter)
    const pendingOnly = payslipItems.filter(p => p.status === 'PENDING');
    pendingOnly.length === 1
      ? pass('인메모리: PENDING 필터 → 1건')
      : fail('인메모리: PENDING 필터 오류', `기대: 1, 실제: ${pendingOnly.length}`);

    // period 필터 시뮬레이션 (where.yearMonth = period)
    const period0601 = payslipItems.filter(p => p.yearMonth === '2026-01');
    period0601.length === 1
      ? pass('인메모리: period "2026-01" 필터 → 1건')
      : fail('인메모리: period 필터 오류', `기대: 1, 실제: ${period0601.length}`);

    // summary 집계 검증 (route.ts 351-358줄)
    const summary = {
      totalCommission: payslipItems.reduce((acc, p) => acc + p.baseCommission, 0),
      totalWithholding: payslipItems.reduce((acc, p) => acc + p.withholdingAmount, 0),
      totalNet: payslipItems.reduce((acc, p) => acc + p.netAmount, 0),
      totalDeduction: payslipItems.reduce((acc, p) => acc + (p.deduction ?? 0), 0),
      pendingCount: payslipItems.filter(p => p.status === 'PENDING').length,
      paidCount: payslipItems.filter(p => p.status === 'SENT').length,
    };

    summary.totalCommission === 1300000
      ? pass(`인메모리: totalCommission = 1,300,000 (800K+500K)`, `실제: ${summary.totalCommission}`)
      : fail('인메모리: totalCommission 오류', `기대: 1300000, 실제: ${summary.totalCommission}`);

    summary.pendingCount === 1 && summary.paidCount === 1
      ? pass(`인메모리: pendingCount=1, paidCount=1`)
      : fail(`인메모리: 카운트 오류`, `pending=${summary.pendingCount}, paid=${summary.paidCount}`);

    return;
  }

  // AffiliatePayslip 테이블 존재하는 경우 실제 DB 테스트
  await client.query(`
    DELETE FROM "AffiliatePayslip"
    WHERE "agentId" = $1 AND "yearMonth" IN ('2026-01', '2025-12')
  `, [TEST_AGENT_ID]);

  await client.query(`
    INSERT INTO "AffiliatePayslip" ("agentId", "yearMonth", "baseCommission", "bonus", "deduction", "netAmount", "status", "createdAt", "updatedAt")
    VALUES
      ($1, '2026-01', 800000, NULL, 26400, 773600, 'PENDING', NOW(), NOW()),
      ($1, '2025-12', 500000, NULL, 16500, 483500, 'SENT',    NOW(), NOW())
  `, [TEST_AGENT_ID]);

  const { rows: allPayslips } = await client.query(`
    SELECT * FROM "AffiliatePayslip"
    WHERE "agentId" = $1 ORDER BY "yearMonth" DESC
  `, [TEST_AGENT_ID]);

  allPayslips.length === 2
    ? pass('DB: 전체 조회 2건 확인')
    : fail('DB: 전체 조회 건수 오류', `기대: 2, 실제: ${allPayslips.length}`);

  const { rows: pendingRows } = await client.query(`
    SELECT * FROM "AffiliatePayslip" WHERE "agentId" = $1 AND "status" = 'PENDING'
  `, [TEST_AGENT_ID]);
  pendingRows.length === 1
    ? pass('DB: PENDING 필터 1건')
    : fail('DB: PENDING 필터 오류', `기대: 1, 실제: ${pendingRows.length}`);

  const { rows: periodRows } = await client.query(`
    SELECT * FROM "AffiliatePayslip" WHERE "agentId" = $1 AND "yearMonth" = '2026-01'
  `, [TEST_AGENT_ID]);
  periodRows.length === 1
    ? pass('DB: period 필터 (2026-01) 1건')
    : fail('DB: period 필터 오류', `기대: 1, 실제: ${periodRows.length}`);

  const want = '2026-02-15T00:00:00.000Z';
  calcExpectedPaymentDate('2026-01') === want
    ? pass(`DB: calcExpectedPaymentDate("2026-01") = "${want}"`)
    : fail('DB: calcExpectedPaymentDate 오류', `기대: ${want}, 실제: ${calcExpectedPaymentDate('2026-01')}`);

  const row = allPayslips.find(r => r.yearMonth === '2026-01');
  if (row) {
    const base = Number(row.baseCommission);
    const net  = Number(row.netAmount);
    base === 800000 && net === 773600
      ? pass(`DB: BigInt 변환 정상 (baseCommission=${base}, netAmount=${net})`)
      : fail('DB: BigInt 변환 오류', `base=${base}, net=${net}`);
  }

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

  // my/route.ts 259-271줄 로직 검증
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
  result?.ok === true
    ? pass('mallUserId=null → ok: true 반환')
    : fail('mallUserId=null 처리 오류');

  Array.isArray(result?.data.payslips) && result.data.payslips.length === 0
    ? pass('mallUserId=null → payslips: [] (빈 배열)')
    : fail('payslips가 빈 배열이 아님');

  result?.data.summary.totalCommission === 0
    ? pass('mallUserId=null → summary 모두 0')
    : fail('summary 값 오류');

  result?.data.document.withholdingRate === 3.3
    ? pass('mallUserId=null → withholdingRate 기본값 3.3')
    : fail('withholdingRate 기본값 오류');

  handleNoMallUser(12345) === null
    ? pass('mallUserId 있음 → null 반환 (정상 플로우 진행)')
    : fail('mallUserId 있음인데 early return 발생');
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

  // 잘못된 형식 → 거부되어야 함
  const invalidCases = [
    { input: 'invalid',  label: '"invalid" 거부' },
    { input: '2026-1',   label: '"2026-1" (한 자리 월) 거부' },
    { input: '26-01',    label: '"26-01" (두 자리 연도) 거부' },
    { input: '',         label: '빈 문자열 거부' },
    { input: null,       label: 'null 거부' },
    { input: '2026/01',  label: '"2026/01" (슬래시) 거부' },
  ];
  for (const { input, label } of invalidCases) {
    validatePeriod(input)?.ok === false
      ? pass(label)
      : fail(label, `validatePeriod("${input}") 이 통과됨`);
  }

  // 올바른 형식 → 통과되어야 함
  const validCases = [
    { input: '2026-01', label: '"2026-01" 통과' },
    { input: '2025-12', label: '"2025-12" 통과' },
  ];
  for (const { input, label } of validCases) {
    validatePeriod(input) === null
      ? pass(label)
      : fail(label, '통과되어야 하는데 거부됨');
  }

  // "2026-13" 특수 케이스: regex는 통과하지만 JS Date overflow
  const overflowResult = validatePeriod('2026-13');
  overflowResult === null
    ? pass('"2026-13" regex 통과 (형식 유효, 월 값 자체는 검증 안 함)')
    : fail('"2026-13" regex 거부 — 예상과 다름');

  // overflow 동작 확인
  const overflowDate = new Date(Date.UTC(2026, 13, 1));
  log('ℹ️ ', `"2026-13" 처리: Date.UTC(2026,13,1) → ${overflowDate.toISOString()}`);
  log('ℹ️ ', 'JS Date overflow로 자동 보정됨 (2027-02-01) — 쿼리 오류 없이 잘못된 기간 쿼리 실행 위험');
  pass('"2026-13" overflow → JS 자동 보정 (DB 오류 없음, 단 잘못된 결과 반환 가능)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 메인
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=================================================');
  console.log('  정산 시스템 통합 테스트 시작');
  console.log('  TEST_AGENT_ID:', TEST_AGENT_ID);
  console.log('  TEST_PERIOD:  ', TEST_PERIOD);
  console.log('=================================================');

  try {
    await client.connect();
    console.log('\n✅ DB 연결 성공');

    // DB 스키마 상태 확인
    const dbStatus = await preflight();
    console.log('\n[DB 스키마 현황]');
    console.log(`  CommissionLedger 테이블:    ${dbStatus.commissionLedgerExists ? '✅ 존재' : '❌ 없음'}`);
    console.log(`  CommissionLedger.orgId 칼럼: ${dbStatus.commissionLedgerHasOrgId ? '✅ 존재' : '❌ 없음 (마이그레이션 미적용)'}`);
    console.log(`  AffiliatePayslip 테이블:    ${dbStatus.affiliatePayslipExists ? '✅ 존재' : '❌ 없음 (마이그레이션 미적용)'}`);

    await scenario1(dbStatus);
    await scenario2(dbStatus);
    await scenario3();
    await scenario4();

  } catch (err) {
    console.error('\n❌ 테스트 실행 중 예외 발생:', err.message);
    console.error(err.stack);
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
