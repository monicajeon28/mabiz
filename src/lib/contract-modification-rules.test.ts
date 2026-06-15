/**
 * Contract Modification Auto-Approval Rules Engine - 통합 테스트
 *
 * 테스트 시나리오:
 * 1. 여행 날짜 수정 (tripDate) - 자동 승인 가능
 * 2. 객실 타입 변경 (roomType) - 가격 차이로 자동 거절
 * 3. 연락처 수정 (contactInfo) - 형식 검증
 * 4. 특별 요청 (specialRequest) - 길이 제한
 * 5. 가격 변경 (price) - 항상 수동 검토
 *
 * 실행: npx jest src/lib/contract-modification-rules.test.ts
 */

import {
  evaluateAutoApproval,
  AUTO_APPROVABLE_FIELDS,
  calculateAutoApprovalStats,
} from "./contract-modification-rules";

// Mock Prisma
jest.mock("./prisma", () => ({
  prisma: {
    contractTemplate: {
      findUnique: jest.fn(async ({ where }) => {
        // Mock 템플릿 반환
        if (where.id === "template-cruise-001") {
          return {
            id: "template-cruise-001",
            fieldMapping: {
              roomPrices: {
                OCEAN_VIEW: 2500000,
                INTERIOR: 2500000,
                BALCONY: 3500000,
              },
            },
          };
        }
        return null;
      }),
    },
    contractInstance: {
      findUnique: jest.fn(async ({ where }) => {
        // Mock 계약 반환
        if (where.id === "contract-001") {
          return {
            id: "contract-001",
            templateId: "template-cruise-001",
            boundData: {
              tripDate: "2026-07-15",
              roomType: "OCEAN_VIEW",
              contactInfo: "customer@example.com",
              specialRequest: "조용한 위치 선호",
              price: "2500000",
              paymentTerms: "FULL_PAYMENT",
            },
            status: "DRAFT",
          };
        }
        return null;
      }),
    },
  },
}));

describe("Contract Modification Auto-Approval Rules", () => {
  // Test 1: tripDate 수정 - 자동 승인 가능 (7일 이후)
  it("should AUTO_APPROVE tripDate modification 10+ days away", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    const result = await evaluateAutoApproval({
      id: "mod-001",
      contractId: "contract-001",
      fieldName: "tripDate",
      newValue: futureDate.toISOString().split("T")[0],
      currentValue: "2026-07-15",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(true);
    expect(result.complexity).toBeLessThan(40);
    expect(result.appliedLenses).toContain("L2_LOW_COMPLEXITY");
  });

  // Test 2: tripDate 수정 - 자동 거절 (7일 이내)
  it("should REJECT tripDate modification within 7 days", async () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 5);

    const result = await evaluateAutoApproval({
      id: "mod-002",
      contractId: "contract-001",
      fieldName: "tripDate",
      newValue: soonDate.toISOString().split("T")[0],
      currentValue: "2026-07-15",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.complexity).toBeGreaterThan(70);
    expect(result.reason).toContain("7일");
  });

  // Test 3: contactInfo 수정 - 유효한 이메일
  it("should AUTO_APPROVE valid email contactInfo", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-003",
      contractId: "contract-001",
      fieldName: "contactInfo",
      newValue: "newemail@example.com",
      currentValue: "customer@example.com",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(true);
    expect(result.complexity).toBeLessThan(30);
  });

  // Test 4: contactInfo 수정 - 유효하지 않은 형식
  it("should REJECT invalid email format", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-004",
      contractId: "contract-001",
      fieldName: "contactInfo",
      newValue: "not-an-email",
      currentValue: "customer@example.com",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.reason).toContain("형식 오류");
  });

  // Test 5: specialRequest 수정 - 길이 제한
  it("should AUTO_APPROVE specialRequest within length limit", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-005",
      contractId: "contract-001",
      fieldName: "specialRequest",
      newValue: "높은 층수의 객실을 원합니다",
      currentValue: "조용한 위치 선호",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(true);
    expect(result.complexity).toBeLessThan(30);
  });

  // Test 6: specialRequest 수정 - 길이 초과
  it("should REJECT specialRequest exceeding 500 chars", async () => {
    const longText = "a".repeat(501);
    const result = await evaluateAutoApproval({
      id: "mod-006",
      contractId: "contract-001",
      fieldName: "specialRequest",
      newValue: longText,
      currentValue: "조용한 위치 선호",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.reason).toContain("500자");
  });

  // Test 7: price 수정 - 항상 수동 검토 필요
  it("should REJECT price modification (always manual review)", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-007",
      contractId: "contract-001",
      fieldName: "price",
      newValue: "2750000",
      currentValue: "2500000",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.reason).toContain("수동 검토 필수");
    expect(result.appliedLenses).toContain("L6_LOSS_AVERSION");
  });

  // Test 8: 지원하지 않는 필드
  it("should REJECT unsupported field", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-008",
      contractId: "contract-001",
      fieldName: "unknownField",
      newValue: "some-value",
      currentValue: "old-value",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.reason).toContain("지원하지 않는");
    expect(result.dealRiskFlag).toBe(true);
  });

  // Test 9: calculateAutoApprovalStats - 통계 계산
  it("should calculate approval statistics correctly", () => {
    const requests = [
      { status: "AUTO_APPROVED", complexity: 25 },
      { status: "AUTO_APPROVED", complexity: 30 },
      { status: "PENDING", complexity: 70 },
      { status: "REJECTED", complexity: 100 },
    ];

    const stats = calculateAutoApprovalStats(requests);

    expect(stats.totalRequests).toBe(4);
    expect(stats.autoApproved).toBe(2);
    expect(stats.autoApprovalRate).toBe(50);
    expect(stats.pendingReview).toBe(1);
    expect(stats.rejectedCount).toBe(1);
    expect(stats.averageComplexity).toBe(56.25);
  });

  // Test 10: 비정상 입력 처리
  it("should handle missing contract gracefully", async () => {
    const result = await evaluateAutoApproval({
      id: "mod-010",
      contractId: "contract-nonexistent",
      fieldName: "tripDate",
      newValue: "2026-08-01",
      currentValue: "2026-07-15",
      requestedByUserId: "user-001",
    });

    expect(result.isAutoApprovable).toBe(false);
    expect(result.reason).toContain("찾을 수 없음");
    expect(result.dealRiskFlag).toBe(true);
  });
});

describe("Field Configuration Tests", () => {
  // Test 11: AUTO_APPROVABLE_FIELDS 정의 확인
  it("should have required fields defined", () => {
    const requiredFields = ["tripDate", "roomType", "contactInfo", "specialRequest", "price"];

    requiredFields.forEach((field) => {
      expect(AUTO_APPROVABLE_FIELDS[field]).toBeDefined();
      expect(AUTO_APPROVABLE_FIELDS[field].label).toBeDefined();
      expect(AUTO_APPROVABLE_FIELDS[field].category).toBeDefined();
      expect(AUTO_APPROVABLE_FIELDS[field].isAutoApprovable).toBeDefined();
      expect(AUTO_APPROVABLE_FIELDS[field].validator).toBeDefined();
    });
  });

  // Test 12: 필드별 자동 승인 설정 확인
  it("should have correct autoApprovable settings", () => {
    expect(AUTO_APPROVABLE_FIELDS.tripDate.isAutoApprovable).toBe(true);
    expect(AUTO_APPROVABLE_FIELDS.price.isAutoApprovable).toBe(false);
    expect(AUTO_APPROVABLE_FIELDS.paymentTerms.isAutoApprovable).toBe(false);
  });
});
