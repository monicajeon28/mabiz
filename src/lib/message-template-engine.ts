import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface MessageTemplate {
  id: string;
  name: string;
  type: "SMS" | "EMAIL" | "CALL";
  content: string; // With {{variable}} placeholders
  variables: string[]; // Extracted variable names
  psychologyLens: string; // L0-L10
  tone: "FRIENDLY" | "URGENT" | "PROFESSIONAL" | "EMPATHETIC";
  language: "KO" | "EN" | "ZH";
  tags: string[];
  conversionRate?: number; // Historical performance
  createdAt: Date;
}

export interface MessageContext {
  contactId: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  customVariables?: Record<string, any>;
  segment?: string;
  lens?: string;
}

// Template variable extraction and substitution
export function extractVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1]);
  }

  return Array.from(new Set(variables));
}

export function renderMessage(
  template: string,
  context: MessageContext
): string {
  let message = template;

  // Built-in variables
  const builtInVars = {
    name: context.contactName,
    contactName: context.contactName,
    phone: context.contactPhone || "",
    email: context.contactEmail || "",
    segment: context.segment || "",
    lens: context.lens || "",
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    currentDate: new Date().getDate(),
  };

  // Replace built-in variables
  for (const [key, value] of Object.entries(builtInVars)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }

  // Replace custom variables
  if (context.customVariables) {
    for (const [key, value] of Object.entries(context.customVariables)) {
      message = message.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value)
      );
    }
  }

  return message;
}

// Tone-based message variations
export function generateToneVariation(
  message: string,
  targetTone: "FRIENDLY" | "URGENT" | "PROFESSIONAL" | "EMPATHETIC"
): string {
  const tonePatterns: Record<string, Record<string, string>> = {
    FRIENDLY: {
      subject: "제목",
      greeting: "안녕 {{name}}님! 😊",
      closing: "항상 응원합니다! 💪",
    },
    URGENT: {
      subject: "🚨 긴급",
      greeting: "{{name}}님께 중요한 안내",
      closing: "⏰ 지금 바로 확인하세요!",
    },
    PROFESSIONAL: {
      greeting: "{{name}} 회장님께",
      closing: "감사합니다.",
    },
    EMPATHETIC: {
      greeting: "{{name}}님, 저희가 이해합니다",
      closing: "언제든 도움이 필요하시면 연락주세요.",
    },
  };

  // Apply tone-specific modifications
  const patterns = tonePatterns[targetTone] || {};
  let modified = message;

  for (const [pattern, replacement] of Object.entries(patterns)) {
    if (modified.includes(pattern)) {
      modified = modified.replace(pattern, replacement);
    }
  }

  return modified;
}

// Ebbinghaus Forgetting Curve: optimal repetition timing
export function calculateOptimalRepetitionSchedule(
  contactId: string,
  initialDate: Date
): Date[] {
  // Based on Ebbinghaus spaced repetition intervals
  const intervals = [0, 1, 3, 7, 14, 30]; // Days
  return intervals.map(
    (days) => new Date(initialDate.getTime() + days * 24 * 60 * 60 * 1000)
  );
}

// Psychology lens-based message suggestions
export function suggestMessageByLens(lens: string): MessageTemplate[] {
  const lensTemplates: Record<string, Partial<MessageTemplate>[]> = {
    L0: [
      {
        name: "L0 Reactivation - Problem",
        content:
          "{{name}}님, 최근 연락이 없었네요. 혹시 문제가 있으신가요? 😟",
        psychologyLens: "L0",
        tone: "EMPATHETIC",
      },
      {
        name: "L0 Reactivation - Incentive",
        content:
          "{{name}}님 생각이 듭니다! 복귀 보너스 20% OFF 특별 제안 🎁",
        psychologyLens: "L0",
        tone: "FRIENDLY",
      },
    ],
    L6: [
      {
        name: "L6 Loss Aversion - Time Pressure",
        content:
          "⏰ {{name}}님! 이 특가는 오늘까지만 유효합니다. 놓치지 마세요!",
        psychologyLens: "L6",
        tone: "URGENT",
      },
      {
        name: "L6 Scarcity - Limited Stock",
        content: "🔥 남은 자리: 3석 → {{name}}님을 위해 예약해드릴까요?",
        psychologyLens: "L6",
        tone: "URGENT",
      },
    ],
    L10: [
      {
        name: "L10 Immediate Action - Decision",
        content:
          "{{name}}님, 지금이 결정의 시간입니다! 예약하기 →  [LINK]",
        psychologyLens: "L10",
        tone: "PROFESSIONAL",
      },
      {
        name: "L10 Closing - Commitment",
        content:
          "{{name}}님의 신청을 기다리고 있습니다. 확인 버튼을 눌러주세요.",
        psychologyLens: "L10",
        tone: "PROFESSIONAL",
      },
    ],
  };

  return (lensTemplates[lens] || []).map((t) => ({
    id: `template-${Math.random()}`,
    type: "SMS",
    variables: extractVariables(t.content || ""),
    createdAt: new Date(),
    ...t,
  } as MessageTemplate));
}

// A/B test message variants
export async function createMessageVariant(
  originalTemplate: string,
  variations: number = 2
): Promise<string[]> {
  const variants: string[] = [originalTemplate];

  for (let i = 1; i < variations; i++) {
    const tone = ["FRIENDLY", "URGENT", "PROFESSIONAL"][
      i % 3
    ] as "FRIENDLY" | "URGENT" | "PROFESSIONAL";
    variants.push(generateToneVariation(originalTemplate, tone));
  }

  return variants;
}

// Performance tracking
export async function updateTemplatePerformance(
  templateId: string,
  successCount: number,
  totalCount: number
): Promise<void> {
  const conversionRate = (successCount / totalCount) * 100;

  logger.log("[Message Template] Performance updated", {
    templateId,
    successCount,
    totalCount,
    conversionRate: `${conversionRate.toFixed(1)}%`,
  });

  // TODO: Store in database for historical tracking
}

// Language localization
export async function translateMessage(
  message: string,
  targetLanguage: "KO" | "EN" | "ZH"
): Promise<string> {
  // TODO: Implement actual translation via Google Translate API or similar
  // For now, return as-is
  logger.log("[Message Template] Translation requested", {
    targetLanguage,
    length: message.length,
  });

  return message;
}
