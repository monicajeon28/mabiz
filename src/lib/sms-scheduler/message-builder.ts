/**
 * Menu #38 Phase 4 Step 5-3: SMS 메시지 생성 엔진
 * 렌즈별 템플릿 로드 → 변수 치환 → 검증 → 평문 변환
 */

import { LensType, ContactData, MessageBuildContext, MessageBuildResult, SmsFailureReason } from './types';
import { LENS_SEQUENCE_MAP, LENS_PLACEHOLDER_MESSAGE } from './sms-templates';
import { replaceTemplateVariables } from './variable-replacer';

const MAX_SMS_LENGTH = 2000; // 알리고 최대 길이
const EMOJI_REGEX = /[\p{Emoji}]/gu;

/**
 * 문자열에서 이모지 제거
 */
function removeEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, '').trim();
}

/**
 * 마크다운 기호를 평문 기호로 변환
 */
function markdownToPlaintext(text: string): string {
  return text
    .replace(/\*\*/g, '') // **bold** → bold
    .replace(/\*/g, '') // *italic* → italic
    .replace(/`/g, '') // `code` → code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [link](url) → link
    .replace(/#{1,6}\s/g, '') // # heading → heading
    .replace(/---/g, '━━━') // 구분선
    .replace(/___/g, '━━━')
    .trim();
}

/**
 * SMS 메시지 길이 제한 확인
 */
function validateMessageLength(message: string): { valid: boolean; warning?: string } {
  const length = message.length;

  if (length > MAX_SMS_LENGTH) {
    return {
      valid: false,
      warning: `메시지가 ${length}자(최대 ${MAX_SMS_LENGTH}자) 초과했습니다. 텍스트를 줄여주세요.`,
    };
  }

  // 경고: 2000자에 가까움
  if (length > 1800) {
    return {
      valid: true,
      warning: `메시지 길이가 ${length}자입니다. 분할 발송될 수 있습니다.`,
    };
  }

  return { valid: true };
}

/**
 * 전화번호 유효성 검증 (한국 휴대폰)
 */
function validatePhoneNumber(phone: string): boolean {
  // 010-XXXX-XXXX 또는 01012345678 형식
  const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
  const cleanedPhone = phone.replace(/-/g, '');
  return phoneRegex.test(cleanedPhone) && cleanedPhone.length === 11;
}

/**
 * 필수 변수 확인
 */
function validateRequiredVariables(
  template: string,
  contactData: ContactData
): { valid: boolean; missingVariables?: string[] } {
  const variablePattern = /\{([^}]+)\}/g;
  const requiredVars = new Set<string>();

  let match;
  while ((match = variablePattern.exec(template)) !== null) {
    requiredVars.add(match[1]);
  }

  const missingVars: string[] = [];

  for (const variable of requiredVars) {
    let hasValue = false;

    switch (variable) {
      case 'name':
        hasValue = !!contactData.name && contactData.name.trim().length > 0;
        break;
      case 'age':
        hasValue = contactData.age !== undefined && contactData.age > 0;
        break;
      case 'ship_name':
        hasValue = !!contactData.shipName && contactData.shipName.trim().length > 0;
        break;
      case 'remaining_cabins':
        hasValue = contactData.remainingCabins !== undefined && contactData.remainingCabins >= 0;
        break;
      default:
        // 다른 변수들은 선택적
        hasValue = true;
    }

    if (!hasValue) {
      missingVars.push(variable);
    }
  }

  if (missingVars.length > 0) {
    return { valid: false, missingVariables: missingVars };
  }

  return { valid: true };
}

/**
 * SMS 메시지 생성 메인 함수
 * @param context - 메시지 생성 컨텍스트 (렌즈, 일차, 고객 데이터)
 * @returns 생성 결과 (성공/실패 + 메시지 + 경고)
 */
export async function buildSmsMessage(context: MessageBuildContext): Promise<MessageBuildResult> {
  const { lensType, day, contactData } = context;

  // Step 1: 고객 정보 기본 검증
  if (!contactData.name || !contactData.phone) {
    return {
      success: false,
      messageLength: 0,
      error: SmsFailureReason.INVALID_PHONE,
      errorMessage: '고객 이름 또는 휴대폰 번호가 누락되었습니다.',
    };
  }

  // Step 2: 전화번호 검증
  if (!validatePhoneNumber(contactData.phone)) {
    return {
      success: false,
      messageLength: 0,
      error: SmsFailureReason.INVALID_PHONE,
      errorMessage: `유효하지 않은 휴대폰 번호입니다: ${contactData.phone}`,
    };
  }

  // Step 3: 렌즈 시퀀스 로드
  const lensSequence = LENS_SEQUENCE_MAP[lensType as string];
  if (!lensSequence) {
    // 템플릿이 정의되지 않은 렌즈는 플레이스홀더 사용
    const placeholderResult = await buildPlaceholderMessage(contactData);
    return placeholderResult;
  }

  // Step 4: Day별 템플릿 선택
  let dayKey: 'day_0' | 'day_1' | 'day_2' | 'day_3' | undefined;
  switch (day) {
    case 0:
      dayKey = 'day_0';
      break;
    case 1:
      dayKey = 'day_1';
      break;
    case 2:
      dayKey = 'day_2';
      break;
    case 3:
      dayKey = 'day_3';
      break;
    default:
      return {
        success: false,
        messageLength: 0,
        error: SmsFailureReason.TEMPLATE_NOT_FOUND,
        errorMessage: `유효하지 않은 Day 값: ${day}`,
      };
  }

  // 해당 Day 템플릿이 없으면 플레이스홀더 사용
  const dayTemplate = lensSequence.templates[dayKey];
  if (!dayTemplate) {
    return await buildPlaceholderMessage(contactData);
  }

  // Step 5: 필수 변수 검증
  const variableCheck = validateRequiredVariables(dayTemplate.template, contactData);
  if (!variableCheck.valid) {
    return {
      success: false,
      messageLength: 0,
      error: SmsFailureReason.INVALID_VARIABLES,
      errorMessage: `필수 변수 누락: ${variableCheck.missingVariables?.join(', ')}`,
    };
  }

  // Step 6: 변수 치환
  let message = dayTemplate.template;
  try {
    message = replaceTemplateVariables(message, contactData, context.templateVariables || {});
  } catch (error) {
    return {
      success: false,
      messageLength: 0,
      error: SmsFailureReason.INVALID_VARIABLES,
      errorMessage: `변수 치환 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  // Step 7: 마크다운 제거
  message = markdownToPlaintext(message);

  // Step 8: 이모지 제거 (경고)
  const emojiRemoved = EMOJI_REGEX.test(message);
  message = removeEmojis(message);

  // Step 9: 메시지 길이 검증
  const lengthCheck = validateMessageLength(message);
  if (!lengthCheck.valid) {
    return {
      success: false,
      messageLength: message.length,
      error: SmsFailureReason.MESSAGE_BUILD_FAILED,
      errorMessage: lengthCheck.warning,
    };
  }

  // Step 10: 성공 반환
  const warnings: string[] = [];
  if (emojiRemoved) {
    warnings.push('이모지가 제거되었습니다.');
  }
  if (lengthCheck.warning) {
    warnings.push(lengthCheck.warning);
  }

  return {
    success: true,
    messageContent: message,
    messageLength: message.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 플레이스홀더 메시지 생성 (템플릿 없는 렌즈용)
 */
async function buildPlaceholderMessage(contactData: ContactData): Promise<MessageBuildResult> {
  let message = LENS_PLACEHOLDER_MESSAGE;

  try {
    message = replaceTemplateVariables(message, contactData, {});
    message = markdownToPlaintext(message);
    message = removeEmojis(message);

    return {
      success: true,
      messageContent: message,
      messageLength: message.length,
      warnings: ['템플릿이 정의되지 않아 플레이스홀더 메시지를 사용했습니다.'],
    };
  } catch (error) {
    return {
      success: false,
      messageLength: 0,
      error: SmsFailureReason.MESSAGE_BUILD_FAILED,
      errorMessage: `플레이스홀더 메시지 생성 실패: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * 대량 메시지 생성 (배치 처리)
 */
export async function buildSmsMessageBatch(
  contexts: MessageBuildContext[]
): Promise<(MessageBuildResult & { contextIndex: number })[]> {
  const results = await Promise.all(
    contexts.map(async (context, index) => ({
      ...(await buildSmsMessage(context)),
      contextIndex: index,
    }))
  );

  return results;
}
