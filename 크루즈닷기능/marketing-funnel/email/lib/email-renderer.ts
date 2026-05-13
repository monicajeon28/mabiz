/**
 * O-1: 이메일 템플릿 렌더러
 * Handlebars를 사용한 템플릿 변수 렌더링
 */

import Handlebars from 'handlebars';
import { logger } from './logger';

/**
 * Handlebars 헬퍼 함수 등록
 * 날짜, 금액, 마스킹 등의 포매팅
 */
Handlebars.registerHelper('formatDate', (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

Handlebars.registerHelper('formatTime', (time: string | Date) => {
  const d = typeof time === 'string' ? new Date(time) : time;
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
});

Handlebars.registerHelper('formatCurrency', (amount: number | string) => {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  return new Intl.NumberFormat('ko-KR').format(num);
});

Handlebars.registerHelper('maskEmail', (email: string) => {
  const [name, domain] = email.split('@');
  return `${name.substring(0, 2)}***@${domain}`;
});

Handlebars.registerHelper('maskPhone', (phone: string) => {
  return phone.replace(/(\d{3})\d*(\d{4})/, '$1-***-$2');
});

Handlebars.registerHelper('maskAccount', (account: string) => {
  if (account.length <= 4) return '****';
  return '*'.repeat(account.length - 4) + account.slice(-4);
});

/**
 * 이메일 템플릿 렌더링
 * @param template EmailTemplate 객체
 * @param variables 변수 객체
 * @returns { subject, body } 렌더링된 내용
 */
export function renderTemplate(
  template: { subject: string; body: string },
  variables: Record<string, any>
): { subject: string; body: string } {
  try {
    const subjectTemplate = Handlebars.compile(template.subject);
    const bodyTemplate = Handlebars.compile(template.body);

    const subject = subjectTemplate(variables);
    const body = bodyTemplate(variables);

    return { subject, body };
  } catch (error) {
    logger.error('EmailRenderer: Template rendering failed', {
      error: error instanceof Error ? error.message : String(error),
      context: 'renderTemplate',
    });
    throw error;
  }
}

/**
 * 템플릿 문법 검증 (컴파일 시점에 오류 감지)
 */
export function validateTemplate(subject: string, body: string): string[] {
  const errors: string[] = [];

  try {
    Handlebars.compile(subject);
  } catch (error) {
    errors.push(`Subject syntax error: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    Handlebars.compile(body);
  } catch (error) {
    errors.push(`Body syntax error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * 변수 누락 검증
 * @param template 템플릿 객체
 * @param variables 사용자 제공 변수
 * @param requiredVariables 필수 변수 배열
 */
export function validateVariables(
  variables: Record<string, any>,
  requiredVariables: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredVariables.filter((v) => !(v in variables) || variables[v] === undefined);

  return {
    valid: missing.length === 0,
    missing,
  };
}
