/**
 * Contact 생성 후 세그먼트별 자동 SMS 발송 테스트
 * Track C (SMS 자동화) - Step 5
 */

import { POST } from "@/app/api/contacts/route";
import { detectSegment } from "@/lib/segment-detector";
import { sendSms } from "@/lib/aligo";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

// Mock 설정
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    contact: {
      create: jest.fn(),
    },
    smsTemplate: {
      findFirst: jest.fn(),
    },
    contactFunnelState: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    organization: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/segment-detector", () => ({
  detectSegment: jest.fn((customer) => {
    const age = customer.age ?? 45;
    if (age >= 25 && age <= 35) return "A";
    if (age >= 40 && age <= 50) return "B";
    if (age >= 45 && age <= 55) return "C";
    if (age >= 50 && age <= 65) return "D";
    return "E";
  }),
}));

jest.mock("@/lib/aligo", () => ({
  sendSms: jest.fn().mockResolvedValue({ result_code: 1, message: "Success" }),
  resolveUserSmsConfig: jest
    .fn()
    .mockResolvedValue({ key: "test_key", userId: "test_user", sender: "01012345678" }),
}));

jest.mock("@/lib/rbac", () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    userId: "user123",
    organizationId: "org123",
    role: "OWNER",
  }),
  buildContactWhere: jest.fn(),
  maskContactInfo: jest.fn(),
}));

jest.mock("@/lib/funnel-trigger", () => ({
  triggerGroupFunnel: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("[POST /api/contacts] 세그먼트별 자동 SMS 발송", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  const mockSendSms = sendSms as jest.MockedFunction<typeof sendSms>;
  const mockDetectSegment = detectSegment as jest.MockedFunction<typeof detectSegment>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Contact 생성 → SMS 즉시 발송
   * Segment A (30대 커플)인 경우, SMS 템플릿이 있으면 발송되어야 함
   */
  test("should send SMS immediately after contact creation for segment A", async () => {
    const mockContact = {
      id: "contact123",
      organizationId: "org123",
      name: "김철수",
      phone: "01012345678",
      email: "kim@example.com",
      segment: "A",
      age: 30,
      maritalStatus: "MARRIED",
      childrenCount: 0,
    };

    const mockTemplate = {
      id: "template123",
      organizationId: "org123",
      category: "AUTO_RECOMMEND",
      title: "세그먼트 A 추천",
      content: "[이름]님을 위한 프리미엄 크루즈 패키지 추천 ✨",
      segmentCode: "A",
      isSystem: true,
      triggerType: null,
      triggerOffset: null,
      usageCount: 0,
      psychologyTag: "Novelty + Romance",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(mockTemplate as any);
    mockDetectSegment.mockReturnValueOnce("A");

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "김철수",
        phone: "01012345678",
        email: "kim@example.com",
        age: 30,
        maritalStatus: "MARRIED",
        childrenCount: 0,
      }),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    // Contact 생성 확인
    expect(mockPrisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "김철수",
          phone: "01012345678",
          segment: "A",
        }),
      })
    );

    // 응답 확인
    expect(result.ok).toBe(true);
    expect(result.contact.id).toBe("contact123");

    // SMS 발송이 시도되었는지 확인 (약간의 지연이 있을 수 있음)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: "01012345678",
        organizationId: "org123",
        contactId: "contact123",
        channel: "GROUP",
      })
    );
  });

  /**
   * Test 2: segment=B (40대 가족) → B용 템플릿 선택
   */
  test("should select correct SMS template for segment B", async () => {
    const mockContact = {
      id: "contact456",
      organizationId: "org123",
      name: "이순신",
      phone: "01087654321",
      segment: "B",
      age: 45,
      maritalStatus: "MARRIED",
      childrenCount: 2,
    };

    const mockTemplateB = {
      id: "templateB",
      organizationId: "org123",
      category: "AUTO_RECOMMEND",
      title: "세그먼트 B 추천",
      content: "[이름]님 가족을 위한 맞춤 크루즈 여행 👨‍👩‍👧‍👦",
      segmentCode: "B",
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(mockTemplateB as any);
    mockDetectSegment.mockReturnValueOnce("B");

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "이순신",
        phone: "01087654321",
        age: 45,
        maritalStatus: "MARRIED",
        childrenCount: 2,
      }),
    });

    const response = await POST(mockRequest);
    await response.json();

    // 템플릿 조회 시 segmentCode: "B"로 조회되었는지 확인
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockPrisma.smsTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          segmentCode: "B",
        }),
      })
    );
  });

  /**
   * Test 3: 템플릿 없음 → SMS 발송 안 함 (에러 아님)
   */
  test("should skip SMS if template not found (no error)", async () => {
    const mockContact = {
      id: "contact789",
      organizationId: "org123",
      name: "박문수",
      phone: "01011112222",
      segment: "C",
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(null); // 템플릿 없음
    mockDetectSegment.mockReturnValueOnce("C");

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "박문수",
        phone: "01011112222",
        age: 50,
      }),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    // Contact 생성은 성공해야 함
    expect(result.ok).toBe(true);

    // SMS 발송은 시도되지 않아야 함
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSendSms).not.toHaveBeenCalled();

    // 로깅은 되어야 함
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("세그먼트 SMS 템플릿 없음"),
      expect.any(Object)
    );
  });

  /**
   * Test 4: sendSms 실패 → SmsLog에 기록되고, Contact는 정상 생성
   */
  test("should handle SMS send failure gracefully", async () => {
    const mockContact = {
      id: "contact999",
      organizationId: "org123",
      name: "홍길동",
      phone: "01000000000",
      segment: "D",
    };

    const mockTemplate = {
      id: "templateD",
      category: "AUTO_RECOMMEND",
      content: "[이름]님을 위한 경험 중심 크루즈 🎓",
      segmentCode: "D",
      isSystem: true,
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(mockTemplate as any);
    mockDetectSegment.mockReturnValueOnce("D");

    // SMS 발송 실패 시뮬레이션
    mockSendSms.mockResolvedValueOnce({ result_code: -1, message: "발송 오류" });

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "홍길동",
        phone: "01000000000",
        age: 60,
      }),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    // Contact 생성은 성공해야 함 (SMS 실패가 Contact 생성을 막지 않음)
    expect(result.ok).toBe(true);
    expect(result.contact.id).toBe("contact999");
  });

  /**
   * Test 5: 필드 치환 검증: [이름], [링크] 정상 치환
   */
  test("should replace template variables correctly", async () => {
    const mockContact = {
      id: "contactVar",
      organizationId: "org123",
      name: "김영희",
      phone: "01099999999",
      segment: "E",
    };

    const mockTemplate = {
      id: "templateE",
      category: "AUTO_RECOMMEND",
      content: "[이름]님을 위한 편안한 크루즈 여행 🏡\n가족과 함께하는 안전하고 간편한 크루즈!\n[링크]에서 자세히 보기",
      segmentCode: "E",
      isSystem: true,
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(mockTemplate as any);
    mockDetectSegment.mockReturnValueOnce("E");

    process.env.NEXT_PUBLIC_BASE_URL = "https://crm.mabiz.dev";

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "김영희",
        phone: "01099999999",
        age: 70,
      }),
    });

    const response = await POST(mockRequest);
    await response.json();

    // SMS 발송 시 변수 치환 확인
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining("김영희님을 위한"), // [이름] 치환
        msg: expect.stringContaining("https://crm.mabiz.dev"), // [링크] 치환
      })
    );
  });

  /**
   * Test 6: LMS vs SMS 타입 판정 (메시지 길이)
   */
  test("should determine LMS vs SMS based on message length", async () => {
    const mockContact = {
      id: "contactLMS",
      organizationId: "org123",
      name: "김철수",
      phone: "01012345678",
      segment: "A",
    };

    // 90자 이상 메시지 (LMS 필요)
    const longTemplate = {
      id: "templateLong",
      category: "AUTO_RECOMMEND",
      content:
        "[이름]님을 위한 프리미엄 크루즈 패키지를 추천드립니다. 신혼부부를 위한 특별한 경험을 준비했습니다. 낭만적인 크루즈 여행으로 추억을 만들어보세요! [링크]에서 자세히 보기",
      segmentCode: "A",
      isSystem: true,
    };

    mockPrisma.contact.create.mockResolvedValueOnce(mockContact as any);
    mockPrisma.smsTemplate.findFirst.mockResolvedValueOnce(longTemplate as any);
    mockDetectSegment.mockReturnValueOnce("A");

    const mockRequest = new Request("http://localhost:3000/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "김철수",
        phone: "01012345678",
        age: 30,
      }),
    });

    const response = await POST(mockRequest);
    await response.json();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // msgType이 LMS로 설정되었는지 확인
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        msgType: "LMS",
      })
    );
  });
});
