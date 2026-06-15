# Phase 4: Contract Reminder 테스트 케이스

## 테스트 목표
Cron Job이 SENT 상태 계약서를 정확하게 감지하고, A/B 변형을 올바르게 발송하며, 메타데이터를 정확히 업데이트하는지 검증합니다.

---

## 테스트 데이터 설정

### 테스트용 조직 & 계약서 생성
```sql
-- 테스트 조직
INSERT INTO "Organization" (id, name, slug, status)
VALUES ('test-org-reminder', 'Test Reminder Org', 'test-reminder', 'ACTIVE');

-- 테스트 계약 템플릿
INSERT INTO "ContractTemplate" (id, organizationId, name, htmlContent, status)
VALUES ('test-template-1', 'test-org-reminder', 'Test Template', '<p>Test</p>', 'ACTIVE');

-- 테스트 SMS 설정
INSERT INTO "OrgSmsConfig" (id, organizationId, aligoKey, aligoUserId, senderPhone, isActive)
VALUES ('sms-config-test', 'test-org-reminder', 'test-key', 'test-user', '01012345678', true);
```

---

## 테스트 케이스 1: 정상 재전송 (A/B 변형 A - 긴박감)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 8일 전
- `reminderCount`: 0
- `boundData`: { signerName: "김철수", signerPhone: "01098765432", signerEmail: "kim@example.com" }
- Cron 실행 시간: 09:00 KST

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount)
VALUES (
  'contract-test-1',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "김철수", "signerPhone": "01098765432", "signerEmail": "kim@example.com"}',
  NOW() - INTERVAL '8 days',
  0
);
```

### 예상 결과
| 항목 | 값 |
|------|-----|
| SMS 발송 성공 | ✅ |
| 발송 메시지 | "김철수님, 계약서가 대기 중입니다. 7일 남았습니다. 지금 서명하세요: [링크]" |
| 변형 선택 | A (긴박감) |
| reminderCount 업데이트 | 0 → 1 |
| lastReminderSentAt 업데이트 | NOW() |
| Email 대기 | ✅ (준비됨) |

### 검증 쿼리
```sql
SELECT id, status, reminderCount, lastReminderSentAt
FROM "ContractInstance"
WHERE id = 'contract-test-1';

-- 예상 결과:
-- id | status | reminderCount | lastReminderSentAt
-- contract-test-1 | SENT | 1 | 2026-06-15 09:30:00 (UTC)
```

---

## 테스트 케이스 2: 두 번째 재전송 (A/B 변형 B - 친절함)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 15일 전
- `reminderCount`: 1
- `lastReminderSentAt`: 7일 전
- `boundData`: { signerName: "박민지", signerPhone: "01055556666" }

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount, lastReminderSentAt)
VALUES (
  'contract-test-2',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "박민지", "signerPhone": "01055556666", "signerEmail": "park@example.com"}',
  NOW() - INTERVAL '15 days',
  1,
  NOW() - INTERVAL '7 days'
);
```

### 예상 결과
| 항목 | 값 |
|------|-----|
| SMS 발송 성공 | ✅ |
| 발송 메시지 | "박민지님, 계약서를 아직 확인하지 않으셨네요. 7일 남았습니다. 클릭해서 서명 완료하세요: [링크]" |
| 변형 선택 | B (친절함) |
| reminderCount 업데이트 | 1 → 2 |
| lastReminderSentAt 업데이트 | NOW() |

### 검증 쿼리
```sql
SELECT id, reminderCount, lastReminderSentAt
FROM "ContractInstance"
WHERE id = 'contract-test-2';

-- 예상 결과:
-- id | reminderCount | lastReminderSentAt
-- contract-test-2 | 2 | 2026-06-15 09:30:00 (UTC)
```

---

## 테스트 케이스 3: 세 번째 재전송 (최종)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 22일 전
- `reminderCount`: 2
- Cron 실행

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount)
VALUES (
  'contract-test-3',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "이준호", "signerPhone": "01077778888"}',
  NOW() - INTERVAL '22 days',
  2
);
```

### 예상 결과
| 항목 | 값 |
|------|-----|
| SMS 발송 성공 | ✅ |
| 발송 메시지 | "이준호님, 계약서가 대기 중입니다. 7일 남았습니다. 지금 서명하세요: [링크]" |
| reminderCount 업데이트 | 2 → 3 |
| 다음 Cron 회피 | ✅ (reminderCount < 3 조건 제외) |

---

## 테스트 케이스 4: 재전송 한계 도달 (Skip)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 29일 전
- `reminderCount`: 3 (최대 횟수)

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount)
VALUES (
  'contract-test-4',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "정혜영", "signerPhone": "01099999999"}',
  NOW() - INTERVAL '29 days',
  3
);
```

### 예상 결과
| 항목 | 값 |
|------|-----|
| 쿼리 조건 | reminderCount < 3 제외 |
| Cron 처리 | Skip |
| reminderCount 변경 | 없음 (3 유지) |
| 로그 | 처리 대상에서 제외됨 |

### 검증 쿼리
```sql
-- Cron 후 contract-test-4 조회
SELECT * FROM "ContractInstance" WHERE id = 'contract-test-4';

-- 예상: reminderCount=3, lastReminderSentAt 변경 없음
```

---

## 테스트 케이스 5: 연락처 없음 (Skip)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 8일 전
- `reminderCount`: 0
- `boundData`: { signerName: "손영수" } (Phone & Email 모두 없음)

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount)
VALUES (
  'contract-test-5',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "손영수"}',
  NOW() - INTERVAL '8 days',
  0
);
```

### 예상 결과
| 항목 | 값 |
|------|-----|
| Cron 처리 | Skip |
| 로그 | "연락처 없음" 경고 |
| reminderCount 변경 | 없음 (0 유지) |
| skippedCount | +1 |

### 검증 쿼리
```sql
SELECT * FROM "ContractInstance" WHERE id = 'contract-test-5';
-- 예상: reminderCount=0, lastReminderSentAt=NULL
```

---

## 테스트 케이스 6: SMS 발송 실패 (재시도 준비)

### 선행 조건
- 계약서 상태: SENT
- `createdAt`: 8일 전
- `reminderCount`: 0
- Aligo API Mock: result_code = -99 (Opt-out)

### 테스트 SQL
```sql
INSERT INTO "ContractInstance" 
  (id, organizationId, templateId, status, boundData, createdAt, reminderCount)
VALUES (
  'contract-test-6',
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "홍길동", "signerPhone": "01011111111"}',
  NOW() - INTERVAL '8 days',
  0
);
```

### 예상 결과 (현재 구현)
| 항목 | 값 |
|------|-----|
| SMS 발송 시도 | ✅ |
| API 응답 | result_code = -99 |
| reminderCount 업데이트 | 0 → 1 (정상 카운팅) |
| lastReminderSentAt 업데이트 | NOW() |
| skippedCount | +1 (실패로 기록) |

**주의**: 현재 구현에서는 result_code 값에 관계없이 `reminderCount`를 증가합니다. 향후 검토 필요.

---

## 테스트 케이스 7: 배치 처리 (100건 연쇄)

### 선행 조건
- SENT 상태 계약서 100건 생성
- `createdAt`: 8-15일 전 (다양한 값)
- `reminderCount`: 0, 1, 2, 3 (균등 분포)

### 테스트 시나리오
```sql
-- 100건 대량 생성 (변형 A, B 번갈아 배정)
INSERT INTO "ContractInstance" 
SELECT 
  'contract-bulk-' || generate_subscripts(ARRAY[1..100], 1)::text,
  'test-org-reminder',
  'test-template-1',
  'SENT',
  '{"signerName": "Customer", "signerPhone": "01012345678"}',
  NOW() - INTERVAL '8 days' - INTERVAL '1 day' * (generate_subscripts(ARRAY[1..100], 1) % 8),
  (generate_subscripts(ARRAY[1..100], 1) % 4)::int
FROM generate_series(1, 100);
```

### 예상 결과
| 메트릭 | 값 |
|--------|-----|
| 처리 계약서 | ~75건 |
| SMS 발송 | ~75건 |
| Skip (reminderCount=3) | ~25건 |
| 소요 시간 | < 30초 |
| earlyExit | false |

### 검증 쿼리
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN reminderCount > 0 THEN 1 ELSE 0 END) as updated,
  SUM(CASE WHEN reminderCount = 3 THEN 1 ELSE 0 END) as at_limit
FROM "ContractInstance"
WHERE id LIKE 'contract-bulk-%';
```

---

## 테스트 케이스 8: Cron 시간 초과 처리

### 선행 조건
- SENT 상태 계약서 1000건 (시뮬레이션)
- BATCH_SIZE = 100
- MAX_DURATION_MS = 250,000ms (250s)

### 예상 결과
| 항목 | 값 |
|------|-----|
| 처리된 배치 | 8-9개 (800-900건) |
| 마지막 배치 | 미처리 (다음 Cron에서 재처리) |
| earlyExit | true |
| 반환 JSON | { "earlyExit": true, "processedTotal": 800 } |

---

## 통합 테스트 실행 계획

### 1단계: 유닛 테스트 (각 케이스별)
```bash
# 로컬 환경에서 계약서 8건 생성 후 Cron 수동 실행
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/contract-reminders
```

### 2단계: A/B 검증
```sql
-- reminderCount별 메시지 변형 검증
SELECT 
  reminderCount,
  COUNT(*) as count,
  CASE WHEN reminderCount % 2 = 0 THEN 'A (Urgency)' ELSE 'B (Friendly)' END as variant
FROM "ContractInstance"
WHERE status = 'SENT' AND reminderCount > 0
GROUP BY reminderCount;
```

### 3단계: 성과 메트릭 수집
```sql
-- Cron 실행 후 메트릭
SELECT 
  COUNT(*) as total_reminders,
  SUM(CASE WHEN reminderCount > 0 THEN 1 ELSE 0 END) as sent,
  AVG(reminderCount) as avg_reminder_count,
  MAX(reminderCount) as max_reminder_count
FROM "ContractInstance"
WHERE organizationId = 'test-org-reminder' AND status = 'SENT';
```

### 4단계: 프로덕션 배포 전 점검
- [ ] vercel.json Cron 스케줄 등록
- [ ] CRON_SECRET 환경변수 설정
- [ ] NEXT_PUBLIC_BASE_URL 확인
- [ ] SMS 설정 (aligoKey, userId, senderPhone) 확인
- [ ] 계약서 생성 플로우에서 공개 서명 링크 정상 작동 확인
- [ ] 모니터링 대시보드 설정 (Cron 실행 로그)

---

## 예상 시간표

| 단계 | 시간 | 담당자 |
|------|------|--------|
| 스키마 수정 | 30분 | Agent-CTR-CRON |
| Cron Job 구현 | 2시간 | Agent-CTR-CRON |
| 테스트 작성 | 1시간 | Agent-CTR-CRON |
| TSC 검증 | 30분 | Agent-CTR-CRON |
| 통합 테스트 | 2시간 | 3팀 공동 |
| 버그 수정 | 1시간 | 필요시 |
| 프로덕션 배포 | 30분 | DevOps |

**총 소요 시간**: 7-8시간 (Day 1-2)

---

**작성자**: Agent-CTR-CRON  
**작성일**: 2026-06-15  
**상태**: Test Plan Draft
