// ANALYTICS-EMAIL-DUP — CrmMarketingMessage.channel 추가 (additive, NOT NULL DEFAULT 'SMS' → 기존행 백필).
import { readFileSync } from 'node:fs';
import pg from 'pg';
function loadEnv(f){try{for(const l of readFileSync(f,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}catch{}}
loadEnv('.env.local');loadEnv('.env');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
try{
  await c.query(`ALTER TABLE "CrmMarketingMessage" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'SMS';`);
  const col=(await c.query(`SELECT column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_name='CrmMarketingMessage' AND column_name='channel'`)).rows;
  const cnt=(await c.query(`SELECT channel, COUNT(*)::int AS n FROM "CrmMarketingMessage" GROUP BY channel`)).rows;
  console.log('OK 컬럼:',JSON.stringify(col));
  console.log('채널별 행수(기존 백필 확인):',JSON.stringify(cnt));
}finally{ await c.end(); }
