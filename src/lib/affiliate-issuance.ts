import "server-only";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const PREFIX_MAP: Record<string, string> = {
  BRANCH_MANAGER: "boss",
  SALES_AGENT: "user",
  PRE_SALES: "free",
  HQ: "hq",
};

export function getAffiliatePrefix(type: string): string {
  return PREFIX_MAP[type] ?? "user";
}

/** mallUserId 채번: prefix+최소 빈 번호 (몰 generatePartnerId와 동일 규칙) */
export async function generateMallUserId(type: string): Promise<string> {
  const prefix = getAffiliatePrefix(type);
  const existing = await prisma.gmUser.findMany({
    where: { phone: { startsWith: prefix } },
    select: { phone: true },
  });

  const regex = new RegExp(`^${prefix}(\\d{1,5})(?:-.*)?$`);
  const usedNums = new Set<number>();
  for (const u of existing) {
    if (u.phone) {
      const m = u.phone.match(regex);
      if (m) usedNums.add(parseInt(m[1], 10));
    }
  }

  let n = 1;
  while (usedNums.has(n)) n++;
  return `${prefix}${n}`;
}

/** affiliateCode: mallUserId 기반 고유 코드 생성 */
export function buildAffiliateCode(name: string, mallUserId: string): string {
  const namePart = name
    .replace(/\s+/g, "")
    .slice(0, 4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const base = namePart ? `${mallUserId}_${namePart}` : mallUserId;
  return base.replace(/[^a-z0-9_-]/g, "");
}

/** affiliateCode 중복 시 번호 접미사 붙여 고유값 반환 */
export async function ensureUniqueAffiliateCode(base: string): Promise<string> {
  let code = base;
  let i = 1;
  for (;;) {
    const exists = await prisma.gmAffiliateProfile.findUnique({
      where: { affiliateCode: code },
      select: { id: true },
    });
    if (!exists) return code;
    code = `${base}${i++}`;
  }
}

/** mallUserId 중복 확인 */
export async function isMallUserIdTaken(mallUserId: string): Promise<boolean> {
  const u = await prisma.gmUser.findFirst({
    where: { OR: [{ phone: mallUserId }, { mallUserId }] },
    select: { id: true },
  });
  return !!u;
}

export async function hashAffiliatePassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export interface IssueAffiliateInput {
  type: string;
  name: string;
  displayName?: string;
  nickname?: string;
  contactPhone?: string;
  contactEmail?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  withholdingRate?: number;
  agentCommissionRate?: number;
  guarantorName?: string;
  guarantorId?: number;
  managerProfileId?: number;
  contractSignedAt?: Date;
  contractSignature?: string;
  contractIp?: string;
  contractVersion?: string;
  contractUserAgent?: string;
  initialPassword?: string;
}

export interface IssueAffiliateResult {
  userId: number;
  mallUserId: string;
  profileId: number;
  affiliateCode: string;
  relationId?: number;
}
