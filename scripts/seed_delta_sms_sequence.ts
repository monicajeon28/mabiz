/**
 * Menu #38 Phase 4 Track 1: Delta SMS 렌탈 3일 시퀀스 시드 스크립트
 *
 * 실행: npx tsx scripts/seed_delta_sms_sequence.ts --org-id <orgId>
 *
 * 기능:
 * - delta_sms_sequence.json 로드
 * - 4개 메시지 (Day 0~3) SmsTemplate 생성
 * - 3가지 세그먼트 (자유여행/크루즈/호텔) 변형 저장
 * - PASONA 심리학 태그 포함
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

interface SequenceMessage {
  day: number;
  triggerType: string;
  triggerOffset: number;
  sendTime: string;
  message: string;
  psychology: string;
  psychologyTag: string;
  template: string;
  segmentVariations: Record<string, {
    segment: string;
    message: string;
  }>;
}

const prisma = new PrismaClient();

async function seedDeltaSmsSequence(organizationId: string) {
  try {
    // 1. JSON 파일 로드
    const jsonPath = path.resolve(process.cwd(), 'data/delta_sms_sequence.json');
    const sequenceData: SequenceMessage[] = JSON.parse(
      fs.readFileSync(jsonPath, 'utf-8')
    );

    console.log(`[Seeds] Delta SMS 렌탈 시퀀스 로드 완료: ${sequenceData.length}개 메시지`);

    // 2. 기존 템플릿 삭제 (idempotent)
    const deletedCount = await prisma.smsTemplate.deleteMany({
      where: {
        organizationId,
        title: {
          startsWith: 'Day',
        },
        category: 'DELTA_SMS_RENTAL',
      },
    });
    console.log(`[Seeds] 기존 템플릿 삭제: ${deletedCount.count}개`);

    // 3. 각 메시지별로 3가지 변형 생성
    let totalCreated = 0;

    for (const msg of sequenceData) {
      for (const [segCode, segData] of Object.entries(msg.segmentVariations)) {
        const smsTemplate = await prisma.smsTemplate.create({
          data: {
            organizationId,
            category: 'DELTA_SMS_RENTAL',
            title: `${msg.template}_${segCode}`,
            content: segData.message,
            triggerType: msg.triggerType,
            triggerOffset: msg.triggerOffset,
            segmentCode: segCode,
            psychologyTag: msg.psychologyTag,
            isSystem: true,
            usageCount: 0,
          },
        });

        console.log(
          `✓ Day ${msg.day} [${segCode}] ${segData.segment}: ${smsTemplate.id}`
        );
        totalCreated++;
      }
    }

    console.log(`
[Seeds] 완료! 총 ${totalCreated}개 SMS 템플릿 생성
- Day 0: 불안해소 (Loss Aversion)
- Day 1: 선택 가이드 (Narrative Transportation)
- Day 2: 희소성 (Scarcity + Urgency)
- Day 3: 최종 확인 (Call-to-Action)

각 Day마다 3가지 세그먼트 변형 (A: 자유여행, B: 크루즈, C: 호텔)
    `);

  } catch (error) {
    console.error('[Error]', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// CLI 인자 파싱
const args = process.argv.slice(2);
const orgIdIndex = args.indexOf('--org-id');
if (orgIdIndex === -1) {
  console.error('사용법: npx tsx scripts/seed_delta_sms_sequence.ts --org-id <orgId>');
  process.exit(1);
}

const organizationId = args[orgIdIndex + 1];
if (!organizationId) {
  console.error('--org-id 값이 필요합니다');
  process.exit(1);
}

seedDeltaSmsSequence(organizationId);
