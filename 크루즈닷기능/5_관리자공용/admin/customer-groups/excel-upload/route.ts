export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import * as XLSX from 'xlsx';
import { scheduleAdminFunnelMessages } from '@/lib/funnel-scheduler';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
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

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Customer Groups Excel] Auth check error:', error);
    return null;
  }
}

// POST: 엑셀 파일로 고객 일괄 등록
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 필요합니다.' }, { status: 400 });
    }

    if (!groupId) {
      return NextResponse.json({ ok: false, error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const groupIdNum = parseInt(groupId);
    if (isNaN(groupIdNum)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 그룹 소유권 확인
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupIdNum,
        adminId: admin.id,
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 엑셀 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellText: false,
      raw: false,
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 첫 번째 행을 헤더로 사용하여 JSON 변환
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: null, // 빈 셀은 null로 처리
      raw: false, // 날짜 등을 문자열로 변환
    }) as any[];
    
    logger.debug('[Excel Upload] 읽은 데이터 행 수:', data.length);
    if (data.length > 0) {
      logger.debug('[Excel Upload] 첫 번째 행:', data[0]);
    }

    if (data.length === 0) {
      return NextResponse.json({ ok: false, error: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 });
    }

    // 전화번호 정규화 함수
    const normalizePhone = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length < 10) return null;
      return digits;
    };

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 엑셀 데이터 처리 (배치 처리로 성능 최적화 - N+1 쿼리 문제 해결)
    const batchSize = 100;
    
    // 1단계: 모든 행의 전화번호 정규화 및 유효성 검사
    const validRows: Array<{
      rowIndex: number;
      name: string;
      phone: string;
      email: string | null;
      memo: string | null;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // 디버깅: 첫 번째 행의 키 확인
      if (i === 0) {
        logger.debug('[Excel Upload] 첫 번째 행의 키:', Object.keys(row));
        logger.debug('[Excel Upload] 첫 번째 행 데이터:', row);
      }
      
      // 이름, 연락처, 이메일, 비고 열 인식 (우선순위: 한글 > 영어)
      const name = row['이름'] || row['name'] || row['Name'] || row['NAME'] || '';
      const phone = row['연락처'] || row['전화번호'] || row['휴대폰번호'] || row['phone'] || row['Phone'] || row['PHONE'] || '';
      const email = row['이메일'] || row['email'] || row['Email'] || row['EMAIL'] || null;
      const memo = row['비고'] || row['memo'] || row['Memo'] || row['MEMO'] || row['메모'] || null;

      if (!name || !phone) {
        errorCount++;
        errors.push(`행 ${i + 2}: 이름과 전화번호는 필수입니다.`);
        continue;
      }

      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        errorCount++;
        errors.push(`행 ${i + 2}: 유효하지 않은 전화번호입니다.`);
        continue;
      }

      validRows.push({
        rowIndex: i + 2,
        name: String(name).trim(),
        phone: normalizedPhone,
        email: email ? String(email).trim() : null,
        memo: memo ? String(memo).trim() : null,
      });
    }

    // 2단계: 배치로 기존 사용자 조회
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const phones = batch.map(r => r.phone);

      // 기존 사용자 배치 조회
      const existingUsers = await prisma.user.findMany({
        where: { phone: { in: phones } },
        select: { id: true, phone: true },
      });

      const existingPhones = new Set(existingUsers.map(u => u.phone));
      const existingUsersMap = new Map(existingUsers.map(u => [u.phone, u.id]));

      // 기존 고객의 customerSource와 adminMemo 업데이트
      const existingUsersToUpdate = batch
        .filter(r => existingPhones.has(r.phone))
        .map(r => {
          const userId = existingUsersMap.get(r.phone);
          if (!userId) return null;
          return {
            userId,
            memo: r.memo || null,
          };
        })
        .filter((u): u is { userId: number; memo: string | null } => u !== null);

      // 기존 고객 업데이트 (customerSource를 'group'으로, adminMemo 업데이트)
      // 배치 업데이트로 최적화 (N+1 쿼리 문제 해결)
      if (existingUsersToUpdate.length > 0) {
        await prisma.$transaction(
          existingUsersToUpdate.map(userUpdate =>
            prisma.user.update({
              where: { id: userUpdate.userId },
              data: {
                customerSource: 'group',
                adminMemo: userUpdate.memo || undefined,
              },
            })
          )
        ).catch(() => {
          // 업데이트 실패해도 계속 진행
        });
      }

      // 새로 생성할 사용자 목록
      const now = new Date();
      const newUsers = batch
        .filter(r => !existingPhones.has(r.phone))
        .map(r => ({
          name: r.name,
          phone: r.phone,
          email: r.email,
          password: '3800',
          role: 'user' as const,
          customerStatus: 'active' as const,
          customerSource: 'group' as const, // 고객 그룹 관리에서 추가한 고객
          adminMemo: r.memo || null, // 비고를 adminMemo에 저장
          updatedAt: now, // updatedAt 필수 필드 추가
        }));

      // 새 사용자 배치 생성
      if (newUsers.length > 0) {
        // SQLite는 createMany의 skipDuplicates를 지원하지 않으므로 개별 생성
        // 하지만 트랜잭션으로 묶어서 성능 향상
        await prisma.$transaction(
          newUsers.map(userData =>
            prisma.user.create({ data: userData })
          )
        );
      }

      // 3단계: 모든 사용자 ID 조회 (기존 + 새로 생성)
      const allPhones = batch.map(r => r.phone);
      const allUsers = await prisma.user.findMany({
        where: { phone: { in: allPhones } },
        select: { id: true, phone: true },
      });

      const allUsersMap = new Map(allUsers.map(u => [u.phone, u.id]));

      // 4단계: 그룹 멤버 추가 (중복 체크)
      const groupMembersToAdd = batch
        .map(r => {
          const userId = allUsersMap.get(r.phone);
          if (!userId) return null;
          return {
            groupId: groupIdNum,
            userId,
            addedBy: admin.id,
          };
        })
        .filter((m): m is { groupId: number; userId: number; addedBy: number } => m !== null);

      if (groupMembersToAdd.length > 0) {
        // 중복 체크를 위해 기존 멤버 조회
        const existingMembers = await prisma.customerGroupMember.findMany({
          where: {
            groupId: groupIdNum,
            userId: { in: groupMembersToAdd.map(m => m.userId) },
          },
          select: { userId: true },
        });

        const existingUserIds = new Set(existingMembers.map(m => m.userId));
        const newMembers = groupMembersToAdd.filter(m => !existingUserIds.has(m.userId));

        if (newMembers.length > 0) {
          // SQLite는 createMany의 skipDuplicates를 지원하지 않으므로 개별 생성
          // 트랜잭션으로 묶어서 성능 향상
          try {
            await prisma.$transaction(
              newMembers.map(memberData =>
                prisma.customerGroupMember.create({ data: memberData })
              )
            );
            addedCount += newMembers.length;

            // 퍼널 자동 발송: 새로 그룹에 추가된 고객들에게 퍼널 메시지 예약
            for (const memberData of newMembers) {
              scheduleAdminFunnelMessages({
                userId: memberData.userId,
                groupId: groupIdNum,
                adminId: admin.id,
              }).catch(err => console.error('[Admin Excel Upload] Funnel schedule error:', err));
            }
          } catch (transactionError: any) {
            // 개별 에러 처리
            for (const memberData of newMembers) {
              try {
                await prisma.customerGroupMember.create({ data: memberData });
                addedCount++;

                // 퍼널 자동 발송
                scheduleAdminFunnelMessages({
                  userId: memberData.userId,
                  groupId: groupIdNum,
                  adminId: admin.id,
                }).catch(err => console.error('[Admin Excel Upload] Funnel schedule error:', err));
              } catch (memberError: any) {
                if (memberError.code === 'P2002') {
                  skippedCount++;
                } else {
                  errorCount++;
                  errors.push(`행 ${batch.find(r => allUsersMap.get(r.phone) === memberData.userId)?.rowIndex}: ${memberError.message || '처리 실패'}`);
                }
              }
            }
          }
        }

        skippedCount += groupMembersToAdd.length - newMembers.length;
      }
    }

    return NextResponse.json({
      ok: true,
      message: '엑셀 파일 업로드가 완료되었습니다.',
      summary: {
        total: data.length,
        added: addedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      errors: errors.slice(0, 10), // 최대 10개 에러만 반환
    });
  } catch (error: any) {
    console.error('[Customer Groups Excel Upload] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '엑셀 파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 엑셀 양식 파일 다운로드
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    // 샘플 데이터로 엑셀 파일 생성 (이름, 연락처, 이메일, 비고)
    const sampleData = [
      { 이름: '홍길동', 연락처: '010-1234-5678', 이메일: 'hong@example.com', 비고: '샘플 데이터' },
      { 이름: '김철수', 연락처: '010-2345-6789', 이메일: 'kim@example.com', 비고: '' },
      { 이름: '이영희', 연락처: '010-3456-7890', 이메일: 'lee@example.com', 비고: '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    
    // 열 너비 설정
    worksheet['!cols'] = [
      { wch: 15 }, // 이름
      { wch: 20 }, // 연락처
      { wch: 30 }, // 이메일
      { wch: 30 }, // 비고
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '고객목록');

    // Buffer 생성
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true,
    });

    // Buffer를 Uint8Array로 변환하여 반환
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename*=UTF-8\'\'%EA%B3%A0%EA%B0%9D_%EC%9D%BC%EA%B4%84%EB%93%B1%EB%A1%9D_%EC%96%91%EC%8B%9D.xlsx',
      },
    });
  } catch (error: any) {
    console.error('[Customer Groups Excel Download] Error:', error);
    console.error('[Customer Groups Excel Download] Error stack:', error.stack);
    return NextResponse.json(
      { ok: false, error: error.message || '양식 파일 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
