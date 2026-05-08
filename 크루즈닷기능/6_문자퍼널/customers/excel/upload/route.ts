export const dynamic = 'force-dynamic';

export const runtime = 'nodejs'; // Edge Runtime 금지 (xlsx 라이브러리 사용)

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

/**
 * POST /api/partner/customers/excel/upload
 * 엑셀 파일 업로드 및 고객 일괄 생성
 */
export async function POST(req: NextRequest) {
  try {
    let profile;
    try {
      const context = await requirePartnerContext({ includeManagedAgents: true });
      profile = context.profile;
    } catch (contextError: any) {
      console.error('[Partner Customers Excel Upload] requirePartnerContext error:', contextError);
      if (contextError instanceof Error) {
        return NextResponse.json(
          { ok: false, message: contextError.message || '인증 오류가 발생했습니다.' },
          { status: (contextError as any).status || 401 }
        );
      }
      return NextResponse.json(
        { ok: false, message: '인증 오류가 발생했습니다.' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const agentProfileId = formData.get('agentProfileId') as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 크기 확인 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, message: `파일 크기가 너무 큽니다. (최대 10MB, 현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    // 파일 타입 확인
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { ok: false, message: '엑셀 파일만 업로드 가능합니다. (.xlsx, .xls)' },
        { status: 400 }
      );
    }

    // 엑셀 파일 파싱
    let buffer: ArrayBuffer;
    let workbook: XLSX.WorkBook;
    let data: any[];

    try {
      buffer = await file.arrayBuffer();
    } catch (error: any) {
      console.error('[Partner Customers Excel Upload] File read error:', error);
      return NextResponse.json(
        { ok: false, message: '파일을 읽는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (error: any) {
      console.error('[Partner Customers Excel Upload] Excel parse error:', error);
      return NextResponse.json(
        { ok: false, message: '엑셀 파일 형식이 올바르지 않습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.' },
        { status: 400 }
      );
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { ok: false, message: '엑셀 파일에 시트가 없습니다.' },
        { status: 400 }
      );
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return NextResponse.json(
        { ok: false, message: '엑셀 파일의 첫 번째 시트를 읽을 수 없습니다.' },
        { status: 400 }
      );
    }

    try {
      data = XLSX.utils.sheet_to_json(worksheet) as any[];
    } catch (error: any) {
      console.error('[Partner Customers Excel Upload] Sheet to JSON error:', error);
      return NextResponse.json(
        { ok: false, message: '엑셀 데이터를 변환하는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json({ ok: false, message: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 판매원 할당 검증 (대리점장인 경우)
    let assignedAgentId: number | null = null;
    if (profile.type === 'BRANCH_MANAGER' && agentProfileId) {
      const agentId = Number(agentProfileId);
      // managedRelations는 requirePartnerContext에서 매핑됨
      const hasAgent =
        (profile as any).managedRelations?.some((relation: any) => relation.agent?.id === agentId) ?? false;
      if (!hasAgent) {
        return NextResponse.json(
          { ok: false, message: '해당 판매원은 대리점장 관리 대상이 아닙니다.' },
          { status: 400 }
        );
      }
      assignedAgentId = agentId;
    } else if (profile.type === 'SALES_AGENT') {
      assignedAgentId = profile.id;
    }

    // 각 행 처리
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let customerName: string | null = null;
      let customerPhone: string | null = null;
      let normalizedPhone: string | null = null;

      try {
        // 이름과 연락처 추출 (다양한 컬럼명 지원)
        customerName =
          row['이름'] ||
          row['name'] ||
          row['Name'] ||
          row['NAME'] ||
          row['고객명'] ||
          row['성명'] ||
          null;
        customerPhone =
          row['연락처'] ||
          row['전화번호'] ||
          row['phone'] ||
          row['Phone'] ||
          row['PHONE'] ||
          row['전화'] ||
          row['휴대폰'] ||
          row['핸드폰'] ||
          null;

        // 이름 또는 연락처 중 하나는 필수
        if (!customerName && !customerPhone) {
          results.failed++;
          results.errors.push(`${i + 2}행: 이름 또는 연락처가 없습니다.`);
          continue;
        }

        // 연락처 정규화 (숫자만 추출)
        normalizedPhone = customerPhone
          ? customerPhone.replace(/[^0-9]/g, '')
          : null;

        // 중복 확인 (연락처 기준)
        if (normalizedPhone) {
          const whereCondition: any = {
            customerPhone: normalizedPhone,
          };

          if (profile.type === 'BRANCH_MANAGER') {
            whereCondition.managerId = profile.id;
          } else if (profile.type === 'SALES_AGENT') {
            whereCondition.agentId = profile.id;
          }

          const existing = await prisma.affiliateLead.findFirst({
            where: whereCondition,
          });

          if (existing) {
            results.failed++;
            results.errors.push(`${i + 2}행: 이미 등록된 연락처입니다. (${normalizedPhone})`);
            continue;
          }
        }

        // 고객 생성
        const now = new Date();
        const createData: any = {
          customerName: customerName ? String(customerName).trim() : null,
          customerPhone: normalizedPhone,
          status: 'NEW',
          updatedAt: now, // 필수 필드
        };

        // 대리점장인 경우
        if (profile.type === 'BRANCH_MANAGER') {
          createData.manager = { connect: { id: profile.id } };
          if (assignedAgentId) {
            createData.agent = { connect: { id: assignedAgentId } };
          }
        } else if (profile.type === 'SALES_AGENT') {
          // 판매원인 경우
          createData.agent = { connect: { id: profile.id } };
          // agentRelations는 requirePartnerContext에서 매핑됨
          const activeManager = (profile as any).agentRelations?.[0]?.managerId;
          if (activeManager) {
            createData.manager = { connect: { id: activeManager } };
          }
        } else {
          createData.manager = { connect: { id: profile.id } };
        }

        await prisma.affiliateLead.create({
          data: createData,
        });

        results.success++;

        // Google 스프레드시트 백업 (비동기)
        import('@/lib/google-sheets').then(({ sendToGoogleSheet }) => {
          let channel = '본사';
          let managerName = '';
          if (profile.type === 'BRANCH_MANAGER') {
            channel = '대리점장';
            managerName = 'Excel Upload';
          } else if (profile.type === 'SALES_AGENT') {
            channel = '판매원';
            managerName = 'Excel Upload';
          }

          sendToGoogleSheet({
            name: customerName ? String(customerName).trim() : '',
            phone: normalizedPhone || '',
            source: 'excel-import',
            productName: '',
            channel,
            manager: managerName,
            notes: undefined,
            target: 'management', // 내 고객 관리용 시트로 전송
          });
        });
      } catch (error: any) {
        results.failed++;
        const errorMsg = error?.message || '처리 오류';
        const errorCode = error?.code || 'UNKNOWN';
        console.error(`[Partner Customers Excel Upload] Row ${i + 2} error:`, {
          error: errorMsg,
          code: errorCode,
          customerName,
          customerPhone: normalizedPhone,
        });
        results.errors.push(`${i + 2}행: ${errorMsg}${errorCode ? ` (${errorCode})` : ''}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `처리 완료: 성공 ${results.success}건, 실패 ${results.failed}건`,
      results,
    });
  } catch (error: any) {
    console.error('[Partner Customers Excel Upload] POST error:', error);
    console.error('[Partner Customers Excel Upload] Error stack:', error.stack);
    console.error('[Partner Customers Excel Upload] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    // 더 자세한 에러 메시지 제공
    let errorMessage = '엑셀 파일을 업로드하는 중 오류가 발생했습니다.';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code === 'ENOENT') {
      errorMessage = '파일을 찾을 수 없습니다.';
    } else if (error.code === 'EACCES') {
      errorMessage = '파일 접근 권한이 없습니다.';
    }

    return NextResponse.json(
      { ok: false, message: errorMessage },
      { status: 500 }
    );
  }
}
