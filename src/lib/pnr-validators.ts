/**
 * PNR 유효성 검사 함수들
 * 클라이언트(page.tsx)와 서버(route.ts) 양쪽에서 재사용 가능
 */

import type { Traveler, TravelerInput } from '@/src/lib/types/pnr';

/**
 * 단일 여행자 유효성 검사 오류 정보
 */
export interface ValidationError {
  field: keyof Traveler | keyof TravelerInput;
  message: string;
}

/**
 * 단일 여행자 검증
 * @param traveler 검증할 여행자 객체
 * @param index 여행자 인덱스 (0=대표자, 1+=동행자)
 * @returns 오류 객체 또는 null
 */
export function validateTraveler(
  traveler: Traveler | TravelerInput,
  index: number
): ValidationError | null {
  const label = index === 0 ? '대표자' : `동행자 ${index}`;

  // 이름 검증
  if (!traveler.korName?.trim()) {
    return {
      field: 'korName',
      message: `${label}의 이름을 입력해주세요.`,
    };
  }

  // 주민번호 검증
  if (!traveler.residentNum?.trim()) {
    return {
      field: 'residentNum',
      message: `${label}의 주민등록번호를 입력해주세요.`,
    };
  }

  // 주민번호 형식 검사
  const cleanResidentNum = traveler.residentNum.replace(/-/g, '');
  const validLengths = [6, 7, 13]; // 6자리, 7자리, 13자리 모두 허용

  if (!validLengths.includes(cleanResidentNum.length)) {
    return {
      field: 'residentNum',
      message: `${label}의 주민등록번호 형식이 올바르지 않습니다. (예: 000000-0000000)`,
    };
  }

  // 연락처 검증
  if (!traveler.phone?.trim()) {
    return {
      field: 'phone',
      message: `${label}의 연락처를 입력해주세요.`,
    };
  }

  return null;
}

/**
 * 모든 여행자 검증
 * @param travelers 검증할 여행자 배열
 * @returns 첫 번째 오류 또는 null
 */
export function validateAllTravelers(
  travelers: (Traveler | TravelerInput)[]
): ValidationError | null {
  for (let i = 0; i < travelers.length; i++) {
    const error = validateTraveler(travelers[i], i);
    if (error) {
      return error;
    }
  }
  return null;
}

/**
 * 여행자 배열 길이 검증
 * @param travelers 검증할 여행자 배열
 * @returns 오류 객체 또는 null
 */
export function validateTravelerCount(
  travelers: (Traveler | TravelerInput)[]
): ValidationError | null {
  if (!travelers || travelers.length === 0) {
    return {
      field: 'korName',
      message: '최소 1명의 여행자가 필요합니다.',
    };
  }

  if (travelers.length > 20) {
    return {
      field: 'korName',
      message: '최대 20명까지 추가 가능합니다.',
    };
  }

  return null;
}
