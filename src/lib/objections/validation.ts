import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';

export interface ObjectionData {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryName: string;
  priority: number;
  frequency: string;
  customerSayings: string[];
  psychologyLens: string[];
  immediateResponse: string;
  expectedConversionLift: string;
  relatedSegments: string[];
}

// 모든 유효한 이의 ID 목록 캐싱
const validObjectionIds = new Set(
  objectionsData.objections.map((o: any) => o.id)
);

export function isValidObjectionId(objectionId: string): boolean {
  return validObjectionIds.has(objectionId);
}

export function getObjectionData(objectionId: string): ObjectionData | null {
  const objection = objectionsData.objections.find((o: any) => o.id === objectionId);
  return objection || null;
}

export function getAllObjectionIds(): string[] {
  return Array.from(validObjectionIds).sort();
}

export function getObjectionsByCategory(categoryId: string): ObjectionData[] {
  return objectionsData.objections.filter((o: any) => o.categoryId === categoryId);
}

export function validateCustomerReaction(reaction: string): boolean {
  return ['positive', 'neutral', 'negative'].includes(reaction);
}

export interface CallLogObjectionInput {
  objectionId?: string;
  customerReaction?: string;
  recovered?: boolean;
  recoveryTime?: number;
}

export function validateObjectionInput(input: CallLogObjectionInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.objectionId && !isValidObjectionId(input.objectionId)) {
    errors.push(`Invalid objectionId: ${input.objectionId}`);
  }

  if (input.customerReaction && !validateCustomerReaction(input.customerReaction)) {
    errors.push(`Invalid customerReaction: ${input.customerReaction}. Must be 'positive', 'neutral', or 'negative'`);
  }

  if (input.recoveryTime !== undefined) {
    if (typeof input.recoveryTime !== 'number' || input.recoveryTime < 0) {
      errors.push(`Invalid recoveryTime: must be a non-negative number`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
