/**
 * SMS/LMS/MMS 메시지 타입 자동 분류 및 크기 검증
 *
 * 한국 이동통신사 표준:
 * - SMS: 0-90바이트 (EUC-KR 기준, 한글 1글자=2바이트)
 * - LMS: 91-2,000바이트 (제목+본문)
 * - MMS: 2,000바이트 초과 또는 이미지 포함
 *
 * 인코딩별 주의:
 * - EUC-KR: 한글 2바이트, 영문/숫자 1바이트, 이모지 미지원
 * - UTF-8: 한글 3바이트, 영문/숫자 1바이트, 이모지 3-4바이트
 *
 * @see https://aligo.in/api/send/
 * @see https://www.kisa.or.kr/public/laws/laws3.jsp
 */

import { logger } from '@/lib/logger';

export interface MessageSize {
  bytes: number;
  encoding: 'euc-kr' | 'utf-8';
  type: 'SMS' | 'LMS' | 'MMS';
  characterCount: number;
  hasUnsupportedCharacters: boolean;
  unsupportedCharacters?: string[];
}

export interface ValidationResult {
  valid: boolean;
  currentType: 'SMS' | 'LMS' | 'MMS';
  recommendedType: 'SMS' | 'LMS' | 'MMS';
  bytes: number;
  characterCount: number;
  encoding: 'euc-kr' | 'utf-8';
  issues: string[];
}

export type AligoMessageType = 'SMS' | 'LMS' | 'MMS';

function detectUnsupportedCharacters(message: string): string[] {
  const unsupported: string[] = [];
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu;

  const matches = [...message.matchAll(emojiRegex)];
  matches.forEach((match) => {
    if (!unsupported.includes(match[0])) {
      unsupported.push(match[0]);
    }
  });

  return unsupported;
}

export function calculateMessageBytes(
  message: string,
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr'
): number {
  if (!message || message.length === 0) {
    return 0;
  }

  if (encoding === 'utf-8') {
    const encoder = new TextEncoder();
    return encoder.encode(message).length;
  }

  let bytes = 0;

  for (let i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);

    if (code >= 0xac00 && code <= 0xd7a3) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 3;
      i++;
    } else {
      bytes += 1;
    }
  }

  return bytes;
}

export function detectMessageType(
  message: string,
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr',
  hasImage: boolean = false
): AligoMessageType {
  if (hasImage) {
    return 'MMS';
  }

  const bytes = calculateMessageBytes(message, encoding);

  if (bytes <= 90) {
    return 'SMS';
  } else if (bytes <= 2000) {
    return 'LMS';
  } else {
    return 'MMS';
  }
}

export function validateMessageSize(
  message: string,
  maxType: AligoMessageType = 'MMS',
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr'
): ValidationResult {
  const bytes = calculateMessageBytes(message, encoding);
  const characterCount = message.length;
  const unsupportedChars = detectUnsupportedCharacters(message);
  const currentType = detectMessageType(message, encoding);

  const typeLimits = {
    SMS: 90,
    LMS: 2000,
    MMS: Infinity,
  };

  const maxTypeLimit = typeLimits[maxType];

  const valid =
    bytes <= maxTypeLimit && unsupportedChars.length === 0;

  let recommendedType: AligoMessageType = currentType;
  if (
    encoding === 'euc-kr' &&
    unsupportedChars.length > 0
  ) {
    recommendedType = detectMessageType(message, 'utf-8');
  }

  const issues: string[] = [];
  if (unsupportedChars.length > 0) {
    issues.push(
      `EUC-KR 미지원 문자 ${unsupportedChars.length}개: ${unsupportedChars.slice(0, 3).join(', ')}${unsupportedChars.length > 3 ? '...' : ''}`
    );
  }

  if (bytes > maxTypeLimit) {
    issues.push(
      `${maxType} 초과: ${bytes}바이트 > ${maxTypeLimit}바이트 제한`
    );
  }

  return {
    valid,
    currentType,
    recommendedType,
    bytes,
    characterCount,
    encoding,
    issues,
  };
}

export function getMessageSize(message: string): MessageSize {
  const eucKrBytes = calculateMessageBytes(message, 'euc-kr');
  const utf8Bytes = calculateMessageBytes(message, 'utf-8');
  const unsupportedChars = detectUnsupportedCharacters(message);

  const hasUnsupported = unsupportedChars.length > 0;
  const encoding: 'euc-kr' | 'utf-8' = hasUnsupported ? 'utf-8' : 'euc-kr';
  const bytes = hasUnsupported ? utf8Bytes : eucKrBytes;

  return {
    bytes,
    encoding,
    type: detectMessageType(message, encoding),
    characterCount: message.length,
    hasUnsupportedCharacters: hasUnsupported,
    unsupportedCharacters: unsupportedChars,
  };
}

export function splitMessageIfNeeded(
  message: string,
  maxType: AligoMessageType = 'MMS',
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr'
): string[] {
  const result = validateMessageSize(message, maxType, encoding);

  if (result.valid) {
    return [message];
  }

  const typeLimits = {
    SMS: 90,
    LMS: 2000,
    MMS: Infinity,
  };

  const maxBytes = typeLimits[maxType];

  if (!isFinite(maxBytes)) {
    return [message];
  }

  const parts: string[] = [];
  let currentMessage = '';

  for (let i = 0; i < message.length; i++) {
    const char = message[i];
    const testMessage = currentMessage + char;
    const testBytes = calculateMessageBytes(testMessage, encoding);

    if (testBytes <= maxBytes) {
      currentMessage = testMessage;
    } else {
      if (currentMessage) {
        parts.push(currentMessage);
      }
      currentMessage = char;
    }
  }

  if (currentMessage) {
    parts.push(currentMessage);
  }

  if (parts.length > 1) {
    return parts.map(
      (part, idx) =>
        `[${idx + 1}/${parts.length}] ${part}`
    );
  }

  return parts;
}

export function formatMessageSizeLog(
  message: string,
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr'
): string {
  const bytes = calculateMessageBytes(message, encoding);
  const type = detectMessageType(message, encoding);
  const chars = message.length;

  return `${type} (${bytes}바이트, ${chars}글자) [${encoding}]`;
}

export function autoDetectAligoMessageFields(
  message: string,
  userProvidedTitle?: string,
  encoding: 'euc-kr' | 'utf-8' = 'euc-kr'
): {
  msg_type: 'SMS' | 'LMS';
  title?: string;
  message: string;
} {
  const type = detectMessageType(message, encoding);

  if (type === 'SMS') {
    return {
      msg_type: 'SMS',
      message,
    };
  } else {
    const title = userProvidedTitle
      ? userProvidedTitle.substring(0, 50)
      : message.substring(0, 30);

    return {
      msg_type: 'LMS',
      title,
      message,
    };
  }
}

export function logMessageSizeInfo(
  message: string,
  context: string = 'SMS 발송'
): void {
  const size = getMessageSize(message);
  logger.debug('[Message Size]', {
    context,
    ...size,
    log: formatMessageSizeLog(message, size.encoding),
  });
}
