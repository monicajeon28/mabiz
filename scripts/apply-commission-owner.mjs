// 대리점장 구매확인 — 미러 AffiliateSale(public_AffiliateSale)에 확정신호 4컬럼 추가 (additive, 무중단).
import { readFileSync } from 'node:fs';
import pg from 'pg';
function loadEnv(f){try{for(const l of readFileSync(f,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}catch{}}
loadEnv('.env.local');loadEnv('.env');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
try{
  await c.query(`
    ALTER TABLE "AffiliateSale"
      ADD COLUMN IF NOT EXISTS "commissionOwnerType" TEXT,
      ADD COLUMN IF NOT EXISTS "commissionOwnerConfirmed" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "confirmedOwnerById" INTEGER,
      ADD COLUMN IF NOT EXISTS "confirmedOwnerAt" TIMESTAMP(3);
  `);
  const col=(await c.query(`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='AffiliateSale' AND column_name IN ('commissionOwnerType','commissionOwnerConfirmed','confirmedOwnerById','confirmedOwnerAt') ORDER BY column_name`)).rows;
  console.log('OK 컬럼:',JSON.stringify(col));
}finally{ await c.end(); }
