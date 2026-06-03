/**
 * ToolClickTracker API 테스트
 * @date 2026-06-03
 * Task 5: ToolClickTracker API 구현 검증
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST, GET } from "../route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import * as auth from "@/lib/rbac";

// 모의 객체
vi.mock("@/lib/rbac");
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

describe("ToolClickTracker API", () => {
  const mockAuthContext = {
    userId: "user-123",
    organizationId: "org-456",
    role: "AGENT",
  };

  beforeAll(() => {
    vi.mocked(auth.getAuthContext).mockResolvedValue(mockAuthContext);
  });

  describe("POST /api/tools/click-tracker", () => {
    it("should track a click event with minimal logging (no PII)", async () => {
      const body = {
        scriptId: "script-001",
        event: "click",
      };

      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 1n,
        organizationId: mockAuthContext.organizationId,
        userId: mockAuthContext.userId,
        action: "TOOL_CLICK",
        resourceType: "PlaybookScript",
        resourceId: "script-001",
        status: "SUCCESS",
        purpose: undefined,
        reasonDescription: "click",
        durationMs: undefined,
        piiFieldsAccessed: [],
        sessionId: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        piiValuesModified: null,
        errorMessage: null,
      } as any);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.trackId).toBeDefined();
    });

    it("should accept success event with situation and duration", async () => {
      const body = {
        scriptId: "script-002",
        event: "success",
        situation: "PRICE_OBJECTION",
        durationMs: 480000, // 8분
      };

      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 2n,
        organizationId: mockAuthContext.organizationId,
        userId: mockAuthContext.userId,
        action: "TOOL_CLICK",
        resourceType: "PlaybookScript",
        resourceId: "script-002",
        status: "SUCCESS",
        purpose: "PRICE_OBJECTION",
        reasonDescription: "success",
        durationMs: 480000,
        piiFieldsAccessed: [],
        sessionId: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        piiValuesModified: null,
        errorMessage: null,
      } as any);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reject if scriptId is missing", async () => {
      const body = { event: "click" };
      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("scriptId");
    });

    it("should reject invalid event type", async () => {
      const body = {
        scriptId: "script-003",
        event: "invalid",
      };
      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 401 if not authenticated", async () => {
      vi.mocked(auth.getAuthContext).mockRejectedValueOnce(
        new Error("UNAUTHORIZED")
      );

      const body = { scriptId: "script-004" };
      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("인증");

      // 복구
      vi.mocked(auth.getAuthContext).mockResolvedValue(mockAuthContext);
    });

    it("should return 403 if FREE_SALES role", async () => {
      vi.mocked(auth.getAuthContext).mockResolvedValueOnce({
        ...mockAuthContext,
        role: "FREE_SALES",
      });

      const body = { scriptId: "script-005" };
      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);

      // 복구
      vi.mocked(auth.getAuthContext).mockResolvedValue(mockAuthContext);
    });
  });

  describe("GET /api/tools/click-tracker/stats", () => {
    it("should return TOP scripts ranking", async () => {
      const req = new NextRequest(
        "http://localhost/api/tools/click-tracker/stats?days=7",
        { method: "GET" }
      );

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([
        { resourceId: "script-001", _count: { id: 10 } },
        { resourceId: "script-002", _count: { id: 8 } },
      ] as any);

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([
        { resourceId: "script-001", _count: { id: 8 } },
        { resourceId: "script-002", _count: { id: 4 } },
      ] as any);

      vi.mocked(prisma.salesPlaybook.findMany).mockResolvedValue([
        { id: "script-001", title: "가격이의 응대법", type: "CORE" },
        { id: "script-002", title: "건강이슈 대응", type: "CORE" },
      ] as any);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary.totalUsage).toBe(18);
      expect(data.summary.totalSuccess).toBe(12);
      expect(data.topScripts).toBeInstanceOf(Array);
    });

    it("should return stats for specific scriptId", async () => {
      const req = new NextRequest(
        "http://localhost/api/tools/click-tracker/stats?scriptId=script-001&days=7",
        { method: "GET" }
      );

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([
        { reasonDescription: "click", _count: { id: 10 } },
        { reasonDescription: "use", _count: { id: 5 } },
      ] as any);

      vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(8);

      vi.mocked(prisma.salesPlaybook.findUnique).mockResolvedValueOnce({
        id: "script-001",
        title: "가격이의 응대법",
        type: "CORE",
      } as any);

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([
        { resourceId: "script-001", _count: { id: 15 } },
      ] as any);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scriptId).toBe("script-001");
      expect(data.usageCount).toBeDefined();
      expect(data.successRate).toBeDefined();
      expect(data.ranking).toBeDefined();
    });

    it("should enforce AGENT permission (self only)", async () => {
      const req = new NextRequest(
        "http://localhost/api/tools/click-tracker/stats?days=7",
        { method: "GET" }
      );

      vi.mocked(prisma.auditLog.groupBy)
        .mockResolvedValueOnce([{ resourceId: "script-001", _count: { id: 10 } }] as any)
        .mockResolvedValueOnce([{ resourceId: "script-001", _count: { id: 8 } }] as any);

      vi.mocked(prisma.salesPlaybook.findMany).mockResolvedValue([
        { id: "script-001", title: "테스트", type: "CORE" },
      ] as any);

      const response = await GET(req);
      const data = await response.json();

      // AGENT 역할에서 본인 데이터만 조회 확인
      expect(data.scope).toBe("self");
    });

    it("should return 403 for FREE_SALES role", async () => {
      vi.mocked(auth.getAuthContext).mockResolvedValueOnce({
        ...mockAuthContext,
        role: "FREE_SALES",
      });

      const req = new NextRequest(
        "http://localhost/api/tools/click-tracker/stats?days=7",
        { method: "GET" }
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);

      // 복구
      vi.mocked(auth.getAuthContext).mockResolvedValue(mockAuthContext);
    });
  });

  describe("Security Requirements", () => {
    it("should never log PII (no contactId, phone, email, name)", async () => {
      const body = {
        scriptId: "script-006",
        event: "success",
      };

      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await POST(req);

      // 캡처된 호출 확인
      const createCall = vi.mocked(prisma.auditLog.create).mock.calls[0];
      const auditData = createCall[0].data;

      // PII 필드가 저장되지 않았는지 확인
      expect(auditData.piiFieldsAccessed).toEqual([]);
      expect(auditData.userId).toBeDefined(); // 하지만 userId는 OK (익명화 가능)
      expect(JSON.stringify(auditData)).not.toMatch(/contact|phone|email|name/i);
    });

    it("should track all required fields for audit", async () => {
      const body = {
        scriptId: "script-007",
        event: "success",
        situation: "HEALTH_CONCERN",
        durationMs: 300000,
      };

      const req = new NextRequest("http://localhost/api/tools/click-tracker", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await POST(req);

      const createCall = vi.mocked(prisma.auditLog.create).mock.calls[0];
      const auditData = createCall[0].data;

      expect(auditData).toMatchObject({
        action: "TOOL_CLICK",
        resourceType: "PlaybookScript",
        resourceId: "script-007",
        purpose: "HEALTH_CONCERN",
        reasonDescription: "success",
        durationMs: 300000,
        status: "SUCCESS",
      });
    });
  });

  describe("Stats Calculations", () => {
    it("should calculate success rate correctly", async () => {
      // 10 uses, 8 success → 80%
      const req = new NextRequest(
        "http://localhost/api/tools/click-tracker/stats?scriptId=script-calc",
        { method: "GET" }
      );

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([
        { reasonDescription: "click", _count: { id: 2 } },
        { reasonDescription: "use", _count: { id: 8 } },
      ] as any);

      vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(8);

      vi.mocked(prisma.salesPlaybook.findUnique).mockResolvedValueOnce({
        id: "script-calc",
        title: "계산 테스트",
        type: "CORE",
      } as any);

      vi.mocked(prisma.auditLog.groupBy).mockResolvedValueOnce([] as any);

      const response = await GET(req);
      const data = await response.json();

      // useCount = 2 + 8 = 10, success = 8 → 80%
      expect(data.successRate).toBe(80);
    });
  });
});
