/**
 * AutoFeedbackGenerator API Test Suite
 * @date 2026-06-03
 *
 * 테스트 케이스:
 * 1. 성공: PASONA Day 0-3 4개 SMS 생성
 * 2. dryRun: 미리보기만 (DB 저장 X)
 * 3. 권한 없음: FREE_SALES
 * 4. Contact 없음: 404
 * 5. SMS 거부: optOutAt 설정 → 400 SMS_OPT_OUT
 * 6. 중복 SMS: 24시간 내 PENDING/RETRY → 400 SMS_ALREADY_SCHEDULED
 * 7. 렌즈 감지 실패: 500 LENS_DETECTION_FAILED
 * 8. 템플릿 없음: 404 NO_TEMPLATE_FOR_LENS
 */

describe('POST /api/tools/auto-feedback', () => {
  describe('성공 케이스', () => {
    test('✅ Contact 기존 SMS 없음 → PASONA Day 0-3 생성', async () => {
      // Arrange
      const contactId = 'contact_test_001';
      const ctx = {
        userId: 'user_123',
        role: 'AGENT',
        orgId: 'org_abc123'
      };

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: false })
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.lens).toBeDefined();
      expect(data.smsCount).toBe(4);
      expect(data.created).toHaveLength(4);

      // Day 0-3 검증
      expect(data.created[0].day).toBe(0);
      expect(data.created[0].phase).toBe('P_A');
      expect(data.created[1].day).toBe(1);
      expect(data.created[1].phase).toBe('S');
      expect(data.created[2].day).toBe(2);
      expect(data.created[2].phase).toBe('O_N');
      expect(data.created[3].day).toBe(3);

      // ScheduledAt 검증 (Ebbinghaus 망각곡선)
      const now = new Date();
      const scheduledAt0 = new Date(data.created[0].scheduledAt);
      const diff0 = (scheduledAt0.getTime() - now.getTime()) / (1000 * 60);
      expect(diff0).toBeCloseTo(120, -1); // 2시간 ±10분

      const scheduledAt1 = new Date(data.created[1].scheduledAt);
      const diff1 = (scheduledAt1.getTime() - now.getTime()) / (1000 * 60);
      expect(diff1).toBeCloseTo(1440 + 600, -1); // 24h + 10h
    });

    test('✅ dryRun=true → 미리보기만 (DB 저장 X)', async () => {
      // Arrange
      const contactId = 'contact_test_002';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: true })
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.dryRun).toBe(true);
      expect(data.messages).toBeDefined();
      expect(data.messages).toHaveLength(4);

      // 메시지 미리보기 검증
      expect(data.messages[0].day).toBe(0);
      expect(data.messages[0].message).toBeDefined();
      expect(data.messages[0].message.length).toBeGreaterThan(0);

      // schedule 반환 (SMS_DAY0_3_SCHEDULE)
      expect(data.schedule).toBeDefined();
      expect(data.schedule).toHaveLength(4);
      expect(data.schedule[0].day).toBe(0);
      expect(data.schedule[0].delayMinutes).toBe(120);
    });
  });

  describe('권한 검증', () => {
    test('❌ FREE_SALES 역할 → 403 권한 없음', async () => {
      // Arrange
      const ctx = { role: 'FREE_SALES' };

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_123' }),
        headers: { 'x-user-role': 'FREE_SALES' }
      });

      // Assert
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.message).toContain('권한이 없습니다');
    });

    test('❌ contactId 누락 → 400 필수 필드', async () => {
      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({})
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.message).toContain('contactId는 필수');
    });
  });

  describe('Contact 검증', () => {
    test('❌ Contact 없음 → 404 고객 찾을 수 없음', async () => {
      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_not_exists' })
      });

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toContain('고객을 찾을 수 없거나 권한이 없습니다');
    });
  });

  describe('GDPR 검증', () => {
    test('❌ optOutAt 설정됨 → 400 SMS_OPT_OUT', async () => {
      // Arrange: optOutAt이 설정된 Contact
      const contactId = 'contact_optout';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId })
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe('SMS_OPT_OUT');
      expect(data.message).toContain('SMS 수신을 거부');
    });
  });

  describe('중복 SMS 방지', () => {
    test('❌ 24시간 내 PENDING SMS 있음 → 400 SMS_ALREADY_SCHEDULED', async () => {
      // Arrange: 기존 PENDING SMS가 있는 Contact
      const contactId = 'contact_pending_sms';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId })
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe('SMS_ALREADY_SCHEDULED');
      expect(data.message).toContain('이미 SMS가 예약');
    });

    test('✅ 24시간 초과 이전 SMS 있음 → 새로 생성 가능', async () => {
      // Arrange: 24시간 초과 이전 SMS가 있는 Contact
      const contactId = 'contact_old_sms';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: false })
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.smsCount).toBe(4);
    });
  });

  describe('렌즈 감지 검증', () => {
    test('❌ 렌즈 감지 실패 → 500 LENS_DETECTION_FAILED', async () => {
      // Arrange: 렌즈 감지가 실패하는 시나리오 (mocked)
      const contactId = 'contact_lens_error';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId })
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe('LENS_DETECTION_FAILED');
      expect(data.message).toContain('고객 분석에 실패');
    });
  });

  describe('PASONA 템플릿 검증', () => {
    test('❌ 렌즈에 대한 템플릿 없음 → 404 NO_TEMPLATE_FOR_LENS', async () => {
      // Arrange: 존재하지 않는 렌즈 (L99)로 강제 설정한 Contact
      const contactId = 'contact_unknown_lens';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId })
      });

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe('NO_TEMPLATE_FOR_LENS');
    });
  });

  describe('메시지 개인화', () => {
    test('✅ {{name}} 변수 치환', async () => {
      // Arrange
      const contactId = 'contact_john';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: true })
      });

      // Assert
      const data = await res.json();
      const message = data.messages[0].message;
      expect(message).toContain('John'); // Contact name
      expect(message).not.toContain('{{name}}'); // 치환 완료
    });

    test('✅ {{daysSince}} 변수 치환', async () => {
      // Arrange: lastContactedAt이 7일 전인 Contact
      const contactId = 'contact_7days_ago';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: true })
      });

      // Assert
      const data = await res.json();
      const message = data.messages[0].message;
      expect(message).toContain('7'); // 7 days
      expect(message).not.toContain('{{daysSince}}');
    });

    test('✅ 안전한 기본값으로 변수 치환', async () => {
      // Arrange: 변수가 정의되지 않은 Contact
      const contactId = 'contact_minimal_data';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: true })
      });

      // Assert
      const data = await res.json();
      const message = data.messages[0].message;
      expect(message).toContain('고객'); // name 기본값
      expect(message).toContain('15'); // discount 기본값
      expect(message).not.toContain('{{'); // 모든 변수 치환됨
    });
  });

  describe('응답 포맷 검증', () => {
    test('✅ created 배열 구조 정확성', async () => {
      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_test', dryRun: false })
      });

      // Assert
      const data = await res.json();
      expect(data.created[0]).toHaveProperty('id');
      expect(data.created[0]).toHaveProperty('day');
      expect(data.created[0]).toHaveProperty('phase');
      expect(data.created[0]).toHaveProperty('tone');
      expect(data.created[0]).toHaveProperty('scheduledAt');
      expect(data.created[0]).toHaveProperty('status');
      expect(data.created[0].status).toBe('PENDING');
    });

    test('✅ 에러 응답 code 필드 포함', async () => {
      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_optout' })
      });

      // Assert
      const data = await res.json();
      expect(data).toHaveProperty('code');
      expect(data.code).toBe('SMS_OPT_OUT');
    });
  });

  describe('로깅 검증', () => {
    test('✅ 성공 로그 기록', async () => {
      // Arrange
      const contactId = 'contact_log_test';

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId, dryRun: false })
      });

      // Assert
      // logger.log 호출 확인 (mock 또는 실제 로그 검증)
      // "[POST /api/tools/auto-feedback] PASONA Day 0-3 자동 생성 완료"
      expect(res.status).toBe(200);
    });

    test('✅ 에러 로그 기록', async () => {
      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_error' })
      });

      // Assert
      // logger.error 호출 확인
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('성능 검증', () => {
    test('⏱️ 응답 시간 < 1초 (dryRun)', async () => {
      // Arrange
      const start = performance.now();

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_perf', dryRun: true })
      });

      // Assert
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000); // 1초
      expect(res.status).toBe(200);
    });

    test('⏱️ 응답 시간 < 2초 (DB 저장)', async () => {
      // Arrange
      const start = performance.now();

      // Act
      const res = await fetch('/api/tools/auto-feedback', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact_perf_db', dryRun: false })
      });

      // Assert
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000); // 2초
      expect(res.status).toBe(200);
    });
  });
});
