/**
 * Kakao Channel Service
 * 카카오톡 알림톡 발송 관련 유틸리티 함수
 */

import { logger } from '@/lib/logger';
import type { KakaoConfig, SubstitutionOption } from '@/lib/types/kakao';

const MAX_KAKAO_TITLE_LENGTH = 30;
const MAX_KAKAO_MESSAGE_LENGTH = 1000;

/**
 * Kakao 메시지 입력값 검증
 * @param title - 제목 (30자 이하)
 * @param message - 메시지 (1000자 이하)
 * @returns 검증 결과 { valid: boolean; error?: string }
 */
export function validateKakaoMessage(title: string, message: string): {
  valid: boolean;
  error?: string;
} {
  if (!title?.trim()) {
    return { valid: false, error: '제목을 입력하세요.' };
  }

  if (!message?.trim()) {
    return { valid: false, error: '메시지를 입력하세요.' };
  }

  const trimmedTitle = title.trim();
  const trimmedMsg = message.trim();

  if (trimmedTitle.length > MAX_KAKAO_TITLE_LENGTH) {
    return {
      valid: false,
      error: `제목은 ${MAX_KAKAO_TITLE_LENGTH}자 이내여야 합니다.`,
    };
  }

  if (trimmedMsg.length > MAX_KAKAO_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `메시지는 ${MAX_KAKAO_MESSAGE_LENGTH}자 이내여야 합니다.`,
    };
  }

  // 제어 문자 검사
  const disallowedChars = /[\x00-\x1F\x7F​-⁯﻿]/;
  if (disallowedChars.test(trimmedTitle) || disallowedChars.test(trimmedMsg)) {
    return { valid: false, error: '사용할 수 없는 문자가 포함되어 있습니다.' };
  }

  return { valid: true };
}

/**
 * 메시지에서 치환변수를 실제 값으로 교체
 * @param template - 템플릿 메시지 (예: "안녕하세요 [이름]님")
 * @param contact - 연락처 정보
 * @returns 치환된 메시지
 */
export function performSubstitution(
  template: string,
  contact: {
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  }
): string {
  let result = template;

  // 기본 치환변수
  if (contact.name) {
    result = result
      .replace(/\[이름\]/g, contact.name)
      .replace(/\[고객명\]/g, contact.name);
  }

  if (contact.phone) {
    result = result.replace(/\[전화번호\]/g, contact.phone);
  }

  if (contact.email) {
    result = result.replace(/\[이메일\]/g, contact.email);
  }

  // 커스텀 필드 (예: [상품명], [출발일] 등)
  Object.entries(contact).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      const pattern = new RegExp(`\\[${key}\\]`, 'g');
      result = result.replace(pattern, String(value));
    }
  });

  return result;
}

/**
 * 치환변수 옵션 배열 반환
 * @returns 기본 치환변수 목록
 */
export function getSubstitutionOptions(): SubstitutionOption[] {
  return [
    { label: '[이름]', desc: '고객 이름' },
    { label: '[전화번호]', desc: '고객 전화번호' },
    { label: '[상품명]', desc: '관심 상품명' },
    { label: '[출발일]', desc: '예정 출발일' },
  ];
}

/**
 * Kakao 메시지 프리뷰 생성
 * @param title - 제목
 * @param message - 메시지
 * @returns 프리뷰 텍스트
 */
export function generateKakaoPreview(title: string, message: string): string {
  return `${title}\n${message}`;
}

/**
 * Kakao 메시지 길이 체크
 * @param text - 메시지 텍스트
 * @returns 길이 정보
 */
export function getKakaoMessageLength(text: string): {
  length: number;
  isWarning: boolean;
  isError: boolean;
} {
  const length = text.length;
  const isWarning = length > MAX_KAKAO_MESSAGE_LENGTH * 0.9; // 90% 이상
  const isError = length > MAX_KAKAO_MESSAGE_LENGTH;

  return { length, isWarning, isError };
}

/**
 * Kakao 제목 길이 체크
 * @param text - 제목 텍스트
 * @returns 길이 정보
 */
export function getKakaoTitleLength(text: string): {
  length: number;
  isWarning: boolean;
  isError: boolean;
} {
  const length = text.length;
  const isWarning = length > MAX_KAKAO_TITLE_LENGTH * 0.8; // 80% 이상
  const isError = length > MAX_KAKAO_TITLE_LENGTH;

  return { length, isWarning, isError };
}

/**
 * 카카오톡 API 호출 (단건 발송)
 * @param receiver - 수신자 전화번호
 * @param title - 제목 (알림톡 헤더)
 * @param message - 메시지 본문
 * @param senderKey - Kakao 발신키
 * @returns API 응답
 */
export async function sendKakaoMessage(
  receiver: string,
  title: string,
  message: string,
  senderKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const aligoKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;

    if (!aligoKey || !aligoUserId) {
      logger.error('[kakao-service] 필수 환경변수 누락', {
        hasKey: !!aligoKey,
        hasUserId: !!aligoUserId,
      });
      return {
        success: false,
        error: 'Kakao 서비스 설정 오류',
      };
    }

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: aligoKey,
        user_id: aligoUserId,
        senderkey: senderKey,
        tpl_code: process.env.ALIGO_KAKAO_TPL_CODE || 'EXAM',
        receiver,
        subject: title,
        message,
        failover: 'true', // SMS 폴백 활성화
      }),
    });

    const data = await response.json();

    if (data.result_code === '1' || data.result_code === 1) {
      logger.log('[kakao-service] 발송 성공', {
        receiver,
        messageId: data.msg_id,
      });
      return {
        success: true,
        messageId: data.msg_id,
      };
    } else {
      logger.warn('[kakao-service] 발송 실패', {
        receiver,
        code: data.result_code,
        message: data.message,
      });
      return {
        success: false,
        error: `Kakao API 오류: ${data.message}`,
      };
    }
  } catch (err) {
    logger.error('[kakao-service] 발송 중 오류', { err });
    return {
      success: false,
      error: err instanceof Error ? err.message : '알 수 없는 오류',
    };
  }
}

/**
 * Day 0-3 PASONA 기반 Kakao 템플릿
 */
export const KAKAO_PASONA_TEMPLATES = {
  DAY0_PROBLEM_AGITATE: {
    title: 'Day 0 - 문제 각성',
    titleTemplate: '[이름]님께 특별한 소식',
    messageTemplate: '[이름]님,\n\n예약이 완료되었습니다!\n출발까지 [출발일]일 남았습니다.\n준비는 어떻게 하고 계신가요?',
  },
  DAY1_SOLUTION: {
    title: 'Day 1 - 솔루션 제시',
    titleTemplate: '[이름]님 준비물 안내',
    messageTemplate: '[이름]님께서 필요하신 준비물\n\n✓ 여권 (6개월 이상 유효)\n✓ 여행 보험 가입\n✓ 수하물 태그\n\n자세한 내용은 아래 링크를 확인하세요.',
  },
  DAY2_OFFER: {
    title: 'Day 2 - 가치 강조',
    titleTemplate: '[상품명] 여행 매력 5가지',
    messageTemplate: '[이름]님,\n\n[상품명]의 특별한 매력을 소개합니다!\n\n1️⃣ 세계 최고 수준의 크루즈\n2️⃣ 프리미엄 식사 서비스\n3️⃣ 다양한 엔터테인먼트\n4️⃣ 친절한 한국인 스태프\n5️⃣ 평생 추억\n\n더 알아보기:',
  },
  DAY3_URGENCY_ACTION: {
    title: 'Day 3 - 긴박감 + 행동',
    titleTemplate: '남은 시간 3일! 객실 업그레이드',
    messageTemplate: '[이름]님께 좋은 소식!\n\n더 좋은 객실로 업그레이드 가능합니다.\n단, 오늘까지만 특별 할인이 적용됩니다!\n\n지금 바로 확인하세요:',
  },
};

/**
 * Kakao 로그 포맷팅 (발송 이력 표시)
 */
export function formatKakaoLog(log: {
  sentAt: Date;
  title: string;
  content: string;
  sentCount: number;
  failedCount: number;
}): string {
  return `[${log.sentAt.toLocaleString('ko-KR')}] ${log.title} (성공: ${log.sentCount}명, 실패: ${log.failedCount}명)`;
}
