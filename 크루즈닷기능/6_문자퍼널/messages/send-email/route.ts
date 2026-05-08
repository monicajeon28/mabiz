export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { backupEmailWithImages } from '@/lib/message-backup';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Send Email] No session cookie found');
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      console.log('[Send Email] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {
      console.log('[Send Email] User is not admin:', session.User.role);
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Send Email] Auth check error:', error);
    return null;
  }
}

// 이메일 발송기 생성
function createEmailTransporter() {
  const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587');
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    throw new Error('이메일 설정이 완료되지 않았습니다. 환경 변수를 확인해주세요.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 포트는 SSL 사용
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

// 템플릿 변수 치환 함수
const replaceTemplateVariables = (
  text: string,
  name: string,
  phone: string,
  productName: string,
  linkUrl: string
): string => {
  return text
    .replace(/\{이름\}/g, name || '고객')
    .replace(/\{\{이름\}\}/g, name || '고객')
    .replace(/\{연락처\}/g, phone || '')
    .replace(/\{\{연락처\}\}/g, phone || '')
    .replace(/\{상품\}/g, productName || '')
    .replace(/\{\{상품명\}\}/g, productName || '')
    .replace(/\{링크\}/g, linkUrl || '');
};

// POST: 이메일 발송
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const body = await req.json();
    const { recipients, userIds, mallUserIds, title, content, productName, linkUrl, includeMallUsers, includeProspects, directEmails, imageUrl, images, buttons } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 이메일 설정 확인
    if (!process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: '이메일 설정이 완료되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

    console.log('[Send Email] Request:', {
      recipientsCount: recipients?.length || 0,
      productName: productName || 'N/A',
      linkUrl: linkUrl || 'N/A'
    });

    // 대상 사용자 조회
    let targetUsers: Array<{ id: number; name: string; email: string; type: string }> = [];

    // 새로운 방식: recipients 배열로 전달 (이름, 이메일 쌍)
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const validRecipients = recipients
        .filter((r: any) => r.email && r.email.trim() && r.email.includes('@'))
        .map((r: any) => ({
          id: 0,
          name: r.name || '고객',
          email: r.email.trim(),
          type: 'direct',
        }));

      targetUsers = validRecipients;
      console.log('[Send Email] Recipients from new format:', targetUsers.length);
    }
    
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // 특정 고객 선택 (크루즈 가이드 AI 사용 고객)
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds.map((id: any) => parseInt(id)) },
          role: 'user',
          email: { not: null },
        },
        select: { id: true, name: true, email: true },
      });
      targetUsers = users.filter(u => u.email !== null).map(u => ({ ...u, type: 'cruise-guide' })) as any;
    }

    // 크루즈몰 사용자 추가 (선택된 크루즈몰 고객 또는 includeMallUsers 플래그)
    if (mallUserIds && Array.isArray(mallUserIds) && mallUserIds.length > 0) {
      // 선택된 크루즈몰 고객
      const mallUsers = await prisma.user.findMany({
        where: {
          id: { in: mallUserIds.map((id: any) => parseInt(id)) },
          role: 'community', // 크루즈몰 고객은 role이 'community'
          email: { not: null },
        },
        select: { id: true, name: true, email: true },
      });
      const mallUsersList = mallUsers
        .filter(u => u.email !== null && u.email.trim() !== '')
        .map(u => ({ ...u, type: 'mall' })) as any;
      
      // 중복 제거 (이미 추가된 이메일 제외)
      const existingEmails = new Set(targetUsers.map(u => u.email));
      const newMallUsers = mallUsersList.filter((u: any) => !existingEmails.has(u.email));
      targetUsers = [...targetUsers, ...newMallUsers];
    } else if (includeMallUsers) {
      // 전체 크루즈몰 고객 (includeMallUsers 플래그가 true인 경우)
      const mallUsers = await prisma.user.findMany({
        where: {
          role: 'community', // 크루즈몰 고객은 role이 'community'
          email: { not: null },
        },
        select: { id: true, name: true, email: true },
      });
      const mallUsersList = mallUsers
        .filter(u => u.email !== null && u.email.trim() !== '')
        .map(u => ({ ...u, type: 'mall' })) as any;
      
      // 중복 제거 (이미 추가된 이메일 제외)
      const existingEmails = new Set(targetUsers.map(u => u.email));
      const newMallUsers = mallUsersList.filter((u: any) => !existingEmails.has(u.email));
      targetUsers = [...targetUsers, ...newMallUsers];
    }

    // 잠재고객 추가
    if (includeProspects) {
      const prospects = await prisma.prospect.findMany({
        where: {
          isActive: true,
          email: { not: null },
        },
        select: { id: true, name: true, email: true },
      });
      const prospectsList = prospects
        .filter(p => p.email !== null)
        .map(p => ({ id: p.id, name: p.name, email: p.email, type: 'prospect' })) as any;
      
      // 중복 제거 (이미 추가된 이메일 제외)
      const existingEmails = new Set(targetUsers.map(u => u.email));
      const newProspects = prospectsList.filter((p: any) => !existingEmails.has(p.email));
      targetUsers = [...targetUsers, ...newProspects];
    }

    // 직접 입력된 이메일 추가
    if (directEmails && Array.isArray(directEmails) && directEmails.length > 0) {
      const validDirectEmails = directEmails
        .filter((email: string) => email && email.trim() && email.includes('@'))
        .map((email: string) => email.trim());
      
      const existingEmails = new Set(targetUsers.map(u => u.email));
      const newDirectEmails = validDirectEmails
        .filter((email: string) => !existingEmails.has(email))
        .map((email: string) => ({ 
          id: 0, // 직접 입력은 id 없음
          name: null, 
          email, 
          type: 'direct' 
        })) as any;
      
      targetUsers = [...targetUsers, ...newDirectEmails];
    }

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { ok: false, error: '이메일을 발송할 고객이 없습니다. 이메일 주소가 등록된 고객이 없거나 선택한 고객이 조건에 맞지 않습니다.' },
        { status: 400 }
      );
    }

    // 이메일 발송기 생성
    const transporter = createEmailTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || '크루즈 가이드';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_SMTP_USER || '';

    // 이미지 HTML 추가 (새로운 images 배열 또는 기존 imageUrl 지원)
    let imageHtml = '';
    if (images && Array.isArray(images) && images.length > 0) {
      const imageItems = images.slice(0, 5).map((img: { url: string; name: string }) =>
        `<div style="margin-bottom: 15px; text-align: center;">
          <img src="${img.url}" alt="${img.name || '이미지'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        </div>`
      ).join('');
      imageHtml = `<div style="margin-top: 20px; margin-bottom: 20px;">${imageItems}</div>`;
    } else if (imageUrl) {
      imageHtml = `<div style="margin: 20px 0; text-align: center;"><img src="${imageUrl}" alt="첨부 이미지" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>`;
    }

    // 버튼 HTML 추가 (최대 3개)
    let buttonsHtml = '';
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      const buttonItems = buttons.slice(0, 3).map((btn: { label: string; url: string }) =>
        `<a href="${btn.url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; margin: 5px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);">${btn.label}</a>`
      ).join('');
      buttonsHtml = `<div style="margin-top: 25px; margin-bottom: 20px; text-align: center;">${buttonItems}</div>`;
    }

    // 각 사용자에게 이메일 발송
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const user of targetUsers) {
      try {
        // 템플릿 변수 치환 (각 수신자마다 개별 적용) - null 안전 처리
        const userPhone = (user as any).phone || '';
        const safeTitle = title ?? '';
        const safeContent = content ?? '';
        const safeName = user.name ?? '고객';
        const safeProductName = productName ?? '';
        const safeLinkUrl = linkUrl ?? '';

        const personalizedTitle = replaceTemplateVariables(safeTitle, safeName, userPhone, safeProductName, safeLinkUrl);
        const personalizedContent = replaceTemplateVariables(safeContent, safeName, userPhone, safeProductName, safeLinkUrl);

        // 치환 결과 유효성 검사
        if (!personalizedTitle || !personalizedContent) {
          console.warn(`[SendEmail] 템플릿 치환 결과가 비어있음 - user: ${user.email}`);
        }

        // HTML 형식으로 변환 (줄바꿈 처리)
        const htmlContent = personalizedContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');

        const mailOptions: any = {
          from: `"${fromName}" <${fromAddress}>`,
          to: user.email,
          subject: personalizedTitle,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
                ${personalizedTitle}
              </h2>
              <div style="margin-top: 20px; line-height: 1.6; color: #333;">
                ${htmlContent}
              </div>
              ${imageHtml}
              ${buttonsHtml}
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
                <p>본 메일은 크루즈 가이드에서 발송되었습니다.</p>
                <p>문의사항이 있으시면 고객센터로 연락해주세요.</p>
              </div>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        successCount++;
        results.push({ userId: user.id, email: user.email, name: user.name, success: true });

        console.log(`[Send Email] 이메일 발송 성공: ${user.name} (${user.email})`);
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        results.push({ userId: user.id, email: user.email, success: false, error: errorMessage });
        console.error(`[Send Email] 이메일 발송 실패 (${user.email}):`, error);
      }
    }

    // AdminMessage에 기록 (이메일 발송 기록) - User가 있는 경우만
    try {
      for (const user of targetUsers) {
        // 잠재고객과 직접 입력된 이메일은 userId가 없으므로 기록하지 않음
        if (user.type !== 'prospect' && user.type !== 'direct' && user.id && user.id > 0) {
          await prisma.adminMessage.create({
            data: {
              adminId: admin.id,
              userId: user.id,
              title,
              content,
              messageType: 'email',
              totalSent: 1,
              updatedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error('[Send Email] 메시지 기록 실패:', error);
      // 메시지 기록 실패해도 이메일 발송은 성공했으므로 계속 진행
    }

    // Google Drive 이미지 백업 + Spreadsheet 백업 (비동기, 실패해도 메인 응답에 영향 없음)
    backupEmailWithImages({
      sentAt: new Date(),
      senderName: admin.name || '관리자',
      senderType: 'ADMIN',
      messageType: 'EMAIL',
      subject: title,
      content: content,
      recipients: targetUsers.map((u) => ({ name: u.name, email: u.email })),
      recipientCount: targetUsers.length,
      status: failCount === 0 ? 'SENT' : failCount === targetUsers.length ? 'FAILED' : 'PARTIAL',
      successCount,
      failCount,
    }, images).catch((err) => console.error('[Admin Email Backup] 백업 실패:', err));

    return NextResponse.json({
      ok: true,
      totalSent: targetUsers.length,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    console.error('[Send Email] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
