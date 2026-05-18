# Menu #38 Phase 2 작업지시서 — 발송 이력 추적 + 자동 재시도

**Phase 일정**: 2026-05-19 ~ 2026-05-26 (1주)  
**진행 방식**: 2개 트랙 병렬 (A: DB/API, B: 모니터링)  
**목표**: SendingHistory 모델 + 재시도 로직 + WebHook 통합 완성

---

## Step 3-1: Track A — DB/API 구현 (5일)

### 3-1-A: SendingHistory 모델 + 마이그레이션

**담당**: Agent α  
**소요 시간**: 1일 (2026-05-19)  
**파일 생성**:
- `prisma/schema.prisma` (수정) — SendingHistory 모델 추가
- `prisma/migrations/20260519000000_menu38_phase2_sending_history.sql` (신규) — 마이그레이션 파일
- `docs/SENDING_HISTORY_SPECIFICATION.md` (신규) — 스펙 문서

**상세 작업**:

1. **Prisma 스키마 추가**
   ```typescript
   model SendingHistory {
     id                String    @id @default(cuid())
     organizationId    String
     campaignId        String
     contactId         String
     channel           String    // SMS | EMAIL | BOTH
     status            SendingStatus @default(PENDING)
     
     scheduledAt       DateTime
     sentAt            DateTime?
     nextRetryAt       DateTime?
     
     emailStatus       String?
     emailSentAt       DateTime?
     emailOpenedAt     DateTime?
     
     smsStatus         String?
     smsSentAt         DateTime?
     
     failureReason     SendingFailureReason?
     failureMessage    String?
     failureUserMsg    String?
     
     retryCount        Int       @default(0)
     maxRetries        Int       @default(3)
     lastRetryReason   String?
     
     linkClickedAt     DateTime?
     registeredAt      DateTime?
     landingPageViewId String?
     
     contentPreview    String?
     messageId         String?
     metadata          Json?
     
     createdAt         DateTime  @default(now())
     updatedAt         DateTime  @updatedAt
     
     campaign          CrmMarketingCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
     contact           Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
     
     // 5개 필수 인덱스
     @@index([organizationId, status, nextRetryAt], name: "idx_sending_retry_scan")
     @@index([campaignId, status], name: "idx_sending_campaign_status")
     @@index([contactId, sentAt(sort: Desc)], name: "idx_sending_contact_history")
     @@index([organizationId, sentAt], name: "idx_sending_org_time")
     @@index([status, retryCount], name: "idx_sending_status_retry")
     
     // 중복 방지
     @@unique([campaignId, contactId], name: "uq_sending_campaign_contact")
     
     @@map("SendingHistory")
   }
   ```

2. **Enum 추가**
   ```typescript
   enum SendingStatus {
     PENDING            // 발송 대기
     SENT               // 발송 성공
     FAILED             // 발송 실패
     SKIPPED            // 건너뜀
     RETRY_SCHEDULED    // 재시도 예정
     ABANDONED          // 최대 재시도 초과
   }
   
   enum SendingFailureReason {
     INVALID_EMAIL
     INVALID_PHONE
     OPT_OUT
     QUOTA_EXCEEDED
     SYSTEM_ERROR
     PROVIDER_ERROR
     NETWORK_ERROR
     BOUNCE
   }
   ```

3. **마이그레이션 SQL 작성** (PostgreSQL, 논블로킹)
   - 테이블 생성
   - CONCURRENTLY 인덱스 생성
   - Unique 제약조건
   - Foreign Key

4. **CrmMarketingCampaign 업데이트**
   ```typescript
   // 추가 필드
   totalCount       Int @default(0)
   sentCount        Int @default(0)
   failedCount      Int @default(0)
   skippedCount     Int @default(0)
   openCount        Int @default(0)
   clickCount       Int @default(0)
   registeredCount  Int @default(0)
   
   // 추가 관계
   sendingHistory   SendingHistory[]
   ```

5. **마이그레이션 실행 검증**
   ```bash
   npx prisma migrate deploy
   npx prisma studio  # 테이블 확인
   ```

**완료 기준**:
- [ ] Prisma 컴파일 OK (TypeScript strict mode)
- [ ] 마이그레이션 파일 검증 (SQL 문법)
- [ ] 로컬 DB 마이그레이션 성공
- [ ] 스펙 문서 작성 완료

---

### 3-1-B: Cron Job 개선 — 재시도 로직

**담당**: Agent β  
**소요 시간**: 2일 (2026-05-19 ~ 2026-05-20)  
**파일 수정**:
- `src/lib/cron/execute-campaigns.ts` (수정) — 재시도 로직 개선
- `src/lib/sending-history.ts` (신규) — SendingHistory 유틸 함수

**상세 작업**:

1. **재시도 간격 조정** (Phase 1 → Phase 2)
   ```typescript
   // Before (Phase 1)
   const delayMs = Math.pow(2, retryCount) * 60000; // 1, 2, 4분
   
   // After (Phase 2)
   const RETRY_DELAYS = [
     60 * 60 * 1000,       // 1시간
     6 * 60 * 60 * 1000,   // 6시간
     24 * 60 * 60 * 1000,  // 24시간
   ];
   
   const base = RETRY_DELAYS[retryCount] || 0;
   const jitter = Math.random() * 0.1 * base; // ±10% jitter
   const nextRetryAt = new Date(Date.now() + base + jitter);
   ```

2. **executeCampaignMessages() 구현** (stub → 실제 발송)
   ```typescript
   async function executeCampaignMessages(campaign: CrmMarketingCampaign, contacts: Contact[]) {
     const results = { sent: 0, failed: 0, skipped: 0 };
     
     for (const batch of chunks(contacts, 50)) {
       const promises = batch.map(contact => {
         if (campaign.sendSms) {
           return sendSms(contact.phone, campaign.smsBody)
             .then(() => ({ status: 'SENT', channel: 'SMS' }))
             .catch(err => ({ status: 'FAILED', channel: 'SMS', error: err }));
         }
         if (campaign.sendEmail) {
           return sendFunnelEmail(contact.email, campaign.emailSubject, campaign.emailBody)
             .then(() => ({ status: 'SENT', channel: 'EMAIL' }))
             .catch(err => ({ status: 'FAILED', channel: 'EMAIL', error: err }));
         }
       });
       
       const outcomes = await Promise.all(promises);
       
       // SendingHistory에 기록
       for (let i = 0; i < batch.length; i++) {
         await createSendingHistory(campaign.id, batch[i].id, outcomes[i]);
       }
       
       results.sent += outcomes.filter(o => o.status === 'SENT').length;
       results.failed += outcomes.filter(o => o.status === 'FAILED').length;
     }
     
     return results;
   }
   ```

3. **updateExecutionStatus() → updateSendingStatus()**
   ```typescript
   async function updateSendingStatus(
     sendingId: string,
     status: SendingStatus,
     failureReason?: SendingFailureReason,
     retryCount?: number
   ) {
     const sending = await db.sendingHistory.findUnique({ where: { id: sendingId } });
     
     if (status === 'FAILED') {
       // 재시도 가능한가?
       const permanentFailures = ['INVALID_EMAIL', 'INVALID_PHONE', 'OPT_OUT'];
       
       if (!permanentFailures.includes(failureReason) && retryCount < sending.maxRetries) {
         // 재시도 예약
         const nextRetryAt = calculateNextRetry(retryCount);
         
         return db.sendingHistory.update({
           where: { id: sendingId },
           data: {
             status: 'RETRY_SCHEDULED',
             nextRetryAt,
             failureReason,
             retryCount: retryCount + 1,
           },
         });
       } else {
         // 영구 실패
         return db.sendingHistory.update({
           where: { id: sendingId },
           data: {
             status: 'ABANDONED',
             failureReason,
             retryCount: retryCount + 1,
           },
         });
       }
     }
     
     return db.sendingHistory.update({
       where: { id: sendingId },
       data: { status, sentAt: status === 'SENT' ? new Date() : undefined },
     });
   }
   ```

4. **Cron 메인 함수 개선**
   ```typescript
   export async function executePendingCampaigns() {
     const campaigns = await db.crmMarketingCampaign.findMany({
       where: {
         nextExecutionAt: { lte: new Date() },
         status: 'ACTIVE',
       },
       include: { group: true },
     });
     
     for (const campaign of campaigns) {
       // 1. 대상 연락처 조회
       const contacts = await getContactsByGroup(campaign.groupId);
       
       // 2. 발송 실행
       const results = await executeCampaignMessages(campaign, contacts);
       
       // 3. 다음 실행 예약 (반복 규칙에 따라)
       if (campaign.repeatRule !== 'ONCE') {
         campaign.nextExecutionAt = calculateNextExecution(campaign.repeatRule);
       }
       
       // 4. 캠페인 카운트 업데이트
       await db.crmMarketingCampaign.update({
         where: { id: campaign.id },
         data: {
           sentCount: { increment: results.sent },
           failedCount: { increment: results.failed },
           nextExecutionAt: campaign.nextExecutionAt,
         },
       });
     }
     
     // 5. 재시도 대상 처리
     const retryTargets = await db.sendingHistory.findMany({
       where: {
         status: 'RETRY_SCHEDULED',
         nextRetryAt: { lte: new Date() },
       },
     });
     
     for (const target of retryTargets) {
       await retrySendingMessage(target);
     }
   }
   ```

**완료 기준**:
- [ ] 재시도 간격 1h/6h/24h로 조정 완료
- [ ] executeCampaignMessages() SMS/Email 실제 발송 구현
- [ ] updateSendingStatus() 재시도 로직 구현
- [ ] Cron 메인 함수 통합 완료
- [ ] 테스트 (로컬 실행)

---

### 3-1-C: WebHook 콜백 엔드포인트

**담당**: Agent γ  
**소요 시간**: 1.5일 (2026-05-20 ~ 2026-05-21)  
**파일 생성**:
- `src/app/api/webhooks/execution-status/route.ts` (신규)
- `src/app/api/webhooks/aligo/status/route.ts` (신규)
- `src/lib/webhook-execution.ts` (신규) — 웹훅 검증 & 처리

**상세 작업**:

1. **ExecutionLog 콜백 엔드포인트** (`/api/webhooks/execution-status`)
   ```typescript
   export async function POST(request: Request) {
     const body = await request.json();
     
     // 1. 서명 검증
     const signature = request.headers.get('x-signature');
     if (!verifyWebhookSignature(body, signature)) {
       return Response.json({ error: 'Invalid signature' }, { status: 401 });
     }
     
     // 2. executionId 검증
     const execution = await db.sendingHistory.findUnique({
       where: { id: body.executionId },
     });
     if (!execution) {
       return Response.json({ error: 'Execution not found' }, { status: 404 });
     }
     
     // 3. 상태 업데이트
     const updated = await updateSendingStatus(
       body.executionId,
       body.status,
       body.failureReason,
       execution.retryCount
     );
     
     // 4. 응답
     return Response.json({
       ok: true,
       executionId: updated.id,
       status: updated.status,
       updatedAt: updated.updatedAt,
     });
   }
   ```

2. **Aligo SMS 콜백 엔드포인트** (`/api/webhooks/aligo/status`)
   ```typescript
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     
     const msgId = searchParams.get('msg_id');
     const stat = parseInt(searchParams.get('stat') || '0');
     const resultCode = searchParams.get('result');
     
     // Aligo 상태 → SendingStatus 매핑
     const statusMap: Record<number, SendingStatus> = {
       0: 'PENDING',      // 수신중
       1: 'SENT',         // 성공
       2: 'FAILED',       // 실패
       3: 'PENDING',      // 대기
     };
     
     const status = statusMap[stat];
     
     // SendingHistory 조회 & 업데이트
     const sending = await db.sendingHistory.findFirst({
       where: { messageId: msgId },
     });
     
     if (!sending) {
       return Response.json({ error: 'Message not found' }, { status: 404 });
     }
     
     await updateSendingStatus(sending.id, status, null, sending.retryCount);
     
     return Response.json({ ok: true, status });
   }
   ```

3. **멱등성 처리** (ProcessedWebhookEvent)
   ```typescript
   async function processSendingWebhook(eventId: string, handler: () => Promise<void>) {
     // 중복 체크
     const existing = await db.processedWebhookEvent.findUnique({
       where: { eventId },
     });
     
     if (existing) {
       return { duplicate: true };
     }
     
     // 처리 실행
     await handler();
     
     // 처리 기록
     await db.processedWebhookEvent.create({
       data: {
         eventId,
         webhookType: 'sending_status',
         processedAt: new Date(),
       },
     });
     
     return { ok: true };
   }
   ```

**완료 기준**:
- [ ] `/api/webhooks/execution-status` 구현 및 테스트
- [ ] `/api/webhooks/aligo/status` 구현 및 테스트
- [ ] 서명 검증 (HMAC-SHA256)
- [ ] 멱등성 처리 완료

---

## Step 3-2: Track B — 모니터링/운영 (3일)

### 3-2-A: 대시보드 — 발송 현황 조회

**담당**: Agent δ  
**소요 시간**: 1.5일 (2026-05-21 ~ 2026-05-22)  
**파일 생성**:
- `src/app/api/campaigns/sending-history/stats/route.ts` (신규)
- `src/app/api/campaigns/sending-history/failures/route.ts` (신규)
- `src/app/(dashboard)/campaigns/sending-history/page.tsx` (신규)

**상세 작업**:

1. **발송 현황 통계 API**
   ```typescript
   // GET /api/campaigns/sending-history/stats?campaignId=X&period=7d
   
   async function getStats(campaignId: string, period: '1d' | '7d' | '30d') {
     const since = calculateSince(period);
     
     const total = await db.sendingHistory.count({
       where: { campaignId, createdAt: { gte: since } }
     });
     
     const statuses = await db.sendingHistory.groupBy({
       by: ['status'],
       where: { campaignId, createdAt: { gte: since } },
       _count: true,
     });
     
     const channels = await db.sendingHistory.groupBy({
       by: ['channel'],
       where: { campaignId, createdAt: { gte: since } },
       _count: true,
     });
     
     return {
       total,
       byStatus: Object.fromEntries(statuses.map(s => [s.status, s._count])),
       byChannel: Object.fromEntries(channels.map(c => [c.channel, c._count])),
       successRate: ((total - failures) / total * 100).toFixed(2) + '%',
     };
   }
   ```

2. **실패 목록 조회 API**
   ```typescript
   // GET /api/campaigns/sending-history/failures?campaignId=X&limit=50&offset=0
   
   async function getFailures(campaignId: string, limit = 50, offset = 0) {
     return await db.sendingHistory.findMany({
       where: {
         campaignId,
         status: { in: ['FAILED', 'ABANDONED'] },
       },
       include: {
         contact: { select: { name: true, email: true, phone: true } },
       },
       orderBy: { createdAt: 'desc' },
       take: limit,
       skip: offset,
     });
   }
   ```

3. **대시보드 페이지** (발송 현황 + 실패 목록)
   ```typescript
   // src/app/(dashboard)/campaigns/sending-history/page.tsx
   
   export default function SendingHistoryPage() {
     const [stats, setStats] = useState(null);
     const [failures, setFailures] = useState([]);
     
     useEffect(() => {
       fetch(`/api/campaigns/sending-history/stats?campaignId=${campaignId}`)
         .then(r => r.json())
         .then(data => setStats(data));
       
       fetch(`/api/campaigns/sending-history/failures?campaignId=${campaignId}`)
         .then(r => r.json())
         .then(data => setFailures(data));
     }, [campaignId]);
     
     return (
       <div className="space-y-6">
         {/* 통계 카드 */}
         <div className="grid grid-cols-4 gap-4">
           <Card title="총 발송" value={stats.total} />
           <Card title="성공" value={stats.byStatus.SENT} color="green" />
           <Card title="실패" value={stats.byStatus.FAILED} color="red" />
           <Card title="재시도중" value={stats.byStatus.RETRY_SCHEDULED} color="yellow" />
         </div>
         
         {/* 실패 목록 테이블 */}
         <Card title="발송 실패 목록 (최근)">
           <Table columns={['연락처', '채널', '실패 사유', '재시도', '시간']} rows={failures} />
         </Card>
       </div>
     );
   }
   ```

**완료 기준**:
- [ ] 통계 API 구현 (상태별, 채널별 그룹화)
- [ ] 실패 목록 API 구현
- [ ] 대시보드 페이지 완성
- [ ] UI 반응형 디자인 확인

---

### 3-2-B: 수동 재전송 기능

**담당**: Agent ε  
**소요 시간**: 1day (2026-05-22 ~ 2026-05-23)  
**파일 생성**:
- `src/app/api/campaigns/sending-history/[id]/resend/route.ts` (신규)
- UI 버튼 추가 (sending-history/page.tsx)

**상세 작업**:

1. **수동 재전송 API**
   ```typescript
   // PATCH /api/campaigns/sending-history/[id]/resend
   
   export async function PATCH(
     request: Request,
     { params: { id } }: { params: { id: string } }
   ) {
     const sending = await db.sendingHistory.findUnique({
       where: { id },
       include: { contact: true, campaign: true },
     });
     
     if (!sending) return Response.json({ error: 'Not found' }, { status: 404 });
     
     // 상태 초기화 & 재발송
     let result;
     
     if (sending.campaign.sendSms && sending.smsStatus !== 'SENT') {
       result = await sendSms(sending.contact.phone, sending.campaign.smsBody);
     }
     if (sending.campaign.sendEmail && sending.emailStatus !== 'SENT') {
       result = await sendFunnelEmail(
         sending.contact.email,
         sending.campaign.emailSubject,
         sending.campaign.emailBody
       );
     }
     
     // 상태 업데이트
     const updated = await db.sendingHistory.update({
       where: { id },
       data: {
         status: result.success ? 'SENT' : 'FAILED',
         sentAt: result.success ? new Date() : null,
         failureReason: result.error ? 'SYSTEM_ERROR' : null,
         retryCount: 0, // 초기화
       },
     });
     
     return Response.json({ ok: true, sending: updated });
   }
   ```

2. **UI 버튼 추가**
   ```typescript
   <button
     onClick={() => resendMessage(failureId)}
     className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
   >
     🔄 재전송
   </button>
   ```

**완료 기준**:
- [ ] 수동 재전송 API 구현
- [ ] UI 버튼 추가 및 기능 테스트
- [ ] 성공/실패 토스트 메시지

---

### 3-2-C: 모니터링 대시보드

**담당**: Agent ζ  
**소요 시간**: 1day (2026-05-23 ~ 2026-05-24)  
**파일 생성**:
- `src/app/(dashboard)/admin/sending-monitor/page.tsx` (신규)
- `src/app/api/admin/sending-metrics/route.ts` (신규)

**상세 작업**:

1. **모니터링 메트릭 API**
   ```typescript
   // GET /api/admin/sending-metrics?period=7d
   
   async function getMetrics(period: '1d' | '7d' | '30d') {
     const since = calculateSince(period);
     
     const metrics = {
       totalSent: await countWhere({ status: 'SENT', createdAt: { gte: since } }),
       totalFailed: await countWhere({ status: 'FAILED', createdAt: { gte: since } }),
       avgRetries: await averageRetries({ createdAt: { gte: since } }),
       failureRate: (failed / (sent + failed) * 100).toFixed(2) + '%',
       
       byChannel: {
         sms: { sent: 0, failed: 0 },
         email: { sent: 0, failed: 0 },
       },
       
       dlqSize: await countWhere({ resolved: null }), // DLQ 적체
       
       topFailures: await groupByReason(),
     };
     
     return metrics;
   }
   ```

2. **모니터링 대시보드**
   ```typescript
   // src/app/(dashboard)/admin/sending-monitor/page.tsx
   
   <div className="grid grid-cols-3 gap-4 mb-6">
     <KpiCard label="발송 성공률" value={`${metrics.successRate}%`} />
     <KpiCard label="평균 재시도" value={`${metrics.avgRetries.toFixed(1)}회`} />
     <KpiCard label="DLQ 크기" value={metrics.dlqSize} color={metrics.dlqSize > 100 ? 'red' : 'green'} />
   </div>
   
   {/* 차트 */}
   <LineChart data={channelTrends} title="채널별 발송률 추이" />
   
   {/* 실패 원인 분석 */}
   <PieChart data={topFailures} title="실패 원인 분포" />
   ```

**완료 기준**:
- [ ] 메트릭 API 구현
- [ ] 대시보드 페이지 완성
- [ ] 차트 시각화 (Chart.js / Recharts)

---

## 예상 일정 (상세)

| 날짜 | Track A | Track B | 상태 |
|------|---------|---------|------|
| 2026-05-19 | 3-1-A: SendingHistory + 마이그레이션 | - | 🔄 진행 |
| 2026-05-20 | 3-1-B: 재시도 로직 개선 (1/2) | - | 🔄 진행 |
| 2026-05-21 | 3-1-B: 재시도 로직 완료 + 3-1-C: WebHook (1/2) | 3-2-A: 대시보드 (1/2) | 🔄 진행 |
| 2026-05-22 | 3-1-C: WebHook 완료 (코드 리뷰) | 3-2-A: 대시보드 완료 + 3-2-B: 수동 재전송 (1/2) | 🔄 진행 |
| 2026-05-23 | Track A 병합 준비 | 3-2-B: 수동 재전송 완료 + 3-2-C: 모니터링 (1/2) | 🔄 진행 |
| 2026-05-24 | - | 3-2-C: 모니터링 완료 (코드 리뷰) | 🔄 진행 |
| 2026-05-25 | Step 6: 코드 리뷰 통합 (병렬) | Step 6: 코드 리뷰 통합 (병렬) | 🔄 진행 |
| 2026-05-26 | Step 7: 메모리 업데이트 (완료) | Step 7: 메모리 업데이트 (완료) | ✅ 완료 |

**총 소요 시간**: 1주 (2026-05-19 ~ 2026-05-26)

---

## Phase 2 에이전트 역할 분담

| Agent | Track | 담당 | 파일 수 | 예상 LOC |
|-------|-------|------|--------|---------|
| **α** | A | SendingHistory 모델 + 마이그레이션 | 3 | 200 |
| **β** | A | Cron 재시도 로직 | 1 | 400 |
| **γ** | A | WebHook 콜백 엔드포인트 | 3 | 300 |
| **δ** | B | 발송 현황 대시보드 | 3 | 500 |
| **ε** | B | 수동 재전송 기능 | 2 | 200 |
| **ζ** | B | 모니터링 대시보드 | 2 | 400 |

**총**: 6개 에이전트 | 14개 파일 | ~2000줄

---

## 완료 기준 (Step 3 종료)

### Track A 검증
- [ ] SendingHistory 스키마 + 마이그레이션 (PostgreSQL 검증)
- [ ] Cron Job: 재시도 로직 (1h/6h/24h + Jitter)
- [ ] WebHook 엔드포인트 (서명 검증 + 멱등성)
- [ ] 컴파일 OK (TypeScript strict mode)
- [ ] 코드 리뷰 점수 8.0/10 이상

### Track B 검증
- [ ] 대시보드 페이지 (통계 + 실패 목록)
- [ ] 수동 재전송 기능 (UI + API)
- [ ] 모니터링 대시보드 (메트릭 + 차트)
- [ ] 반응형 디자인 확인
- [ ] 접근성 라벨 추가 (aria-label)

### 통합 검증
- [ ] 모든 에이전트 파일 병합
- [ ] 데이터베이스 마이그레이션 안전성
- [ ] 엔드투엔드 테스트 (발송 → 재시도 → 완료)
- [ ] 성능 검증 (1500명 발송 < 2초)
- [ ] 메모리 파일 작성 (Phase 2 완료 문서)

---

## 다음 단계 (Step 4 onwards)

✅ **Step 3**: 작업지시서 (현재)  
⏳ **Step 4**: 사용자 승인 ("좋아, 진행해")  
⏳ **Step 5-2**: 에이전트 병렬 실행 (6개 에이전트, 1주)  
⏳ **Step 6**: 코드 리뷰 통합  
⏳ **Step 7**: 메모리 업데이트 + Phase 2 완료  
⏳ **Phase 3**: A/B 테스트 + 비용 리포팅 (2026-06-02 ~ 2026-06-08)

---

## 주의사항

1. **데이터베이스 마이그레이션**: CONCURRENTLY로 다운타임 0초
2. **재시도 간격**: 반드시 1h/6h/24h 적용 (Phase 1과 다름)
3. **WebHook 멱등성**: 중복 처리 방지 필수
4. **성능**: 1500명 배치 처리 시 < 2초 유지
5. **모니터링**: 실패율 > 5% 시 알림 (대시보드에서 관찰)

