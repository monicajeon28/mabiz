# Menu #38 Cron Job - ExecutionLog 기반 캠페인 자동 발송

## 개요
ExecutionLog 테이블을 기반으로 매일 정해진 시간에 자동으로 캠페인 메시지를 발송하는 Cron Job.

## 파일 구조
```
src/lib/cron/
├── execute-campaigns.ts    # 메인 Cron Job 로직
├── README.md               # 이 파일
└── (추후 추가)
  ├── execute-campaigns.test.ts
  ├── schedule.ts (Vercel Cron)
  └── types.ts
```

## 주요 함수

### 1. getPendingExecutions(organizationId, limit)
- 조건: status='PENDING' AND scheduledAt <= NOW
- 인덱스 활용: `idx_execution_cron_scan` (organizationId, status, scheduledAt)
- 반환: ExecutionRecord[] (id, contactId, channel, status 등)

### 2. executeCampaignMessages(executions, channel)
- Phase 2에서 실제 발송 로직 구현
- SMS: sendSms() → Aligo API
- Email: sendEmail() → SMTP
- 배치 처리 (50명씩)

### 3. updateExecutionStatus(executionId, status, failureReason?, retryCount?)
- ExecutionLog 상태 업데이트
- PENDING → SENT / FAILED / RETRY_SCHEDULED / ABANDONED
- 재시도 로직: 지수 백오프 (1, 2, 4분)

### 4. executePendingCampaigns()
- 메인 Cron Job 함수
- 모든 ACTIVE 조직 순회
- SMS/Email 채널별 병렬 처리

## 실행 방식

### Phase 1 (현재)
- 구조 정의만 (테스트 가능, stub 함수)
- API 엔드포인트 작성 필요: `/api/cron/execute-campaigns`

### Phase 2
- 실제 발송 로직 구현
- Aligo SMS API 연동
- SMTP Email 발송
- 실패 카운팅 및 재시도

### Phase 3
- Vercel Cron Job 설정 또는 외부 scheduler (cron-job.org)
- 일일 실행 스케줄

## 데이터베이스 스키마

### ExecutionLog (기존)
```prisma
model ExecutionLog {
  id                String                    @id @default(cuid())
  organizationId    String
  contactId         String
  sourceId          String
  sourceType        String                    // FUNNEL_SEQUENCE | AUTOMATION_RULE
  channel           String                    // SMS | EMAIL
  status            ExecutionStatus           // PENDING | SENT | FAILED | ...
  executeMonth      String                    // "2025-01" (월별 중복 방지)
  scheduledAt       DateTime                  // 발송 예정 시간
  sentAt            DateTime?
  nextRetryAt       DateTime?                 // 다음 재시도 시간
  retryCount        Int                       @default(0)
  maxRetries        Int                       @default(3)
  ...
}

// 인덱스
@@index([organizationId, status, scheduledAt], name: "idx_execution_cron_scan")
@@index([status], name: "idx_execution_status")
@@index([nextRetryAt], name: "idx_execution_retry")
```

### CrmMarketingCampaign (추가된 필드)
```prisma
model CrmMarketingCampaign {
  ...
  repeatRule        String?       @default("ONCE")      // ONCE | DAILY | WEEKLY | MONTHLY
  nextExecutionAt   DateTime?                            // 다음 실행 예정 시간
  ...
}

// 인덱스
@@index([nextExecutionAt])
```

## 마이그레이션

마이그레이션 파일: `prisma/migrations/20260518130000_menu38_phase1_executionlog_migration.sql`

```bash
# 실행
npx prisma migrate deploy

# 확인
npx prisma db execute --stdin < prisma/migrations/20260518130000_menu38_phase1_executionlog_migration.sql
```

## 테스트

### 로컬 수동 실행
```bash
# TypeScript 직접 실행 (Node.js 필요)
npx ts-node -O '{"module":"commonjs"}' src/lib/cron/execute-campaigns.ts

# 또는 API를 통한 테스트
curl -X POST http://localhost:3000/api/cron/execute-campaigns
```

### 예상 출력
```json
{
  "success": 100,
  "failed": 5,
  "duration": 2500
}
```

## 다음 단계

### Phase 2 작업
- [ ] API 엔드포인트 작성: `/api/cron/execute-campaigns`
- [ ] 실제 SMS 발송 로직 (executeCampaignMessages)
- [ ] 실제 Email 발송 로직
- [ ] 테스트 케이스 (Jest)

### Phase 3 작업
- [ ] Vercel Cron 또는 외부 scheduler 설정
- [ ] 모니터링 (에러 알림)
- [ ] 로그 수집 (Sentry)

## 참고사항

- **중복 방지**: `@@unique([sourceType, sourceId, contactId, executeMonth])`
- **재시도**: 지수 백오프 (1, 2, 4분) → maxRetries(3) 초과 시 ABANDONED
- **성능**: 배치 처리(50명) + Redis 큐(로깅)
- **안전성**: 야간 발송 차단, 수신거부 확인

## 관련 파일
- `src/lib/aligo.ts` - SMS 발송 (sendSms)
- `src/lib/email.ts` - Email 발송 (sendEmail)
- `src/lib/logger.ts` - 로깅
- `prisma/schema.prisma` - 스키마
