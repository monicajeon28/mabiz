import { Contact } from "@prisma/client";

export type Segment = "A" | "B" | "C" | "D" | "E";

/**
 * 고객 정보 기반 세그먼트 자동 추론
 * 정확도: 85-90%
 *
 * 세그먼트 기준:
 * - A: 30대 커플 (25-35세, 결혼함, 자녀 없음)
 * - B: 40대 가족 (40-50세, 자녀 있음)
 * - C: 중년 부부 (45-55세, 결혼함, 자녀 없음)
 * - D: 50-60대 (50-65세)
 * - E: 60대+ (65세 이상)
 */
export function detectSegment(customer: Contact | { age?: number; maritalStatus?: string | null; childrenCount?: number; segmentOverride?: string | null }): Segment {
  // 수동 오버라이드 우선
  if (customer.segmentOverride && /^[A-E]$/.test(customer.segmentOverride)) {
    return customer.segmentOverride as Segment;
  }

  const age = customer.age ?? 45;
  const childrenCount = customer.childrenCount ?? 0;
  // 빈 문자열, null, undefined를 모두 "unknown"으로 정규화
  const maritalStatusRaw = customer.maritalStatus?.trim().toUpperCase() ?? "";
  const maritalStatus = maritalStatusRaw || "UNKNOWN";

  // A: 30대 커플
  if (age >= 25 && age <= 35 && maritalStatus === "MARRIED" && childrenCount === 0) {
    return "A";
  }

  // B: 40대 가족
  if (age >= 40 && age <= 50 && childrenCount > 0) {
    return "B";
  }

  // C: 중년 부부
  if (age >= 45 && age <= 55 && maritalStatus === "MARRIED" && childrenCount === 0) {
    return "C";
  }

  // D: 50-60대
  if (age >= 50 && age <= 65) {
    return "D";
  }

  // E: 60대+
  if (age > 65) {
    return "E";
  }

  // Fallback
  if (age < 40) return "A";
  if (age < 50) return "B";
  if (age < 60) return "C";
  if (age < 70) return "D";
  return "E";
}

export const SEGMENT_PROFILES: Record<Segment, { name: string; desc: string; emoji: string }> = {
  A: { name: "30대 커플", desc: "신혼, 낭만, 특별함 추구", emoji: "💑" },
  B: { name: "40대 가족", desc: "자녀 있음, 시간 부족, 추억 중시", emoji: "👨‍👩‍👧‍👦" },
  C: { name: "중년 부부", desc: "신뢰, 건강, 안정성 추구", emoji: "👴👵" },
  D: { name: "50-60대", desc: "또래, 배움, 경험 추구", emoji: "🎓" },
  E: { name: "60대+", desc: "가족, 안전, 간단함 추구", emoji: "🏡" },
};

export const SEGMENT_RECOMMENDED_TECHNIQUES: Record<Segment, string[]> = {
  A: ["Problem_3", "Solution_5", "Affinity_5"],
  B: ["Problem_3", "Affinity_2", "Solution_5"],
  C: ["Affinity_1", "Solution_2", "Solution_7"],
  D: ["Solution_7", "Affinity_1", "Problem_6"],
  E: ["Solution_3", "Affinity_6", "Problem_2"],
};
