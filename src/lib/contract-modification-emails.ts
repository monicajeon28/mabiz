/**
 * Contract Modification Email System
 * 심리학 렌즈: L2(중재), L6(손실회피), L7(동반자), L10(긴박감)
 *
 * 이메일 시퀀스:
 * 1. requestCreated (L2): "우리가 당신의 요청을 이해하고 있습니다"
 * 2. approved (L7): "우리가 함께 이 문제를 해결했습니다"
 * 3. rejection (L6): "~~는 불가하지만, ~~는 가능합니다"
 * 4. alternativeProposal (L10): "더 나은 조건을 제안합니다. 3일까지만 유효합니다"
 * 5. expirationWarning (L10): "마지막 알림: 유효기한이 곧 만료됩니다"
 * 6. closure: "최종 처리 완료"
 */

import { logger } from "@/lib/logger";

export interface EmailContext {
  customerName: string;
  fieldName: string;
  currentValue: string;
  newValue: string;
  reason?: string;
  requestId: string;
  expiresAt: Date;
  appliedLenses: string[];
  message?: string;
}

/**
 * 시스템 이메일 발송 (조직의 SMTP 설정 사용)
 */
export async function sendSystemEmail({
  to,
  subject,
  html,
  organizationId,
}: {
  to: string;
  subject: string;
  html: string;
  organizationId?: string;
}): Promise<boolean> {
  try {
    // 조직의 이메일 설정 조회
    const { default: prisma } = await import("@/lib/prisma");
    const { sendEmail, getOrgEmailConfig } = await import("@/lib/email");

    let emailConfig: any = null;
    if (organizationId) {
      emailConfig = await getOrgEmailConfig(organizationId);
    }

    // 대체: .env의 기본 SMTP 설정 사용
    if (!emailConfig) {
      logger.warn("[ContractEmail] Organization email config not found, using default SMTP");
      // 설정 없으면 발송 실패로 처리
      return false;
    }

    const success = await sendEmail({
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpUser: emailConfig.smtpUser,
      smtpPassEncrypted: emailConfig.smtpPassEncrypted,
      senderName: emailConfig.senderName,
      senderEmail: emailConfig.senderEmail,
      to,
      subject,
      html,
    });

    if (success) {
      logger.log("[ContractEmail] 발송 성공", { to, subject });
    } else {
      logger.error("[ContractEmail] 발송 실패", { to, subject });
    }

    return success;
  } catch (err) {
    logger.error("[ContractEmail] 예외 발생", { err });
    return false;
  }
}

/**
 * L2 (5-Step Mediation) - 요청 생성 확인
 * "우리가 당신의 요청을 이해하고 있습니다"
 *
 * 심리학: 중재 5단계
 * 1. 문제 인식 (Problem Recognition)
 * 2. 입장 이해 (Understanding Position)
 * 3. 영향 분석 (Impact Analysis)
 * 4. 해결책 모색 (Solution Search)
 * 5. 합의 도출 (Agreement)
 */
export async function sendRequestCreatedEmail(
  contactEmail: string,
  context: EmailContext,
  organizationId?: string
): Promise<boolean> {
  const timeRemaining = Math.ceil(
    (context.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">🔄 수정 요청이 접수되었습니다</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        귀하의 계약서 수정 요청을 잘 받았습니다.<br>
        <strong>현재 검토 중이며, 최대 24시간 내에 처리해드리겠습니다.</strong>
      </p>

      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #3b82f6;">
        <p style="color: #1f2937; font-weight: 600; margin-top: 0;">📋 요청 항목</p>
        <p style="color: #374151; margin: 8px 0;"><strong>${context.fieldName}</strong></p>
        <div style="background: white; padding: 12px; border-radius: 6px; margin: 12px 0; font-family: 'Courier New', monospace;">
          <p style="color: #6b7280; margin: 4px 0;">현재: <code>${context.currentValue}</code></p>
          <p style="color: #2563eb; margin: 4px 0;">→ 신규: <code style="font-weight: bold;">${context.newValue}</code></p>
        </div>
        ${context.reason ? `<p style="color: #4b5563; margin: 8px 0;"><strong>수정 이유</strong><br>${context.reason}</p>` : ""}
      </div>

      <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0;"><strong>⏰ 유효기한</strong><br>${context.expiresAt.toLocaleDateString("ko-KR")} (${timeRemaining}일 남음)</p>
      </div>

      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        이 기간 동안 요청사항을 검토하여 다음 중 하나로 처리해드립니다:
      </p>
      <ul style="color: #4b5563; font-size: 14px; line-height: 1.8;">
        <li><strong>✅ 승인</strong> - 요청사항을 적용합니다</li>
        <li><strong>💡 대안 제시</strong> - 더 나은 조건을 제안합니다</li>
        <li><strong>❌ 거절</strong> - 불가능한 사유를 설명합니다</li>
      </ul>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: "📋 계약서 수정 요청 접수 완료",
    html,
    organizationId,
  });
}

/**
 * L7 (Companion/Family) + L10 (Urgency) - 승인
 * "우리가 함께 이 문제를 해결했습니다"
 *
 * 심리학:
 * - L7: 동반자 설득 (우리가 함께)
 * - L10: 긴박감 제거 (이제 끝)
 */
export async function sendApprovalEmail(
  contactEmail: string,
  context: EmailContext,
  isAutoApproved: boolean = false,
  organizationId?: string
): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">✅ 수정 사항이 적용되었습니다!</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        ${isAutoApproved ? "귀하의 요청이 자동 승인되었으며" : "귀하의 요청이 승인되었으며"},
        <strong>계약서가 업데이트되었습니다.</strong>
      </p>

      <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="color: #1f2937; font-weight: 600; margin-top: 0;">✅ 적용된 변경사항</p>
        <p style="color: #374151; margin: 8px 0;"><strong>${context.fieldName}</strong></p>
        <div style="background: white; padding: 12px; border-radius: 6px; margin: 12px 0; font-family: 'Courier New', monospace;">
          <p style="color: #6b7280; margin: 4px 0;"><strike>${context.currentValue}</strike></p>
          <p style="color: #10b981; margin: 4px 0; font-weight: bold;">↓</p>
          <p style="color: #10b981; margin: 4px 0; font-weight: bold;">${context.newValue}</p>
        </div>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        🎉 <strong>우리가 함께 이 문제를 해결했습니다.</strong><br>
        추가로 도움이 필요한 사항이 있으시면 언제든지 연락 주세요.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: `✅ 수정 요청 승인됨: ${context.fieldName}`,
    html,
    organizationId,
  });
}

/**
 * L6 (Loss Aversion) - 거절 + 대안 제시
 * "~~는 불가하지만, ~~는 가능합니다"
 *
 * 심리학:
 * - L6: 손실회피 (뭔가 잃을까봐 불안)
 * - 해결: 대안으로 손실 최소화
 */
export async function sendRejectionEmail(
  contactEmail: string,
  context: EmailContext & {
    rejectionReason: string;
    alternatives: string[];
  },
  organizationId?: string
): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">⏸️ 수정 요청 검토 완료</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        귀하의 요청을 검토한 결과, 아쉽게도 <strong>${context.fieldName} 변경은 어렵습니다.</strong>
      </p>

      <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ef4444;">
        <p style="color: #7f1d1d; font-weight: 600; margin-top: 0;">❌ 거절 사유</p>
        <p style="color: #991b1b; margin: 8px 0;">${context.rejectionReason}</p>
      </div>

      <p style="color: #1f2937; font-weight: 600; font-size: 15px; margin: 20px 0;">하지만 다음 옵션이 가능합니다:</p>
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
        ${context.alternatives
          .map(
            (alt, idx) => {
              const [title, desc] = alt.split("|");
              return `
            <div style="margin-bottom: 16px; ${idx === context.alternatives.length - 1 ? "margin-bottom: 0;" : ""}">
              <p style="color: #15803d; font-weight: 600; margin: 0 0 6px 0;">
                ${idx + 1}️⃣ ${title?.trim() || "대안"}
              </p>
              <p style="color: #4b5563; margin: 0; font-size: 14px;">
                ${desc?.trim() || ""}
              </p>
            </div>
            `;
            }
          )
          .join("")}
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        위 옵션 중 어떤 것이 도움이 될까요?<br>
        편한 시간에 연락 주시면 감사하겠습니다.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: `⏸️ 수정 요청 검토 완료: ${context.fieldName}`,
    html,
    organizationId,
  });
}

/**
 * L10 (Urgency) + L7 (Companion) - 대안 제시
 * "더 나은 조건을 제안합니다. 3일까지만 유효합니다"
 *
 * 심리학:
 * - L10: 희소성/긴박감 (3일까지만)
 * - L7: 함께 더 나은 조건 찾자
 */
export async function sendAlternativeProposalEmail(
  contactEmail: string,
  context: EmailContext & {
    proposedValue: string;
    proposedReason: string;
  },
  organizationId?: string
): Promise<boolean> {
  const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">💡 더 나은 조건을 제안합니다!</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        귀하의 요청을 검토한 결과, <strong>더 나은 조건을 제안해드리고 싶습니다.</strong>
      </p>

      <div style="background: #faf5ff; border: 1px solid #e9d5ff; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #a855f7;">
        <p style="color: #6b21a8; font-weight: 600; margin-top: 0;">🎯 우리의 제안</p>

        <div style="background: white; padding: 12px; border-radius: 6px; margin: 12px 0;">
          <p style="color: #6b7280; margin: 4px 0; font-size: 14px;"><strong>귀하의 요청:</strong></p>
          <p style="color: #374151; margin: 4px 0; font-family: 'Courier New', monospace;"><code>${context.newValue}</code></p>
        </div>

        <div style="text-align: center; margin: 12px 0;">
          <p style="color: #9333ea; font-size: 20px; margin: 0;">⬇️</p>
        </div>

        <div style="background: #f5f3ff; padding: 12px; border-radius: 6px; margin: 12px 0; border: 2px solid #a855f7;">
          <p style="color: #6b21a8; margin: 4px 0; font-size: 14px; font-weight: 600;"><strong>우리 제안:</strong></p>
          <p style="color: #a855f7; margin: 4px 0; font-family: 'Courier New', monospace; font-weight: bold;"><code>${context.proposedValue}</code></p>
        </div>

        <p style="color: #4b5563; margin: 12px 0; font-size: 14px;">
          <strong>왜 더 좋은가?</strong><br>
          ${context.proposedReason}
        </p>
      </div>

      <div style="background: #fef3c7; border: 2px solid #fcd34d; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0; font-weight: 600;">⏰ 제한된 시간 오퍼</p>
        <p style="color: #92400e; margin: 8px 0; font-size: 15px;">
          <strong>이 제안은 ${deadline.toLocaleDateString("ko-KR")}까지만 유효합니다.</strong>
        </p>
        <p style="color: #92400e; margin: 8px 0; font-size: 14px;">
          지금 승인하시겠습니까? 더 나은 조건을 놓치지 마세요!
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: `💡 새로운 제안: ${context.fieldName}`,
    html,
    organizationId,
  });
}

/**
 * L10 (Final Urgency) - 만료 알림
 * "마지막 알림: 유효기한이 곧 만료됩니다"
 */
export async function sendExpirationWarningEmail(
  contactEmail: string,
  context: EmailContext,
  organizationId?: string
): Promise<boolean> {
  const hoursRemaining = Math.ceil(
    (context.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">⏰ 마지막 알림: 수정 요청 유효기한</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #dc2626; font-size: 15px; line-height: 1.6; font-weight: 600;">
        ${context.fieldName} 수정 요청의 <strong>유효기한이 곧 만료됩니다.</strong>
      </p>

      <div style="background: #fee2e2; border: 2px solid #fca5a5; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #dc2626;">
        <p style="color: #7f1d1d; font-weight: 600; margin-top: 0;">⏰ 유효기한</p>
        <p style="color: #dc2626; margin: 8px 0; font-size: 16px; font-weight: bold;">
          ${context.expiresAt.toLocaleDateString("ko-KR")}
          ${hoursRemaining > 0 ? `(${hoursRemaining}시간 남음)` : "(오늘 자정)"}
        </p>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        <strong>유효기한 이내에 처리해드리지 못하면 요청이 자동 종료됩니다.</strong><br>
        지금 바로 승인 또는 거절 부탁드립니다.
      </p>

      <div style="background: #fef2f2; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <p style="color: #991b1b; font-size: 14px; margin: 0;">
          💡 지금 조치를 취하지 않으면 요청이 자동으로 종료될 예정입니다.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: `⏰ 긴급: 수정 요청 만료 예정 ${context.expiresAt.toLocaleDateString("ko-KR")}`,
    html,
    organizationId,
  });
}

/**
 * L10 (Urgency Final) - 재서명 완료
 * "계약서가 확정되었습니다. 축하합니다!"
 *
 * 심리학:
 * - L10: 긴박감 해제 (최종 완료)
 * - L7: 함께 목표 달성
 */
export async function sendReSignCompletedEmail(
  contactEmail: string,
  context: EmailContext,
  organizationId?: string
): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">✅ 계약서가 최종 확정되었습니다!</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        귀하의 재서명이 완료되었으며,<br>
        <strong>수정된 계약서가 최종 확정되었습니다.</strong>
      </p>

      <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="color: #1f2937; font-weight: 600; margin-top: 0;">✅ 적용된 수정사항</p>
        <p style="color: #374151; margin: 8px 0;"><strong>${context.fieldName}</strong></p>
        <div style="background: white; padding: 12px; border-radius: 6px; margin: 12px 0; font-family: 'Courier New', monospace;">
          <p style="color: #6b7280; margin: 4px 0;"><strike>${context.currentValue}</strike></p>
          <p style="color: #10b981; margin: 4px 0; font-weight: bold;">↓</p>
          <p style="color: #10b981; margin: 4px 0; font-weight: bold;">${context.newValue}</p>
        </div>
      </div>

      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #15803d; font-size: 15px; line-height: 1.6;">
          🎉 <strong>모든 절차가 완료되었습니다.</strong><br>
          계약서는 완전히 유효하며, 언제든지 조회하실 수 있습니다.
        </p>
      </div>

      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        <strong>다음 단계:</strong>
      </p>
      <ul style="color: #4b5563; font-size: 14px; line-height: 1.8;">
        <li>📥 계약서를 다시 다운로드할 수 있습니다</li>
        <li>📧 계약서 사본이 이메일로 전송됩니다</li>
        <li>⏱️ 다음 예정일: [자동으로 생성됨]</li>
      </ul>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: `✅ 계약서 재서명 완료 - ${context.fieldName}`,
    html,
    organizationId,
  });
}

/**
 * 종료 알림 - 최종 상태
 * (승인됨, 거절됨, 만료됨, 대안 수락)
 */
export async function sendClosureEmail(
  contactEmail: string,
  context: EmailContext & {
    closureReason: "APPROVED" | "REJECTED" | "EXPIRED" | "ALTERNATIVE_ACCEPTED";
  },
  organizationId?: string
): Promise<boolean> {
  const messages: Record<
    "APPROVED" | "REJECTED" | "EXPIRED" | "ALTERNATIVE_ACCEPTED",
    { title: string; icon: string; message: string }
  > = {
    APPROVED: {
      title: "✅ 수정이 적용되었습니다",
      icon: "✅",
      message: "요청하신 사항이 승인되어 계약서에 적용되었습니다.",
    },
    REJECTED: {
      title: "❌ 요청이 최종 거절되었습니다",
      icon: "❌",
      message: "요청하신 사항을 검토한 결과, 적용이 어렵습니다.",
    },
    EXPIRED: {
      title: "⏰ 유효기한이 만료되었습니다",
      icon: "⏰",
      message: "요청하신 사항의 유효기한이 만료되었습니다.",
    },
    ALTERNATIVE_ACCEPTED: {
      title: "✅ 대안이 수락되었습니다",
      icon: "✅",
      message: "제안한 대안이 수락되어 계약서에 적용됩니다.",
    },
  };

  const msg = messages[context.closureReason];

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">${msg.icon} ${msg.title}</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        안녕하세요, <strong>${context.customerName}</strong>님!
      </p>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        ${msg.message}
      </p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="color: #374151; margin: 0;"><strong>${context.fieldName}</strong></p>
        <p style="color: #6b7280; margin: 8px 0; font-size: 14px;">
          최종 상태: <code>${context.newValue}</code>
        </p>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        추가로 도움이 필요한 사항이 있으시면 언제든지 연락 주세요.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
        감사합니다!<br>
        <strong>마비즈 CRM 팀</strong>
      </p>
    </div>
  `;

  return sendSystemEmail({
    to: contactEmail,
    subject: msg.title,
    html,
    organizationId,
  });
}
