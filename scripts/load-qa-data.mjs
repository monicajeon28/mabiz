import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { PrismaPg } from '../node_modules/@prisma/adapter-pg/dist/index.mjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// .env.local 파일에서 환경변수 로드
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local'), override: true });

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 환경변수가 없습니다!');
  process.exit(1);
}

console.log('DATABASE_URL 확인:', connectionString.substring(0, 30) + '...');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 현재 카운트 확인
  const existing = await prisma.botGuideAnswer.count();
  console.log(`현재 BotGuideAnswer 수: ${existing}`);

  const args = process.argv.slice(2);

  if (existing > 0 && !args.includes('--force')) {
    console.log('이미 데이터가 있습니다. 강제 재로드하려면 --force 플래그 사용.');
    await prisma.$disconnect();
    return;
  }

  if (existing > 0 && args.includes('--force')) {
    console.log('--force 감지: 기존 데이터 삭제 후 재로드...');
    await prisma.botGuideAnswer.deleteMany({});
  }

  // JSON 파일 로드
  const jsonPath = join(__dirname, '../src/lib/data/questions_rag_memory_with_tone.json');
  const raw = readFileSync(jsonPath, 'utf8');
  const qaData = JSON.parse(raw);
  const items = qaData.questions || [];

  console.log(`로드할 항목 수: ${items.length}`);

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const item of items) {
    try {
      const key = item.key || item.id;
      if (!key || !item.question || !item.answer) {
        errors.push({ key: key || 'unknown', error: '필수 필드 누락' });
        failed++;
        continue;
      }

      await prisma.botGuideAnswer.upsert({
        where: { key },
        update: {
          question: item.question,
          answer: item.answer,
          category: item.category || '기타',
          type: item.type || '상담기록',
          source: item.source || 'ai-generated',
          salesTone: item.sales_tone || item.salesTone || { primary: 'neutral', secondary: [], confidence: 0 },
          keywords: item.keywords || [],
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          key,
          question: item.question,
          answer: item.answer,
          category: item.category || '기타',
          type: item.type || '상담기록',
          source: item.source || 'ai-generated',
          salesTone: item.sales_tone || item.salesTone || { primary: 'neutral', secondary: [], confidence: 0 },
          keywords: item.keywords || [],
          isActive: true,
        },
      });
      succeeded++;
    } catch (e) {
      errors.push({ key: item.key || item.id, error: e.message });
      failed++;
    }
  }

  console.log(`\n✅ 완료: ${succeeded}개 성공, ${failed}개 실패`);
  if (errors.length > 0) {
    console.log('오류 샘플 (최대 5개):');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${e.error}`));
  }

  const finalCount = await prisma.botGuideAnswer.count();
  console.log(`최종 DB 레코드 수: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
