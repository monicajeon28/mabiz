// 대리점장 구매확인 — DB 파트 통합테스트 (raw SQL 정확성 + 원자 claim 중복차단).
// 발신(몰)은 실제로 안 쏨. fixture 생성→검증→삭제.
import { readFileSync } from 'node:fs';
import pg from 'pg';
function loadEnv(f){try{for(const l of readFileSync(f,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}catch{}}
loadEnv('.env.local');loadEnv('.env');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
let pass=0,fail=0; const ok=(n,p)=>{if(p){pass++;console.log('  ✅ '+n);}else{fail++;console.log('  ❌ '+n);}};
let saleId=null;
try{
  // fixture: 미러 AffiliateSale 1행 (managerId/sourceAgentId는 임의 — 조인 null 허용, SQL 정확성만 검증)
  const ins=await c.query(`INSERT INTO "AffiliateSale" ("saleAmount","status","managerId","sourceAgentId","agentId","createdAt","updatedAt") VALUES (1000000,'APPROVED',999001,999002,999002,NOW(),NOW()) RETURNING id`);
  saleId=ins.rows[0].id;
  console.log('[fixture] mirror AffiliateSale#'+saleId);

  console.log('\n[1] GET 조인 SQL — 담당자/확정필드 컬럼·조인 정확성');
  const r=await c.query(`
    SELECT als.id, als."commissionOwnerType", als."commissionOwnerConfirmed", als."confirmedOwnerAt", als."sourceAgentId",
           mgr."displayName" AS "managerDisplayName", pre."displayName" AS "presalesDisplayName", preU."phone" AS "presalesPhone"
    FROM "AffiliateSale" als
    LEFT JOIN "AffiliateProfile" mgr ON mgr.id = als."managerId"
    LEFT JOIN "AffiliateProfile" pre ON pre.id = als."sourceAgentId"
    LEFT JOIN "User" preU ON preU.id = pre."userId"
    WHERE als.id=$1`,[saleId]);
  ok('조인 SQL 실행됨(컬럼/테이블 정확) — 행 반환', r.rows.length===1);
  ok('확정필드 초기값(미확정/false)', r.rows[0].commissionOwnerConfirmed===false && r.rows[0].commissionOwnerType===null);

  console.log('\n[2] 원자 claim — 미확정 건 1회만 잡힘');
  const claim1=await c.query(`UPDATE "AffiliateSale" SET "commissionOwnerType"='BRANCH_MANAGER',"confirmedOwnerById"=999001,"confirmedOwnerAt"=NOW(),"commissionOwnerConfirmed"=true WHERE id=$1 AND "commissionOwnerConfirmed"=false AND status NOT IN ('REFUNDED','CANCELLED','REJECTED') RETURNING id`,[saleId]);
  ok('1차 claim 성공(1행)', claim1.rows.length===1);

  console.log('\n[3] 중복 claim 차단 — 동일 건 재확정 0행(=409)');
  const claim2=await c.query(`UPDATE "AffiliateSale" SET "commissionOwnerType"='PRESALES',"confirmedOwnerById"=999003,"confirmedOwnerAt"=NOW(),"commissionOwnerConfirmed"=true WHERE id=$1 AND "commissionOwnerConfirmed"=false AND status NOT IN ('REFUNDED','CANCELLED','REJECTED') RETURNING id`,[saleId]);
  ok('2차 claim 0행(중복차단=1,000원 중복차감 방지)', claim2.rows.length===0);
  const after=await c.query(`SELECT "commissionOwnerType","commissionOwnerConfirmed","confirmedOwnerById" FROM "AffiliateSale" WHERE id=$1`,[saleId]);
  ok('값은 1차 확정 그대로(덮어쓰기 안 됨)', after.rows[0].commissionOwnerType==='BRANCH_MANAGER' && after.rows[0].confirmedOwnerById===999001);

  console.log('\n[4] 발신실패 롤백 — 확정 해제 복원');
  const rb=await c.query(`UPDATE "AffiliateSale" SET "commissionOwnerConfirmed"=false,"commissionOwnerType"=NULL,"confirmedOwnerById"=NULL,"confirmedOwnerAt"=NULL WHERE id=$1 AND "commissionOwnerConfirmed"=true RETURNING id`,[saleId]);
  ok('롤백 1행(재시도 가능 상태로 복원)', rb.rows.length===1);

  console.log('\n[5] 환불건 확정 차단 — status=REFUNDED면 claim 0행');
  await c.query(`UPDATE "AffiliateSale" SET status='REFUNDED' WHERE id=$1`,[saleId]);
  const claimR=await c.query(`UPDATE "AffiliateSale" SET "commissionOwnerConfirmed"=true WHERE id=$1 AND "commissionOwnerConfirmed"=false AND status NOT IN ('REFUNDED','CANCELLED','REJECTED') RETURNING id`,[saleId]);
  ok('환불건은 claim 0행(확정 불가)', claimR.rows.length===0);

  console.log(`\n[결과] PASS ${pass} / FAIL ${fail}`);
}catch(e){ console.error('예외:',e.message); fail++; }
finally{
  if(saleId) await c.query(`DELETE FROM "AffiliateSale" WHERE id=$1`,[saleId]).catch(()=>{});
  console.log('[cleanup] fixture 삭제');
  await c.end(); process.exit(fail>0?1:0);
}
