/**
 * Menu #38 Phase 3-β: contact-template-sender.ts 단위 테스트
 *
 * 테스트 범위:
 * - P0: 블로커 (타입, 로직, 에러 처리)
 * - P1: 성능·보안 (재시도, 중복 제거)
 * - P2: 통합 (전체 흐름 검증)
 *
 * 커버리지 목표: 95%+ 라인, 90%+ 브랜치
 */

import { sendToContactByTemplate } from "@/lib/services/contact-template-sender";
import db from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSms, sendFunnelEmail } from "@/lib/aligo";
import { getFeatureFlag } from "@/lib/config/feature-flags";

// Mock setup
jest.mock("@/lib/prisma");
jest.mock("@/lib/logger");
jest.mock("@/lib/aligo");
jest.mock("@/lib/config/feature-flags");

// Type guards for mocks
const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockSendSms = sendSms as jest.MockedFunction<typeof sendSms>;
const mockSendFunnelEmail = sendFunnelEmail as jest.MockedFunction<typeof sendFunnelEmail>;
const mockGetFeatureFlag = getFeatureFlag as jest.MockedFunction<typeof getFeatureFlag>;

describe("sendToContactByTemplate", () => {
  // ─────────────────────────────────────────────────────────────────
  // Setup & Teardown
  // ─────────────────────────────────────────────────────────────────

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockLogger.warn.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
    mockLogger.info.mockImplementation(() => {});

    // Default: Feature Flag OFF
    mockGetFeatureFlag.mockReturnValue(false);
  });

  // ═════════════════════════════════════════════════════════════════
  // P0: 블로커 테스트 (배포 가능 여부)
  // ═════════════════════════════════════════════════════════════════

  describe("P0: 블로커 검증", () => {
    describe("Contact 조회 및 유효성 검증", () => {
      test("Contact 없으면 SKIPPED 반환", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue(null);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "invalid_contact_id",
          channel: "SMS",
          messageBody: "test message",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("SKIPPED");
        expect(result.failureReason).toBe("INVALID_EMAIL");
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Contact 없음"),
          expect.any(Object)
        );
      });

      test("Contact 조회는 정확한 select 필드만 요청", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: null,
          email: null,
        });

        // Act
        await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "test",
          organizationId: "org_123",
        });

        // Assert: select 필드 검증
        expect(mockDb.contact.findUnique).toHaveBeenCalledWith({
          where: { id: "contact_123" },
          select: { id: true, phone: true, email: true },
        });
      });
    });

    describe("SendingHistory 기록 (필수)", () => {
      test("성공 시 SendingHistory 기록", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_12345",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);
        mockDb.sendingHistory.update.mockResolvedValue({} as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(mockDb.sendingHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              contactId: "contact_123",
              channel: "SMS",
              status: "SENT",
              organizationId: "org_123",
            }),
          })
        );
        expect(result.sendingHistoryId).toBe("sending_123");
      });

      test("실패 시에도 SendingHistory 기록", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: -99, // OPT_OUT
          msg_id: undefined,
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert: 실패해도 기록
        expect(mockDb.sendingHistory.create).toHaveBeenCalledTimes(1);
        expect(result.status).toBe("FAILED");
      });

      test("SendingHistory 기록 실패해도 결과는 반환", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockRejectedValue(
          new Error("DB Error")
        );

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert: 발송 결과는 반환되지만 sendingHistoryId는 undefined
        expect(result.status).toBe("SENT");
        expect(result.sendingHistoryId).toBeUndefined();
      });
    });

    describe("ExecutionLog 기록 (선택적, Feature Flag)", () => {
      test("Feature Flag OFF: ExecutionLog 미기록", async () => {
        // Arrange
        mockGetFeatureFlag.mockReturnValue(false);
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
          sourceId: "campaign_123",
          sourceName: "Test Campaign",
        });

        // Assert
        expect(mockDb.executionLog.create).not.toHaveBeenCalled();
        expect(result.executionLogId).toBeUndefined();
      });

      test("Feature Flag ON + sourceId/sourceName: ExecutionLog 기록", async () => {
        // Arrange
        mockGetFeatureFlag.mockReturnValue(true);
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);
        mockDb.executionLog.create.mockResolvedValue({
          id: "execution_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
          sourceId: "campaign_123",
          sourceName: "Test Campaign",
        });

        // Assert
        expect(mockDb.executionLog.create).toHaveBeenCalledTimes(1);
        expect(result.executionLogId).toBe("execution_123");
      });

      test("Feature Flag ON but 미충분한 파라미터: ExecutionLog 미기록", async () => {
        // Arrange
        mockGetFeatureFlag.mockReturnValue(true);
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act: sourceId/sourceName 없음
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(mockDb.executionLog.create).not.toHaveBeenCalled();
        expect(result.executionLogId).toBeUndefined();
      });

      test("useExecutionLog 파라미터로 Feature Flag 오버라이드", async () => {
        // Arrange
        mockGetFeatureFlag.mockReturnValue(false); // 기본값 OFF
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);
        mockDb.executionLog.create.mockResolvedValue({
          id: "execution_123",
        } as any);

        // Act: useExecutionLog=true로 오버라이드
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
          sourceId: "campaign_123",
          sourceName: "Test Campaign",
          useExecutionLog: true, // Override
        });

        // Assert: Feature Flag OFF인데도 ExecutionLog 기록
        expect(mockDb.executionLog.create).toHaveBeenCalledTimes(1);
        expect(result.executionLogId).toBe("execution_123");
      });
    });

    describe("에러 처리 (catch 블록)", () => {
      test("예외 발생 시 FAILED 반환", async () => {
        // Arrange
        mockDb.contact.findUnique.mockRejectedValue(
          new Error("Database connection failed")
        );

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("FAILED");
        expect(result.failureReason).toBe("SYSTEM_ERROR");
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("발송 중 예외"),
          expect.any(Object)
        );
      });

      test("예외 발생 시 컨텍스트 정보 로깅", async () => {
        // Arrange
        const testError = new Error("Test error");
        mockDb.contact.findUnique.mockRejectedValue(testError);

        // Act
        await sendToContactByTemplate({
          contactId: "contact_xyz",
          channel: "EMAIL",
          messageBody: "test",
          organizationId: "org_abc",
        });

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            contactId: "contact_xyz",
            channel: "EMAIL",
            err: testError,
          })
        );
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // P1: 성능·보안·안정성 테스트
  // ═════════════════════════════════════════════════════════════════

  describe("P1: 성능·보안 검증", () => {
    describe("Enum 매핑 정확성", () => {
      test("SMS 채널: 정상 발송", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 1,
          msg_id: "msg_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("SENT");
        expect(result.messageId).toBe("msg_123");
      });

      test("SMS 채널: OPT_OUT 에러 (-99)", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: -99,
          msg_id: undefined,
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("FAILED");
        expect(result.failureReason).toBe("OPT_OUT");
      });

      test("EMAIL 채널: 정상 발송", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendFunnelEmail.mockResolvedValue({
          result_code: 1,
          messageId: "email_123",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "EMAIL",
          messageBody: "Hello",
          messageSubject: "Test",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("SENT");
        expect(mockSendFunnelEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "test@example.com",
            subject: "Test",
          })
        );
      });
    });

    describe("재시도 가능 여부 판단", () => {
      test("영구 실패 (OPT_OUT): 재시도 불가", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: -99, // OPT_OUT
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);
        mockDb.sendingHistory.update.mockResolvedValue({} as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert: 재시도 스케줄링 호출 안 됨
        expect(mockDb.sendingHistory.update).not.toHaveBeenCalled();
      });

      test("일시적 오류 (PROVIDER_ERROR): 재시도 가능", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: "test@example.com",
        });
        mockSendSms.mockResolvedValue({
          result_code: 0, // PROVIDER_ERROR
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);
        mockDb.sendingHistory.update.mockResolvedValue({} as any);

        // Act
        await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert: 재시도 스케줄링 호출됨
        expect(mockDb.sendingHistory.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "sending_123" },
            data: expect.objectContaining({
              status: "RETRY_SCHEDULED",
            }),
          })
        );
      });
    });

    describe("채널별 유효성 검증", () => {
      test("SMS: 휴대폰 없으면 SKIPPED", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: null, // 휴대폰 없음
          email: "test@example.com",
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "SMS",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("SKIPPED");
        expect(result.failureReason).toBe("INVALID_PHONE");
      });

      test("EMAIL: 이메일 없으면 SKIPPED", async () => {
        // Arrange
        mockDb.contact.findUnique.mockResolvedValue({
          id: "contact_123",
          phone: "01012345678",
          email: null, // 이메일 없음
        });
        mockDb.sendingHistory.create.mockResolvedValue({
          id: "sending_123",
        } as any);

        // Act
        const result = await sendToContactByTemplate({
          contactId: "contact_123",
          channel: "EMAIL",
          messageBody: "Hello",
          organizationId: "org_123",
        });

        // Assert
        expect(result.status).toBe("SKIPPED");
        expect(result.failureReason).toBe("INVALID_EMAIL");
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // P2: 통합 테스트 (전체 흐름)
  // ═════════════════════════════════════════════════════════════════

  describe("P2: 통합 시나리오", () => {
    test("SMS 발송 전체 흐름 (성공)", async () => {
      // Arrange
      mockDb.contact.findUnique.mockResolvedValue({
        id: "contact_123",
        phone: "01012345678",
        email: "test@example.com",
      });
      mockSendSms.mockResolvedValue({
        result_code: 1,
        msg_id: "msg_12345",
      });
      mockDb.sendingHistory.create.mockResolvedValue({
        id: "sending_123",
      } as any);
      mockDb.sendingHistory.update.mockResolvedValue({} as any);

      // Act
      const result = await sendToContactByTemplate({
        contactId: "contact_123",
        channel: "SMS",
        messageBody: "Hello World",
        organizationId: "org_123",
        campaignId: "campaign_456",
      });

      // Assert
      expect(result.status).toBe("SENT");
      expect(result.contactId).toBe("contact_123");
      expect(result.sendingHistoryId).toBe("sending_123");
      expect(result.messageId).toBe("msg_12345");
    });

    test("EMAIL 발송 전체 흐름 (실패)", async () => {
      // Arrange
      mockDb.contact.findUnique.mockResolvedValue({
        id: "contact_123",
        phone: "01012345678",
        email: "test@example.com",
      });
      mockSendFunnelEmail.mockResolvedValue({
        result_code: -96, // INVALID_EMAIL
      });
      mockDb.sendingHistory.create.mockResolvedValue({
        id: "sending_123",
      } as any);

      // Act
      const result = await sendToContactByTemplate({
        contactId: "contact_123",
        channel: "EMAIL",
        messageBody: "Hello World",
        messageSubject: "Test",
        organizationId: "org_123",
      });

      // Assert
      expect(result.status).toBe("FAILED");
      expect(result.failureReason).toBe("INVALID_EMAIL");
      expect(mockDb.sendingHistory.create).toHaveBeenCalledTimes(1);
    });

    test("ExecutionLog + SendingHistory 병행 기록", async () => {
      // Arrange
      mockGetFeatureFlag.mockReturnValue(true);
      mockDb.contact.findUnique.mockResolvedValue({
        id: "contact_123",
        phone: "01012345678",
        email: "test@example.com",
      });
      mockSendSms.mockResolvedValue({
        result_code: 1,
        msg_id: "msg_123",
      });
      mockDb.sendingHistory.create.mockResolvedValue({
        id: "sending_123",
      } as any);
      mockDb.executionLog.create.mockResolvedValue({
        id: "exec_123",
      } as any);

      // Act
      const result = await sendToContactByTemplate({
        contactId: "contact_123",
        channel: "SMS",
        messageBody: "Hello",
        organizationId: "org_123",
        sourceId: "campaign_123",
        sourceName: "Test Campaign",
      });

      // Assert: 둘 다 기록
      expect(mockDb.sendingHistory.create).toHaveBeenCalledTimes(1);
      expect(mockDb.executionLog.create).toHaveBeenCalledTimes(1);
      expect(result.sendingHistoryId).toBe("sending_123");
      expect(result.executionLogId).toBe("exec_123");
    });
  });
});
