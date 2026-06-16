import prisma from "@/lib/prisma";

// 성(姓)만 추출: "김철수" → "김", "박" → "박"
function extractLastName(fullName: string | null | undefined): string {
  if (!fullName) return "익명";
  return fullName.trim().charAt(0);
}

// 페르소나 키워드 → 카테고리 매핑
const PERSONA_CATEGORY_MAP: Record<string, string[]> = {
  FILIAL_DUTY:       ["기타", "탑승&수속"],
  NEWLYWEDS:         ["선상활동", "기항지&투어"],
  SINGLE_ADVENTURE:  ["기항지&투어", "선상활동"],
  RETIRED_LEISURE:   ["식사&음료", "객실&카드"],
  PRICE_SENSITIVE:   ["정책&수수료"],
  REPURCHASE:        ["정책&수수료", "객실&카드"],
};

export interface RagContext {
  successCases: string[];     // 실제 성공사례 (성만 표시)
  scriptPatterns: string[];   // 승인된 스크립트 패턴
  relatedQAs: string[];       // 관련 Q&A
  totalCasesInDB: number;     // DB에 쌓인 총 사례 수
}

export async function buildRagContext(
  organizationId: string,
  personaType: string,
): Promise<RagContext> {
  const categories = PERSONA_CATEGORY_MAP[personaType] ?? ["기타"];

  // 1. 실제 성공사례: 같은 조직 + 같은 페르소나 + 성약된 콜 최근 5건
  const successLogs = await prisma.aiCallLog.findMany({
    where: {
      organizationId,
      converted: true,
      personaType,
      analysisStatus: "DONE",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      analysis: {
        select: {
          personaDetected: true,
          objectionTypes: true,
          strengths: true,
          customerSegmentDetected: true,
        },
      },
    },
  });

  const successCases = successLogs.map((log) => {
    const agentLast = log.agentLastName ?? extractLastName(log.agentUserId);
    const segment = (log.analysis as any)?.customerSegmentDetected ?? "고객";
    const objections = ((log.analysis as any)?.objectionTypes as string[] ?? []).join(", ");
    const strengths = ((log.analysis as any)?.strengths as string[] ?? []).slice(0, 1).join("");
    return `${agentLast} 판매원 → ${segment} 상담 → ${objections ? `${objections} 이의 극복` : "이의 없이"} 성약${strengths ? ` (핵심: ${strengths.slice(0, 30)})` : ""}`;
  });

  // 2. 승인된 스크립트 패턴: 같은 조직 + 같은 페르소나 + APPROVED
  const patterns = await prisma.scriptPattern.findMany({
    where: {
      organizationId,
      personaType,
      status: "APPROVED",
    },
    orderBy: { conversionRate: "desc" },
    take: 3,
    select: { patternText: true, conversionRate: true, category: true },
  });

  const scriptPatterns = patterns.map((p) =>
    `[${p.category}] 전환율 ${Math.round(p.conversionRate * 100)}%: ${p.patternText.slice(0, 100)}`
  );

  // 3. 관련 Q&A: 페르소나 관련 카테고리 상위 3건
  const qas = await prisma.botGuideAnswer.findMany({
    where: {
      isActive: true,
      category: { in: categories },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { question: true, answer: true, category: true },
  });

  const relatedQAs = qas.map((q) =>
    `Q: ${q.question.slice(0, 60)} → A: ${q.answer.slice(0, 80)}`
  );

  // 총 사례 수
  const totalCasesInDB = await prisma.aiCallLog.count({
    where: { organizationId, analysisStatus: "DONE" },
  });

  return { successCases, scriptPatterns, relatedQAs, totalCasesInDB };
}

export function formatRagContextForPrompt(ctx: RagContext): string {
  if (ctx.totalCasesInDB === 0) return "";

  const lines: string[] = [
    `\n\n## 우리 팀 실제 데이터 (${ctx.totalCasesInDB}건 분석됨)`,
  ];

  if (ctx.successCases.length > 0) {
    lines.push("\n### 같은 유형 고객 성공사례 (성약 완료):");
    ctx.successCases.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
  }

  if (ctx.scriptPatterns.length > 0) {
    lines.push("\n### 검증된 스크립트 패턴:");
    ctx.scriptPatterns.forEach((p) => lines.push(`• ${p}`));
  }

  if (ctx.relatedQAs.length > 0) {
    lines.push("\n### 자주 묻는 질문 & 답:");
    ctx.relatedQAs.forEach((q) => lines.push(`• ${q}`));
  }

  lines.push(
    "\n위 실제 사례를 참고해 relatedSuccessCases를 구체적이고 사실적으로 작성하라."
  );

  return lines.join("\n");
}
