export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';
import { backupEmailWithImages } from '@/lib/message-backup';

interface Recipient {
  id?: number;
  name: string;
  email: string;
}

interface EmailImage {
  url: string;
  alt?: string;
}

interface EmailButton {
  text: string;
  url: string;
}

export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const payload = await req.json().catch(() => ({}));

    const { recipients, subject, title, content, images, buttons, scheduledAt, productName, linkUrl } = payload as {
      recipients: Recipient[];
      subject?: string;
      title?: string;
      content: string;
      images?: EmailImage[];
      buttons?: EmailButton[];
      scheduledAt?: string;
      productName?: string;
      linkUrl?: string;
    };

    if (!recipients || recipients.length === 0) {
      throw new PartnerApiError('수신자를 선택해주세요.', 400);
    }

    // subject 또는 title 중 하나 사용
    const emailSubject = subject || title || '';
    if (!emailSubject.trim()) {
      throw new PartnerApiError('이메일 제목을 입력해주세요.', 400);
    }

    if (!content || content.trim().length === 0) {
      throw new PartnerApiError('이메일 내용을 입력해주세요.', 400);
    }

    // 이메일 설정 가져오기
    const isManager = profile.type === 'BRANCH_MANAGER';
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

    if (!emailConfig || !emailConfig.isActive) {
      throw new PartnerApiError('이메일 설정이 필요합니다. 설정 페이지에서 이메일을 먼저 설정해주세요.', 400);
    }

    // SMTP 설정 확인
    const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
    const smtpUser = process.env.EMAIL_SMTP_USER;
    const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      throw new PartnerApiError('시스템 이메일 설정이 되어 있지 않습니다. 관리자에게 문의해주세요.', 500);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // 예약 발송인 경우
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);

      for (const recipient of recipients) {
        // 치환 태그 처리
        const finalSubject = emailSubject
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '');
        const finalContent = content
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{연락처\}/g, recipient.email || '')
          .replace(/\{\{연락처\}\}/g, recipient.email || '')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '')
          .replace(/\{링크\}/g, linkUrl || '');

        await prisma.adminMessage.create({
          data: {
            messageType: 'EMAIL',
            senderId: sessionUser.id,
            recipientType: 'individual',
            recipientCount: 1,
            content: JSON.stringify({ subject: finalSubject, content: finalContent, images, buttons }),
            status: 'SCHEDULED',
            scheduledAt: scheduledDate,
            targetFilters: {
              email: recipient.email,
              name: recipient.name,
              leadId: recipient.id,
              profileId: profile.id,
            },
          },
        });
      }

      return NextResponse.json({
        ok: true,
        message: `${recipients.length}건의 이메일이 예약되었습니다.`,
        scheduled: true,
        scheduledAt: scheduledDate.toISOString(),
      });
    }

    // 즉시 발송
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        // 치환 태그 처리
        const finalSubject = emailSubject
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '');
        let finalContent = content
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{연락처\}/g, recipient.email || '')
          .replace(/\{\{연락처\}\}/g, recipient.email || '')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '')
          .replace(/\{링크\}/g, linkUrl || '');

        // HTML 이메일 본문 생성
        const htmlContent = buildEmailHtml({
          content: finalContent,
          images,
          buttons,
          senderName: emailConfig.senderName || profile.displayName || '크루즈닷',
          signature: emailConfig.signature,
        });

        const mailOptions = {
          from: `${emailConfig.senderName || profile.displayName || '크루즈닷'} <${smtpUser}>`,
          replyTo: emailConfig.senderEmail,
          to: recipient.email,
          subject: finalSubject,
          html: htmlContent,
          text: finalContent.replace(/<[^>]*>/g, ''),
        };

        await transporter.sendMail(mailOptions);
        results.push({ email: recipient.email, success: true });
      } catch (error) {
        results.push({
          email: recipient.email,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // 발송 로그 기록
    await prisma.adminMessage.create({
      data: {
        messageType: 'EMAIL',
        senderId: sessionUser.id,
        recipientType: recipients.length > 1 ? 'bulk' : 'individual',
        recipientCount: recipients.length,
        content: JSON.stringify({ subject: emailSubject, content, images, buttons }),
        status: failCount === 0 ? 'SENT' : failCount === recipients.length ? 'FAILED' : 'PARTIAL',
        sentAt: new Date(),
        targetFilters: {
          recipients: recipients.map((r) => ({ name: r.name, email: r.email, leadId: r.id })),
          profileId: profile.id,
          results,
        },
      },
    });

    // Google Drive 이미지 백업 + Spreadsheet 백업 (비동기, 실패해도 메인 응답에 영향 없음)
    backupEmailWithImages({
      sentAt: new Date(),
      senderName: profile.displayName || sessionUser.name || '파트너',
      senderType: isManager ? 'BRANCH_MANAGER' : 'SALES_AGENT',
      messageType: 'EMAIL',
      subject: emailSubject,
      content: content,
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
      recipientCount: recipients.length,
      status: failCount === 0 ? 'SENT' : failCount === recipients.length ? 'FAILED' : 'PARTIAL',
      successCount,
      failCount,
    }, images).catch((err) => console.error('[Email Backup] 백업 실패:', err));

    return NextResponse.json({
      ok: true,
      message: `총 ${recipients.length}건 중 ${successCount}건 발송 성공${failCount > 0 ? `, ${failCount}건 실패` : ''}`,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Message Center Send Email] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function buildEmailHtml(options: {
  content: string;
  images?: EmailImage[];
  buttons?: EmailButton[];
  senderName: string;
  signature?: string | null;
}): string {
  const { content, images, buttons, senderName, signature } = options;

  let imagesHtml = '';
  if (images && images.length > 0) {
    imagesHtml = images
      .map(
        (img) => `
        <div style="margin: 20px 0; text-align: center;">
          <img src="${img.url}" alt="${img.alt || ''}" style="max-width: 100%; height: auto; border-radius: 8px;" />
        </div>
      `
      )
      .join('');
  }

  let buttonsHtml = '';
  if (buttons && buttons.length > 0) {
    buttonsHtml = `
      <div style="margin: 30px 0; text-align: center;">
        ${buttons
          .map(
            (btn) => `
            <a href="${btn.url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 5px; font-weight: 600;">${btn.text}</a>
          `
          )
          .join('')}
      </div>
    `;
  }

  let signatureHtml = '';
  if (signature) {
    signatureHtml = `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        ${signature.replace(/\n/g, '<br>')}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.8;">
${content.replace(/\n/g, '<br>')}
        </div>

        ${imagesHtml}
        ${buttonsHtml}
        ${signatureHtml}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>본 이메일은 ${senderName}에서 발송되었습니다.</p>
          <p>&copy; ${new Date().getFullYear()} ${senderName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
