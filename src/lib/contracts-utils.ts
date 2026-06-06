/**
 * 계약서 관리 유틸리티
 */

export interface ContractTemplateCreateData {
  name: string;
  category: string;
  description?: string;
  htmlContent?: string;
  visibility?: string;
  fieldMapping?: Record<string, unknown>;
  psychologyLenses?: string[];
  smsDay0TemplateId?: string;
  smsDay1TemplateId?: string;
  smsDay2TemplateId?: string;
  smsDay3TemplateId?: string;
  // 적용 대상
  applyToAllPartners?: boolean;
  applicablePartnerIds?: string[];
}

export interface ContractApplyData {
  templateId: string;
}

export interface ContractUpdateData {
  htmlContent?: string;
  jsonContent?: unknown;
  status?: string;
  fieldMapping?: Record<string, unknown>;
  sections?: Array<{
    title: string;
    content?: string;
    order?: number;
  }>;
}

/**
 * 적용 가능한 템플릿 필터링
 * @param templates 모든 템플릿 목록
 * @param partnerId 현재 대리점 ID
 * @returns 현재 대리점에 적용 가능한 템플릿 목록
 */
export function filterApplicableTemplates(
  templates: any[],
  partnerId: string
): any[] {
  return templates.filter((template) => {
    // 적용 대상이 정의되지 않은 경우 → 모든 대리점에 사용 가능
    if (!template.applicableEntities || template.applicableEntities.length === 0) {
      return true;
    }

    // 적용 대상이 정의된 경우 → 현재 대리점이 포함되어 있는지 확인
    return template.applicableEntities.some((entity: any) => {
      // 모든 대리점에 적용 (partnerId = null)
      if (entity.partnerId === null) {
        return true;
      }
      // 현재 대리점에만 적용
      return entity.partnerId === partnerId;
    });
  });
}

/**
 * 계약서 상태 배지 텍스트
 */
export function getContractStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "작성 중",
    active: "활성",
    archived: "보관됨",
  };
  return labels[status] || status;
}

/**
 * 계약서 상태 배지 색상
 */
export function getContractStatusColor(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    active: "default",
    archived: "outline",
  };
  return colors[status] || "default";
}

/**
 * 계약서 카테고리 라벨
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    CRUISE: "크루즈",
    RENTAL: "렌탈",
    HOTEL: "호텔",
    PACKAGE: "패키지",
    OTHER: "기타",
  };
  return labels[category] || category;
}
