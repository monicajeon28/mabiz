# 실시간 KPI 대시보드 - 빠른 시작 가이드

## 1. 설치 (5분)

### 1.1 전제조건

```bash
✅ Node.js 18+
✅ Next.js 14+
✅ PostgreSQL 12+
✅ Upstash Redis 계정
```

### 1.2 환경 변수 설정

`.env.local` 파일에 추가:

```bash
# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://*.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Optional: WebSocket server (Phase 2)
# WEBSOCKET_SERVER_URL=ws://localhost:3001
```

### 1.3 데이터베이스 준비

Prisma 스키마 인덱스 추가 (`prisma/schema.prisma`):

```prisma
// AffililateSale 모델에 추가
model AffililateSale {
  // ... 기존 필드 ...

  @@index([organizationId, createdAt])
  @@index([organizationId, status])
  @@index([partnerId])
}

// ContactLensSequence 모델에 추가
model ContactLensSequence {
  // ... 기존 필드 ...

  @@index([organizationId, day0SentAt])
}

// CrmMarketingMessage 모델에 추가 (없으면 생성)
model CrmMarketingMessage {
  id           String   @id @default(cuid())
  organizationId String
  contactId    String
  channel      String   // SMS, KAKAO, EMAIL
  content      String
  sentAt       DateTime @default(now())
  openedAt     DateTime?
  clickedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([organizationId, channel, createdAt])
}
```

마이그레이션 실행:

```bash
npx prisma migrate dev --name add_realtime_indexes
```

### 1.4 기존 파일 확인

필요한 파일들이 생성되었는지 확인:

```bash
✅ src/lib/realtime/kpi-socket.ts
✅ src/lib/services/realtime-metrics-service.ts
✅ src/app/api/realtime/kpi/route.ts
✅ src/app/api/realtime/kpi/metrics/route.ts
✅ src/app/(dashboard)/analytics/realtime/page.tsx
✅ docs/REALTIME_KPI_SPEC.md
```

---

## 2. 사용법 (3가지 방식)

### 방식 1: 대시보드 페이지 접속

**URL**: `https://yourapp.com/dashboard/analytics/realtime`

```typescript
// 자동으로 처리됨:
// 1. WebSocket 연결 시도
// 2. 실패 시 HTTP 폴링 폴백
// 3. 메트릭 60초마다 갱신 (폴링 모드) / 5초마다 갱신 (WebSocket)
```

### 방식 2: 커스텀 컴포넌트에서 Hook 사용

```typescript
'use client';

import { useKpiSocket } from '@/lib/realtime/kpi-socket';

export function MyCustomComponent() {
  const { isConnected, metrics, lastEvent } = useKpiSocket();

  return (
    <div>
      <p>상태: {isConnected ? '연결됨' : '폴링 중'}</p>
      <p>오늘 매출: ${metrics?.todayRevenue}</p>
      <p>전환율: {metrics?.lastHourConversion}%</p>
    </div>
  );
}
```

### 방식 3: API 직접 호출 (HTTP polling)

```typescript
const response = await fetch('/api/realtime/kpi/metrics?org=org-123');
const metrics = await response.json();

console.log(metrics.todayRevenue);
console.log(metrics.lastHourConversion);
```

---

## 3. 실시간 이벤트 발행하기

판매 생성, SMS 오픈 등의 이벤트를 발행하려면:

### 3.1 판매 생성 시

`src/app/api/affiliate-sales/create/route.ts` 또는 관련 엔드포인트에 추가:

```typescript
import { realtimeMetricsService } from '@/lib/services/realtime-metrics-service';

// 판매 생성 후...
await realtimeMetricsService.invalidateCache(organizationId);

// 또는 WebSocket 서버에 이벤트 발행 (Phase 2)
// await fetch('/api/realtime/kpi', {
//   method: 'POST',
//   body: JSON.stringify({
//     type: 'sales-created',
//     organizationId,
//     amount,
//     productId,
//     partnerId
//   })
// });
```

### 3.2 SMS 이벤트 처리

`src/app/api/webhooks/sms/route.ts`:

```typescript
import { realtimeMetricsService } from '@/lib/services/realtime-metrics-service';

export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'opened') {
    // SMS 오픈 이벤트
    await realtimeMetricsService.invalidateCache(organizationId);
  }

  // ...
}
```

### 3.3 크론 작업 후

`src/lib/cron/sms-day0.ts`:

```typescript
import { realtimeMetricsService } from '@/lib/services/realtime-metrics-service';

export async function runSmsDay0() {
  // ... SMS 발송 로직 ...

  // 메트릭 캐시 무효화
  for (const orgId of organizationIds) {
    await realtimeMetricsService.invalidateCache(orgId);
  }
}
```

---

## 4. 성능 최적화 체크리스트

### 4.1 데이터베이스

- [ ] 인덱스 생성 확인: `npx prisma db execute --stdin < check-indexes.sql`
- [ ] 쿼리 성능 확인: 각각 <200ms
- [ ] 느린 쿼리 로그 활성화

```sql
-- PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 500; -- 500ms 이상만
SELECT pg_reload_conf();
```

### 4.2 캐싱

- [ ] Redis 연결 확인:

```bash
# .env.local에서
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxx

# 테스트
curl -X GET https://xxx.upstash.io/get/test \
  -H "Authorization: Bearer xxxx"
```

- [ ] 캐시 히트율 확인:

```typescript
// 개발 중
const cached = await redis.get(cacheKey);
console.log(cached ? 'HIT' : 'MISS');
```

### 4.3 프론트엔드

- [ ] 번들 크기 확인:

```bash
npm run build:analyze
```

예상 크기: <50KB (gzipped)

- [ ] 성능 메트릭 확인 (DevTools):

| 메트릭 | 목표 | 확인 |
|--------|------|------|
| LCP | <2.5s | ✅ |
| FID | <100ms | ✅ |
| CLS | <0.1 | ✅ |

---

## 5. 모니터링

### 5.1 실시간 대시보드 헬스 체크

매일 아침 확인:

```bash
# 1. API 응답시간 확인
curl -i https://yourapp.com/api/realtime/kpi/metrics?org=org-123

# 2. Redis 연결 확인
redis-cli ping

# 3. 데이터베이스 연결 확인
psql -c "SELECT 1"
```

### 5.2 자동 경고 설정 (선택사항)

Sentry 또는 모니터링 서비스에 다음을 추가:

```typescript
// src/lib/monitoring.ts
export async function checkRealtimeDashboardHealth() {
  try {
    const response = await fetch('/api/realtime/kpi/metrics?org=test');
    const time = response.headers.get('date');

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    logger.info('Realtime dashboard healthy', { time });
  } catch (error) {
    logger.error('Realtime dashboard health check failed', error);
    // Sentry 또는 Slack에 알림
  }
}
```

---

## 6. 일반적인 문제 해결

### 문제: "메트릭이 표시되지 않음"

**확인 사항**:

```bash
# 1. API 엔드포인트 확인
curl http://localhost:3000/api/realtime/kpi/metrics?org=org-123

# 2. 데이터베이스 데이터 확인
SELECT COUNT(*) FROM "AffililateSale" 
WHERE "organizationId" = 'org-123' 
AND DATE("createdAt") = TODAY();

# 3. Redis 캐시 확인
redis-cli GET "realtime:revenue:org-123"
```

### 문제: "API 응답이 느림 (>5s)"

**확인 사항**:

```sql
-- 느린 쿼리 확인
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 5;

-- 인덱스 확인
\d "AffililateSale"

-- 인덱스 재생성
REINDEX INDEX idx_affiliatesale_org_created;
```

### 문제: "Redis 연결 에러"

```typescript
// src/lib/services/realtime-metrics-service.ts 에서 에러 확인
// 에러 로그를 Sentry로 전송

try {
  const cached = await redis.get(cacheKey);
} catch (error) {
  logger.error('Redis error', error);
  // 에러 무시하고 DB에서 직접 조회 (느림)
}
```

---

## 7. 배포 체크리스트

### 프로덕션 배포 전

- [ ] 모든 인덱스 생성 완료
- [ ] Redis 인스턴스 생성 및 URL 환경변수 설정
- [ ] 데이터베이스 백업 수행
- [ ] 스테이징 환경에서 24시간 테스트
- [ ] Sentry 통합 확인
- [ ] 모니터링 대시보드 설정
- [ ] 팀에 기능 소개 (30분 데모)
- [ ] 릴리즈 노트 작성

### 배포 명령어

```bash
# 1. 마이그레이션 실행
npx prisma migrate deploy

# 2. 빌드
npm run build

# 3. 배포
npm start

# 4. 상태 확인
curl https://yourapp.com/api/realtime/kpi/metrics?org=test
```

---

## 8. 다음 단계

### 단기 (이번 주)

1. **데이터 검증**
   - 오늘 매출 실제 값 확인
   - 파트너 랭킹 정확성 확인
   - 채널별 발송 수 일치 확인

2. **팀 교육**
   - 매니저에게 대시보드 사용법 시연
   - Slack #analytics 채널에 링크 공유
   - 하루 2회 KPI 체크 시작

### 중기 (이번 달)

1. **WebSocket 마이그레이션** (Phase 2)
   - Socket.IO 서버 배포
   - 클라이언트 업데이트
   - 레이턴시 <1초 달성

2. **시각화 개선** (Phase 2)
   - Recharts 차트 추가
   - 실시간 애니메이션
   - 모바일 최적화

### 장기 (3개월)

1. **고급 분석**
   - 렌즈별 성과 분석
   - 파트너별 코호트 분석
   - 이상 탐지 (자동 경고)

2. **자동화**
   - Slack 통합
   - 일일 리포트 자동 발송
   - 임계값 초과 시 알림

---

## 9. 지원 & 문의

### 문서

- 📄 **완전 명세**: `docs/REALTIME_KPI_SPEC.md`
- 📘 **API 레퍼런스**: `src/lib/realtime/kpi-socket.ts` (JSDoc)
- 💾 **데이터베이스**: `prisma/schema.prisma`

### 디버깅

```typescript
// 개발자 도구 콘솔에서
localStorage.setItem('DEBUG', '*');  // 모든 로그 활성화
```

### 연락처

- 기술 문제: #dev-help Slack
- 기능 요청: GitHub Issues
- 버그 보고: Sentry Dashboard

---

## 10. FAQ

**Q: WebSocket이 작동하지 않으면 어떻게 되나요?**  
A: HTTP polling (60초 갱신)으로 자동 폴백됩니다.

**Q: Redis 없이 사용할 수 있나요?**  
A: 네, 캐싱 없이 항상 DB에서 조회합니다 (느림).

**Q: 얼마나 자주 갱신되나요?**  
A: WebSocket (5초) 또는 HTTP (60초)

**Q: 이전 대시보드는 어떻게 되나요?**  
A: `/analytics` (기존) vs `/analytics/realtime` (신규) 병행.

**Q: 성능이 느리면?**  
A: Redis 연결 확인, DB 인덱스 확인, 폴링 주기 조정.

---

**마지막 업데이트**: 2026-05-27  
**버전**: 1.0
