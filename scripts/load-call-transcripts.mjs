import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { PrismaPg } from '../node_modules/@prisma/adapter-pg/dist/index.mjs';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local'), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 판매원 성 추출
function extractAgentLastName(content) {
  const match = content.match(/(?:매니저|판매원|담당자|저는)\s*([가-힣])[가-힣]+/);
  return match ? match[1] : '익';
}

// 고객 성 추출 (파일명에서)
function extractCustomerLastName(filename) {
  // "김원현_250131" 패턴에서 성 추출
  const match = filename.match(/[)]\s*([가-힣])[가-힣]+_\d/);
  if (match) return match[1];
  // "강윤순 고객님" 패턴
  const match2 = filename.match(/([가-힣])[가-힣]+\s*고객/);
  return match2 ? match2[1] : '익';
}

// 페르소나 감지
function detectPersona(content) {
  if (/부모님|어머님|아버님|효도|어머니|아버지/.test(content)) return 'FILIAL_DUTY';
  if (/신혼|허니문|결혼|기념일/.test(content)) return 'NEWLYWEDS';
  if (/가격|비싸|할인|저렴|싸/.test(content)) return 'PRICE_SENSITIVE';
  if (/혼자|1인|친구들|친구/.test(content)) return 'SINGLE_ADVENTURE';
  if (/재구매|또|다시|이번에도/.test(content)) return 'REPURCHASE';
  return 'FILIAL_DUTY';
}

// 조직 ID 조회 (첫 번째 조직 사용 - 초기 로드용)
async function getDefaultOrgId() {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  return org?.id ?? null;
}

async function main() {
  const orgId = await getDefaultOrgId();
  if (!orgId) { console.error('조직 없음'); process.exit(1); }
  console.log('조직 ID:', orgId);

  const dir = join(__dirname, '../docs/크루즈콜모음');
  const files = readdirSync(dir).filter(f => f.includes('transcript') && f.endsWith('.md'));
  console.log(`로드할 파일: ${files.length}개`);

  let succeeded = 0, skipped = 0, failed = 0;

  for (const filename of files) {
    try {
      const content = readFileSync(join(dir, filename), 'utf8');
      const agentLastName = extractAgentLastName(content);
      const personaType = detectPersona(content);

      // 이미 있으면 스킵 (파일명 앞 20자로 중복 체크)
      const searchKey = filename.slice(0, 20);
      const existing = await prisma.aiCallLog.findFirst({
        where: { rawTextMasked: { contains: searchKey } }
      });
      if (existing) {
        console.log(`⏭️  스킵 (중복): ${filename.slice(0, 40)}`);
        skipped++;
        continue;
      }

      // 전화번호 마스킹
      const masked = content.replace(/01[0-9]-?\d{3,4}-?\d{4}/g, '010-****-****');

      // 파일명을 rawTextMasked 앞에 포함 (중복 체크용)
      const rawWithFilename = `[파일: ${filename}]\n\n${masked}`.slice(0, 10000);

      await prisma.$transaction(async (tx) => {
        const callLog = await tx.aiCallLog.create({
          data: {
            organizationId: orgId,
            agentUserId: 'system-import',
            agentLastName,
            productType: 'GENERAL',
            personaType,
            rawTextMasked: rawWithFilename,
            converted: false,
            analysisStatus: 'DONE',
            driveFileId: null,
          },
        });
        await tx.aiCallAnalysis.create({
          data: {
            callLogId: callLog.id,
            personaDetected: personaType,
            personaConfidence: 0.7,
            scores: {},
            keyPhrases: [],
            strengths: [],
            weaknesses: [],
            objectionTypes: [],
          },
        });
      });
      succeeded++;
      console.log(`✅ ${filename.slice(0, 40)} → 성: ${agentLastName} / 페르소나: ${personaType}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${filename}: ${e.message}`);
    }
  }

  console.log(`\n완료: 성공 ${succeeded} / 스킵 ${skipped} / 실패 ${failed}`);
  const total = await prisma.aiCallLog.count();
  console.log(`총 AiCallLog: ${total}건`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
