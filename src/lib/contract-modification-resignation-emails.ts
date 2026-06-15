/**
 * Contract Re-Signing Email Templates
 * Psychology: L7 (Companion/협력) + L10 (Urgency/긴박감)
 * Phase 7: Email Notifications for Contract Modifications & Re-Signing
 */

import { sendFunnelEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export interface ReSignEmailContext {
  customerName: string;
  fieldName: string;
  currentValue: string;
  newValue: string;
  reason?: string;
  requestId: string;
  expiresAt: Date;
  appliedLenses: string[];
  reSignUrl?: string; // e.g., /contracts/{id}/re-sign
  qrCodeUrl?: string;
}

export interface ReSignCompletedContext extends ReSignEmailContext {
  finalContractUrl?: string;
  completedAt?: Date;
}

// ─── Field Label Mapping ───────────────────────────────────────
const fieldLabels: Record<string, string> = {
  tripDate: "📅 여행 날짜",
  roomType: "🏨 객실 타입",
  contactInfo: "📞 연락처",
  specialRequest: "💬 특별 요청",
  dietaryRestriction: "🍽️ 식이 제한",
  price: "💰 가격",
  guestCount: "👥 탑승 인원",
  departurePort: "🚢 출발 항구",
  returnPort: "⚓ 귀항 항구",
  cabinSelection: "🛏️ 객실 선택",
  insuranceOption: "🛡️ 보험 옵션",
  paymentMethod: "💳 결제 방식",
  pickupLocation: "📍 픽업 위치",
  hotelPreference: "🏨 호텔 선호도",
  mobilityNeeds: "♿ 이동 지원 필요",
  petPolicy: "🐾 반려동물",
};

/**
 * L7 (Companion) + L10 (Urgency): 재서명 초대 이메일
 * "변경 사항을 함께 확인했습니다. 재서명 부탁드립니다."
 */
export async function sendReSignInviteEmail(
  organizationId: string,
  contactEmail: string,
  context: ReSignEmailContext
): Promise<boolean> {
  try {
    const timeRemaining = Math.ceil(
      (context.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const displayFieldName = fieldLabels[context.fieldName] || context.fieldName;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <!-- 헤더 -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✏️ 재서명이 필요합니다</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">계약서 변경 사항을 확인하고 재서명해주세요</p>
        </div>

        <!-- 본문 -->
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            안녕하세요, <strong>${context.customerName}</strong>님!
          </p>

          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            귀하의 계약서의 다음 항목이 수정되었습니다. <strong>변경 사항을 확인</strong>하신 후
            <strong style="color: #667eea;">재서명</strong>해주시기 바랍니다.
          </p>

          <!-- 변경 사항 카드 -->
          <div style="background: #f5f7ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px; font-weight: 600;">📝 수정 항목</h3>

            <p style="margin: 0 0 10px 0; font-weight: 600; color: #333; font-size: 15px;">
              ${displayFieldName}
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
              <!-- 현재값 -->
              <div>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; font-weight: 500;">변경 전:</p>
                <code style="background: white; border: 1px solid #ddd; padding: 10px; border-radius: 4px; display: block; color: #333; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-word;">
                  ${context.currentValue}
                </code>
              </div>

              <!-- 새값 -->
              <div>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #4caf50; font-weight: 500;">변경 후:</p>
                <code style="background: #e8f5e9; border: 1px solid #4caf50; padding: 10px; border-radius: 4px; display: block; color: #2e7d32; font-weight: 600; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-word;">
                  ${context.newValue}
                </code>
              </div>
            </div>

            ${
              context.reason
                ? `
              <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #ddd; font-size: 13px; color: #666;">
                <strong>변경 이유:</strong> "${context.reason}"
              </p>
            `
                : ""
            }
          </div>

          <!-- 긴박감 배너 (L10) -->
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404; line-height: 1.8; font-size: 14px;">
              <strong>⏰ 중요:</strong> 이 재서명 요청은 <strong style="color: #ff6b6b;">${timeRemaining}일간</strong> 유효합니다.
              <strong style="color: #ff6b6b;">지금 바로</strong> 재서명하시기를 권장합니다.
            </p>
          </div>

          <!-- CTA 버튼 -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${context.reSignUrl || "#"}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
              🔐 재서명하기 (클릭)
            </a>
          </div>

          ${
            context.qrCodeUrl
              ? `
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 12px; color: #999; margin-bottom: 10px;">또는 QR 코드로 접속:</p>
              <img src="${context.qrCodeUrl}" alt="QR Code" style="width: 150px; height: 150px; border: 1px solid #eee; border-radius: 4px;">
            </div>
          `
              : ""
          }

          <!-- 심리학 메시지 (L7: Companion + L10: Urgency) -->
          <div style="background: #f0f4ff; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center;">
            <p style="margin: 0; color: #667eea; font-size: 14px; line-height: 1.6;">
              💡 <strong>함께 최종 결정을 내리겠습니다.</strong>
              <br>
              변경 사항이 맞다면, <strong style="color: #ff6b6b;">지금 바로</strong> 재서명해주세요.
            </p>
          </div>

          <!-- 안내 -->
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #666;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-weight: 600;">재서명 과정:</h4>
            <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>위의 "재서명하기" 버튼을 클릭</li>
              <li>변경 사항을 최종 확인</li>
              <li>서명 입력 (마우스 또는 터치)</li>
              <li>서명 완료 후 이메일 수신</li>
            </ol>
          </div>

          <p style="margin: 20px 0 0 0; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
            문의사항이 있으시면 고객지원팀에 연락주세요.
          </p>
        </div>

        <!-- 푸터 -->
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999; border-radius: 0 0 8px 8px;">
          <p style="margin: 0;">마비즈 CRM | 계약서 재서명 시스템</p>
          <p style="margin: 5px 0 0 0;">이 이메일은 자동으로 발송되었습니다. 회신 불가.</p>
        </div>
      </div>
    `;

    const result = await sendFunnelEmail({
      organizationId,
      to: contactEmail,
      subject: `📝 재서명 필요: ${displayFieldName} 변경 사항 (${timeRemaining}일 내 완료)`,
      html,
      channel: "CONTRACT_RESIGNING",
    });

    const success = result.result_code === 1;

    if (success) {
      logger.log("[ReSignEmail] 재서명 초대 이메일 발송 성공", {
        contactEmail,
        fieldName: context.fieldName,
        requestId: context.requestId,
      });
    } else {
      logger.log("[ReSignEmail] 재서명 초대 이메일 발송 실패", {
        contactEmail,
        result,
      });
    }

    return success;
  } catch (error) {
    logger.log("[ReSignEmail] 재서명 초대 이메일 발송 중 오류", {
      contactEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * L10 (Urgency 해제) + L7 (Collaboration): 재서명 완료 확인 이메일
 * "✅ 재서명 완료! 최종 계약서를 첨부합니다."
 */
export async function sendReSignCompletedEmail(
  organizationId: string,
  contactEmail: string,
  context: ReSignCompletedContext
): Promise<boolean> {
  try {
    const displayFieldName = fieldLabels[context.fieldName] || context.fieldName;
    const completedAt = context.completedAt || new Date();

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <!-- 성공 헤더 -->
        <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✅ 재서명 완료!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">계약서가 최종 확정되었습니다</p>
        </div>

        <!-- 본문 -->
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            안녕하세요, <strong>${context.customerName}</strong>님!
          </p>

          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            재서명이 완료되었습니다. 변경된 계약서의 최종 버전을 아래에서 다운로드하실 수 있습니다.
          </p>

          <!-- 완료 카드 -->
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 16px; font-weight: 600;">📋 확정된 변경사항</h3>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 10px; color: #333; width: 30%; font-weight: 600;">항목:</td>
                <td style="padding: 10px; color: #2e7d32; font-weight: 600;">${displayFieldName}</td>
              </tr>
              <tr style="background: #f1f8f6;">
                <td style="padding: 10px; color: #333; font-weight: 600;">변경 내용:</td>
                <td style="padding: 10px; color: #333;">
                  <code style="font-family: 'Courier New', monospace;">${context.currentValue}</code>
                  <strong style="color: #666;"> → </strong>
                  <strong style="color: #4caf50;">${context.newValue}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #333; font-weight: 600;">확정 시간:</td>
                <td style="padding: 10px; color: #333;">${completedAt.toLocaleString("ko-KR")}</td>
              </tr>
            </table>
          </div>

          <!-- 다운로드 CTA -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${context.finalContractUrl || "#"}"
               style="display: inline-block; background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
              📥 최종 계약서 다운로드
            </a>
          </div>

          <!-- 심리학 메시지 (L7 + L10 해제) -->
          <div style="background: #f0f4ff; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center;">
            <p style="margin: 0; color: #4caf50; font-size: 14px; line-height: 1.6;">
              🎉 <strong>우리가 함께 최종 결정을 내렸습니다!</strong>
              <br>
              변경된 계약서가 완전히 확정되었으니 안심하세요.
            </p>
          </div>

          <!-- 감사 로그 안내 -->
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #666;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-weight: 600;">📊 이 계약서의 모든 변경 사항:</h4>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>변경 요청 날짜</li>
              <li>승인 날짜</li>
              <li>재서명 날짜</li>
              <li>모든 항목 기록</li>
            </ul>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
              감사 로그는 계약서 상세 페이지에서 확인할 수 있습니다.
            </p>
          </div>

          <!-- 다음 단계 -->
          <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px; border: 1px solid #e0e0e0;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 14px; font-weight: 600;">🚀 다음 단계:</h4>
            <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.6;">
              최종 계약서를 다운로드하여 안전한 장소에 저장하시길 권장합니다.
              모든 변경사항은 감사 로그에 기록되며, 언제든지 확인할 수 있습니다.
            </p>
          </div>

          <p style="margin: 20px 0 0 0; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
            다른 문의사항이 있으시면 고객지원팀에 연락주세요.
          </p>
        </div>

        <!-- 푸터 -->
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999; border-radius: 0 0 8px 8px;">
          <p style="margin: 0;">마비즈 CRM | 계약서 관리 시스템</p>
          <p style="margin: 5px 0 0 0;">모든 변경사항은 감사 로그에 기록됩니다.</p>
        </div>
      </div>
    `;

    const result = await sendFunnelEmail({
      organizationId,
      to: contactEmail,
      subject: `✅ 재서명 완료: 최종 계약서 준비됨`,
      html,
      channel: "CONTRACT_RESIGNING",
    });

    const success = result.result_code === 1;

    if (success) {
      logger.log("[ReSignEmail] 재서명 완료 이메일 발송 성공", {
        contactEmail,
        fieldName: context.fieldName,
        requestId: context.requestId,
      });
    } else {
      logger.log("[ReSignEmail] 재서명 완료 이메일 발송 실패", {
        contactEmail,
        result,
      });
    }

    return success;
  } catch (error) {
    logger.log("[ReSignEmail] 재서명 완료 이메일 발송 중 오류", {
      contactEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 변경 거부 알림 이메일
 * "📌 계약서 변경 요청이 거부되었습니다."
 */
export async function sendModificationRejectedEmail(
  organizationId: string,
  contactEmail: string,
  context: {
    customerName: string;
    fieldName: string;
    currentValue: string;
    proposedValue: string;
    rejectionReason?: string;
    supportContactEmail?: string;
  }
): Promise<boolean> {
  try {
    const displayFieldName =
      fieldLabels[context.fieldName] || context.fieldName;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <!-- 헤더 -->
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700;">📌 변경 요청 검토 결과</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">변경 요청이 거부되었습니다</p>
        </div>

        <!-- 본문 -->
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            안녕하세요, <strong>${context.customerName}</strong>님!
          </p>

          <p style="margin: 0 0 20px 0; line-height: 1.8; font-size: 15px;">
            요청하신 계약서 변경사항에 대해 검토가 완료되었습니다.
          </p>

          <!-- 거부 카드 -->
          <div style="background: #ffebee; border-left: 4px solid #ff6b6b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 15px 0; color: #c62828; font-size: 16px; font-weight: 600;">❌ 거부된 변경사항</h3>

            <p style="margin: 0 0 10px 0; font-weight: 600; color: #333; font-size: 15px;">
              ${displayFieldName}
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
              <div>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; font-weight: 500;">현재 값:</p>
                <code style="background: white; border: 1px solid #ddd; padding: 10px; border-radius: 4px; display: block; color: #333; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-word;">
                  ${context.currentValue}
                </code>
              </div>

              <div>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; font-weight: 500;">요청된 값:</p>
                <code style="background: #fff3f3; border: 1px solid #ffcdd2; padding: 10px; border-radius: 4px; display: block; color: #d32f2f; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-word;">
                  ${context.proposedValue}
                </code>
              </div>
            </div>

            ${
              context.rejectionReason
                ? `
              <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #ffcdd2; font-size: 13px; color: #666;">
                <strong>거부 사유:</strong> ${context.rejectionReason}
              </p>
            `
                : ""
            }
          </div>

          <!-- 안내 -->
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #666;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-weight: 600;">다음 단계:</h4>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>거부 사유를 검토하셨나요?</li>
              <li>추가 문의사항이 있으시면 아래 이메일로 연락주세요</li>
              <li>대체 방안이 있다면 함께 상담할 수 있습니다</li>
            </ul>
          </div>

          <!-- 연락처 -->
          <div style="background: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center;">
            <p style="margin: 0; color: #1565c0; font-size: 14px; line-height: 1.6;">
              <strong>📞 지원팀 연락처</strong>
              <br>
              ${context.supportContactEmail || "support@mabiz.com"}
            </p>
          </div>

          <p style="margin: 20px 0 0 0; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
            ご不明な点がございましたら、お気軽にお問い合わせください。
          </p>
        </div>

        <!-- 푸터 -->
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999; border-radius: 0 0 8px 8px;">
          <p style="margin: 0;">마비즈 CRM | 계약서 관리 시스템</p>
          <p style="margin: 5px 0 0 0;">이 이메일은 자동으로 발송되었습니다. 회신 불가.</p>
        </div>
      </div>
    `;

    const result = await sendFunnelEmail({
      organizationId,
      to: contactEmail,
      subject: `📌 계약서 변경 요청 검토 결과: ${displayFieldName}`,
      html,
      channel: "CONTRACT_MODIFICATION",
    });

    const success = result.result_code === 1;

    if (success) {
      logger.log("[ModificationEmail] 변경 거부 이메일 발송 성공", {
        contactEmail,
        fieldName: context.fieldName,
      });
    }

    return success;
  } catch (error) {
    logger.log("[ModificationEmail] 변경 거부 이메일 발송 중 오류", {
      contactEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
