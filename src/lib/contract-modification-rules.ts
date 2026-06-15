/**
 * Contract Modification Auto-Approval Rules Engine
 * 자동 승인 가능 여부를 판단하는 규칙 정의
 *
 * Template: T10 심리학 렌즈 통합 (L2 복잡도 평가)
 * Lens Detection: L0(부재중)→L1(재활성화)→L2(복잡도)→L6(손실회피)→L10(긴박감)
 */

import { prisma } from "./prisma";

export interface ModificationFieldConfig {
  label: string;
  category: "timeline" | "inventory" | "contact" | "preference" | "financial" | "operational";
  isAutoApprovable: boolean;
  validator: (newValue: string, contract: any) => Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  complexity?: number; // 0-100 L2 복잡도 점수
}

export const AUTO_APPROVABLE_FIELDS: Record<string, ModificationFieldConfig> = {
  tripDate: {
    label: "여행 날짜",
    category: "timeline",
    isAutoApprovable: true,
    validator: async (newValue: string, contract: any) => {
      try {
        const boundData = contract.boundData as any;
        const currentDate = new Date(boundData.tripDate || "");
        const newDate = new Date(newValue);

        // 유효한 날짜인지 확인
        if (isNaN(newDate.getTime())) {
          return { valid: false, reason: "유효하지 않은 날짜 형식", complexity: 30 };
        }

        const daysUntilTrip = Math.ceil(
          (currentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // 출발 7일 이내면 자동 불가 (L10 긴박감 + 제약)
        if (daysUntilTrip <= 7) {
          return {
            valid: false,
            reason: "출발 7일 이내는 수정 불가 (고객 확인 필요)",
            complexity: 85, // 높은 복잡도: 운영상 제약
          };
        }

        // 과거 날짜 불가
        if (newDate < new Date()) {
          return { valid: false, reason: "과거 날짜로 수정 불가", complexity: 50 };
        }

        // 날짜 유효성 (최대 365일 후)
        const daysFromNow = Math.ceil((newDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysFromNow > 365) {
          return {
            valid: false,
            reason: "1년 이상 후의 날짜로 수정 불가",
            complexity: 40,
          };
        }

        return { valid: true, complexity: 25 };
      } catch (error) {
        return { valid: false, reason: "날짜 검증 중 오류 발생", complexity: 100 };
      }
    },
  },

  roomType: {
    label: "객실 타입",
    category: "inventory",
    isAutoApprovable: true,
    validator: async (newValue: string, contract: any) => {
      try {
        const boundData = contract.boundData as any;
        const currentRoomType = boundData.roomType;

        // 같은 객실 타입으로 수정하는 경우
        if (currentRoomType === newValue) {
          return { valid: false, reason: "동일한 객실 타입으로 변경 불가", complexity: 10 };
        }

        // 템플릿에서 필드 매핑 조회
        const template = await prisma.contractTemplate.findUnique({
          where: { id: contract.templateId },
          select: {
            fieldMapping: true,
          },
        });

        if (!template) {
          return {
            valid: false,
            reason: "계약 템플릿을 찾을 수 없음",
            complexity: 100,
          };
        }

        // fieldMapping에서 객실별 가격 추출
        const fieldMapping = template.fieldMapping as any;
        const priceMap = fieldMapping?.roomPrices || {};

        const currentPrice = priceMap[currentRoomType] || 0;
        const newPrice = priceMap[newValue] || 0;

        // 같은 가격대 객실로만 변경 허용
        if (currentPrice !== newPrice) {
          const priceDiff = newPrice - currentPrice;
          return {
            valid: false,
            reason: `가격 차이 발생: ${currentPrice.toLocaleString()}원 → ${newPrice.toLocaleString()}원 (차액: ${priceDiff > 0 ? "+" : ""}${priceDiff.toLocaleString()}원)`,
            complexity: 75, // L6 손실회피: 금액 변동
          };
        }

        return { valid: true, complexity: 30 };
      } catch (error) {
        return {
          valid: false,
          reason: "객실 정보 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },

  contactInfo: {
    label: "연락처 정보",
    category: "contact",
    isAutoApprovable: true,
    validator: async (newValue: string) => {
      try {
        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^01[0-9]\d{7,8}$/; // 한국 휴대폰

        const isValidEmail = emailRegex.test(newValue);
        const isValidPhone = phoneRegex.test(newValue.replace(/[\s-]/g, ""));

        if (!isValidEmail && !isValidPhone) {
          return {
            valid: false,
            reason: "이메일 또는 휴대폰 형식 오류",
            complexity: 20,
          };
        }

        return { valid: true, complexity: 15 };
      } catch (error) {
        return {
          valid: false,
          reason: "연락처 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },

  specialRequest: {
    label: "특별 요청",
    category: "preference",
    isAutoApprovable: true,
    validator: async (newValue: string) => {
      try {
        // 길이 제한만 확인
        if (newValue.length > 500) {
          return {
            valid: false,
            reason: "특별 요청은 500자 이내만 가능",
            complexity: 20,
          };
        }

        // 비속어 간단 체크 (실제로는 더 복잡한 필터 필요)
        const isAppropriate = !newValue.includes("...");
        if (!isAppropriate) {
          return {
            valid: false,
            reason: "부적절한 내용이 포함되어 있습니다",
            complexity: 50,
          };
        }

        return { valid: true, complexity: 18 };
      } catch (error) {
        return {
          valid: false,
          reason: "특별 요청 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },

  dietaryRestriction: {
    label: "식이 제한",
    category: "preference",
    isAutoApprovable: true,
    validator: async (newValue: string) => {
      try {
        if (newValue.length > 200) {
          return {
            valid: false,
            reason: "식이 제한은 200자 이내만 가능",
            complexity: 15,
          };
        }

        // 알려진 식이 제한 목록과 매칭
        const knownRestrictions = ["vegetarian", "vegan", "gluten-free", "dairy-free", "halal", "kosher"];
        const isKnown =
          newValue.length === 0 || knownRestrictions.some((r) => newValue.toLowerCase().includes(r));

        if (!isKnown && newValue.length > 0) {
          // 커스텀 요청이면 복잡도 증가
          return { valid: true, complexity: 40 };
        }

        return { valid: true, complexity: 20 };
      } catch (error) {
        return {
          valid: false,
          reason: "식이 제한 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },

  price: {
    label: "가격",
    category: "financial",
    isAutoApprovable: false, // 금액은 항상 수동 검토 필요
    validator: async (newValue: string, contract: any) => {
      try {
        const boundData = contract.boundData as any;
        const currentPrice = parseInt(boundData.price) || 0;
        const newPrice = parseInt(newValue) || 0;

        if (isNaN(newPrice) || newPrice < 0) {
          return {
            valid: false,
            reason: "유효하지 않은 가격",
            complexity: 100,
          };
        }

        const variance = currentPrice > 0 ? Math.abs(newPrice - currentPrice) / currentPrice : 1;

        // 금액 변동 크기에 따른 복잡도 점수
        let complexity = 75; // 기본값: 높음 (금전 관련)
        let reason = `가격 변경: ${currentPrice.toLocaleString()}원 → ${newPrice.toLocaleString()}원 (변동율: ${(variance * 100).toFixed(1)}%)`;

        if (variance > 0.5) {
          complexity = 95; // 50% 이상: 매우 높은 복잡도
        } else if (variance > 0.2) {
          complexity = 85; // 20-50%: 높은 복잡도
        } else if (variance > 0.05) {
          complexity = 75; // 5-20%: 중간 복잡도
        } else {
          complexity = 65; // 5% 이하: 낮은 복잡도
        }

        return { valid: true, reason, complexity };
      } catch (error) {
        return {
          valid: false,
          reason: "가격 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },

  paymentTerms: {
    label: "결제 조건",
    category: "financial",
    isAutoApprovable: false,
    validator: async (newValue: string, contract: any) => {
      try {
        const validTerms = ["FULL_PAYMENT", "INSTALLMENT_2", "INSTALLMENT_3", "DEPOSIT_50"];
        const isValid = validTerms.includes(newValue);

        if (!isValid) {
          return {
            valid: false,
            reason: "지원하지 않는 결제 조건",
            complexity: 50,
          };
        }

        // 결제 조건 변경은 금전 관련 => 높은 복잡도
        return { valid: true, complexity: 80 };
      } catch (error) {
        return {
          valid: false,
          reason: "결제 조건 검증 중 오류 발생",
          complexity: 100,
        };
      }
    },
  },
};

/**
 * 자동 승인 가능 여부 평가
 * 심리학 렌즈: L2(복잡도)→L6(손실회피)→L10(긴박감)
 */
export async function evaluateAutoApproval(request: {
  id: string;
  contractId: string;
  fieldName: string;
  newValue: string;
  currentValue: string;
  requestedByUserId: string;
}): Promise<{
  isAutoApprovable: boolean;
  reason: string;
  complexity: number; // 0-100 (L2 복잡도 점수)
  dealRiskFlag: boolean;
  appliedLenses: string[];
  validationDetails: ValidationResult;
}> {
  // 1. 계약 조회
  const contract = await prisma.contractInstance.findUnique({
    where: { id: request.contractId },
    select: {
      id: true,
      templateId: true,
      boundData: true,
      status: true,
    },
  });

  if (!contract) {
    return {
      isAutoApprovable: false,
      reason: "계약을 찾을 수 없음",
      complexity: 100,
      dealRiskFlag: true,
      appliedLenses: ["L1_UNCLEAR"],
      validationDetails: {
        valid: false,
        reason: "계약 미존재",
        complexity: 100,
      },
    };
  }

  // 2. 필드 설정 조회
  const fieldConfig = AUTO_APPROVABLE_FIELDS[request.fieldName];

  if (!fieldConfig) {
    return {
      isAutoApprovable: false,
      reason: `지원하지 않는 필드: ${request.fieldName}`,
      complexity: 100,
      dealRiskFlag: true,
      appliedLenses: ["L1_UNCLEAR"],
      validationDetails: {
        valid: false,
        reason: "필드 미지원",
        complexity: 100,
      },
    };
  }

  // 3. 필드별 검증 실행
  const validationDetails = await fieldConfig.validator(request.newValue, contract);

  if (!validationDetails.valid) {
    return {
      isAutoApprovable: false,
      reason: validationDetails.reason || `${fieldConfig.label} 검증 실패`,
      complexity: validationDetails.complexity || 50,
      dealRiskFlag: validationDetails.complexity ? validationDetails.complexity > 70 : true,
      appliedLenses: ["L2_COMPLEXITY"],
      validationDetails,
    };
  }

  // 4. 자동 승인 가능 여부 결정
  if (!fieldConfig.isAutoApprovable) {
    return {
      isAutoApprovable: false,
      reason: `${fieldConfig.label} 필드는 수동 검토 필수`,
      complexity: validationDetails.complexity || 75,
      dealRiskFlag: true,
      appliedLenses: ["L6_LOSS_AVERSION"], // 금전 관련 = 손실회피
      validationDetails,
    };
  }

  // 5. 심리학 렌즈 적용 (L2 복잡도가 낮으면 자동 승인)
  const complexity = validationDetails.complexity || 30;
  const lenses: string[] = [];

  if (complexity > 70) {
    lenses.push("L2_HIGH_COMPLEXITY");
    lenses.push("L6_LOSS_AVERSION");
  } else if (complexity > 40) {
    lenses.push("L2_MEDIUM_COMPLEXITY");
  } else {
    lenses.push("L2_LOW_COMPLEXITY");
  }

  // 시간 제약이 있는 필드 (tripDate 등)
  if (request.fieldName === "tripDate") {
    lenses.push("L10_URGENCY");
  }

  return {
    isAutoApprovable: true,
    reason: `${fieldConfig.label} 자동 승인 가능 (복잡도: ${complexity})`,
    complexity,
    dealRiskFlag: false,
    appliedLenses: lenses,
    validationDetails,
  };
}

/**
 * 자동 승인율 계산 (KPI)
 */
export function calculateAutoApprovalStats(requests: any[]): {
  totalRequests: number;
  autoApproved: number;
  autoApprovalRate: number;
  pendingReview: number;
  rejectedCount: number;
  averageComplexity: number;
} {
  if (requests.length === 0) {
    return {
      totalRequests: 0,
      autoApproved: 0,
      autoApprovalRate: 0,
      pendingReview: 0,
      rejectedCount: 0,
      averageComplexity: 0,
    };
  }

  const autoApproved = requests.filter((r) => r.status === "AUTO_APPROVED").length;
  const pendingReview = requests.filter((r) => r.status === "PENDING").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;
  const totalComplexity = requests.reduce((sum, r) => sum + (r.complexity || 0), 0);

  return {
    totalRequests: requests.length,
    autoApproved,
    autoApprovalRate: (autoApproved / requests.length) * 100,
    pendingReview,
    rejectedCount,
    averageComplexity: totalComplexity / requests.length,
  };
}
