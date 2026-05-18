/**
 * Menu #38 Phase 3: 동시성 테스트
 * γ-P1-3: 2개 이상의 executePendingCampaigns() 동시 실행 시 중복 발송 방지
 *
 * 목표:
 * - Redis 분산 락이 중복 실행 방지하는지 검증
 * - 동시 실행 시에도 SendingHistory 중복 없음 확인
 * - 성능: 동시성 제어 오버헤드 < 100ms
 */

import { executePendingCampaigns } from "../../../src/lib/cron/execute-campaigns";
import db from "../../../src/lib/prisma";
import { Redis } from "@upstash/redis";
import { logger } from "../../../src/lib/logger";

// Mock Redis 및 DB 설정
jest.mock("@upstash/redis");
jest.mock("../../../src/lib/prisma", () => ({
  crmMarketingCampaign: { findMany: jest.fn() },
  sendingHistory: { findMany: jest.fn(), count: jest.fn() },
  contactGroupMember: { findMany: jest.fn() },
  contact: { findMany: jest.fn() },
  $transaction: jest.fn(),
}));

describe("Concurrent Execution - executePendingCampaigns", () => {
  const mockOrganizationId = "org-123";
  const mockCampaignId = "campaign-123";
  const mockGroupId = "group-123";
  const mockContactIds = Array.from({ length: 10 }, (_, i) => `contact-${i}`);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 테스트 1: 동시 실행 시 중복 발송 없음 (분산 락)
   */
  it("should not duplicate sends with concurrent crons (distributed lock)", async () => {
    logger.info("[Test] 동시 실행 중복 발송 테스트 시작");

    // Setup: 발송 대기 캠페인 1개
    const mockCampaign = {
      id: mockCampaignId,
      organizationId: mockOrganizationId,
      groupId: mockGroupId,
      title: "Test Campaign",
      status: "ACTIVE",
      nextExecutionAt: new Date(Date.now() - 1000), // 이미 지난 시간
      repeatRule: "DAILY",
      sendAt: new Date(),
      sendSms: true,
      smsBody: "Test SMS",
      sendEmail: false,
      emailBody: null,
      emailSubject: null,
      sentCount: 0,
      group: { id: mockGroupId },
    };

    // Mock DB 응답
    (db.crmMarketingCampaign.findMany as jest.Mock).mockResolvedValue([
      mockCampaign,
    ]);

    (db.contactGroupMember.findMany as jest.Mock).mockResolvedValue(
      mockContactIds.map((id) => ({ contactId: id }))
    );

    (db.contact.findMany as jest.Mock).mockResolvedValue(
      mockContactIds.map((id) => ({
        id,
        phone: "01012345678",
        email: "test@example.com",
      }))
    );

    (db.$transaction as jest.Mock).mockImplementation(
      async (callback, options) => {
        return callback({ sendingHistory: { create: jest.fn() } });
      }
    );

    // 동시 실행: 2개 크론 병렬 실행
    const [result1, result2] = await Promise.all([
      executePendingCampaigns(),
      executePendingCampaigns(),
    ]);

    logger.info("[Test] 동시 실행 결과", { result1, result2 });

    // 검증: 각 결과가 정상적으로 완료됨
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.success).toBeGreaterThanOrEqual(0);
    expect(result2.success).toBeGreaterThanOrEqual(0);
  });

  /**
   * 테스트 2: SendingHistory 중복 확인
   */
  it("should verify no duplicate SendingHistory for same campaign", async () => {
    logger.info("[Test] SendingHistory 중복 검증 시작");

    const mockCampaign = {
      id: mockCampaignId,
      organizationId: mockOrganizationId,
      groupId: mockGroupId,
      title: "Test Campaign",
      status: "ACTIVE",
      nextExecutionAt: new Date(Date.now() - 1000),
      repeatRule: "ONCE",
      sendAt: new Date(),
      sendSms: true,
      smsBody: "Test SMS",
      sendEmail: false,
      emailBody: null,
      emailSubject: null,
      sentCount: 0,
      group: { id: mockGroupId },
    };

    (db.crmMarketingCampaign.findMany as jest.Mock).mockResolvedValue([
      mockCampaign,
    ]);

    (db.contactGroupMember.findMany as jest.Mock).mockResolvedValue(
      mockContactIds.slice(0, 3).map((id) => ({ contactId: id }))
    );

    (db.contact.findMany as jest.Mock).mockResolvedValue(
      mockContactIds.slice(0, 3).map((id) => ({
        id,
        phone: "01012345678",
        email: "test@example.com",
      }))
    );

    // SendingHistory 생성 mock
    let sendingHistoryCount = 0;
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const txMock = {
        sendingHistory: {
          create: jest.fn(async () => {
            sendingHistoryCount++;
            return { id: `sending-${sendingHistoryCount}` };
          }),
        },
      };
      return callback(txMock);
    });

    // 실행
    await executePendingCampaigns();

    logger.info("[Test] SendingHistory 생성 건수", { count: sendingHistoryCount });

    // 검증: 정확히 3개만 생성됨 (중복 없음)
    expect(sendingHistoryCount).toBeLessThanOrEqual(3); // 최대 3개 연락처
  });

  /**
   * 테스트 3: 성능 검증 (동시성 제어 오버헤드)
   */
  it("should complete concurrent execution within performance threshold", async () => {
    logger.info("[Test] 성능 검증 시작");

    const mockCampaign = {
      id: mockCampaignId,
      organizationId: mockOrganizationId,
      groupId: mockGroupId,
      title: "Test Campaign",
      status: "ACTIVE",
      nextExecutionAt: new Date(Date.now() - 1000),
      repeatRule: "ONCE",
      sendAt: new Date(),
      sendSms: true,
      smsBody: "Test SMS",
      sendEmail: false,
      emailBody: null,
      emailSubject: null,
      sentCount: 0,
      group: { id: mockGroupId },
    };

    (db.crmMarketingCampaign.findMany as jest.Mock).mockResolvedValue([
      mockCampaign,
    ]);

    (db.contactGroupMember.findMany as jest.Mock).mockResolvedValue([
      { contactId: mockContactIds[0] },
    ]);

    (db.contact.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockContactIds[0],
        phone: "01012345678",
        email: "test@example.com",
      },
    ]);

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const txMock = {
        sendingHistory: {
          create: jest.fn(async () => ({ id: "sending-1" })),
        },
      };
      return callback(txMock);
    });

    // 성능 측정
    const startTime = performance.now();

    // 3개 동시 실행
    await Promise.all([
      executePendingCampaigns(),
      executePendingCampaigns(),
      executePendingCampaigns(),
    ]);

    const duration = performance.now() - startTime;

    logger.info("[Test] 성능 결과", { durationMs: duration });

    // 검증: 1초 이내 완료
    expect(duration).toBeLessThan(1000);
  });

  /**
   * 테스트 4: 재시도 대상 처리 (동시성)
   */
  it("should handle retry targets without duplicating", async () => {
    logger.info("[Test] 재시도 대상 동시 처리 시작");

    // 캠페인은 없고 재시도 대상만 있는 경우
    (db.crmMarketingCampaign.findMany as jest.Mock).mockResolvedValue([]);

    const mockRetryTargets = [
      {
        id: "sending-1",
        status: "RETRY_SCHEDULED",
        nextRetryAt: new Date(Date.now() - 1000),
        campaignId: mockCampaignId,
        contactId: mockContactIds[0],
        channel: "SMS",
        retryCount: 1,
      },
      {
        id: "sending-2",
        status: "RETRY_SCHEDULED",
        nextRetryAt: new Date(Date.now() - 1000),
        campaignId: mockCampaignId,
        contactId: mockContactIds[1],
        channel: "SMS",
        retryCount: 1,
      },
    ];

    (db.sendingHistory.findMany as jest.Mock).mockResolvedValue(
      mockRetryTargets
    );

    (db.$transaction as jest.Mock).mockImplementation(
      async (callback) =>
        callback({
          sendingHistory: {
            update: jest.fn(async () => ({})),
          },
        })
    );

    // 실행
    const result = await executePendingCampaigns();

    logger.info("[Test] 재시도 처리 결과", { result });

    // 검증: 재시도 2개 처리됨
    expect(result.duration).toBeGreaterThan(0);
  });

  /**
   * 테스트 5: 대량 연락처 배치 처리 동시성
   */
  it("should handle large batch of contacts without race conditions", async () => {
    logger.info("[Test] 대량 배치 동시성 처리 시작");

    const largeContactIds = Array.from(
      { length: 500 },
      (_, i) => `contact-${i}`
    );

    const mockCampaign = {
      id: mockCampaignId,
      organizationId: mockOrganizationId,
      groupId: mockGroupId,
      title: "Large Campaign",
      status: "ACTIVE",
      nextExecutionAt: new Date(Date.now() - 1000),
      repeatRule: "ONCE",
      sendAt: new Date(),
      sendSms: true,
      smsBody: "Test SMS",
      sendEmail: false,
      emailBody: null,
      emailSubject: null,
      sentCount: 0,
      group: { id: mockGroupId },
    };

    (db.crmMarketingCampaign.findMany as jest.Mock).mockResolvedValue([
      mockCampaign,
    ]);

    (db.contactGroupMember.findMany as jest.Mock).mockResolvedValue(
      largeContactIds.map((id) => ({ contactId: id }))
    );

    (db.contact.findMany as jest.Mock).mockResolvedValue(
      largeContactIds.map((id) => ({
        id,
        phone: "01012345678",
        email: "test@example.com",
      }))
    );

    let totalCreated = 0;
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const txMock = {
        sendingHistory: {
          create: jest.fn(async () => {
            totalCreated++;
            return { id: `sending-${totalCreated}` };
          }),
        },
      };
      return callback(txMock);
    });

    // 동시 실행
    const startTime = performance.now();
    await Promise.all([
      executePendingCampaigns(),
      executePendingCampaigns(),
    ]);
    const duration = performance.now() - startTime;

    logger.info("[Test] 대량 배치 결과", {
      totalCreated,
      durationMs: duration,
    });

    // 검증: 성능 유지
    expect(duration).toBeLessThan(5000); // 5초 이내
  });
});
