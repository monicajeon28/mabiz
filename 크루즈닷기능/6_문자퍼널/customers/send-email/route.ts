export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

// 계급/타입 변환 함수
function getPartnerRankTitle(type: string): string {
  switch (type) {
    case 'BRANCH_MANAGER':
    case 'manager':
      return '대리점장'; // 750만원 계약서
    case 'STAFF':
    case 'staff':
    case 'TEAM_LEADER':
    case 'team_leader':
      return '스탭/팀장'; // 540만원 계약서
    case 'AGENT':
    case 'agent':
    default:
      return '매니저'; // 330만원 계약서
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();
    const body = await req.json();
    const { emails, title, content, images, buttons } = body;

    // images: Array<{ url: string; name: string }> - base64 또는 URL
    // buttons: Array<{ label: string; url: string }> - 최대 3개

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new PartnerApiError('이메일 주소 목록이 필요합니다.', 400);
    }

    if (!title || !content) {
      throw new PartnerApiError('제목과 내용을 입력해주세요.', 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter((email: string) => emailRegex.test(email));

    if (validEmails.length === 0) {
      throw new PartnerApiError('유효한 이메일 주소가 없습니다.', 400);
    }

    // 대리점장인지 판매원인지 확인
    const isManager = profile.type === 'BRANCH_MANAGER' || profile.type === 'manager';

    // 저장된 이메일 설정 가져오기
    let emailConfig;
    if (isManager) {
      emailConfig = await prisma.partnerEmailConfig.findUnique({
        where: { profileId: profile.id },
      });
    } else {
      emailConfig = await prisma.affiliateEmailConfig.findUnique({
        where: { profileId: profile.id },
      });
    }

    // 설정이 없거나 비활성화된 경우
    if (!emailConfig || !emailConfig.isActive) {
      throw new PartnerApiError(
        '이메일 설정이 필요합니다. 설정 페이지에서 발신자 이메일을 먼저 등록해주세요.',
        400
      );
    }

    // 파트너 정보 가져오기
    const contractName = sessionUser.name || '크루즈닷 파트너'; // 계약서상 이름
    const displayName = emailConfig.senderName || profile.displayName || profile.branchLabel || contractName;
    const marketingPhone = profile.contactPhone || ''; // 마케팅용 연락처
    const marketingEmail = emailConfig.senderEmail; // 저장된 발신자 이메일 사용
    const partnerRank = getPartnerRankTitle(profile.type); // 계급
    const fromEmail = marketingEmail;

    // SMTP 설정 (환경변수 사용)
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASSWORD || process.env.SMTP_PASS;
    const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || '587');
    const defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || emailUser || 'noreply@cruisedot.com';

    if (!emailUser || !emailPass) {
      throw new PartnerApiError('이메일 서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.', 500);
    }

    // nodemailer transporter 설정
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // 담당자 연락처 정보 (마케팅용 연락처)
    const contactInfo = [];
    if (marketingPhone) {
      contactInfo.push(`<span>📞 ${marketingPhone}</span>`);
    }
    if (fromEmail) {
      contactInfo.push(`<span>✉️ <a href="mailto:${fromEmail}" style="color: #4f46e5; text-decoration: none;">${fromEmail}</a></span>`);
    }
    const contactSection = contactInfo.length > 0
      ? `<p style="font-size: 13px; color: #555; margin: 8px 0; line-height: 1.6;">${contactInfo.join(' &nbsp;|&nbsp; ')}</p>`
      : '';

    // 이미지 HTML 생성
    let imagesHtml = '';
    if (images && Array.isArray(images) && images.length > 0) {
      const imageItems = images.slice(0, 5).map((img: { url: string; name: string }) =>
        `<div style="margin-bottom: 15px; text-align: center;">
          <img src="${img.url}" alt="${img.name || '이미지'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        </div>`
      ).join('');
      imagesHtml = `
        <div style="margin-top: 20px; margin-bottom: 20px;">
          ${imageItems}
        </div>
      `;
    }

    // 버튼 HTML 생성
    let buttonsHtml = '';
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      const buttonItems = buttons.slice(0, 3).map((btn: { label: string; url: string }) =>
        `<a href="${btn.url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; margin: 5px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">${btn.label}</a>`
      ).join('');
      buttonsHtml = `
        <div style="margin-top: 25px; margin-bottom: 20px; text-align: center;">
          ${buttonItems}
        </div>
      `;
    }

    // HTML 본문 작성 - 크루즈닷 푸터 자동 추가
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- 헤더 -->
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">${title}</h2>
            <p style="color: #666; font-size: 14px; margin: 8px 0 0 0;">발신: ${displayName}</p>
          </div>

          <!-- 본문 -->
          <div style="font-size: 15px; line-height: 1.8; white-space: pre-wrap; color: #333; padding: 10px 0;">${content.replace(/\n/g, '<br>')}</div>

          <!-- 이미지 섹션 -->
          ${imagesHtml}

          <!-- 버튼 섹션 -->
          ${buttonsHtml}
        </div>

        <!-- 크루즈닷 푸터 (자동 추가) -->
        <div style="margin-top: 30px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);">
          <!-- 로고 및 슬로건 -->
          <div style="padding: 25px 20px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 20px; margin-bottom: 15px;">
              <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">🚢 CruiseDot</span>
            </div>
            <p style="color: rgba(255,255,255,0.95); font-size: 15px; font-weight: 500; margin: 0; line-height: 1.5;">
              당신의 행복한 크루즈 여행을 동행합니다<br/>
              <span style="font-size: 13px; color: rgba(255,255,255,0.85);">크루즈닷AI와 함께</span>
            </p>
          </div>

          <!-- 담당자 정보 -->
          <div style="background: rgba(255,255,255,0.95); padding: 20px 25px; text-align: center;">
            <div style="display: inline-block; background: #4f46e5; color: #fff; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 12px; margin-bottom: 10px;">
              ${partnerRank}
            </div>
            <p style="font-size: 18px; font-weight: bold; color: #333; margin: 5px 0;">
              ${contractName}
            </p>
            ${contactSection}
          </div>

          <!-- 회사 정보 -->
          <div style="background: rgba(0,0,0,0.1); padding: 15px 20px; text-align: center;">
            <p style="color: rgba(255,255,255,0.9); font-size: 11px; margin: 0; line-height: 1.6;">
              크루즈닷 (CruiseDot)<br/>
              경기 화성시 효행로 1068 603-A60호 (우: 18405)<br/>
              <a href="https://cruisedot.co.kr" style="color: rgba(255,255,255,0.95); text-decoration: none; font-weight: bold;">www.cruisedot.co.kr</a>
            </p>
          </div>
        </div>

        <!-- 하단 안내 -->
        <div style="margin-top: 15px; text-align: center;">
          <p style="font-size: 10px; color: #999; margin: 5px 0;">
            본 메일은 크루즈닷 파트너 네트워크를 통해 발송되었습니다.
          </p>
          <p style="font-size: 10px; color: #999; margin: 5px 0;">
            크루즈 첫여행 크루즈닷, 두번째 부터 행복하게
          </p>
        </div>
      </body>
      </html>
    `;

    // 이메일 발송
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 한 번에 최대 20개씩 발송 (파트너용이므로 제한)
    const batchSize = 20;
    for (let i = 0; i < validEmails.length; i += batchSize) {
      const batch = validEmails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          const mailOptions = {
            from: `"${contractName} (크루즈닷 ${partnerRank})" <${defaultFromAddress}>`,
            replyTo: fromEmail || defaultFromAddress,
            to: email,
            subject: title,
            html: htmlBody,
          };

          await transporter.sendMail(mailOptions);
          sentCount++;
        } catch (error: any) {
          failedCount++;
          errors.push(`${email}: ${error.message || '발송 실패'}`);
          console.error(`[Partner Send Email] Failed to send to ${email}:`, error);
        }
      }

      // 배치 간 딜레이
      if (i + batchSize < validEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 발송 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.email.sent',
        details: {
          profileId: profile.id,
          contractName,
          partnerRank,
          marketingPhone,
          marketingEmail: fromEmail,
          recipientCount: validEmails.length,
          sentCount,
          failedCount,
          title,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      totalCount: validEmails.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Send Email] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : '이메일 발송에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}
