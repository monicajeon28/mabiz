export const dynamic = 'force-dynamic';

/**
 * 관리자 - 메시지 발송 내역 엑셀 내보내기 API
 * POST /api/admin/messages/export-excel
 *
 * 구글 스프레드시트로 내보내기 또는 CSV 다운로드
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { getGoogleAuth } from '@/lib/google-drive';

// 메시지 발송 내역 백업 스프레드시트 ID
const MESSAGE_BACKUP_SPREADSHEET_ID = process.env.MESSAGE_BACKUP_SPREADSHEET_ID || '';

// 발송 방법 라벨
function getMethodLabel(type: string): string {
  switch (type) {
    case 'sms': return 'SMS';
    case 'email': return '이메일';
    case 'kakao': return '카카오톡';
    case 'push':
    case 'announcement': return '푸시알림';
    case 'agent-manager':
    case 'manager-agent':
    case 'manager-manager':
    case 'agent-admin':
    case 'manager-admin':
      return '팀메시지';
    default: return '앱메시지';
  }
}

// 발송 유형 라벨
function getSenderTypeLabel(messageType: string): string {
  switch (messageType) {
    case 'agent-manager': return '판매원→대리점장';
    case 'manager-agent': return '대리점장→판매원';
    case 'manager-manager': return '대리점장→대리점장';
    case 'agent-admin': return '판매원→본사';
    case 'manager-admin': return '대리점장→본사';
    case 'team-dashboard': return '본사→팀';
    default: return '관리자→고객';
  }
}

export async function POST(req: NextRequest) {
  try {
    // 메시지 데이터 조회
    const messages = await prisma.adminMessage.findMany({
      where: { isActive: true },
      include: {
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true, role: true },
        },
        User_AdminMessage_userIdToUser: {
          select: { id: true, name: true, phone: true },
        },
        UserMessageRead: {
          select: { userId: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // 최근 1000건
    });

    // 스프레드시트 헤더
    const header = [
      '발송일시',
      '담당자',
      '담당자역할',
      '제목',
      '내용',
      '발송방법',
      '발송유형',
      '수신자이름',
      '수신자연락처',
      '발송건수',
      '수신건수',
      '수신율(%)',
      '읽음시간',
    ];

    // 데이터 행 생성
    const rows = messages.map(msg => {
      const sender = msg.User_AdminMessage_adminIdToUser;
      const recipient = msg.User_AdminMessage_userIdToUser;
      const totalSent = 1; // 메시지당 1건
      const totalRead = msg.UserMessageRead.length > 0 ? 1 : 0;
      const readRate = Math.round((totalRead / totalSent) * 100);
      const readAt = msg.UserMessageRead[0]?.readAt;

      return [
        new Date(msg.createdAt).toLocaleString('ko-KR'),
        sender?.name || '시스템',
        sender?.role === 'admin' ? '관리자' :
          sender?.role === 'manager' ? '대리점장' :
          sender?.role === 'agent' ? '판매원' : '시스템',
        msg.title,
        msg.content.substring(0, 200).replace(/\n/g, ' '),
        getMethodLabel(msg.messageType || ''),
        getSenderTypeLabel(msg.messageType || ''),
        recipient?.name || '전체',
        recipient?.phone || '-',
        totalSent.toString(),
        totalRead.toString(),
        `${readRate}%`,
        readAt ? new Date(readAt).toLocaleString('ko-KR') : '미확인',
      ];
    });

    // 구글 스프레드시트로 내보내기 시도
    if (MESSAGE_BACKUP_SPREADSHEET_ID) {
      try {
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        const sheetName = '메시지발송내역';
        const values = [header, ...rows];

        // 기존 데이터 클리어 후 새 데이터 입력
        await sheets.spreadsheets.values.clear({
          spreadsheetId: MESSAGE_BACKUP_SPREADSHEET_ID,
          range: `'${sheetName}'!A:M`,
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId: MESSAGE_BACKUP_SPREADSHEET_ID,
          range: `'${sheetName}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });

        console.log(`[Message Export] Exported ${messages.length} messages to Google Sheets`);

        return NextResponse.json({
          ok: true,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MESSAGE_BACKUP_SPREADSHEET_ID}/edit`,
          totalCount: messages.length,
        });
      } catch (sheetError: any) {
        console.error('[Message Export] Google Sheets export failed:', sheetError);
        // 스프레드시트 실패 시 CSV로 폴백
      }
    }

    // CSV 생성 (스프레드시트가 없거나 실패한 경우)
    const csvContent = [
      header.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return NextResponse.json({
      ok: true,
      csv: csvContent,
      totalCount: messages.length,
    });
  } catch (error: any) {
    console.error('[Message Export] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || '내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 구글 스프레드시트에 메시지 발송 내역 백업 (자동화용)
 */
async function backupMessagesToSheet(): Promise<{
  ok: boolean;
  totalCount: number;
  error?: string;
}> {
  if (!MESSAGE_BACKUP_SPREADSHEET_ID) {
    return { ok: false, totalCount: 0, error: 'MESSAGE_BACKUP_SPREADSHEET_ID not configured' };
  }

  try {
    const messages = await prisma.adminMessage.findMany({
      where: { isActive: true },
      include: {
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true, role: true },
        },
        User_AdminMessage_userIdToUser: {
          select: { id: true, name: true, phone: true },
        },
        UserMessageRead: {
          select: { userId: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetName = '메시지발송내역';
    const header = [
      '발송일시', '담당자', '담당자역할', '제목', '내용',
      '발송방법', '발송유형', '수신자이름', '수신자연락처',
      '발송건수', '수신건수', '수신율(%)', '읽음시간',
    ];

    const rows = messages.map(msg => {
      const sender = msg.User_AdminMessage_adminIdToUser;
      const recipient = msg.User_AdminMessage_userIdToUser;
      const totalRead = msg.UserMessageRead.length > 0 ? 1 : 0;
      const readAt = msg.UserMessageRead[0]?.readAt;

      return [
        new Date(msg.createdAt).toLocaleString('ko-KR'),
        sender?.name || '시스템',
        sender?.role === 'admin' ? '관리자' :
          sender?.role === 'manager' ? '대리점장' :
          sender?.role === 'agent' ? '판매원' : '시스템',
        msg.title,
        msg.content.substring(0, 200).replace(/\n/g, ' '),
        getMethodLabel(msg.messageType || ''),
        getSenderTypeLabel(msg.messageType || ''),
        recipient?.name || '전체',
        recipient?.phone || '-',
        '1',
        totalRead.toString(),
        `${totalRead * 100}%`,
        readAt ? new Date(readAt).toLocaleString('ko-KR') : '미확인',
      ];
    });

    const values = [header, ...rows];

    await sheets.spreadsheets.values.update({
      spreadsheetId: MESSAGE_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Message Backup] Backed up ${messages.length} messages to sheet`);

    return { ok: true, totalCount: messages.length };
  } catch (error: any) {
    console.error('[Message Backup] Failed:', error);
    return { ok: false, totalCount: 0, error: error.message };
  }
}
