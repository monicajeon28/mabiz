/**
 * src/lib/email-templates.ts
 * 이메일 HTML 템플릿 렌더러 — 인라인 스타일, 모바일 최적화
 *
 * 용도:
 *   renderPartnerJoinedEmail  — 신규 파트너 가입 시 OWNER 수신
 *   renderNewOrgEmail         — 신규 대리점(Organization) 생성 시 GLOBAL_ADMIN 수신
 *   renderPartnerContractSignedEmail — 파트너 계약서 서명 완료 시 파트너 수신
 */

// ── HTML 이스케이프 헬퍼 ──────────────────────────────────────────────
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/** URL이 https:// 또는 http://로 시작하는지 확인, 아니면 '#' 반환 */
function safeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : '#';
}

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

// 확정 용어: OWNER=지사 / AGENT=대리점장 / FREE_SALES=마케터 (영어·구명칭 노출 금지)
const ROLE_LABEL: Record<string, string> = {
  AGENT:        '대리점장',
  FREE_SALES:   '마케터',
  OWNER:        '지사',
  GLOBAL_ADMIN: '관리자',
};

export function renderPartnerJoinedEmail(p: PartnerJoinedEmailParams): { subject: string; html: string } {
  const roleLabel = ROLE_LABEL[p.partnerRole] ?? p.partnerRole;
  const subject   = `[CRM] 신규 파트너 가입: ${p.partnerName} (${roleLabel})`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      신규 파트너가 가입했습니다
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${escapeHtml(p.ownerName)}님 안녕하세요. 새로운 ${escapeHtml(roleLabel)}이 초대 링크를 통해 가입을 완료했습니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${infoRow('이름',    escapeHtml(p.partnerName))}
      ${infoRow('전화번호', escapeHtml(p.partnerPhone))}
      ${infoRow('역할',    escapeHtml(roleLabel))}
      ${infoRow('가입일시', escapeHtml(p.joinedAt))}
    </table>

    ${p.crmUrl ? `
    <div style="margin-top:28px;">
      <a href="${safeUrl(p.crmUrl)}/dashboard/partners"
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
      ${infoRow('대리점명',      escapeHtml(p.orgName))}
      ${infoRow('대리점 ID',     escapeHtml(p.orgId))}
      ${infoRow('대리점장',      escapeHtml(p.ownerName))}
      ${infoRow('대리점장 연락처', escapeHtml(p.ownerPhone))}
      ${infoRow('계약 참조 ID',  escapeHtml(p.contractRef))}
      ${infoRow('생성일시',      escapeHtml(p.createdAt))}
    </table>

    <div style="margin-top:20px;padding:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
      <p style="margin:0;color:#92400e;font-size:13px;font-weight:500;">
        다음 단계: 대리점장에게 초대 링크를 발송하여 CRM 계정을 활성화하세요.
      </p>
    </div>

    ${p.crmUrl ? `
    <div style="margin-top:24px;">
      <a href="${safeUrl(p.crmUrl)}/admin/organizations"
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
  const safeInviteUrl = safeUrl(p.inviteUrl);

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      CRM 가입 초대장
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${escapeHtml(p.recipientName)}님, ${escapeHtml(p.orgName)}에서 ${escapeHtml(roleLabel)}(으)로 초대합니다.
    </p>

    <div style="background:#f0f7ff;border-radius:10px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">초대 링크 (${escapeHtml(p.expiresAt)}까지 유효)</p>
      <p style="margin:0;word-break:break-all;">
        <a href="${safeInviteUrl}"
           style="color:#1e3a5f;font-size:13px;font-weight:500;">${escapeHtml(p.inviteUrl)}</a>
      </p>
    </div>

    <div style="margin-top:4px;">
      <a href="${safeInviteUrl}"
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

// ── renderPartnerWelcomeEmail ─────────────────────────────────────
export interface PartnerWelcomeEmailParams {
  name:           string;
  tier:           string;
  managerCode:    string;
  managerLink:    string;
  agentCode?:     string;
  agentLink?:     string;
  appUrl:         string;
}

export function renderPartnerWelcomeEmail(p: PartnerWelcomeEmailParams): { subject: string; html: string } {
  const subject = `[크루즈닷] 계약 승인 완료 - ${p.tier} 계정이 생성되었습니다`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      계약이 승인되었습니다! 🎉
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${escapeHtml(p.name)}님, 귀사의 ${escapeHtml(p.tier)} 계약이 승인되었습니다.
      아래의 대리점 코드로 CRM 시스템에 접속할 수 있습니다.
    </p>

    <div style="background:#f0f7ff;border-radius:10px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px;color:#1e3a5f;font-size:13px;font-weight:600;">
        📋 대리점 정보
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${infoRow('계약 등급', p.tier)}
        ${infoRow('대리점 코드', p.managerCode)}
        ${p.agentCode ? infoRow('판매원 코드', p.agentCode) : ''}
      </table>
    </div>

    <div style="background:#eff6ff;border-radius:10px;padding:16px;margin:20px 0;border-left:4px solid #3b82f6;">
      <p style="margin:0 0 8px;color:#1e40af;font-size:12px;font-weight:600;">
        💡 다음 단계
      </p>
      <ol style="margin:0;padding-left:20px;color:#1e40af;font-size:13px;">
        <li style="margin:4px 0;">임시 비밀번호는 SMS로 발송되었습니다</li>
        <li style="margin:4px 0;">CRM 로그인 후 비밀번호를 변경해주세요</li>
        <li style="margin:4px 0;"><a href="${p.appUrl}/login" style="color:#3b82f6;text-decoration:none;font-weight:500;">CRM 로그인하기</a></li>
      </ol>
    </div>

    ${p.managerLink ? `
    <div style="margin:20px 0;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
        대리점 링크 (고객 공유용)
      </p>
      <p style="margin:0;word-break:break-all;">
        <a href="${p.managerLink}" style="color:#3b82f6;font-size:12px;">${p.managerLink}</a>
      </p>
    </div>` : ''}

    ${p.agentLink ? `
    <div style="margin:20px 0;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
        판매원 링크 (고객 공유용)
      </p>
      <p style="margin:0;word-break:break-all;">
        <a href="${p.agentLink}" style="color:#3b82f6;font-size:12px;">${p.agentLink}</a>
      </p>
    </div>` : ''}

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.8;">
        문의 사항이 있으신가요?<br />
        <a href="mailto:jmonica@cruisedot.co.kr" style="color:#1e3a5f;font-weight:600;">고객 지원팀</a>으로 연락주세요.
      </p>
    </div>
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderFunnelDay0Email (상담 후 즉시 감사 + 건강검진 안내) ──────────────────
/**
 * Day 0: 상담 직후 (감정 단계)
 * PASONA: P(Problem) + A(Agitate) - 건강 문제의 심각성 깨우기
 * L6 손실회피: "지금 받지 않으면 평생 후회할 수 있습니다"
 * L10 즉시구매: 긴박한 톤 (10석 남음)
 */
export interface FunnelDay0EmailParams {
  name: string;
  consultantName: string;
  consultationType: string; // "건강검진" | "영양상담" | "운동처방"
  nextSteps?: string;      // 추가 안내사항
  crmUrl?: string;
}

export function renderFunnelDay0Email(p: FunnelDay0EmailParams): { subject: string; html: string } {
  const subject = `[크루즈닷] ${escapeHtml(p.name)}님 상담 감사합니다 - 즉시 실천 방법 3가지`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      상담이 완료되었습니다 ✓
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${escapeHtml(p.name)}님 안녕하세요.<br />
      ${escapeHtml(p.consultantName)} 상담사의 ${escapeHtml(p.consultationType)}를 완료해주셔서 감사합니다.
    </p>

    <!-- P단계: 문제 재확인 -->
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;color:#856404;font-size:13px;font-weight:600;">
        🔔 상담에서 언급하신 건강 이슈의 심각성
      </p>
      <p style="margin:8px 0 0;color:#664d03;font-size:13px;line-height:1.6;">
        오늘 상담에서 확인된 사항들이 방치될 경우, 향후 합병증으로 발전할 가능성이 높습니다.<br />
        <strong>지금 이 순간이 생활습관을 바꿀 수 있는 마지막 기회입니다.</strong>
      </p>
    </div>

    <!-- A단계: 감정 자극 + 행동 유도 -->
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
      <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:600;">
        지금 바로 실천할 수 있는 3가지 방법
      </p>
      <ol style="margin:0;padding-left:20px;color:#495057;font-size:13px;line-height:1.8;">
        <li style="margin:6px 0;"><strong>오늘 저녁</strong>: 상담 자료 읽기 (10분)</li>
        <li style="margin:6px 0;"><strong>내일 아침</strong>: 첫 번째 식단 변경 적용</li>
        <li style="margin:6px 0;"><strong>3일 이내</strong>: 운동 프로그램 시작</li>
      </ol>
    </div>

    <!-- N단계: 최종 행동 촉구 (시간 제한) -->
    <div style="margin:24px 0;">
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">
        <strong>⏰ 주의</strong>: 상담 이후 처음 72시간 동안 실행하는 사람이 성공률이 89% 높습니다.
      </p>
      <a href="${safeUrl(p.crmUrl ?? '')}/consultation/followup"
         style="display:inline-block;background:#28a745;color:#ffffff;text-decoration:none;
                padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px;">
        맞춤형 실천 계획서 받기 (72시간 한정)
      </a>
    </div>

    ${p.nextSteps ? `
    <div style="margin-top:20px;padding:12px;background:#e8f5e9;border-radius:6px;color:#2e7d32;font-size:13px;">
      ${p.nextSteps}
    </div>` : ''}
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderFunnelDay1Email (상품 3가지 소개 + 추천 로직) ──────────────────
/**
 * Day 1: 상담 다음날 (이성 단계)
 * PASONA: S(Solution) + O(Offer) - 해결책 제시
 * 3가지 상품군 제시 (기본/표준/프리미엄) → 맞춤형 추천
 */
export interface FunnelDay1EmailParams {
  name: string;
  recommendedTier: "basic" | "standard" | "premium"; // 상담 결과 기반 추천
  product1?: string;
  product2?: string;
  product3?: string;
  crmUrl?: string;
}

export function renderFunnelDay1Email(p: FunnelDay1EmailParams): { subject: string; html: string } {
  const subject = `[크루즈닷] ${p.name}님을 위한 최적 상품 3가지`;

  const tierLabel: Record<string, string> = {
    basic: "기본형",
    standard: "표준형",
    premium: "프리미엄형"
  };
  const tierColor: Record<string, string> = {
    basic: "#6c757d",
    standard: "#0d6efd",
    premium: "#ffc107"
  };

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      ${p.name}님을 위한 맞춤 솔루션 🎯
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      어제 상담 결과를 바탕으로, 전문가팀이 당신의 건강 상태에 최적화된<br />
      상품 3가지를 추천합니다.
    </p>

    <!-- 추천 등급 하이라이트 -->
    <div style="background:${tierColor[p.recommendedTier]};color:#fff;padding:16px;border-radius:8px;margin:20px 0;">
      <p style="margin:0;font-size:12px;opacity:0.9;">추천 등급</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:700;">
        ⭐ ${tierLabel[p.recommendedTier]} (당신의 건강 수준에 가장 적합)
      </p>
    </div>

    <!-- 상품 3가지 비교 테이블 -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr style="background:#f8f9fa;">
        <td style="padding:12px;border-bottom:1px solid #e9ecef;color:#6b7280;font-size:12px;font-weight:600;">
          상품
        </td>
        <td style="padding:12px;border-bottom:1px solid #e9ecef;color:#6b7280;font-size:12px;font-weight:600;">
          추천 이유
        </td>
        <td style="padding:12px;border-bottom:1px solid #e9ecef;color:#6b7280;font-size:12px;font-weight:600;">
          선택
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e9ecef;">
        <td style="padding:12px;color:#111827;font-size:13px;">
          ${p.product1 || "건강검진 기본형"}
        </td>
        <td style="padding:12px;color:#495057;font-size:12px;">
          초기 단계 최적화
        </td>
        <td style="padding:12px;">
          <button style="background:#f0f0f0;border:1px solid #ddd;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
            보기
          </button>
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e9ecef;background:#fffbf0;">
        <td style="padding:12px;color:#111827;font-size:13px;font-weight:600;">
          ${p.product2 || "건강검진 표준형"} ⭐ 추천
        </td>
        <td style="padding:12px;color:#495057;font-size:12px;">
          당신의 건강에 정확히 맞춤
        </td>
        <td style="padding:12px;">
          <button style="background:#ffc107;border:0;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;color:#000;">
            선택하기
          </button>
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e9ecef;">
        <td style="padding:12px;color:#111827;font-size:13px;">
          ${p.product3 || "건강검진 프리미엄형"}
        </td>
        <td style="padding:12px;color:#495057;font-size:12px;">
          최고 수준의 종합 관리
        </td>
        <td style="padding:12px;">
          <button style="background:#f0f0f0;border:1px solid #ddd;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
            보기
          </button>
        </td>
      </tr>
    </table>

    <div style="background:#e7f3ff;border-left:4px solid #0d6efd;padding:14px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;color:#004085;font-size:12px;line-height:1.6;">
        💡 <strong>왜 표준형인가?</strong><br />
        상담에서 확인된 당신의 BMI 수치, 혈당 수치와 스트레스 레벨을 고려할 때,<br />
        기본형으로는 부족하고 프리미엄형은 과도합니다.
      </p>
    </div>
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderFunnelDay2Email (고객만족도 + 베테랑 사례) ──────────────────
/**
 * Day 2: 상담 2일 후 (신뢰 구축 단계)
 * PASONA: O(Offer) + N(Narrow) - 사회증명 + 신뢰도 강화
 * L7 동반자 설득: "다른 사람들도 했어, 너도 할 수 있어"
 */
export interface FunnelDay2EmailParams {
  name: string;
  successStories?: { person: string; result: string; duration: string }[];
  satisfactionRate?: number; // e.g. 94
  crmUrl?: string;
}

export function renderFunnelDay2Email(p: FunnelDay2EmailParams): { subject: string; html: string } {
  const subject = `[크루즈닷] ${p.name}님과 같은 사람들의 성공 사례 94%`;

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
      당신처럼 시작한 사람들의 놀라운 변화 📈
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      지난 6개월간 크루즈닷 프로그램을 완료한 고객 94%가<br />
      "생활 방식에 긍정적 변화가 있었다"고 응답했습니다.
    </p>

    <!-- 만족도 배지 -->
    <div style="text-align:center;margin:20px 0;">
      <div style="display:inline-block;background:#e7f5ff;border-radius:12px;padding:20px;width:300px;">
        <p style="margin:0 0 8px;color:#0d6efd;font-size:32px;font-weight:700;">
          94%
        </p>
        <p style="margin:0;color:#0d6efd;font-size:14px;font-weight:600;">
          만족도 (지난 6개월)
        </p>
      </div>
    </div>

    <!-- 성공 사례 3가지 -->
    ${p.successStories?.map((story) => `
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:12px 0;border-left:4px solid #28a745;">
      <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;">
        ${story.person}님 (${story.duration})
      </p>
      <p style="margin:0;color:#495057;font-size:12px;">
        "${story.result}"
      </p>
    </div>
    `).join('') || `
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:12px 0;border-left:4px solid #28a745;">
      <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;">
        이정훈님 (3개월 실천)
      </p>
      <p style="margin:0;color:#495057;font-size:12px;">
        "처음 2주는 힘들었지만, 4주차부터 몸의 변화가 눈에 띄게 났아요. 지금은 거기서 더 나아가 자신감이 생겼습니다."
      </p>
    </div>
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:12px 0;border-left:4px solid #28a745;">
      <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;">
        박미정님 (6개월 실천)
      </p>
      <p style="margin:0;color:#495057;font-size:12px;">
        "의료진의 지속적인 피드백이 큰 도움이 됐습니다. 혼자가 아니라는 안심감이 있었어요."
      </p>
    </div>
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:12px 0;border-left:4px solid #28a745;">
      <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;">
        김철수님 (9개월 실천)
      </p>
      <p style="margin:0;color:#495057;font-size:12px;">
        "처음엔 반신반의했지만, 결과가 말해줍니다. 모두에게 추천합니다."
      </p>
    </div>
    `}

    <!-- 다음 단계 + 감정적 이유 -->
    <div style="background:#e7f3ff;border-left:4px solid #0d6efd;padding:14px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#004085;font-size:13px;font-weight:600;">
        🎯 당신도 이들처럼 될 수 있습니다
      </p>
      <p style="margin:0;color:#004085;font-size:12px;line-height:1.6;">
        다른 사람이 할 수 있다면 당신도 할 수 있습니다.<br />
        <strong>지금 바로 프로그램에 참여하면 성공할 확률은 94%입니다.</strong>
      </p>
    </div>
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderFunnelDay3Email (최종 클로징 + 긴박감 + 할인) ──────────────────
/**
 * Day 3: 상담 3일 후 (최종 결정 단계)
 * PASONA: N(Narrow) + A(Action) - 구체적 행동 촉구
 * L6 손실회피 + L10 즉시구매: "10석 남음 + 3일 뒤 할인 종료"
 */
export interface FunnelDay3EmailParams {
  name: string;
  seatsRemaining?: number;      // e.g. 10
  discountPercent?: number;     // e.g. 25
  discountExpiresIn?: number;   // hours, e.g. 72
  originalPrice?: string;       // e.g. "498,000원"
  discountedPrice?: string;     // e.g. "374,000원"
  crmUrl?: string;
}

export function renderFunnelDay3Email(p: FunnelDay3EmailParams): { subject: string; html: string } {
  const subject = `[긴급] ${escapeHtml(p.name)}님 한정 할인이 72시간 뒤 종료됩니다 ⏰`;

  const body = `
    <h2 style="margin:0 0 8px;color:#d32f2f;font-size:22px;font-weight:700;">
      ⚠️ 긴급 알림: 한정 할인 72시간 남음
    </h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${escapeHtml(p.name)}님께 드린 ${p.discountPercent || 25}% 할인 혜택이<br />
      <strong>72시간(3일) 뒤 자동으로 종료됩니다.</strong>
    </p>

    <!-- 타이머 + 손실회피 강조 -->
    <div style="background:#ffebee;border-left:6px solid #d32f2f;padding:20px;border-radius:8px;margin:20px 0;">
      <p style="margin:0 0 12px;color:#b71c1c;font-size:14px;font-weight:700;">
        ⏱️ 남은 시간: 72시간
      </p>
      <p style="margin:0;color:#c62828;font-size:13px;line-height:1.6;">
        이 시간을 놓치면 다시는 이 가격으로 프로그램을 받을 수 없습니다.<br />
        <strong>지금이 결정할 마지막 기회입니다.</strong>
      </p>
    </div>

    <!-- 할인 비교 (정가 vs 할인가) -->
    ${p.originalPrice && p.discountedPrice ? `
    <div style="background:#f0f7ff;padding:16px;border-radius:8px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
        정가
      </p>
      <p style="margin:0 0 16px;color:#999;font-size:20px;text-decoration:line-through;">
        ${p.originalPrice}
      </p>

      <p style="margin:0 0 8px;color:#0d6efd;font-size:12px;font-weight:600;">
        지금 가격 (${p.discountPercent || 25}% 할인)
      </p>
      <p style="margin:0;color:#0d6efd;font-size:32px;font-weight:700;">
        ${p.discountedPrice}
      </p>
    </div>
    ` : ''}

    <!-- 좌석 제한 (희소성) -->
    ${p.seatsRemaining && p.seatsRemaining <= 10 ? `
    <div style="background:#fff3e0;border:2px dashed #ff9800;padding:12px;border-radius:6px;margin:16px 0;text-align:center;">
      <p style="margin:0;color:#e65100;font-size:13px;font-weight:700;">
        🚨 경고: 현재 ${p.seatsRemaining}석만 남음
      </p>
      <p style="margin:4px 0 0;color:#bf360c;font-size:12px;">
        모집 마감까지 평균 1시간 30분 소요 중입니다
      </p>
    </div>
    ` : ''}

    <!-- 최종 CTA (강한 색상) -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${safeUrl(p.crmUrl ?? '')}/purchase"
         style="display:inline-block;background:#d32f2f;color:#ffffff;text-decoration:none;
                padding:16px 40px;border-radius:8px;font-size:16px;font-weight:700;margin-bottom:12px;">
        지금 신청하기 (72시간 한정)
      </a>
      <p style="margin:8px 0 0;color:#9aa0a6;font-size:11px;">
        * 신청 후 5분 이내 확인 문자가 발송됩니다
      </p>
    </div>

    <!-- 최후의 이의 대응 -->
    <div style="background:#f5f5f5;padding:16px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;color:#111827;font-size:13px;font-weight:600;">
        아직도 고민 중이신가요?
      </p>
      <ul style="margin:0;padding-left:20px;color:#495057;font-size:12px;">
        <li style="margin:4px 0;">전액 환불 보장 (30일 이내)</li>
        <li style="margin:4px 0;">전문가 무료 상담 (1회)</li>
        <li style="margin:4px 0;">분할 결제 가능 (3-6개월)</li>
      </ul>
    </div>
  `;

  return { subject, html: wrapEmail(body) };
}

// ── renderPartnerContractSignedEmail ──────────────────────────────────────
export interface PartnerContractSignedEmailParams {
  partnerName: string;
  partnerEmail: string;
  contractSignedAt: string;
  driveLinkUrl: string;
  adminEmail: string;
}

export function renderPartnerContractSignedEmail(
  p: PartnerContractSignedEmailParams
): { subject: string; html: string } {
  const subject = '📄 파트너 어필리에이트 계약서 서명 완료';

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">
      <strong>${escapeHtml(p.partnerName)}</strong> 파트너님,
    </p>
    <p style="margin:0 0 20px;color:#666;font-size:14px;line-height:1.6;">
      어필리에이트 계약서가 정상적으로 서명되었습니다. <br />
      아래 버튼을 클릭하여 계약서를 확인하실 수 있습니다.
    </p>

    <div style="margin:24px 0;padding:16px;background:#f0f7ff;border-left:4px solid #1e3a5f;border-radius:4px;">
      <p style="margin:0 0 8px;color:#1e3a5f;font-weight:600;font-size:13px;">📋 계약서 정보</p>
      <table style="width:100%;font-size:13px;color:#555;">
        <tr>
          <td style="padding:4px 0;"><strong>파트너명</strong></td>
          <td style="padding:4px 0;text-align:right;">${escapeHtml(p.partnerName)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>서명완료일</strong></td>
          <td style="padding:4px 0;text-align:right;">${escapeHtml(p.contractSignedAt)}</td>
        </tr>
      </table>
    </div>

    <div style="margin:24px 0;text-align:center;">
      <a href="${safeUrl(p.driveLinkUrl)}"
         style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
        📥 계약서 다운로드
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#999;">
        또는 <a href="${safeUrl(p.driveLinkUrl)}" style="color:#1e3a5f;text-decoration:underline;">${safeUrl(
    p.driveLinkUrl
  )}</a>로 이동
      </p>
    </div>

    <div style="margin:32px 0 0;padding:16px 0;border-top:1px solid #e8eaed;font-size:12px;color:#999;">
      <p style="margin:0 0 8px;">이 이메일에 첨부된 계약서도 함께 전송되었습니다.</p>
      <p style="margin:0;">문의 사항이 있으시면 <a href="mailto:${safeUrl(
        p.adminEmail
      )}" style="color:#1e3a5f;text-decoration:none;">${escapeHtml(p.adminEmail)}</a>로 연락주시기 바랍니다.
      </p>
    </div>
  `;

  return { subject, html: wrapEmail(body) };
}
