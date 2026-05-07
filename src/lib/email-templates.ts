/**
 * src/lib/email-templates.ts
 * 이메일 HTML 템플릿 렌더러 — 인라인 스타일, 모바일 최적화
 *
 * 용도:
 *   renderPartnerJoinedEmail  — 신규 파트너 가입 시 OWNER 수신
 *   renderNewOrgEmail         — 신규 대리점(Organization) 생성 시 GLOBAL_ADMIN 수신
 */

// ── 공통 래퍼 ──────────────────────────────────────────────────────────
function wrapEmail(body: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>크루즈닷 CRM 알림</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- 헤더 -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                🚢 크루즈닷 CRM
              </p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="background:#f8f9fb;padding:20px 32px;border-top:1px solid #e8eaed;">
              <p style="margin:0;color:#9aa0a6;font-size:12px;line-height:1.6;">
                이 메일은 크루즈닷 CRM 시스템에서 자동 발송되었습니다.<br />
                문의: <a href="mailto:jmonica@cruisedot.co.kr" style="color:#1e3a5f;">jmonica@cruisedot.co.kr</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
      <span style="color:#6b7280;font-size:13px;display:inline-block;min-width:100px;">${label}</span>
      <span style="color:#111827;font-size:14px;font-weight:500;">${value}</span>
    </td>
  </tr>`;
}

// ── renderPartnerJoinedEmail ──────────────────────────────────────────
export interface PartnerJoinedEmailParams {
  ownerName:    string;
  partnerName:  string;
  partnerPhone: string;
  partnerRole:  string;
  joinedAt:     string;
  crmUrl:       string;
}

const ROLE_LABEL: Record<string, string> = {
  AGENT:      '영업파트너',
  FREE_SALES: '프리마케터',
  OWNER:      '대리점장',
};

export function renderPartnerJoinedEmail(p: PartnerJoinedEmailParams): { subject: string; html: string } {
  const roleLabel = ROLE_LABEL[p.partnerRole] ?? p.partnerRole;
  const subject   = `[CRM] 신규 파트너 가입: ${p.partnerName} (${roleLabel})`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      신규 파트너가 가입했습니다
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${p.ownerName}님 안녕하세요. 새로운 ${roleLabel}이 초대 링크를 통해 가입을 완료했습니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${infoRow('이름',    p.partnerName)}
      ${infoRow('전화번호', p.partnerPhone)}
      ${infoRow('역할',    roleLabel)}
      ${infoRow('가입일시', p.joinedAt)}
    </table>

    ${p.crmUrl ? `
    <div style="margin-top:28px;">
      <a href="${p.crmUrl}/dashboard/partners"
         style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        파트너 목록 확인하기
      </a>
    </div>` : ''}
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderNewOrgEmail ─────────────────────────────────────────────────
export interface NewOrgEmailParams {
  orgName:     string;
  orgId:       string;
  ownerName:   string;
  ownerPhone:  string;
  contractRef: string;   // GMcruise 계약 참조 ID
  createdAt:   string;
  crmUrl:      string;
}

export function renderNewOrgEmail(p: NewOrgEmailParams): { subject: string; html: string } {
  const subject = `[CRM] 신규 대리점 생성: ${p.orgName}`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      신규 대리점이 생성되었습니다
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      GMcruise 계약서 서명 완료 웹훅을 수신하여 대리점이 자동 생성되었습니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${infoRow('대리점명',      p.orgName)}
      ${infoRow('대리점 ID',     p.orgId)}
      ${infoRow('대리점장',      p.ownerName)}
      ${infoRow('대리점장 연락처', p.ownerPhone)}
      ${infoRow('계약 참조 ID',  p.contractRef)}
      ${infoRow('생성일시',      p.createdAt)}
    </table>

    <div style="margin-top:20px;padding:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
      <p style="margin:0;color:#92400e;font-size:13px;font-weight:500;">
        다음 단계: 대리점장에게 초대 링크를 발송하여 CRM 계정을 활성화하세요.
      </p>
    </div>

    ${p.crmUrl ? `
    <div style="margin-top:24px;">
      <a href="${p.crmUrl}/admin/organizations"
         style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        대리점 관리 페이지 열기
      </a>
    </div>` : ''}
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderInviteLinkEmail ─────────────────────────────────────────────
export interface InviteLinkEmailParams {
  recipientName: string;
  orgName:       string;
  role:          string;
  inviteUrl:     string;
  expiresAt:     string;
}

export function renderInviteLinkEmail(p: InviteLinkEmailParams): { subject: string; html: string } {
  const roleLabel = ROLE_LABEL[p.role] ?? p.role;
  const subject   = `[크루즈닷 CRM] ${p.orgName} ${roleLabel} 초대장`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      CRM 가입 초대장
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${p.recipientName}님, ${p.orgName}에서 ${roleLabel}(으)로 초대합니다.
    </p>

    <div style="background:#f0f7ff;border-radius:10px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">초대 링크 (${p.expiresAt}까지 유효)</p>
      <p style="margin:0;word-break:break-all;">
        <a href="${p.inviteUrl}"
           style="color:#1e3a5f;font-size:13px;font-weight:500;">${p.inviteUrl}</a>
      </p>
    </div>

    <div style="margin-top:4px;">
      <a href="${p.inviteUrl}"
         style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;
                padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        가입하기
      </a>
    </div>

    <p style="margin:24px 0 0;color:#9aa0a6;font-size:12px;">
      이 링크는 1회만 사용 가능하며, 만료 후에는 새 링크를 요청해야 합니다.
    </p>
  `;

  return { subject, html: wrapEmail(body) };
}
