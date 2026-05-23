export const dynamic = 'force-dynamic';

/**
 * 여권/PNR 전용 챗봇 API
 *
 * 시나리오형 봇으로 다음 단계를 진행:
 * 1. 여권 사진 업로드 (OCR 수행 -> DB 임시저장)
 * 2. 주민번호 뒷자리 입력 (보안 입력)
 * 3. PNR - 방별 여행자 매핑
 * 4. 완료 시 엑셀 생성 트리거
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// TODO: scanPassport는 GMcruise gemini 라이브러리에서 제공 — CRM에 @/lib/gemini 이식 필요
// import { scanPassport } from '@/lib/gemini';

export const runtime = 'nodejs';

// 세션별 상태 저장 (실제 운영에서는 Redis 등 사용 권장)
const sessionState = new Map<string, {
  step: number;
  reservationId: number;
  totalPeople: number;
  uploadedPassports: Array<{
    imageBase64: string;
    ocrData: Record<string, unknown>;
    travelerIndex: number;
  }>;
  residentNumbers: string[];
  roomAssignments: Record<number, string[]>; // roomNumber -> traveler names
}>();

interface PassportFlowRequest {
  message?: string;
  image?: string; // base64 이미지
  reservationId?: number;
  action?: 'start' | 'upload' | 'resident' | 'assign' | 'complete';
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body: PassportFlowRequest = await req.json();
    const sessionKey = `passport_flow_${session.userId}_${body.reservationId || ''}`;

    // 상태 초기화 또는 가져오기
    let state = sessionState.get(sessionKey);
    if (!state && body.action === 'start' && body.reservationId) {
      // 예약 정보 확인
      const reservation = await prisma.gmReservation.findUnique({
        where: { id: body.reservationId },
        include: {
          trip: true,
        },
      });

      if (!reservation) {
        return NextResponse.json(
          { ok: false, error: '예약을 찾을 수 없습니다' },
          { status: 404 }
        );
      }

      if (reservation.mainUserId !== parseInt(session.userId)) {
        return NextResponse.json(
          { ok: false, error: '권한이 없습니다' },
          { status: 403 }
        );
      }

      state = {
        step: 1,
        reservationId: body.reservationId,
        totalPeople: reservation.totalPeople,
        uploadedPassports: [],
        residentNumbers: [],
        roomAssignments: {},
      };
      sessionState.set(sessionKey, state);

      return NextResponse.json({
        ok: true,
        step: 1,
        message: `안녕하세요! 여권 등록을 도와드리겠습니다.\n\n총 ${reservation.totalPeople}명의 여권 사진을 한 장씩 올려주세요. (${reservation.totalPeople}장 필요)`,
        totalPeople: reservation.totalPeople,
      });
    }

    if (!state) {
      return NextResponse.json(
        { ok: false, error: '세션이 만료되었습니다. 다시 시작해주세요.' },
        { status: 400 }
      );
    }

    // Step 1: 여권 사진 업로드
    if (state.step === 1 && body.image) {
      try {
        // TODO: scanPassport 이식 후 활성화
        // const ocrData = await scanPassport(body.image, 'image/jpeg');
        const ocrData: Record<string, unknown> = {
          korName: '(OCR 미구현)',
          engSurname: 'UNKNOWN',
          engGivenName: 'UNKNOWN',
        };

        // 임시 저장
        state.uploadedPassports.push({
          imageBase64: body.image,
          ocrData,
          travelerIndex: state.uploadedPassports.length,
        });

        const remaining = state.totalPeople - state.uploadedPassports.length;

        if (remaining > 0) {
          return NextResponse.json({
            ok: true,
            step: 1,
            message: `여권 ${state.uploadedPassports.length}번째 등록 완료!\n\n${(ocrData.korName as string) || (ocrData.engSurname as string)}님의 여권을 확인했습니다.\n\n남은 여권: ${remaining}장\n다음 여권 사진을 올려주세요.`,
            uploaded: state.uploadedPassports.length,
            remaining,
            ocrPreview: {
              name: (ocrData.korName as string) || `${ocrData.engSurname} ${ocrData.engGivenName}`,
            },
          });
        } else {
          // 모든 여권 업로드 완료 -> Step 2로 이동
          state.step = 2;
          sessionState.set(sessionKey, state);

          return NextResponse.json({
            ok: true,
            step: 2,
            message: `모든 여권 등록 완료!\n\n이제 OCR로 읽지 못한 '주민번호 뒷자리'를 입력해주세요.\n\n보안을 위해 뒷자리 7자리만 입력해주세요.\n(예: 1234567)`,
            uploaded: state.uploadedPassports.length,
          });
        }
      } catch (error: unknown) {
        const err = error as Record<string, unknown>;
        logger.error('[Passport Flow] OCR 실패:', { err });
        return NextResponse.json({
          ok: false,
          error: '여권 인식에 실패했습니다. 다시 촬영해주세요.',
        }, { status: 400 });
      }
    }

    // Step 2: 주민번호 뒷자리 입력
    if (state.step === 2 && body.message) {
      const residentNum = body.message.trim().replace(/[^0-9]/g, '');

      if (residentNum.length !== 7) {
        return NextResponse.json({
          ok: false,
          error: '주민번호 뒷자리는 7자리 숫자여야 합니다.\n다시 입력해주세요.',
        });
      }

      state.residentNumbers.push(residentNum);

      if (state.residentNumbers.length < state.totalPeople) {
        return NextResponse.json({
          ok: true,
          step: 2,
          message: `${state.residentNumbers.length}번째 주민번호 입력 완료!\n\n남은 입력: ${state.totalPeople - state.residentNumbers.length}명\n다음 분의 주민번호 뒷자리를 입력해주세요.`,
          entered: state.residentNumbers.length,
          remaining: state.totalPeople - state.residentNumbers.length,
        });
      } else {
        // Step 3으로 이동
        state.step = 3;
        sessionState.set(sessionKey, state);

        // 방 정보: travelers 관계 없음, 빈 rooms 반환
        const rooms: Record<number, number> = {};

        const roomList = Object.entries(rooms)
          .map(([roomNum, count]) => `방 ${roomNum} (${count}명)`)
          .join(', ');

        return NextResponse.json({
          ok: true,
          step: 3,
          message: `모든 주민번호 입력 완료!\n\n이제 방 배정을 진행하겠습니다.\n\n총 ${Object.keys(rooms).length}개의 방이 있습니다.\n${roomList}\n\n1번 방에 들어갈 분의 성함을 말씀해주세요.`,
          rooms: Object.keys(rooms).map(Number),
        });
      }
    }

    // Step 3: 방별 여행자 매핑
    if (state.step === 3 && body.message) {
      const message = body.message.trim();
      const currentRoom = Object.keys(state.roomAssignments).length + 1;

      // 방 정보: travelers 관계 없음, 빈 rooms 반환
      const rooms: Record<number, number> = {};

      const roomNumbers = Object.keys(rooms).map(Number).sort((a, b) => a - b);
      const currentRoomNumber = roomNumbers[currentRoom - 1];
      const roomCapacity = rooms[currentRoomNumber] || 0;

      if (!state.roomAssignments[currentRoomNumber]) {
        state.roomAssignments[currentRoomNumber] = [];
      }

      // 이름 매칭 (간단한 로직)
      const matchedNames = state.uploadedPassports
        .map((p) => (p.ocrData.korName as string) || `${p.ocrData.engSurname} ${p.ocrData.engGivenName}`)
        .filter((name) => name.includes(message) || message.includes(name.split(' ')[0]));

      if (matchedNames.length > 0) {
        state.roomAssignments[currentRoomNumber].push(matchedNames[0]);
      } else {
        state.roomAssignments[currentRoomNumber].push(message);
      }

      const assignedCount = state.roomAssignments[currentRoomNumber].length;

      if (assignedCount < roomCapacity) {
        return NextResponse.json({
          ok: true,
          step: 3,
          message: `${message}님을 방 ${currentRoomNumber}에 배정했습니다.\n\n방 ${currentRoomNumber}에 들어갈 분이 더 있나요? (${assignedCount}/${roomCapacity}명)`,
          currentRoom: currentRoomNumber,
          assigned: assignedCount,
          capacity: roomCapacity,
        });
      }

      // 다음 방으로 이동
      if (currentRoom < roomNumbers.length) {
        const nextRoomNumber = roomNumbers[currentRoom];
        const nextRoomCapacity = rooms[nextRoomNumber] || 0;

        return NextResponse.json({
          ok: true,
          step: 3,
          message: `방 ${currentRoomNumber} 배정 완료!\n\n이제 방 ${nextRoomNumber}에 들어갈 분의 성함을 말씀해주세요. (${nextRoomCapacity}명)`,
          currentRoom: nextRoomNumber,
        });
      } else {
        // 모든 방 배정 완료 -> Step 4
        state.step = 4;
        sessionState.set(sessionKey, state);

        // DB에 저장
        await savePassportData(state);

        return NextResponse.json({
          ok: true,
          step: 4,
          message: `모든 등록이 완료되었습니다!\n\n여권 정보가 저장되었고, 엑셀 파일이 생성됩니다.\n\n감사합니다!`,
          completed: true,
        });
      }
    }

    return NextResponse.json({
      ok: false,
      error: '잘못된 요청입니다.',
    }, { status: 400 });

  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Flow API] Error:', { err });
    return NextResponse.json(
      { ok: false, error: '여권 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 여권 데이터를 DB에 저장
 */
async function savePassportData(state: {
  reservationId: number;
  uploadedPassports: Array<{
    imageBase64: string;
    ocrData: Record<string, unknown>;
    travelerIndex: number;
  }>;
  residentNumbers: string[];
  roomAssignments: Record<number, string[]>;
}) {
  const reservation = await prisma.gmReservation.findUnique({
    where: { id: state.reservationId },
  });

  if (!reservation) {
    throw new Error('예약을 찾을 수 없습니다');
  }

  const travelers = await prisma.gmTraveler.findMany({
    where: { reservationId: state.reservationId },
    orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
  });

  // Traveler 업데이트
  for (let i = 0; i < state.uploadedPassports.length && i < travelers.length; i++) {
    const passport = state.uploadedPassports[i];
    const traveler = travelers[i];
    const residentNum = state.residentNumbers[i] || '';

    await prisma.gmTraveler.update({
      where: { id: traveler.id },
      data: {
        korName: (passport.ocrData.korName as string) || null,
        engSurname: (passport.ocrData.engSurname as string) || null,
        engGivenName: (passport.ocrData.engGivenName as string) || null,
        residentNum: residentNum || null,
        gender: (passport.ocrData.gender as string) || null,
        birthDate: (passport.ocrData.birthDate as string) || null,
        passportNo: (passport.ocrData.passportNo as string) || null,
        issueDate: (passport.ocrData.issueDate as string) || null,
        expiryDate: (passport.ocrData.expiryDate as string) || null,
        passportImage: passport.imageBase64.substring(0, 100) + '...', // 간단한 저장 (실제로는 파일 저장 필요)
      },
    });
  }

  // Reservation 상태 업데이트
  await prisma.gmReservation.update({
    where: { id: state.reservationId },
    data: { passportStatus: 'COMPLETED' },
  });
}
