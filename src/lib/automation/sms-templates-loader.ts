import fs from 'fs';
import path from 'path';

export interface SmsTemplate {
  id: string;
  segment: 'newlywed' | 'family' | 'couple';
  day: number;
  variant: 'default' | 'variantb';
  phase: string;
  content: string;
  psychology: string[];
  expectedClickRate: number;
  expectedConversionRate: number;
  cta: {
    text: string;
    url: string;
  };
  metadata: Record<string, any>;
}

let cachedTemplates: SmsTemplate[] | null = null;

/**
 * SMS 템플릿 JSON 파일 로드 (캐싱)
 */
export function loadSmsTemplates(): SmsTemplate[] {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const templatesPath = path.join(process.cwd(), 'docs', 'sms-templates.json');
  const fileContent = fs.readFileSync(templatesPath, 'utf-8');
  const data = JSON.parse(fileContent);
  cachedTemplates = (data.templates as SmsTemplate[]) || [];
  return cachedTemplates;
}

/**
 * 특정 템플릿 ID로 템플릿 조회
 */
export function getTemplate(templateId: string): SmsTemplate | undefined {
  const templates = loadSmsTemplates();
  return templates.find(t => t.id === templateId);
}

/**
 * 세그먼트 + Day + Variant로 템플릿 조회
 */
export function getTemplateBySegmentAndDay(
  segment: 'newlywed' | 'family' | 'couple',
  day: number,
  variant: 'default' | 'variantb'
): SmsTemplate | undefined {
  const templates = loadSmsTemplates();
  return templates.find(t => t.segment === segment && t.day === day && t.variant === variant);
}

/**
 * 메시지 콘텐츠 변수 치환 ({{firstName}} → John, {{ctaUrl}} → URL)
 */
export function interpolateTemplate(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}
