/**
 * 이미지형 랜딩페이지 → htmlContent 자동 생성
 * 이미지 세로 스택 + 하단 신청 폼 (formConfig 기반 동적 필드)
 */

type LandingImage = {
  driveFileId: string;
  width?: number;
  height?: number;
  altText?: string;
};

type FieldConfig = { enabled: boolean; required: boolean };
type AdditionalField = { id: string; name: string; required: boolean };

export type FormConfig = {
  fields: {
    name?: FieldConfig;
    phone?: FieldConfig;
    email?: FieldConfig;
    gender?: FieldConfig;
    birthDate?: FieldConfig;
    address?: FieldConfig;
    marketingConsent?: FieldConfig;
  };
  additionalFields?: AdditionalField[];
};

const INPUT_STYLE = 'width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:12px;box-sizing:border-box;outline:none;';
const SELECT_STYLE = 'width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:12px;box-sizing:border-box;outline:none;background:#fff;';
const CHECKBOX_STYLE = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:14px;color:#555;';

function buildFormFields(formConfig?: FormConfig | null): string {
  const fields = formConfig?.fields;
  const additional = formConfig?.additionalFields ?? [];

  // 기본: 이름 + 연락처는 항상 포함 (formConfig 없으면 기본 폼)
  const lines: string[] = [];

  // 이름
  const nameField = fields?.name;
  if (!fields || nameField?.enabled !== false) {
    const req = nameField?.required !== false ? ' required' : '';
    lines.push(`<input type="text" name="name" placeholder="이름"${req} style="${INPUT_STYLE}" />`);
  }

  // 연락처
  const phoneField = fields?.phone;
  if (!fields || phoneField?.enabled !== false) {
    const req = phoneField?.required !== false ? ' required' : '';
    lines.push(`<input type="tel" name="phone" placeholder="연락처 (010-0000-0000)"${req} style="${INPUT_STYLE}" />`);
  }

  // 이메일
  if (fields?.email?.enabled) {
    const req = fields.email.required ? ' required' : '';
    lines.push(`<input type="email" name="email" placeholder="이메일"${req} style="${INPUT_STYLE}" />`);
  }

  // 성별
  if (fields?.gender?.enabled) {
    const req = fields.gender.required ? ' required' : '';
    lines.push(`<select name="gender"${req} style="${SELECT_STYLE}"><option value="">성별 선택</option><option value="male">남성</option><option value="female">여성</option></select>`);
  }

  // 생년월일
  if (fields?.birthDate?.enabled) {
    const req = fields.birthDate.required ? ' required' : '';
    lines.push(`<input type="date" name="birthDate" placeholder="생년월일"${req} style="${INPUT_STYLE}" />`);
  }

  // 주소
  if (fields?.address?.enabled) {
    const req = fields.address.required ? ' required' : '';
    lines.push(`<input type="text" name="address" placeholder="주소"${req} style="${INPUT_STYLE}" />`);
  }

  // 커스텀 질문
  for (const q of additional) {
    const req = q.required ? ' required' : '';
    lines.push(`<input type="text" name="custom_${q.id}" placeholder="${q.name}"${req} style="${INPUT_STYLE}" />`);
  }

  // 마케팅 동의
  if (fields?.marketingConsent?.enabled) {
    lines.push(`<label style="${CHECKBOX_STYLE}"><input type="checkbox" name="marketingConsent" value="yes" /> 마케팅 정보 수신에 동의합니다</label>`);
  }

  return lines.join('\n  ');
}

export function buildImageLandingHtml(
  images: LandingImage[],
  options?: {
    buttonTitle?: string;
    formConfig?: FormConfig | null;
  },
): string {
  const buttonText = options?.buttonTitle || '신청하기';
  const formFields = buildFormFields(options?.formConfig);

  const imageHtml = images
    .map((img) => {
      const src = `https://lh3.googleusercontent.com/d/${img.driveFileId}=w1200`;
      const alt = img.altText || '랜딩페이지 이미지';
      const aspectRatio = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : '';
      return `<img src="${src}" alt="${alt}" style="width:100%;display:block;${aspectRatio}" loading="lazy" />`;
    })
    .join('\n');

  return `<div style="margin:0;padding:0;line-height:0;background:#fff;">
${imageHtml}
</div>

<form style="max-width:480px;margin:0 auto;padding:32px 20px 48px;background:#fff;font-family:'Pretendard',sans-serif;">
  <h3 style="text-align:center;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">지금 바로 신청하세요</h3>
  <p style="text-align:center;font-size:14px;color:#888;margin:0 0 24px;">상담 신청 후 담당자가 연락드립니다</p>
  ${formFields}
  <button type="submit"
    style="width:100%;padding:16px;background:#FF6B35;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px;">
    ${buttonText}
  </button>
</form>`;
}
