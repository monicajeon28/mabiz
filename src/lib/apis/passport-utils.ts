/**
 * 여권 정보 재사용 공통 함수
 * Traveler 정보 업데이트 시 GmUser 테이블에 여권 정보를 백업하여
 * 다음 여행 예약 시 자동으로 불러올 수 있게 합니다.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface PassportData {
  korName: string;
  phone?: string;
  passportNo?: string;
  passportExpiryDate?: Date | string;
  residentNum?: string;
  nationality?: string;
  dateOfBirth?: Date | string;
  engSurname?: string;
  engGivenName?: string;
}

/**
 * 여권 정보를 GmUser 테이블에 백업
 * @param userId - GmUser ID
 * @param passportData - 여권 정보
 */
export async function backupPassportDataToUser(
  userId: number,
  passportData: PassportData
): Promise<void> {
  try {
    // GmUser 조회
    const user = await prisma.gmUser.findUnique({
      where: { id: userId },
      select: { id: true, customerStatus: true },
    });

    if (!user) {
      logger.warn(`[Passport Utils] GmUser not found: ${userId}`);
      return;
    }

    // customerStatus 업데이트 (PASSPORT_READY 태그 추가)
    const currentStatus = user.customerStatus || '';
    let newStatus = currentStatus;

    // PASSPORT_READY 태그가 없으면 추가
    if (!currentStatus.includes('PASSPORT_READY')) {
      newStatus = currentStatus
        ? `${currentStatus},PASSPORT_READY`
        : 'PASSPORT_READY';
    }

    // GmUser 업데이트
    await prisma.gmUser.update({
      where: { id: userId },
      data: {
        customerStatus: newStatus,
      },
    });

    logger.log(`[Passport Utils] Passport data backed up for user ${userId}`);
  } catch (error: unknown) {
    logger.error('[Passport Utils] Error backing up passport data:', error instanceof Error ? { message: error.message } : undefined);
    // 에러가 발생해도 메인 로직은 계속 진행
  }
}

/**
 * 이름과 전화번호로 GmUser 찾기 (동명이인 감지)
 *
 * 반환:
 * - { id, ambiguous: false } — 유일한 사용자 확인
 * - { ids: [1,2,3], ambiguous: true, count } — 동명이인 2명 이상
 * - null — 사용자 없음
 *
 * @param korName - 한국 이름
 * @param phone - 전화번호 (선택, 우선순위 높음)
 */
export async function findUserByNameAndPhone(
  korName: string,
  phone?: string
): Promise<
  | { id: number; ambiguous: false; createdAt: Date }
  | { ids: number[]; ambiguous: true; count: number }
  | null
> {
  try {
    // 전화번호가 있으면 전화번호+이름으로 검색 (가장 정확)
    if (phone) {
      const usersByPhoneName = await prisma.gmUser.findMany({
        where: { phone, name: korName },
        select: { id: true, createdAt: true },
        take: 10, // 동명이인 최대 10명까지만 로드
      });

      if (usersByPhoneName.length === 1) {
        return { id: usersByPhoneName[0].id, ambiguous: false, createdAt: usersByPhoneName[0].createdAt };
      }

      if (usersByPhoneName.length > 1) {
        // 동명이인 — UI에서 선택하게 해야 함
        return {
          ids: usersByPhoneName.map((u) => u.id),
          ambiguous: true,
          count: usersByPhoneName.length,
        };
      }

      // 전화번호+이름으로 못 찾으면 이름만으로 검색
    }

    // 이름만으로 검색
    const usersByName = await prisma.gmUser.findMany({
      where: { name: korName },
      select: { id: true, createdAt: true, phone: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (usersByName.length === 0) {
      return null;
    }

    if (usersByName.length === 1) {
      return { id: usersByName[0].id, ambiguous: false, createdAt: usersByName[0].createdAt };
    }

    // 동명이인 2명 이상 감지
    // 전화번호가 제공되었다면 일치하는 항목으로 좁혀보기
    if (phone) {
      const normalized = (p: string) => p.replace(/[-\s()]/g, '');
      const phoneNorm = normalized(phone);
      const matching = usersByName.filter(
        (u) => u.phone && normalized(u.phone) === phoneNorm
      );

      if (matching.length === 1) {
        return { id: matching[0].id, ambiguous: false, createdAt: matching[0].createdAt };
      }

      if (matching.length > 1) {
        return {
          ids: matching.map((u) => u.id),
          ambiguous: true,
          count: matching.length,
        };
      }
    }

    // 동명이인 확인됨
    return {
      ids: usersByName.map((u) => u.id),
      ambiguous: true,
      count: usersByName.length,
    };
  } catch (error: unknown) {
    logger.error(
      '[Passport Utils] Error finding user:',
      error instanceof Error ? { message: error.message } : undefined
    );
    return null;
  }
}
