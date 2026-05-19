/**
 * Menu #38 Phase 4 Step 5-3: 템플릿 변수 치환 엔진
 * {name}, {ship_name}, {remaining_cabins} 등 고객 정보 변수 치환
 */

import { ContactData } from './types';

/**
 * 지원하는 모든 변수 목록
 */
const VARIABLE_DEFINITIONS: Record<
  string,
  {
    description: string;
    format?: (value: any) => string;
    defaultValue?: string;
  }
> = {
  // 고객 기본정보
  name: {
    description: '고객 이름',
    format: (value) => String(value || '고객').trim(),
  },
  age: {
    description: '고객 나이',
    format: (value) => (value ? `${value}세` : ''),
    defaultValue: '',
  },
  gender: {
    description: '고객 성별',
    format: (value) => {
      if (!value) return '';
      return value === 'M' ? '남성' : value === 'F' ? '여성' : String(value);
    },
    defaultValue: '',
  },
  profession: {
    description: '직업',
    format: (value) => String(value || '').trim(),
    defaultValue: '',
  },
  family_count: {
    description: '가족 수',
    format: (value) => (value ? `${value}명` : ''),
    defaultValue: '',
  },

  // 크루즈 정보
  ship_name: {
    description: '선박명',
    format: (value) => String(value || 'Dream Cruises').trim(),
    defaultValue: 'Dream Cruises',
  },
  date_start: {
    description: '출발일',
    format: (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value as string);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    },
    defaultValue: '',
  },
  date_end: {
    description: '귀국일',
    format: (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value as string);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    },
    defaultValue: '',
  },
  duration_days: {
    description: '여행 기간 (일수)',
    format: (value) => (value ? `${value}일` : ''),
    defaultValue: '',
  },
  port_list: {
    description: '포트 목록',
    format: (value) => String(value || '').trim(),
    defaultValue: '',
  },
  cabin_type: {
    description: '선실 타입',
    format: (value) => String(value || 'Standard').trim(),
    defaultValue: '',
  },

  // 마케팅 정보
  price_base: {
    description: '기본 가격 (원)',
    format: (value) => {
      if (!value) return '';
      const num = Number(value);
      return `${num.toLocaleString('ko-KR')}원`;
    },
    defaultValue: '',
  },
  price_discount: {
    description: '할인율 (%)',
    format: (value) => (value ? `${value}%` : ''),
    defaultValue: '',
  },
  price_discounted: {
    description: '할인된 가격 (원)',
    format: (value) => {
      if (!value) return '';
      const num = Number(value);
      return `${num.toLocaleString('ko-KR')}원`;
    },
    defaultValue: '',
  },
  membership_type: {
    description: '멤버십 타입',
    format: (value) => {
      if (!value) return '';
      const types: Record<string, string> = {
        A: '플랜 A (월 33,000)',
        B: '플랜 B (월 66,000)',
        C: '플랜 C (월 99,000)',
      };
      return types[value as string] || String(value);
    },
    defaultValue: '',
  },
  remaining_cabins: {
    description: '남은 선실 수',
    format: (value) => {
      if (value === undefined || value === null) return '';
      const num = Number(value);
      if (num <= 0) return '마지막 1석';
      if (num === 1) return '1석';
      return `${num}석`;
    },
    defaultValue: '',
  },

  // CRM 정보
  lens_type: {
    description: '렌즈 타입',
    format: (value) => String(value || '').trim(),
    defaultValue: '',
  },
};

/**
 * 템플릿 변수 패턴 매칭
 */
const VARIABLE_PATTERN = /\{([^}]+)\}/g;

/**
 * 변수를 고객 데이터에서 추출
 * {name} → contactData.name
 * {ship_name} → contactData.shipName
 */
function getVariableValue(variableName: string, contactData: ContactData): string {
  let value: any = undefined;

  // camelCase 변수명을 snake_case와 매핑
  switch (variableName) {
    case 'name':
      value = contactData.name;
      break;
    case 'age':
      value = contactData.age;
      break;
    case 'gender':
      value = contactData.gender;
      break;
    case 'profession':
      value = contactData.profession;
      break;
    case 'family_count':
      value = contactData.familyCount;
      break;
    case 'ship_name':
      value = contactData.shipName;
      break;
    case 'date_start':
      value = contactData.dateStart;
      break;
    case 'date_end':
      value = contactData.dateEnd;
      break;
    case 'duration_days':
      value = contactData.durationDays;
      break;
    case 'port_list':
      value = contactData.portList;
      break;
    case 'cabin_type':
      value = contactData.cabinType;
      break;
    case 'price_base':
      value = contactData.priceBase;
      break;
    case 'price_discount':
      value = contactData.priceDiscount;
      break;
    case 'membership_type':
      value = contactData.membershipType;
      break;
    case 'remaining_cabins':
      value = contactData.remainingCabins;
      break;
    case 'lens_type':
      value = contactData.lensType;
      break;
    default:
      return '';
  }

  const definition = VARIABLE_DEFINITIONS[variableName];
  if (!definition) {
    return '';
  }

  // 포매팅 함수 적용
  if (definition.format && value !== undefined && value !== null) {
    return definition.format(value);
  }

  // 기본값 또는 빈 문자열
  return definition.defaultValue || '';
}

/**
 * 메시지 템플릿에서 변수를 치환
 * @param template - {name}님, {ship_name}에 탑승해주세요 등의 템플릿
 * @param contactData - 고객 정보
 * @param customVariables - 추가 사용자 정의 변수
 * @returns 치환된 메시지
 */
export function replaceTemplateVariables(
  template: string,
  contactData: ContactData,
  customVariables: Record<string, string | number> = {}
): string {
  let result = template;

  // 템플릿에서 모든 변수 패턴 찾기
  const matches = Array.from(template.matchAll(VARIABLE_PATTERN));

  // 역순으로 치환 (인덱스 변화 방지)
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const variableName = match[1];
    const fullMatch = match[0]; // {variable_name}

    // 1. 사용자 정의 변수 확인
    let replacementValue: string;
    if (variableName in customVariables) {
      replacementValue = String(customVariables[variableName]);
    } else {
      // 2. 표준 변수 확인
      replacementValue = getVariableValue(variableName, contactData);
    }

    // 3. 치환
    result = result.substring(0, match.index) + replacementValue + result.substring(match.index! + fullMatch.length);
  }

  return result;
}

/**
 * 템플릿에서 필요한 모든 변수 추출
 * @param template - 메시지 템플릿
 * @returns 변수 배열
 */
export function extractVariablesFromTemplate(template: string): string[] {
  const variables = new Set<string>();
  let match;

  const pattern = new RegExp(VARIABLE_PATTERN);
  while ((match = pattern.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * 변수 검증: 템플릿에 필요한 모든 변수가 contactData에 있는지 확인
 * @param template - 메시지 템플릿
 * @param contactData - 고객 정보
 * @returns { valid: boolean, missingVariables?: string[] }
 */
export function validateTemplateVariables(
  template: string,
  contactData: ContactData
): { valid: boolean; missingVariables?: string[] } {
  const requiredVariables = extractVariablesFromTemplate(template);
  const missingVariables: string[] = [];

  for (const variable of requiredVariables) {
    const value = getVariableValue(variable, contactData);
    if (!value || value.trim().length === 0) {
      missingVariables.push(variable);
    }
  }

  if (missingVariables.length > 0) {
    return { valid: false, missingVariables };
  }

  return { valid: true };
}

/**
 * 변수 정의 조회
 */
export function getVariableDefinitions(): typeof VARIABLE_DEFINITIONS {
  return VARIABLE_DEFINITIONS;
}

/**
 * 변수 가이드 생성 (UI용)
 */
export function generateVariableGuide(): string {
  const groups: Record<string, string[]> = {
    '고객 기본정보': ['name', 'age', 'gender', 'profession', 'family_count'],
    '크루즈 정보': ['ship_name', 'date_start', 'date_end', 'duration_days', 'port_list', 'cabin_type'],
    '마케팅 정보': ['price_base', 'price_discount', 'price_discounted', 'membership_type', 'remaining_cabins'],
    'CRM 정보': ['lens_type'],
  };

  let guide = '# SMS 템플릿 변수 가이드\n\n';

  for (const [group, variables] of Object.entries(groups)) {
    guide += `## ${group}\n`;
    for (const variable of variables) {
      const def = VARIABLE_DEFINITIONS[variable];
      guide += `- \`{${variable}}\`: ${def.description}\n`;
    }
    guide += '\n';
  }

  return guide;
}
