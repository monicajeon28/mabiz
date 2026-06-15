/**
 * 계약 완료 이메일 발송 시스템 (Team B: Email Sender)
 * ContractInstance 완료 후 감사 인증서 다운로드 링크를 포함한 이메일 발송
 */

import { sendSystemEmail } from '@/lib/system-email';
import { logger } from '@/lib/logger';

interface ContractEmailData {
  id: string;
  status: string;
  signedAt: Date | null;
  template?: {
    name: string;
  };
}

interface AuditEmailParams {
  contract: ContractEmailData;
  recipientEmail: string;
  recipientName?: string;
}

/**
 * HTML 이메일 본문 생성: 계약 완료 알림
 * - 헤더: "계약서 서명 완료"
 * - 계약 정보 (ID, 서명일, 상태)
 * - CTA 버튼: 감사 인증서 다운로드
 * - 스타일: 파란색 버튼, Arial 폰트
 */
export function getAuditEmailHtml(
  contractId: string,
  signedDate: string,
  downloadUrl: string,
  recipientName: string = '고객'
): string {
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const escapedName = escapeHtml(recipientName);
  const escapedId = escapeHtml(contractId);
  const escapedDate = escapeHtml(signedDate);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif;
      background: #f5f7fa;
      margin: 0;
      padding: 24px;
      color: #333;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 36px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
    h1 {
      color: #1a2e4a;
      font-size: 22px;
      margin: 0 0 8px;
      font-weight: 600;
    }
    .subtitle {
      color: #4a5568;
      font-size: 14px;
      margin: 0 0 24px;
      font-weight: normal;
    }
    .info-box {
      background: #f0f4f8;
      border-left: 4px solid #2563eb;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #2d3748;
    }
    .info-row {
      display: flex;
      margin: 10px 0;
    }
    .info-label {
      font-weight: 600;
      min-width: 100px;
      color: #1a202c;
    }
    .info-value {
      flex: 1;
      color: #4a5568;
      word-break: break-all;
    }
    p {
      color: #4a5568;
      font-size: 15px;
      line-height: 1.7;
      margin: 0 0 16px;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      margin: 16px 0 24px;
      cursor: pointer;
      transition: background 0.3s ease;
    }
    .btn:hover {
      background: #1d4ed8;
    }
    .btn-icon {
      margin-right: 8px;
    }
    .note {
      font-size: 13px;
      color: #718096;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      margin-top: 24px;
      line-height: 1.6;
    }
    .url {
      font-size: 12px;
      color: #a0aec0;
      word-break: break-all;
      background: #f7fafc;
      padding: 8px 12px;
      border-radius: 4px;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #a0aec0;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ 계약서 서명 완료</h1>
    <p class="subtitle">계약서가 성공적으로 서명되었습니다.</p>

    <p>안녕하세요, <strong>${escapedName}</strong>님!</p>

    <p>귀사의 계약서 서명이 완료되었습니다. 아래에서 감사 인증서(Audit Trail Certificate)를 다운로드하실 수 있습니다. 이 문서는 계약의 법적 유효성을 증명하는 완전한 기록입니다.</p>

    <div class="info-box">
      <div class="info-row">
        <div class="info-label">계약 ID:</div>
        <div class="info-value">${escapedId}</div>
      </div>
      <div class="info-row">
        <div class="info-label">서명일:</div>
        <div class="info-value">${escapedDate}</div>
      </div>
      <div class="info-row">
        <div class="info-label">상태:</div>
        <div class="info-value">✓ 완료</div>
      </div>
    </div>

    <p>감사 인증서는 다음을 포함합니다:</p>
    <ul style="margin: 12px 0; padding-left: 20px; color: #4a5568; font-size: 15px;">
      <li>계약 체결 일시 및 서명자 정보</li>
      <li>전체 계약 문서 사본</li>
      <li>법적 감사 추적 기록</li>
      <li>타임스탬프 및 디지털 서명</li>
    </ul>

    <a href="${downloadUrl}" class="btn">
      <span class="btn-icon">📄</span>감사추적 인증서 다운로드
    </a>

    <p>버튼이 작동하지 않는 경우 아래 주소를 직접 복사하여 브라우저에 붙여넣기 해주세요.</p>
    <p class="url">${downloadUrl}</p>

    <div class="note">
      <strong>문서 보안:</strong> 이 링크는 24시간 동안만 유효합니다. 인증서는 바로 다운로드하여 안전한 위치에 저장하시기 바랍니다.
      <br><br>
      본 이메일은 마비즈 CRM에서 자동 발송된 보안 메일입니다. 문의사항은 담당자에게 연락해 주세요.
    </div>

    <div class="footer">
      마비즈 CRM | 전자계약 관리 시스템
    </div>
  </div>
</body>
</html>`;
}

/**
 * 계약 완료 이메일 발송 (sendSystemEmail 호출)
 * @param params - 계약 정보, 수신자 이메일
 * @returns 발송 성공 여부
 */
export async function sendAuditEmail(params: AuditEmailParams): Promise<boolean> {
  const { contract, recipientEmail, recipientName = '고객' } = params;

  if (!recipientEmail) {
    logger.error('[sendAuditEmail] 수신자 이메일 주소 미설정', {
      contractId: contract.id,
    });
    return false;
  }

  // 이메일 형식 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    logger.error('[sendAuditEmail] 유효하지 않은 이메일 형식', {
      contractId: contract.id,
      email: recipientEmail.slice(0, 5) + '***',
    });
    return false;
  }

  // 서명일 포맷팅
  const signedDate = contract.signedAt
    ? new Date(contract.signedAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '미정';

  // 감사 인증서 다운로드 URL 생성
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://mabizcruisedot.com';
  const downloadUrl = `${baseUrl}/api/contracts/${contract.id}/generate-audit-pdf`;

  // 이메일 HTML 생성
  const emailHtml = getAuditEmailHtml(
    contract.id,
    signedDate,
    downloadUrl,
    recipientName
  );

  // 이메일 발송
  const sent = await sendSystemEmail({
    to: recipientEmail,
    subject: `[마비즈] 계약서 서명 완료 - ${contract.id}`,
    html: emailHtml,
  });

  if (!sent) {
    logger.error('[sendAuditEmail] 이메일 발송 실패', {
      contractId: contract.id,
      recipientEmail: recipientEmail.slice(0, 5) + '***',
    });
    return false;
  }

  logger.log('[sendAuditEmail] 이메일 발송 성공', {
    contractId: contract.id,
    recipientEmail: recipientEmail.slice(0, 5) + '***',
  });

  return true;
}
