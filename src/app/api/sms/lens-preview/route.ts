import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  L0_SMS_TEMPLATES,
  L1_SMS_TEMPLATES,
  L2_SMS_TEMPLATES,
  L6_SMS_TEMPLATES,
  L10_SMS_TEMPLATES,
} from "@/lib/funnel-sms-templates";

/**
 * GET /api/sms/lens-preview?lens=L6&day=1
 *
 * 렌즈별 Day 0-3 SMS 템플릿을 조회합니다.
 *
 * 쿼리 파라미터:
 *   - lens: L0|L1|L2|L6|L10 (기본값: L0)
 *   - day: 0|1|2|3 (조회할 day, 생략 가능)
 *
 * 응답:
 * {
 *   "ok": true,
 *   "lens": "L6",
 *   "lensLabel": "타이밍 (Loss Aversion)",
 *   "day": 1,
 *   "days": [
 *     {
 *       "day": 0,
 *       "template": "안녕하세요...",
 *       "psychology": "PASONA P + 긴박감"
 *     },
 *     ...
 *   ]
 * }
 */

type LensType = "L0" | "L1" | "L2" | "L6" | "L10";

interface LensMetadata {
  label: string;
  description: string;
  psychologyFramework: string;
  psychologyDetails: Record<number, string>; // day별 심리학 기법
}

const LENS_METADATA: Record<LensType, LensMetadata> = {
  L0: {
    label: "신규 고객 (신뢰 구축)",
    description: "부재중/초면 고객을 위한 기본 신뢰 구축 시퀀스",
    psychologyFramework: "PASONA + 사회증명",
    psychologyDetails: {
      0: "PASONA P(Problem) - 문제 인식 + 초기 신뢰 구축",
      1: "PASONA S(Solution) - 해결책 제시 (3가지 옵션)",
      2: "사회증명 - 실제 고객 후기 + 만족도",
      3: "PASONA A(Action) - 희소성 강조 + 최종 클로징",
    },
  },
  L1: {
    label: "가격 민감 (손실회피)",
    description: "예산이 낮거나 가격에 민감한 고객",
    psychologyFramework: "Loss Aversion + 할부/할인 강조",
    psychologyDetails: {
      0: "손실회피 - 저예산 인정 + 할부 0% 강조",
      1: "비교 우위 - 경쟁사 대비 가격 우위 입증",
      2: "할부 옵션 - 구체적 월납금 제시",
      3: "긴박감 + 할인 - 오늘 신청 시 추가 할인",
    },
  },
  L2: {
    label: "준비 불안 (복잡도 해소)",
    description: "여권, 비자, 짐 준비 등 복잡도로 인한 불안감",
    psychologyFramework: "불안 해소 + 권위성 + 단계별 가이드",
    psychologyDetails: {
      0: "불안 해소 - 준비는 우리가 다 해준다는 신뢰",
      1: "단계별 가이드 - 5단계 로드맵 제시",
      2: "권위성 - 베테랑/전문가의 경험담",
      3: "행동 유도 - 매니저와 상담 후 준비 시작",
    },
  },
  L6: {
    label: "타이밍 (긴박감/Loss Aversion)",
    description: "시간 제한, 지금 당장의 결정이 필요한 상황",
    psychologyFramework: "Urgency + Scarcity + Loss Aversion",
    psychologyDetails: {
      0: "PASONA P + 긴박감 - 한정 특가 강조",
      1: "PASONA S + 시간 압박 - 오늘까지만",
      2: "희소성 - 남은 석수 강조",
      3: "PASONA A + 즉시성 - 지금 신청 시 특가",
    },
  },
  L10: {
    label: "클로징 (즉시 구매/의사결정)",
    description: "이미 의사결정 가능한 단계, 바로 구매할 준비 완료",
    psychologyFramework: "Reciprocity + Commitment + Celebration",
    psychologyDetails: {
      0: "축하 + 다음 단계 - 신청 후 처음부터 함께",
      1: "구체적 일정 - 언제 출발? 어디로?",
      2: "최후 혜택 - 고객에 대한 감사 + 특별 대우",
      3: "축하 + 즉시 시작 - 여행 계획 시작 신청",
    },
  },
};

async function getLensTemplates(lens: LensType) {
  const templateMap: Record<LensType, typeof L0_SMS_TEMPLATES> = {
    L0: L0_SMS_TEMPLATES,
    L1: L1_SMS_TEMPLATES,
    L2: L2_SMS_TEMPLATES,
    L6: L6_SMS_TEMPLATES,
    L10: L10_SMS_TEMPLATES,
  };

  return templateMap[lens] || L0_SMS_TEMPLATES;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId && session?.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { error: "인증 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const lensParam = (searchParams.get("lens") || "L0").toUpperCase();
    const dayParam = parseInt(searchParams.get("day") || "0");

    // 렌즈 검증
    const validLenses: LensType[] = ["L0", "L1", "L2", "L6", "L10"];
    const lens = validLenses.includes(lensParam as LensType)
      ? (lensParam as LensType)
      : "L0";

    // Day 검증
    const day = [0, 1, 2, 3].includes(dayParam) ? dayParam : 0;

    // 렌즈 템플릿 조회
    const templates = await getLensTemplates(lens);
    const metadata = LENS_METADATA[lens];

    // Day 0-3 배열 생성
    const days = [0, 1, 2, 3].map((d) => ({
      day: d,
      template: templates[`day${d}` as keyof typeof templates] || "",
      psychology: metadata.psychologyDetails[d] || "",
    }));

    return NextResponse.json({
      ok: true,
      lens,
      lensLabel: metadata.label,
      lensDescription: metadata.description,
      psychologyFramework: metadata.psychologyFramework,
      day,
      days,
    });
  } catch (err) {
    logger.error("[LensPreviewError]", err);
    return NextResponse.json(
      { error: "렌즈 미리보기 실패" },
      { status: 500 }
    );
  }
}
