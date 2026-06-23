/**
 * 렌즈 템플릿 Phase 1 Seed Script
 * L0-L10 렌즈별 Day 0-3 SMS/Email 템플릿 생성
 * 사용: node scripts/seed-lens-templates-phase1.mjs
 * @date 2026-06-24
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LENS_TEMPLATES = {
  L0: {
    name: "부재중 고객 (다시 부르기)",
    color: "#9B59B6",
    icon: "🔴",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 감정적 재연결",
        body: "{고객명}님, 안녕하세요? 저는 {담당자}입니다. 당신을 정말 그리워했어요. 지난 크루즈 때의 그 순간 기억나시나요? 우리와 함께였던 날들이 특별했다고 생각해요.",
        psychologyPrinciple: "emotional_reconnection",
        estimatedClickRate: 0.45,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 추억 회상",
        body: "{고객명}님, 당신이 간 크루즈에서 만났던 사람들이 당신을 찾고 있어요. 우리 다시 만날까요?",
        psychologyPrinciple: "nostalgia",
        estimatedClickRate: 0.42,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 특별한 혜택",
        body: "돌아오신 분들을 위해 특별히 준비했어요. 30% 할인 쿠폰! 이번 주말까지만 사용 가능해요.",
        psychologyPrinciple: "scarcity",
        estimatedClickRate: 0.48,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 최종 초대",
        body: "{고객명}님을 초대합니다. [지금 예약하기] 버튼을 클릭해주세요. 당신의 꿈의 크루즈가 시작됩니다.",
        psychologyPrinciple: "urgency",
        estimatedClickRate: 0.55,
      },
    ],
  },
  L1: {
    name: "가격 민감 고객 (할부 제안)",
    color: "#FFD700",
    icon: "🟡",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 가치 재정의",
        body: "{고객명}님, 알아요. 가격이 비싸 보여요. 하지만 크루즈 1회 = 기억 무조건 남아요. 400% ROI라는 뜻! [비교 보기]",
        psychologyPrinciple: "value_redefinition",
        estimatedClickRate: 0.4,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 경쟁사 대비",
        body: "경쟁사 Royal은 {경쟁사가격}원. 우리는 {우리가격}원. 5가지 추가 포함 무료! [비교보기]",
        psychologyPrinciple: "comparison",
        estimatedClickRate: 0.45,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 유연한 결제",
        body: "{상품명} = 월 5만원씩 {할부개월}개월. 무이자 할부 가능! [할부계산기]",
        psychologyPrinciple: "financial_flexibility",
        estimatedClickRate: 0.52,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 긴박감",
        body: "{고객명}님, 이 가격은 내일까지만! 5% 추가 할인까지 해드려요. [지금 신청]해주세요!",
        psychologyPrinciple: "urgency",
        estimatedClickRate: 0.5,
      },
    ],
  },
  L2: {
    name: "준비 불안감 (복잡성 낮추기)",
    color: "#FF8C00",
    icon: "🟠",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 불확실성 제거",
        body: "{고객명}님, 여행 준비가 복잡하다고 생각하세요? 아니에요! 우리가 3단계로 아주 쉽게 도와드려요.",
        psychologyPrinciple: "uncertainty_removal",
        estimatedClickRate: 0.3,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 단순화",
        body: "Step 1: 원하는 날짜 선택. Step 2: 선실 선택. Step 3: 예약 완료! 그게 전부예요.",
        psychologyPrinciple: "simplification",
        estimatedClickRate: 0.35,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 신뢰 구축",
        body: "10년간 5만 명 고객 만족. 평점 4.9⭐. [후기 보기]",
        psychologyPrinciple: "social_proof",
        estimatedClickRate: 0.4,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 최종 확인",
        body: "{고객명}님, 더 이상 고민하지 마세요. 우리가 24시간 지원해드려요. [지금 시작]",
        psychologyPrinciple: "trust",
        estimatedClickRate: 0.45,
      },
    ],
  },
  L3: {
    name: "경쟁사 비교 고객 (차별성 강조)",
    color: "#4A90E2",
    icon: "🔵",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 경쟁사 분석",
        body: "{고객명}님, 우리 vs Royal vs Carnival. 객관적으로 비교해봤어요. [비교표 보기]",
        psychologyPrinciple: "comparative_analysis",
        estimatedClickRate: 0.4,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 우리만의 강점",
        body: "우리만 제공: 온천, 한식요리, VIP라운지. Royal에는 없어요!",
        psychologyPrinciple: "differentiation",
        estimatedClickRate: 0.45,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 사회증명",
        body: "선택한 이유? 87% \"한국 고객센터\", 92% \"가성비 최고\". [고객후기 100개]",
        psychologyPrinciple: "social_proof",
        estimatedClickRate: 0.5,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 최종 결정",
        body: "결정해야 할 시간이에요. 우리 선택하시고 후회 없으실 거예요. [지금 예약]",
        psychologyPrinciple: "commitment",
        estimatedClickRate: 0.55,
      },
    ],
  },
  L4: {
    name: "서류/절차 복잡 (자동화 강조)",
    color: "#27AE60",
    icon: "🟢",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 시간절약",
        body: "{고객명}님, 여권/APIS? 우리가 자동으로 체크해드려요. 5분 걸려요.",
        psychologyPrinciple: "time_saving",
        estimatedClickRate: 0.35,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 자동화",
        body: "여권 사진 업로드 → APIS 자동 신청 → 완료! 번거로움 없어요.",
        psychologyPrinciple: "automation",
        estimatedClickRate: 0.38,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 신뢰",
        body: "100% 안전해요. 개인정보 암호화(AES-256) + 자동 삭제(30일후).",
        psychologyPrinciple: "trust",
        estimatedClickRate: 0.42,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 지금하기",
        body: "[지금 시작]하면 내일부터 자동 준비 시작해요. 걱정 없어요!",
        psychologyPrinciple: "urgency",
        estimatedClickRate: 0.48,
      },
    ],
  },
  L5: {
    name: "가족동의 필요 (설득 도구)",
    color: "#9B59B6",
    icon: "💜",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 가족참여",
        body: "{고객명}님 + 가족. 크루즈는 함께하는 추억이에요. 아내분께 이것 보여주세요!",
        psychologyPrinciple: "family_involvement",
        estimatedClickRate: 0.25,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 가족혜택",
        body: "4인 가족 패키지: 어른 2명 + 아이 2명. 아이 50% 할인!",
        psychologyPrinciple: "family_benefits",
        estimatedClickRate: 0.3,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 함께의 가치",
        body: "가족이 함께 보낸 크루즈 = 최고의 추억. 아이도 \"또 가고싶어요\"라고 말해요.",
        psychologyPrinciple: "emotional_value",
        estimatedClickRate: 0.33,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 함께 결정",
        body: "[가족 모두 보기] 링크로 공유하세요. 함께 결정하면 더 좋아요!",
        psychologyPrinciple: "joint_decision",
        estimatedClickRate: 0.38,
      },
    ],
  },
  L6: {
    name: "타이밍/손실회피 (긴급성 강조)",
    color: "#E74C3C",
    icon: "🔴",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 손실회피",
        body: "지금만 20% 할인이에요. 지나가면 정가로 구매해야 해요. {고객명}님, 시간이 별로 없어요.",
        psychologyPrinciple: "loss_aversion",
        estimatedClickRate: 0.55,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 희소성",
        body: "명일 자정 마감! 선실 3개만 남았어요. 30% 할인은 더 빨리 끝날 거예요.",
        psychologyPrinciple: "scarcity",
        estimatedClickRate: 0.58,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 확정 압박",
        body: "결정 완료했으신가요? 지금이 최고의 시간이에요. 더 이상 기다릴 수 없어요.",
        psychologyPrinciple: "timing",
        estimatedClickRate: 0.6,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 클로징",
        body: "[지금 예약 완료]하세요. 더 이상 기다리지 마세요. 이게 마지막 기회예요!",
        psychologyPrinciple: "closing",
        estimatedClickRate: 0.65,
      },
    ],
  },
  L7: {
    name: "호텔/시설 중심 (편의성 강조)",
    color: "#3498DB",
    icon: "🟦",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 시설 소개",
        body: "{고객명}님, {상품명}의 시설이 정말 좋아요. 온천, 스파, 뷔페 24시간!",
        psychologyPrinciple: "facility_showcase",
        estimatedClickRate: 0.45,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 가상투어",
        body: "[360도 가상투어] 보세요. 선실, 레스토랑, 카지노 다 볼 수 있어요.",
        psychologyPrinciple: "virtual_experience",
        estimatedClickRate: 0.48,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 고객후기",
        body: "\"시설이 진짜 좋았어요!\" \"돌아오고 싶어요\" [후기 100개 보기]",
        psychologyPrinciple: "social_proof",
        estimatedClickRate: 0.52,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 지금하기",
        body: "이 최고급 시설 경험해보세요. [지금 예약]하세요!",
        psychologyPrinciple: "urgency",
        estimatedClickRate: 0.55,
      },
    ],
  },
  L8: {
    name: "건강/안전 우려 (신뢰/보증 강조)",
    color: "#27AE60",
    icon: "💚",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 안전방침",
        body: "{고객명}님, 코로나 안전은 최우선이에요. 탑승 전 PCR 검사 무료!",
        psychologyPrinciple: "safety_first",
        estimatedClickRate: 0.35,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 격리 시설",
        body: "혹시 모를 경우 격리실 24/7 준비. 의료진도 상주해요.",
        psychologyPrinciple: "preparedness",
        estimatedClickRate: 0.4,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 보증서",
        body: "질병보험 자동 포함. 일일 보장금 50만원!",
        psychologyPrinciple: "guarantee",
        estimatedClickRate: 0.45,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 신뢰 결정",
        body: "안전하게 떠나세요. [지금 예약]하시면 건강검사 무료 제공!",
        psychologyPrinciple: "reassurance",
        estimatedClickRate: 0.5,
      },
    ],
  },
  L9: {
    name: "선물/특별날 (추억강조)",
    color: "#F39C12",
    icon: "🎉",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 특별한 순간",
        body: "{고객명}님, 남편/아내 생일인가요? 크루즈가 최고의 선물이에요!",
        psychologyPrinciple: "gift_occasion",
        estimatedClickRate: 0.35,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 추억만들기",
        body: "선박 위에서 본 바다 석양. 이것보다 로맨틱한 건 없어요. [사진 보기]",
        psychologyPrinciple: "memory_creation",
        estimatedClickRate: 0.4,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 특별 패키지",
        body: "샴페인 + 디너 + 케이크 세트. {가격}원! 따뜻한 추억을 만들어요.",
        psychologyPrinciple: "special_offering",
        estimatedClickRate: 0.48,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 지금 예약",
        body: "[지금 예약]하세요. 당신의 사랑이 빛날 그 순간 준비해드려요! 🎉",
        psychologyPrinciple: "romantic_closure",
        estimatedClickRate: 0.55,
      },
    ],
  },
  L10: {
    name: "즉시 구매 의향 (클로징)",
    color: "#27AE60",
    icon: "🟢",
    templates: [
      {
        day: 0,
        templateType: "sms",
        title: "Day 0: 긴급 할인",
        body: "{고객명}님만을 위해. 10% 추가 할인! 지금 예약 시에만!",
        psychologyPrinciple: "urgency",
        estimatedClickRate: 0.65,
      },
      {
        day: 1,
        templateType: "sms",
        title: "Day 1: 희소성 강조",
        body: "선실 3개 남음. 결정을 미루면 다음 배는 {다음출발일}이에요!",
        psychologyPrinciple: "scarcity",
        estimatedClickRate: 0.68,
      },
      {
        day: 2,
        templateType: "sms",
        title: "Day 2: 결제 진행",
        body: "결제 화면을 열었어요. 마지막 한 발짝이에요! [계속 진행]",
        psychologyPrinciple: "closing",
        estimatedClickRate: 0.7,
      },
      {
        day: 3,
        templateType: "sms",
        title: "Day 3: 최종 확정",
        body: "[예약 완료]를 클릭하세요! 당신의 꿈의 크루즈가 시작돼요! 🎉",
        psychologyPrinciple: "fulfillment",
        estimatedClickRate: 0.75,
      },
    ],
  },
};

async function seedTemplates() {
  try {
    console.log("🌱 렌즈 템플릿 Phase 1 Seeding 시작...");

    // 실제 organizationId를 사용해야 함 (임시: GLOBAL_ADMIN org)
    // 프로덕션에서는 각 조직별로 실행해야 함
    const GLOBAL_ADMIN_ORG_ID = "global_admin_org"; // 실제 ID로 변경 필요

    // 기존 조직 조회
    const orgs = await prisma.organization.findMany({
      take: 5, // 처음 5개 조직만 시드
    });

    for (const lens in LENS_TEMPLATES) {
      const lensConfig = LENS_TEMPLATES[lens];

      for (const org of orgs) {
        // 이미 존재하는지 확인 (중복 방지)
        const existing = await prisma.lensTemplate.findFirst({
          where: {
            organizationId: org.id,
            lensType: lens,
            isSystemTemplate: true,
          },
        });

        if (existing) {
          console.log(`⏭️  ${org.name} - ${lens} 이미 존재, 스킵`);
          continue;
        }

        // 각 렌즈별 Day 0-3 템플릿 생성
        for (const template of lensConfig.templates) {
          await prisma.lensTemplate.create({
            data: {
              organizationId: org.id,
              lensType: lens,
              templateType: template.templateType,
              day: template.day,
              title: template.title,
              body: template.body,
              psychologyPrinciple: template.psychologyPrinciple,
              expectedClickRate: template.estimatedClickRate,
              sendDelayMinutes: 5,
              status: "ACTIVE",
              version: 1,
              isSystemTemplate: true,
              customizations: {
                lens: lens,
                lensName: lensConfig.name,
                color: lensConfig.color,
                icon: lensConfig.icon,
              },
            },
          });

          console.log(
            `✅ ${org.name} - ${lens} ${template.day}일차 생성: ${template.title}`
          );
        }
      }
    }

    console.log(
      "\n✨ 렌즈 템플릿 Phase 1 Seeding 완료! (총 " +
        Object.keys(LENS_TEMPLATES).length * 4 * orgs.length +
        "개 템플릿)"
    );
  } catch (error) {
    console.error("❌ Seeding 오류:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTemplates();
