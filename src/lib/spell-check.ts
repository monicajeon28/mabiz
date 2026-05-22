/**
 * 한글 오타 감지 유틸
 * 간단한 자주하는 오타 목록 기반 감지
 */

interface Typo {
  wrong: string;
  right: string;
}

const COMMON_TYPOS: Typo[] = [
  { wrong: '발싱', right: '발송' },
  { wrong: '문중', right: '문자' },
  { wrong: '고객쓰', right: '고객에게' },
  { wrong: '에약', right: '예약' },
  { wrong: '확인해주세', right: '확인해주세요' },
];

/**
 * 메시지에서 자주하는 오타를 감지합니다
 * @param text 검사할 메시지 텍스트
 * @returns 감지된 오타 배열 (예: ['"발싱" (혹은 "발송"?)', ...])
 */
export function detectTypos(text: string): string[] {
  const found: string[] = [];

  for (const { wrong, right } of COMMON_TYPOS) {
    if (text.includes(wrong)) {
      found.push(`"${wrong}" → "${right}"`);
    }
  }

  return found;
}
