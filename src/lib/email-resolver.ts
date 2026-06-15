/**
 * 이메일 SMTP 설정 Resolver
 *
 * 알리고 resolveUserSmsConfig() 패턴과 동일하게
 * 개인(UserEmailConfig) → 그룹(GroupEmailConfig) → 조직(OrgEmailConfig) → 환경변수
 * 순서로 폴백하여 사용 가능한 SMTP 설정을 반환합니다.
 *
 * 호출 예시:
 *   const cfg = await resolveUserEmailConfig(organizationId, { userId, groupId });
 *   if (!cfg) throw new Error('이메일 설정이 없습니다');
 *   // cfg.smtpHost, cfg.smtpPassword, cfg.source 사용
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/crypto";

export interface ResolvedEmailConfig {
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecure: boolean;
  /** 어느 계층에서 설정을 가져왔는지 — 디버깅/로깅용 */
  source: "user" | "group" | "org" | "env";
}

export async function resolveUserEmailConfig(
  organizationId: string,
  options?: {
    /** 판매원/대리점장 개인 SMTP */
    userId?: string;
    /** 그룹별 SMTP */
    groupId?: string;
  }
): Promise<ResolvedEmailConfig | null> {
  const { userId, groupId } = options ?? {};

  // ─────────────────────────────────────────────────────────────────────
  // 1단계: 개인 SMTP (UserEmailConfig)
  // ─────────────────────────────────────────────────────────────────────
  if (userId) {
    const userCfg = await prisma.userEmailConfig.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (
      userCfg?.isActive &&
      userCfg.isVerified &&
      userCfg.smtpHost &&
      userCfg.smtpUsername &&
      userCfg.smtpPasswordEncrypted
    ) {
      try {
        const smtpPassword = decrypt(
          userCfg.smtpPasswordEncrypted,
          "EMAIL_ENCRYPT_KEY"
        );
        logger.log("[EmailResolver] 개인 SMTP 사용", { userId, organizationId });
        return {
          senderName: userCfg.senderName || "마비즈",
          senderEmail: userCfg.senderEmail || userCfg.smtpUsername,
          smtpHost: userCfg.smtpHost,
          smtpPort: userCfg.smtpPort ?? 587,
          smtpUsername: userCfg.smtpUsername,
          smtpPassword,
          smtpSecure: userCfg.smtpSecure ?? false,
          source: "user",
        };
      } catch (err) {
        logger.error(
          "[EmailResolver] UserEmailConfig 복호화 실패 — 그룹/조직으로 폴백",
          { userId, err }
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2단계: 그룹 SMTP (GroupEmailConfig)
  // ─────────────────────────────────────────────────────────────────────
  if (groupId) {
    const groupCfg = await prisma.groupEmailConfig.findFirst({
      where: { groupId, isActive: true, isVerified: true },
    });

    if (
      groupCfg?.smtpHost &&
      groupCfg.smtpUsername &&
      groupCfg.smtpPasswordEncrypted
    ) {
      try {
        const smtpPassword = decrypt(
          groupCfg.smtpPasswordEncrypted,
          "EMAIL_ENCRYPT_KEY"
        );
        logger.log("[EmailResolver] 그룹 SMTP 사용", {
          groupId,
          organizationId,
        });
        return {
          senderName: groupCfg.senderName || "마비즈",
          senderEmail: groupCfg.senderEmail || groupCfg.smtpUsername,
          smtpHost: groupCfg.smtpHost,
          smtpPort: groupCfg.smtpPort ?? 587,
          smtpUsername: groupCfg.smtpUsername,
          smtpPassword,
          smtpSecure: groupCfg.smtpSecure ?? false,
          source: "group",
        };
      } catch (err) {
        logger.error(
          "[EmailResolver] GroupEmailConfig 복호화 실패 — 조직으로 폴백",
          { groupId, err }
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3단계: 조직 SMTP (OrgEmailConfig)
  // ─────────────────────────────────────────────────────────────────────
  const orgCfg = await prisma.orgEmailConfig.findUnique({
    where: { organizationId },
  });

  if (orgCfg?.isActive && orgCfg.smtpHost && orgCfg.smtpUser && orgCfg.smtpPassEncrypted) {
    try {
      const smtpPassword = decrypt(orgCfg.smtpPassEncrypted, "EMAIL_ENCRYPT_KEY");
      logger.log("[EmailResolver] 조직 SMTP 사용", { organizationId });
      return {
        senderName: orgCfg.senderName || "마비즈",
        senderEmail: orgCfg.senderEmail || orgCfg.smtpUser,
        smtpHost: orgCfg.smtpHost,
        smtpPort: orgCfg.smtpPort ?? 587,
        smtpUsername: orgCfg.smtpUser,
        smtpPassword,
        smtpSecure: false,
        source: "org",
      };
    } catch (err) {
      logger.error(
        "[EmailResolver] OrgEmailConfig 복호화 실패 — 환경변수로 폴백",
        { organizationId, err }
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4단계: 환경변수 폴백
  // ─────────────────────────────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    logger.log("[EmailResolver] 환경변수 SMTP 사용", { organizationId });
    return {
      senderName: process.env.SMTP_SENDER_NAME ?? "마비즈",
      senderEmail: process.env.SMTP_SENDER_EMAIL ?? smtpUser,
      smtpHost,
      smtpPort: Number(process.env.SMTP_PORT ?? "587"),
      smtpUsername: smtpUser,
      smtpPassword: smtpPass,
      smtpSecure: process.env.SMTP_SECURE === "true",
      source: "env",
    };
  }

  logger.warn("[EmailResolver] 사용 가능한 SMTP 설정 없음", {
    organizationId,
    userId,
    groupId,
  });
  return null;
}
