export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import nodemailer from 'nodemailer';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const { prisma } = await import('@/lib/prisma');
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Marketing Customers Send Email] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { emails, title, content, senderEmail } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '이메일 주소 목록이 필요합니다.',
      }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({
        ok: false,
        error: '제목과 내용을 입력해주세요.',
      }, { status: 400 });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter((email: string) => emailRegex.test(email));
    
    if (validEmails.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '유효한 이메일 주소가 없습니다.',
      }, { status: 400 });
    }

    // SMTP 설정
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASSWORD || process.env.SMTP_PASS;
    const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || '587');
    const fromAddress = senderEmail || process.env.EMAIL_FROM_ADDRESS || emailUser || 'noreply@cruisedot.com';

    if (!emailUser || !emailPass) {
      return NextResponse.json({
        ok: false,
        error: '이메일 서버 설정이 완료되지 않았습니다.',
      }, { status: 500 });
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

    // HTML 본문 작성
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin-top: 0;">${title}</h2>
          <div style="margin: 10px 0; font-size: 16px; white-space: pre-wrap;">${content.replace(/\n/g, '<br>')}</div>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
          <p style="font-size: 12px; color: #888; margin: 0; font-style: italic;">
            크루즈 첫여행 크루즈닷, 두번째 부터 행복하게 크루즈닷 감사합니다
          </p>
        </div>
      </body>
      </html>
    `;

    // 이메일 발송 (배치로 나눠서 발송)
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 한 번에 최대 50개씩 발송 (SMTP 서버 부하 방지)
    const batchSize = 50;
    for (let i = 0; i < validEmails.length; i += batchSize) {
      const batch = validEmails.slice(i, i + batchSize);
      
      for (const email of batch) {
        try {
          const mailOptions = {
            from: `"크루즈닷" <${fromAddress}>`,
            to: email,
            subject: title,
            html: htmlBody,
          };

          await transporter.sendMail(mailOptions);
          sentCount++;
        } catch (error: any) {
          failedCount++;
          errors.push(`${email}: ${error.message || '발송 실패'}`);
          console.error(`[Marketing Customers Send Email] Failed to send to ${email}:`, error);
        }
      }

      // 배치 간 딜레이 (SMTP 서버 부하 방지)
      if (i + batchSize < validEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      totalCount: validEmails.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // 최대 10개 에러만 반환
    });
  } catch (error) {
    console.error('[Marketing Customers Send Email] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '이메일 발송에 실패했습니다.',
    }, { status: 500 });
  }
}
