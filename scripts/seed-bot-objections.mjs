/**
 * 크루즈닷봇 이의대응 시드 9종 — ScriptPattern(status=APPROVED) 적재 (작업지시서 Phase 2)
 *
 * 봇이 설득 자료로 인용하는 1차 이의대응 멘트. 과장표현(최저가/100%/보장) 없이
 * 가치 재정의·공감·담당자 연결 중심(가드레일·핸드오프 모델과 정합). 우리 크루즈콜모음 지식 기반.
 *
 * 실행(DB 접근 가능 환경): dotenvx run -- node scripts/seed-bot-objections.mjs
 *   - 특정 조직만: SEED_ORG_ID=<orgId> dotenvx run -- node scripts/seed-bot-objections.mjs
 *   - 미지정 시 status=ACTIVE 인 모든 조직에 적재. 멱등(이미 있으면 skip).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OBJECTIONS = [
  {
    objectionType: "가격",
    patternText:
      "가격이 부담되신다는 말씀 충분히 이해해요. 크루즈는 숙박·식사·이동·공연이 한 번에 포함돼서 따로 다니는 여행과 단순 비교가 어려워요. 하루 단위로 나눠보면 생각보다 합리적인 경우가 많고, 부담되시면 나눠내는 방법도 담당자가 함께 찾아드려요. 가격보다 '이 시간을 어떻게 보내고 싶으신지'를 먼저 그려보면 어떨까요?",
  },
  {
    objectionType: "시간",
    patternText:
      "시간 내기가 쉽지 않으시죠. 출발일이 다양해서 길게 빼기 어려우면 짧은 일정부터도 가능해요. 미리 잡아두면 마음의 준비도 되고 더 좋은 자리를 고를 수 있어서, 우선 가능한 시기만 살짝 잡아둘까요?",
  },
  {
    objectionType: "신뢰",
    patternText:
      "처음이라 걱정되시는 게 당연해요. 저희는 크루즈만 전문으로 오래 다뤄왔고, 출발 전부터 끝까지 한국어로 안내해드려요. 어떤 점이 가장 염려되시는지 말씀해주시면 그 부분부터 확인해드릴게요.",
  },
  {
    objectionType: "가족",
    patternText:
      "가족과 상의가 필요하시죠. 크루즈는 연세 있으신 분도, 아이들도 각자 즐길 거리가 있어서 온 가족이 함께 만족하기 좋은 여행이에요. 가족분이 어떤 점을 걱정하실지 미리 정리해드릴 자료를 보내드릴까요?",
  },
  {
    objectionType: "기항지",
    patternText:
      "어디를 들르는지가 제일 궁금하시죠. 같은 지역이라도 배와 일정마다 들르는 항구와 머무는 시간이 달라요. 마음에 두신 도시가 있으면 말씀해주세요. 그 도시를 잘 도는 일정으로 비교해드릴게요.",
  },
  {
    objectionType: "건강",
    patternText:
      "건강이 신경 쓰이시는 건 가장 중요한 부분이에요. 배 안에서는 이동이 편해서 오히려 편하게 다니시는 분도 많아요. 다만 구체적인 건강 조건은 담당 전문가가 꼭 확인하고 안내드려야 해서, 상황을 알려주시면 맞춰서 도와드릴게요.",
  },
  {
    objectionType: "연기",
    patternText:
      "다음에 생각하시는 것도 좋아요. 다만 좋은 시기와 좋은 자리는 일찍 차는 편이라, 마음에 드는 일정이 있을 때 자리만 먼저 확인해두면 나중에 아쉬움이 적어요. 부담 없이 자리만 알아봐 드려도 될까요?",
  },
  {
    objectionType: "경쟁사",
    patternText:
      "여러 곳 비교해보시는 거 현명하세요. 가격표만 보면 비슷해 보여도 포함되는 것·한국어 안내·출발 전후 케어가 곳마다 달라요. 비교하고 계신 조건을 알려주시면 같은 기준으로 솔직하게 비교해드릴게요.",
  },
  {
    objectionType: "환불",
    patternText:
      "혹시 못 가게 될까 걱정되시죠. 일정과 시점에 따라 환불·변경 규정이 정해져 있어서, 정확한 조건은 담당자가 상품 기준으로 확인해드려요. 어떤 상황이 걱정되시는지 알려주시면 그에 맞는 규정을 짚어드릴게요.",
  },
];

async function main() {
  const orgs = process.env.SEED_ORG_ID
    ? [{ id: process.env.SEED_ORG_ID }]
    : await prisma.organization.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

  if (orgs.length === 0) {
    console.log("[seed-bot-objections] 대상 조직 없음 — 종료");
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const org of orgs) {
    for (const o of OBJECTIONS) {
      const existing = await prisma.scriptPattern.findFirst({
        where: {
          organizationId: org.id,
          category: "objection",
          objectionType: o.objectionType,
          productType: "cruise",
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.scriptPattern.create({
        data: {
          organizationId: org.id,
          productType: "cruise",
          personaType: "ALL",
          category: "objection",
          objectionType: o.objectionType,
          patternText: o.patternText,
          productCode: "ALL",
          status: "APPROVED",
          approvedBy: "seed:bot-objections",
          approvedAt: new Date(),
        },
      });
      created++;
    }
  }

  console.log(
    `[seed-bot-objections] 완료 — created=${created} skipped=${skipped} orgs=${orgs.length}`,
  );
}

main()
  .catch((e) => {
    console.error("[seed-bot-objections] 실패", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
