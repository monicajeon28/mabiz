// CRM 수정분 런타임 검증 (읽기전용) — TSC가 못 잡는 raw SQL의 테이블/컬럼 실재 확인.
import { readFileSync } from 'node:fs';
import pg from 'pg';
function loadEnv(f){try{for(const l of readFileSync(f,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}catch{}}
loadEnv('.env.local');loadEnv('.env');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
let pass=0,fail=0;
const ok=(n,p)=>{if(p){pass++;console.log('  ✅ '+n);}else{fail++;console.log('  ❌ '+n);}};
try{
  console.log('[GOLD-1] gold-inquiries 상태변경 raw UPDATE — 테이블명/컬럼 실재');
  try{
    const r=await c.query(`UPDATE "CruiseProductInquiry" SET status=$1,"updatedAt"=NOW() WHERE id=$2 AND "productCode" LIKE 'GOLD_MEMBERSHIP%' RETURNING id`,['pending',-99999]);
    ok('CruiseProductInquiry UPDATE 실행됨(존재X id라 0행, 에러 없음=500 해소)', r.rowCount===0);
  }catch(e){ ok('CruiseProductInquiry UPDATE: '+e.message,false); }

  console.log('\n[PNR-TRIPS-404] trips 라우트 raw SELECT — CruiseProduct 컬럼 실재');
  try{
    const r=await c.query(`SELECT id,"productCode","cruiseLine","shipName","packageName","tourCities","startDate","endDate" FROM "CruiseProduct" WHERE "isActive"=true AND "deletedAt" IS NULL ORDER BY "startDate" ASC NULLS LAST, id DESC LIMIT 1`);
    ok('CruiseProduct SELECT 실행됨(컬럼 모두 실재) — 행:'+r.rowCount, true);
  }catch(e){ ok('CruiseProduct SELECT: '+e.message,false); }

  console.log('\n[옛버그 확인] 존재하지 않던 "ProductInquiry" 테이블');
  try{ await c.query(`SELECT 1 FROM "ProductInquiry" LIMIT 1`); console.log('  (ProductInquiry 존재 — 의외)'); }
  catch(e){ ok('"ProductInquiry"는 실제로 없음 → 옛 코드가 500나던 게 맞음', /does not exist/i.test(e.message)); }

  console.log(`\n[결과] PASS ${pass} / FAIL ${fail}`);
}finally{ await c.end(); process.exit(fail>0?1:0); }
