/**
 * 여권 정보 재사용 공통 함수
 * Traveler 정보 업데이트 시 User 테이블에 여권 정보를 백업하여
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
 * 여권 정보를 User 테이블에 백업
 * @param userId - User ID
 * @param passportData - 여권 정보
 */
export async function backupPassportDataToUser(
  userId: number,
  passportData: PassportData
): Promise<void> {
  try {
    // User 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, customerStatus: true },
    });

    if (!user) {
      logger.warn(`[Passport Utils] User not found: ${userId}`);
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

    // User 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: {
        customerStatus: newStatus,
      },
    });

    logger.log(`[Passport Utils] Passport data backed up for user ${userId}`);
  } catch (error: any) {
    logger.error('[Passport Utils] Error backing up passport data:', error);
    // 에러가 발생해도 메인 로직은 계속 진행
  }
}

/**
 * 이름과 전화번호로 User 찾기
 * @param korName - 한국 이름
 * @param phone - 전화번호 (선택)
 */
export async function findUserByNameAndPhone(
  korName: string,
  phone?: string
): Promise<number | null> {
  try {
    let user = null;

    // 전화번호가 있으면 전화번호로 먼저 검색
    if (phone) {
      user = await prisma.user.findFirst({
        where: { phone, name: korName },
        select: { id: true },
      });
    }

    // 전화번호로 못 찾으면 이름만으로 검색
    if (!user) {
      user = await prisma.user.findFirst({
        where: { name: korName },
        select: { id: true },
      });
    }

    return user?.id || null;
  } catch (error: any) {
    logger.error('[Passport Utils] Error finding user:', error);
    return null;
  }
}








