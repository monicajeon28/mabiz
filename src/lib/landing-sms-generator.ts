/**
 * Landing Pages Phase 3: SMS 자동화 시퀀스 생성
 *
 * pageFormat별로 PASONA 프레임워크 적용
 * Day 0-3 SMS 자동 생성 + CrmLandingPageSms 테이블 저장
 * Grant Cardone 심리학 렌즈 통합
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { selectSmsSequence } from "@/lib/landing-sms-templates";

/**
 * pageFormat별 SMS 렌즈 자동 감지
 * (형식에 따라 가장 적합한 심리학 렌즈 선택)
 */
function detectLensForFormat(pageFormat: string): string {
  const lensMap: Record<string, string> = {
    squeeze: "L0", // 신뢰 구축
    vsl: "L5", // 자기투영 + 스토리 (비디오 감정 연결)
    webinar: "L9", // 신뢰/권위성 (전문가)
    funnel: "L3", // 차별성 (다단계 설득)
    tripwire: "L1", // 가격/가치 (초저가)
    downsell: "L6", // 긴박감/손실회피 (거절 후)
    launch: "L6", // 긴박감/희소성 (제한 시간)
    hybrid: "L0", // 기본값
  };

  return lensMap[pageFormat] || "L0";
}

/**
 * pageFormat별 SMS 메시지 커스터마이징
 * 기존 렌즈 템플릿을 페이지 형식에 맞게 변형
 */
function customizeSmsForFormat(
  sequence: { day0: string; day1: string; day2: string; day3: string },
  pageFormat: string,
  ctaText: string,
  companyName: string,
): { day0: string; day1: string; day2: string; day3: string } {
  const updateCta = (msg: string): string =>
    msg.replace(/(\[신청하기\]|\[지금 신청하기\]|👉.*\n)/g, `👉 [${ctaText}]`);

  const updateCompany = (msg: string): string =>
    msg.replace(/(크루즈닷|마비즈)/g, companyName);

  // pageFormat별 커스터마이징
  switch (pageFormat) {
    case "squeeze":
      // 이메일만 수집하는 형식: 더 짧고 간결하게
      return {
        day0: updateCompany(updateCta(sequence.day0.split("\n").slice(0, 5).join("\n"))),
        day1: updateCompany(updateCta(sequence.day1)),
        day2: updateCompany(updateCta(sequence.day2)),
        day3: updateCompany(updateCta(sequence.day3)),
      };

    case "vsl":
      // 비디오: 가감 없이 전체 스토리 전달
      return {
        day0: updateCompany(updateCta(`${sequence.day0}\n\n📹 [비디오 시청하기]`)),
        day1: updateCompany(updateCta(sequence.day1)),
        day2: updateCompany(updateCta(sequence.day2)),
        day3: updateCompany(updateCta(sequence.day3)),
      };

    case "webinar":
      // 웨비나: 전문가/교육 가치 강조
      return {
        day0: updateCompany(
          updateCta(
            `🎓 전문가 웨비나 개최!\n${sequence.day0.split("\n")[1]}\n\n무료 등록 ${ctaText}`
          )
        ),
        day1: updateCompany(
          updateCta(
            `어제 등록 감사합니다! 📚\n${sequence.day1}\n\n교육 자료 미리 보기: [자료 다운로드]`
          )
        ),
        day2: updateCompany(
          updateCta(
            `웨비나까지 2일 남았어요! ⏰\n${sequence.day2}\n\n[참석 확인하기]`
          )
        ),
        day3: updateCompany(
          updateCta(`🎉 내일이 바로 웨비나 날입니다!\n${sequence.day3}\n\n[실시간 참석하기]`)
        ),
      };

    case "funnel":
      // 퍼널: 단계별 설명 강조
      return {
        day0: updateCompany(
          updateCta(`📍 Step 1 of 3: 기초 이해\n${sequence.day0}\n\n다음 단계 ${ctaText}`)
        ),
        day1: updateCompany(
          updateCta(`📍 Step 2 of 3: 비교 검토\n${sequence.day1}\n\n비교표 보기 ${ctaText}`)
        ),
        day2: updateCompany(
          updateCta(`📍 Step 3 of 3: 최종 결정\n${sequence.day2}\n\n최종 신청 ${ctaText}`)
        ),
        day3: updateCompany(updateCta(`🎊 완성했습니다!\n${sequence.day3}\n\n${ctaText}`)),
      };

    case "tripwire":
      // Tripwire: 저가 강조 + 한정성
      return {
        day0: updateCompany(
          updateCta(
            `🎁 초저가 오퍼! (24시간만)\n${sequence.day0.replace("신청해주셨네요", "특별 오퍼를 보셨네요")}\n\n지금만 할인 ${ctaText}`
          )
        ),
        day1: updateCompany(
          updateCta(
            `⏰ 아직 16시간 남았어요!\n${sequence.day1}\n\n한정 수량 ${ctaText}`
          )
        ),
        day2: updateCompany(
          updateCta(
            `🔥 마지막 8시간입니다!\n${sequence.day2}\n\n마지막 기회 ${ctaText}`
          )
        ),
        day3: updateCompany(
          updateCta(
            `안타깝습니다... 오퍼가 종료되었어요.\n하지만 다음 주에 더 좋은 상품으로 돌아올 예정입니다!\n\n📞 대기자 등록: [등록하기]`
          )
        ),
      };

    case "downsell":
      // Downsell: 손실회피 + 대체 옵션
      return {
        day0: updateCompany(
          updateCta(
            `🤝 더 저렴한 대체 옵션이 있습니다!\n${sequence.day0.replace("기본값", "원래 선택 대신")}\n\n대체 상품 보기 ${ctaText}`
          )
        ),
        day1: updateCompany(
          updateCta(
            `💰 가격 비교\n${sequence.day1}\n\n비교표 확인 ${ctaText}`
          )
        ),
        day2: updateCompany(
          updateCta(
            `✅ 많은 분들이 선택하셨어요\n${sequence.day2}\n\n이 상품으로 신청 ${ctaText}`
          )
        ),
        day3: updateCompany(
          updateCta(`지금이 정말 마지막 기회입니다\n${sequence.day3}\n\n지금 ${ctaText}`)
        ),
      };

    case "launch":
      // Launch: 한정 시간/수량 극대화
      return {
        day0: updateCompany(
          updateCta(
            `🚀 새로운 상품 출시!\n${sequence.day0}\n\n출시 기념 ${ctaText}`
          )
        ),
        day1: updateCompany(
          updateCta(
            `⏳ 48시간 남았어요!\n${sequence.day1}\n\n초기 구매자 특전 ${ctaText}`
          )
        ),
        day2: updateCompany(
          updateCta(
            `🔥 24시간 남았습니다!\n${sequence.day2}\n\n마지막 초기 구매가 ${ctaText}`
          )
        ),
        day3: updateCompany(
          updateCta(
            `출시 기간이 종료되었습니다!\n다음 기회를 기다려주세요.\n\n📧 미리 알림 설정: [신청하기]`
          )
        ),
      };

    case "hybrid":
    default:
      // 하이브리드: 기본 커스터마이징만
      return {
        day0: updateCompany(updateCta(sequence.day0)),
        day1: updateCompany(updateCta(sequence.day1)),
        day2: updateCompany(updateCta(sequence.day2)),
        day3: updateCompany(updateCta(sequence.day3)),
      };
  }
}

/**
 * Landing Page SMS 시퀀스 자동 생성
 *
 * @param pageId - CrmLandingPage ID
 * @param pageFormat - Russell Brunson 형식 (squeeze, vsl, webinar, funnel 등)
 * @param ctaText - CTA 버튼 텍스트 (예: "신청하기", "지금 예약하기")
 * @param companyName - 회사/조직명 (기본값: "마비즈")
 * @param smsDayRange - SMS 생성 범위 (예: "0-3", "0", null)
 *
 * @returns 생성된 SMS 시퀀스 (4개 메시지)
 */
export async function generateSmsSequence(
  pageId: string,
  pageFormat: string,
  ctaText: string,
  companyName: string = "마비즈",
  smsDayRange: string | null = "0-3",
): Promise<{ day0: string; day1: string; day2: string; day3: string } | null> {
  try {
    // smsDayRange가 없거나 '0-3'이 아니면 SMS 생성 스킵
    if (!smsDayRange || smsDayRange !== "0-3") {
      logger.log(`[generateSmsSequence] SMS 생성 스킵 (smsDayRange: ${smsDayRange})`);
      return null;
    }

    // 1. 렌즈 감지
    const detectedLens = detectLensForFormat(pageFormat);

    // 2. 렌즈에 맞는 기본 SMS 템플릿 선택
    const baseSequence = selectSmsSequence(detectedLens);

    // 3. pageFormat + CTA에 맞게 커스터마이징
    const customized = customizeSmsForFormat(baseSequence, pageFormat, ctaText, companyName);

    // 4. CrmLandingPageSms 테이블에 4개 메시지 저장
    const schedules = [
      { day: 0, schedule: "+0d 09:00" }, // Day 0: 신청 당일 09:00
      { day: 1, schedule: "+1d 10:00" }, // Day 1: 다음 날 10:00
      { day: 2, schedule: "+2d 14:00" }, // Day 2: 이틀 후 14:00
      { day: 3, schedule: "+3d 18:00" }, // Day 3: 사흘 후 18:00
    ];

    for (const { day, schedule } of schedules) {
      const messages = [customized.day0, customized.day1, customized.day2, customized.day3];
      const text = messages[day] || "";

      await prisma.crmLandingPageSms.create({
        data: {
          pageId,
          day,
          text,
          schedule,
          status: "PENDING",
        },
      });
    }

    logger.log(`[generateSmsSequence] SMS 4개 생성 완료`, {
      pageId,
      lens: detectedLens,
      format: pageFormat,
    });

    return customized;
  } catch (err) {
    logger.error("[generateSmsSequence] 에러", { err, pageId, pageFormat });
    // SMS 생성 실패는 치명적이지 않으므로 null 반환 (페이지 생성은 계속 진행)
    return null;
  }
}

/**
 * 기존 페이지의 SMS 시퀀스 재생성
 * (pageFormat이나 CTA 변경 시 기존 SMS 삭제 후 새로 생성)
 */
export async function regenerateSmsSequence(
  pageId: string,
  pageFormat: string,
  ctaText: string,
  companyName: string = "마비즈",
): Promise<void> {
  try {
    // 기존 SMS 삭제
    await prisma.crmLandingPageSms.deleteMany({
      where: { pageId },
    });

    logger.log(`[regenerateSmsSequence] 기존 SMS 삭제`, { pageId });

    // 새로운 SMS 생성
    await generateSmsSequence(pageId, pageFormat, ctaText, companyName, "0-3");
  } catch (err) {
    logger.error("[regenerateSmsSequence] 에러", { err, pageId });
    throw err;
  }
}
