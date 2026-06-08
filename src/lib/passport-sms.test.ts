/**
 * Unit Tests for passport-sms.ts
 *
 * Note: 이 파일은 예제/테스트용 입니다.
 * 실제 테스트 실행 시 jest/vitest 설정이 필요합니다.
 */

import {
  renderSmsMessage,
  validateMessageLength,
  PASSPORT_SMS_TEMPLATES,
} from "@/lib/passport-sms";

// ─── Test 1: SMS 템플릿 렌더링 ────────────────────────────────

describe("renderSmsMessage", () => {
  it("should render basic template correctly", () => {
    const message = renderSmsMessage("basic", {
      customerName: "김철수",
      tripName: "노르웨이 크루즈",
      linkUrl: "https://passport.mabiz.co.kr/abc123",
    });

    expect(message).toContain("김철수");
    expect(message).toContain("노르웨이 크루즈");
    expect(message).toContain("passport.mabiz.co.kr");
    expect(message.length).toBeLessThanOrEqual(160); // SMS 2건 이내
  });

  it("should render reminder template with days left", () => {
    const message = renderSmsMessage("reminder", {
      customerName: "박영희",
      daysLeft: 7,
      linkUrl: "https://passport.mabiz.co.kr/xyz789",
    });

    expect(message).toContain("박영희");
    expect(message).toContain("7");
    expect(message).toContain("남았습니다");
  });

  it("should render urgent template", () => {
    const message = renderSmsMessage("urgent", {
      customerName: "이순신",
      tripName: "캐리비안 크루즈",
      daysLeft: 3,
      linkUrl: "https://passport.mabiz.co.kr/def456",
    });

    expect(message).toContain("⚠️");
    expect(message).toContain("긴급");
    expect(message).toContain("이순신");
    expect(message).toContain("캐리비안");
    expect(message).toContain("3");
  });

  it("should handle missing optional parameters", () => {
    const message = renderSmsMessage("basic", {
      customerName: "고객님",
      linkUrl: "https://passport.mabiz.co.kr",
    });

    expect(message).toContain("고객님");
    expect(message).toContain("여행"); // 기본값
  });
});

// ─── Test 2: 메시지 길이 검증 ────────────────────────────────

describe("validateMessageLength", () => {
  it("should classify short message as SMS", () => {
    const shortMsg = "안녕하세요";
    const result = validateMessageLength(shortMsg);

    expect(result.isValid).toBe(true);
    expect(result.messageType).toBe("SMS");
    expect(result.length).toBe(5);
  });

  it("should classify message over 90 chars as LMS", () => {
    const longMsg = "안녕하세요 고객님입니다 여기는 매우 긴 메시지입니다 여기는 매우 긴 메시지입니다 여기는 매우 긴 메시지입니다 여기는 매우 긴 메시지입니다";
    const result = validateMessageLength(longMsg);

    expect(result.isValid).toBe(true);
    expect(result.messageType).toBe("LMS");
    expect(result.length).toBeGreaterThan(90);
  });

  it("should reject message over 1000 chars", () => {
    const veryLongMsg = "A".repeat(1001);
    const result = validateMessageLength(veryLongMsg);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("너무 깁니다");
    expect(result.length).toBe(1001);
  });
});

// ─── Test 3: 템플릿 정의 검증 ────────────────────────────────

describe("PASSPORT_SMS_TEMPLATES", () => {
  it("should have 3 template types", () => {
    expect(Object.keys(PASSPORT_SMS_TEMPLATES)).toHaveLength(3);
    expect(PASSPORT_SMS_TEMPLATES["basic"]).toBeDefined();
    expect(PASSPORT_SMS_TEMPLATES["reminder"]).toBeDefined();
    expect(PASSPORT_SMS_TEMPLATES["urgent"]).toBeDefined();
  });

  it("all templates should contain required variables", () => {
    Object.values(PASSPORT_SMS_TEMPLATES).forEach((template) => {
      expect(template.variables).toContain("customerName");
      expect(template.variables).toContain("linkUrl");
      expect(template.message).toContain("{customerName}");
      expect(template.message).toContain("{linkUrl}");
    });
  });

  it("all template messages should be within LMS limit", () => {
    Object.values(PASSPORT_SMS_TEMPLATES).forEach((template) => {
      // 템플릿은 변수 플레이스홀더를 포함하므로 실제 길이보다 짧음
      expect(template.message.length).toBeLessThan(1000);
    });
  });
});

// ─── 성능 테스트 (예제) ────────────────────────────────────────

/**
 * 배치 처리 성능 예상치
 *
 * 100명 발송 시나리오:
 * - 배치 크기: 10명
 * - 배치 수: 10개
 * - 각 배치 발송 시간: ~1초 (Aligo API 호출 병렬)
 * - 배치 간 딜레이: 200ms × 9 = 1.8초
 * - 총 예상 시간: 10초 + 1.8초 = ~12초
 *
 * 기존 순차 발송:
 * - 1명당 ~0.5초 (네트워크 + Aligo 응답)
 * - 100명 = 50초
 *
 * 개선율: 약 4배 빨라짐 ⚡
 */

// ─── 수동 테스트용 예제 ────────────────────────────────────────

/**
 * 사용 예제:
 *
 * import { sendSmsBatch, renderSmsMessage } from "@/lib/passport-sms";
 * import { resolveUserSmsConfig } from "@/lib/aligo";
 *
 * async function testBatch() {
 *   const config = await resolveUserSmsConfig("org-123", "user-456");
 *
 *   const recipients = [
 *     {
 *       id: "log-1",
 *       phone: "01012345678",
 *       customerName: "김철수",
 *       tripName: "노르웨이",
 *       daysLeft: 5
 *     },
 *     {
 *       id: "log-2",
 *       phone: "01098765432",
 *       customerName: "박영희",
 *       tripName: "알래스카",
 *       daysLeft: 3
 *     }
 *   ];
 *
 *   const result = await sendSmsBatch(
 *     config,
 *     recipients,
 *     "reminder",
 *     "https://passport.mabiz.co.kr",
 *     "org-123"
 *   );
 *
 *   console.log(result);
 *   // {
 *   //   successCount: 2,
 *   //   failureCount: 0,
 *   //   totalCount: 2,
 *   //   errors: [],
 *   //   sentAt: "2026-06-08T10:30:00Z"
 *   // }
 * }
 */

export {};
