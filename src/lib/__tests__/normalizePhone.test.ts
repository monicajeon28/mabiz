import { normalizePhone } from '@/lib/import-utils';

describe('normalizePhone', () => {
  // 한국 휴대폰 (11자리)
  test('01012345678 → 010-1234-5678', () => {
    expect(normalizePhone('01012345678')).toBe('010-1234-5678');
  });

  // 하이픈 포함
  test('010-1234-5678 → 010-1234-5678', () => {
    expect(normalizePhone('010-1234-5678')).toBe('010-1234-5678');
  });

  // 국제번호 (+821012345670)
  test('+821012345670 → 010-1234-5670', () => {
    expect(normalizePhone('+821012345670')).toBe('010-1234-5670');
  });

  // 띄어쓰기
  test('010 1234 5678 → 010-1234-5678', () => {
    expect(normalizePhone('010 1234 5678')).toBe('010-1234-5678');
  });

  // 고정전화 (10자리)
  test('0212345678 → 02-1234-5678', () => {
    expect(normalizePhone('0212345678')).toBe('02-1234-5678');
  });

  // 고정전화 (11자리)
  test('02112345678 → 021-1234-5678', () => {
    expect(normalizePhone('02112345678')).toBe('021-1234-5678');
  });

  // 유효하지 않은 경우 - 빈 문자열
  test('빈 문자열 → null', () => {
    expect(normalizePhone('')).toBeNull();
  });

  // 유효하지 않은 경우 - 숫자 10자 미만
  test('0101234567 (10자리) → null', () => {
    expect(normalizePhone('0101234567')).toBeNull();
  });

  // 유효하지 않은 경우 - 숫자가 아닌 문자만
  test('abc → null', () => {
    expect(normalizePhone('abc')).toBeNull();
  });

  // 국제번호 고정전화
  test('+82212345678 → 02-1234-5678', () => {
    expect(normalizePhone('+82212345678')).toBe('02-1234-5678');
  });

  // 01로 시작하는 경우 (01X 형식)
  test('01156789012 → 010-1678-9012', () => {
    expect(normalizePhone('01156789012')).toBe('010-1678-9012');
  });

  // null 입력
  test('null → null', () => {
    expect(normalizePhone(null)).toBeNull();
  });

  // undefined 입력
  test('undefined → null', () => {
    expect(normalizePhone(undefined)).toBeNull();
  });

  // 숫자 타입 입력
  test('01012345678 (number) → 010-1234-5678', () => {
    expect(normalizePhone(1012345678 as unknown as string)).toBe('010-1234-5678');
  });
});
