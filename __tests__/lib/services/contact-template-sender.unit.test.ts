/**
 * Menu #38 Phase 3-β P2-5: DI 패턴 단위 테스트
 *
 * 테스트 목표:
 * - 의존성 주입으로 단위 테스트 가능성 검증
 * - Mock DB, SMS, Email 서비스 사용
 * - 재시도 로직, 에러 분류, Feature Flag 검증
 *
 * 주의: 이 파일은 향후 DI 패턴 도입 후 활성화 예정
 * (현재는 참고용 문서)
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

/**
 * Phase 3-β P2-5 DI 패턴 제안
 *
 * 현재 구조 (단위 테스트 불가):
 * ```typescript
 * export async function sendToContactByTemplate(
 *   params: SendToContactByTemplateParams
 * ): Promise<SendingResult> {
 *   const contact = await db.contact.findUnique(...);  // 직접 호출
 *   await sendSms(...);  // 직접 호출
 * }
 * ```
 *
 * 개선된 구조 (DI 패턴, 단위 테스트 가능):
 * ```typescript
 * interface ContactTemplateSenderDependencies {
 *   db: DatabaseClient;
 *   smsService: SMSService;
 *   emailService: EmailService;
 *   logger: Logger;
 * }
 *
 * export async function sendToContactByTemplate(
 *   params: SendToContactByTemplateParams,
 *   deps?: Partial<ContactTemplateSenderDependencies>
 * ): Promise<SendingResult> {
 *   const { db, smsService, emailService, logger } = {
 *     db: defaultDb,
 *     smsService: defaultSmsService,
 *     emailService: defaultEmailService,
 *     logger: defaultLogger,
 *     ...deps,
 *   };
 *
 *   const contact = await db.contact.findUnique(...);
 *   const result = await smsService.send(...);
 * }
 * ```
 */

// ─────────────────────────────────────────────────────────────────
// Mock 정의
// ─────────────────────────────────────────────────────────────────

interface MockDatabaseClient {
  contact: {
    findUnique: jest.Mock<any>;
  };
  sendingHistory: {
    create: jest.Mock<any>;
    update: jest.Mock<any>;
  };
  executionLog: {
    create: jest.Mock<any>;
  };
}

interface MockSMSService {
  send: jest.Mock<any>;
  resolveConfig: jest.Mock<any>;
}

interface MockEmailService {
  send: jest.Mock<any>;
}

interface MockLogger {
  info: jest.Mock<any>;
  warn: jest.Mock<any>;
  error: jest.Mock<any>;
  debug: jest.Mock<any>;
}

// ─────────────────────────────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────────────────────────────

describe("ContactTemplateSender (DI 패턴)", () => {
  let mockDb: MockDatabaseClient;
  let mockSmsService: MockSMSService;
  let mockEmailService: MockEmailService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    // Mock DB
    mockDb = {
      contact: {
        findUnique: jest.fn(),
      },
      sendingHistory: {
        create: jest.fn(),
        update: jest.fn(),
      },
      executionLog: {
        create: jest.fn(),
      },
    };

    // Mock SMS Service
    mockSmsService = {
      send: jest.fn(),
      resolveConfig: jest.fn(),
    };

    // Mock Email Service
    mockEmailService = {
      send: jest.fn(),
    };

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 1: SMS 발송 성공
  // ─────────────────────────────────────────────────────────────────

  it("should send SMS successfully", async () => {
    // Arrange
    const contactId = "c123";
    const phone = "01012345678";
    const messageBody = "환영합니다!";
    const organizationId = "org456";

    mockDb.contact.findUnique.mockResolvedValue({
      id: contactId,
      phone,
      email: null,
    });

    mockSmsService.resolveConfig.mockResolvedValue({
      apiKey: "test-key",
      senderId: "MABIZ",
    });

    mockSmsService.send.mockResolvedValue({
      result_code: 1,
      msg_id: "msg_789",
    });

    mockDb.sendingHistory.create.mockResolvedValue({
      id: "sh_001",
      contactId,
      status: "SENT",
    });

    // Act
    // 주의: 현재 contact-template-sender.ts는 DI 지원하지 않음
    // 아래는 DI 패턴 도입 후 테스트 코드
    /*
    const result = await sendToContactByTemplate(
      {
        contactId,
        channel: "SMS",
        messageBody,
        organizationId,
        campaignId: "camp789",
      },
      { db: mockDb as any, smsService: mockSmsService as any, logger: mockLogger as any }
    );

    // Assert
    expect(result.status).toBe("SENT");
    expect(result.sendingHistoryId).toBe("sh_001");
    expect(mockDb.contact.findUnique).toHaveBeenCalledWith({
      where: { id: contactId },
      select: { id: true, phone: true, email: true },
    });
    expect(mockSmsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: phone,
        msg: messageBody,
      })
    );
    expect(mockDb.sendingHistory.create).toHaveBeenCalled();
    */
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 2: Contact 없음 처리
  // ─────────────────────────────────────────────────────────────────

  it("should handle missing contact gracefully", async () => {
    // Arrange
    const contactId = "c999";
    mockDb.contact.findUnique.mockResolvedValue(null);

    // Act
    // const result = await sendToContactByTemplate(
    //   { contactId, channel: "SMS", messageBody: "test", organizationId: "org1" },
    //   { db: mockDb as any, logger: mockLogger as any }
    // );

    // Assert
    // expect(result.status).toBe("SKIPPED");
    // expect(result.failureReason).toBe("INVALID_PHONE");
    // expect(mockDb.sendingHistory.create).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 3: 에러 분류 (네트워크 오류)
  // ─────────────────────────────────────────────────────────────────

  it("should classify network errors as retryable", async () => {
    // Arrange
    const contactId = "c123";
    mockDb.contact.findUnique.mockResolvedValue({
      id: contactId,
      phone: "01012345678",
      email: null,
    });

    mockSmsService.resolveConfig.mockResolvedValue({
      apiKey: "test-key",
    });

    // ECONNREFUSED: 네트워크 오류 (재시도 가능)
    mockSmsService.send.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:3000")
    );

    mockDb.sendingHistory.create.mockResolvedValue({
      id: "sh_001",
      status: "FAILED",
    });

    // Act
    // const result = await sendToContactByTemplate(
    //   { contactId, channel: "SMS", messageBody: "test", organizationId: "org1" },
    //   { db: mockDb as any, smsService: mockSmsService as any, logger: mockLogger as any }
    // );

    // Assert
    // expect(result.status).toBe("FAILED");
    // 재시도 가능한 에러는 RETRY_SCHEDULED 상태로 변경되어야 함
    // expect(mockDb.sendingHistory.update).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     data: expect.objectContaining({
    //       status: "RETRY_SCHEDULED",
    //     }),
    //   })
    // );
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 4: 에러 분류 (타입 오류)
  // ─────────────────────────────────────────────────────────────────

  it("should classify type errors as non-retryable", async () => {
    // Arrange
    const contactId = "c123";
    mockDb.contact.findUnique.mockResolvedValue({
      id: contactId,
      phone: "01012345678",
      email: null,
    });

    mockSmsService.resolveConfig.mockResolvedValue({
      apiKey: "test-key",
    });

    // TypeError: 코드 버그 (재시도 불가)
    mockSmsService.send.mockRejectedValue(
      new TypeError("Cannot read property 'phoneNumber' of undefined")
    );

    mockDb.sendingHistory.create.mockResolvedValue({
      id: "sh_001",
      status: "FAILED",
    });

    // Act
    // const result = await sendToContactByTemplate(
    //   { contactId, channel: "SMS", messageBody: "test", organizationId: "org1" },
    //   { db: mockDb as any, smsService: mockSmsService as any, logger: mockLogger as any }
    // );

    // Assert
    // expect(result.status).toBe("FAILED");
    // TypeError는 자동 재시도 스케줄링 안 함
    // expect(mockDb.sendingHistory.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 5: Feature Flag 오버라이드
  // ─────────────────────────────────────────────────────────────────

  it("should respect Feature Flag override", async () => {
    // Arrange
    const contactId = "c123";
    mockDb.contact.findUnique.mockResolvedValue({
      id: contactId,
      phone: "01012345678",
      email: null,
    });

    mockSmsService.resolveConfig.mockResolvedValue({
      apiKey: "test-key",
    });

    mockSmsService.send.mockResolvedValue({
      result_code: 1,
      msg_id: "msg_789",
    });

    mockDb.sendingHistory.create.mockResolvedValue({
      id: "sh_001",
      status: "SENT",
    });

    mockDb.executionLog.create.mockResolvedValue({
      id: "el_001",
      status: "SENT",
    });

    // Act
    // Feature Flag을 명시적으로 오버라이드
    // const result = await sendToContactByTemplate(
    //   {
    //     contactId,
    //     channel: "SMS",
    //     messageBody: "test",
    //     organizationId: "org1",
    //     sourceId: "camp789",
    //     sourceName: "Test Campaign",
    //     useExecutionLog: true,
    //   },
    //   { db: mockDb as any, smsService: mockSmsService as any, logger: mockLogger as any }
    // );

    // Assert
    // expect(result.executionLogId).toBe("el_001");
    // expect(mockDb.executionLog.create).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 6: 재시도 로직 (Jitter 포함)
  // ─────────────────────────────────────────────────────────────────

  it("should schedule retry with jitter", async () => {
    // 재시도 스케줄링이 올바른 지수 백오프 + Jitter를 적용하는지 검증
    // 1차: 1시간 (±10%)
    // 2차: 6시간 (±10%)
    // 3차: 24시간 (±10%)

    // Arrange
    const sendingHistoryId = "sh_001";

    // Act & Assert는 실제 scheduleRetry 함수 테스트로 별도 진행
  });

  // ─────────────────────────────────────────────────────────────────
  // 테스트 7: SendingHistory vs ExecutionLog 분기
  // ─────────────────────────────────────────────────────────────────

  it("should always record SendingHistory regardless of Feature Flag", async () => {
    // Arrange
    const contactId = "c123";
    mockDb.contact.findUnique.mockResolvedValue({
      id: contactId,
      phone: "01012345678",
      email: null,
    });

    mockSmsService.resolveConfig.mockResolvedValue({
      apiKey: "test-key",
    });

    mockSmsService.send.mockResolvedValue({
      result_code: 1,
      msg_id: "msg_789",
    });

    mockDb.sendingHistory.create.mockResolvedValue({
      id: "sh_001",
      status: "SENT",
    });

    // Feature Flag OFF
    // const result = await sendToContactByTemplate(
    //   {
    //     contactId,
    //     channel: "SMS",
    //     messageBody: "test",
    //     organizationId: "org1",
    //     useExecutionLog: false,
    //   },
    //   { db: mockDb as any, smsService: mockSmsService as any, logger: mockLogger as any }
    // );

    // Assert
    // SendingHistory는 항상 기록
    // expect(mockDb.sendingHistory.create).toHaveBeenCalled();
    // ExecutionLog는 기록 안 함
    // expect(mockDb.executionLog.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// 테스트 유틸리티: DI 팩토리
// ─────────────────────────────────────────────────────────────────

/**
 * 테스트용 Mock 의존성 생성 팩토리
 *
 * Phase 3-β P2-5 DI 패턴 도입 시 활용
 */
export function createMockDependencies() {
  return {
    db: {
      contact: { findUnique: jest.fn() },
      sendingHistory: { create: jest.fn(), update: jest.fn() },
      executionLog: { create: jest.fn() },
    },
    smsService: {
      send: jest.fn(),
      resolveConfig: jest.fn(),
    },
    emailService: {
      send: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
}

/**
 * DI 패턴 도입 후 권장 함수 시그니처
 *
 * @example
 * export async function sendToContactByTemplate(
 *   params: SendToContactByTemplateParams,
 *   deps?: Partial<ContactTemplateSenderDependencies>
 * ): Promise<SendingResult>
 *
 * // 사용 예
 * // 프로덕션: 의존성 생략 (기본값 사용)
 * await sendToContactByTemplate({ contactId: "c1", channel: "SMS", ... });
 *
 * // 테스트: Mock 의존성 주입
 * const mockDeps = createMockDependencies();
 * await sendToContactByTemplate(
 *   { contactId: "c1", channel: "SMS", ... },
 *   mockDeps
 * );
 */
