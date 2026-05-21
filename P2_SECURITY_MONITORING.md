# P2 보안 모니터링 & 알림 가이드

## 📊 실시간 모니터링 대시보드 설정

### CloudWatch Dashboards 설정

파일: `infrastructure/cloudwatch/p2-security.json`

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "4XXError", { "stat": "Sum", "label": "403 Forbidden" }],
          ["AWS/ApiGateway", "4XXError", { "stat": "Sum", "label": "401 Unauthorized" }],
          ["CustomMetrics", "RBAC_Bypass_Attempts", { "stat": "Sum" }],
          ["CustomMetrics", "PII_Access_Incidents", { "stat": "Sum" }]
        ],
        "period": 60,
        "stat": "Average",
        "region": "ap-northeast-2",
        "title": "P2 Security Metrics (Real-time)"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", { "stat": "p95" }],
          ["AWS/Lambda", "Duration", { "stat": "p99" }]
        ],
        "title": "API Response Time P95/P99"
      }
    }
  ]
}
```

### 알림 규칙 (Alert Rules)

파일: `infrastructure/alertmanager/p2-security.yaml`

```yaml
groups:
  - name: P2_Security_Alerts
    rules:
      # P0: PII 노출 감지 → 즉시 롤백
      - alert: PII_EXPOSURE_DETECTED
        expr: pii_exposure_incidents > 0
        for: 1m
        labels:
          severity: critical
          component: p2-security
        annotations:
          summary: "PII 노출 감지 — 즉시 롤백 필요"
          description: "{{ $value }} 건의 PII 노출 감지"
          runbook: "https://wiki.internal/p2-rollback"
          action: "POST /api/admin/rollback/p2"

      # P0: RBAC 우회 성공 → 보안팀 알림
      - alert: RBAC_BYPASS_SUCCESS
        expr: rbac_bypass_success_rate > 0.01
        for: 5m
        labels:
          severity: critical
          component: p2-security
        annotations:
          summary: "RBAC 우회 성공 — 보안팀 호출"
          description: "{{ $value }}% 성공률"
          slack_channel: "#security-incidents"

      # P1: 401/403 에러율 증가 → DevOps 호출
      - alert: AUTH_ERROR_SPIKE
        expr: |
          (rate(http_403_total[5m]) + rate(http_401_total[5m])) > 1.05
        for: 10m
        labels:
          severity: warning
          component: p2-security
        annotations:
          summary: "인증/인가 에러율 5% 증가"
          description: "{{ $value }} RPS"

      # P2: API 응답시간 증가 → 모니터링
      - alert: API_LATENCY_INCREASE
        expr: api_latency_p95 > 2000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "API 응답시간 2s 초과"

      # P0: 무한 리다이렉트 루프
      - alert: REDIRECT_LOOP_DETECTED
        expr: redirect_loop_count > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "무한 리다이렉트 루프 — 즉시 롤백"
          action: "POST /api/admin/rollback/p2"
```

---

## 🔍 로깅 전략 (Logging Strategy)

### 1. API 액세스 로그

```typescript
// lib/logger.ts - P2 보안 로그 추가

export const securityLogger = {
  // 권한 검증 실패
  rbacDenied: (
    userId: string,
    role: string,
    endpoint: string,
    requiredRole: string
  ) => {
    logger.warn('[RBAC_DENIED]', {
      userId,
      role,
      endpoint,
      requiredRole,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
    });
  },

  // PII 접근
  piiAccess: (userId: string, resourceType: string, action: string) => {
    logger.info('[PII_ACCESS]', {
      userId,
      resourceType,
      action,  // 'VIEW' | 'DOWNLOAD' | 'EXPORT'
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM',
    });
  },

  // 토큰 위조 시도
  tokenForgery: (ip: string, error: string) => {
    logger.error('[TOKEN_FORGERY]', {
      ip,
      error,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });
  },

  // 세션 무효화 감지
  sessionInvalidation: (userId: string, reason: string) => {
    logger.info('[SESSION_INVALIDATION]', {
      userId,
      reason,  // 'LOGOUT' | 'ROLE_CHANGE' | 'TIMEOUT'
      timestamp: new Date().toISOString(),
    });
  },
};
```

### 2. 구조화된 로깅 (Structured Logging)

```typescript
// src/app/api/admin/affiliate-sales/route.ts

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const ctx = await getAuthContext();

    // 권한 검증
    if (ctx.role !== 'GLOBAL_ADMIN') {
      securityLogger.rbacDenied(
        ctx.userId,
        ctx.role,
        '/api/admin/affiliate-sales',
        'GLOBAL_ADMIN'
      );

      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        {
          status: 403,
          headers: {
            'X-Request-ID': requestId,
            'X-Log-Level': 'WARN',
          },
        }
      );
    }

    // PII 접근 로그
    securityLogger.piiAccess(
      ctx.userId,
      'partner-affiliate-sales',
      'VIEW'
    );

    // ... 비즈니스 로직

    const duration = Date.now() - startTime;
    logger.info('[GET /api/admin/affiliate-sales]', {
      requestId,
      userId: ctx.userId,
      role: ctx.role,
      status: 200,
      durationMs: duration,
      dataSize: JSON.stringify(result).length,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      logger.warn('[UNAUTHORIZED]', {
        requestId,
        endpoint: '/api/admin/affiliate-sales',
        error: err.message,
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    logger.error('[INTERNAL_ERROR]', {
      requestId,
      endpoint: '/api/admin/affiliate-sales',
      error: err,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 📈 메트릭 수집 (Metrics Collection)

### CloudWatch Custom Metrics

```typescript
// lib/metrics.ts

import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-2' });

export async function recordSecurityMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Seconds' | 'Percent' = 'Count'
) {
  try {
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: 'MabizCRM/P2Security',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
          },
        ],
      })
    );
  } catch (err) {
    logger.error('[METRICS_RECORDING_FAILED]', { metricName, err });
  }
}

// 사용 예
export async function incrementRbacBypass() {
  await recordSecurityMetric('RBAC_Bypass_Attempts', 1);
}

export async function recordPiiAccess() {
  await recordSecurityMetric('PII_Access_Count', 1);
}

export async function recordApiLatency(durationMs: number) {
  await recordSecurityMetric('API_Latency_Ms', durationMs, 'Milliseconds');
}
```

---

## 🚨 인시던트 대응 (Incident Response)

### 자동 롤백 절차

```typescript
// src/app/api/admin/rollback/p2/route.ts

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();

  // GLOBAL_ADMIN만 롤백 가능
  if (ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { reason, triggerAlert } = await req.json();

  logger.critical('[P2_ROLLBACK_INITIATED]', {
    reason,  // 'PII_EXPOSURE' | 'RBAC_BYPASS' | 'REDIRECT_LOOP'
    triggerAlert,
    timestamp: new Date().toISOString(),
  });

  // 1. Vercel 배포 롤백
  const rollbackResult = await rollbackToLastGoodDeploy();

  // 2. Slack 알림
  await notifySlack({
    channel: '#p2-incidents',
    message: `P2 롤백 완료: ${reason}`,
    color: 'danger',
  });

  // 3. 인시던트 기록
  await prisma.incident.create({
    data: {
      title: `P2 Security Rollback: ${reason}`,
      severity: 'CRITICAL',
      status: 'RESOLVED',
      rootCause: reason,
      rollbackedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: 'P2 롤백 완료',
    rollbackId: rollbackResult.id,
  });
}

async function rollbackToLastGoodDeploy() {
  // Vercel API 호출
  const response = await fetch(
    'https://api.vercel.com/v13/deployments/DEPLOYMENT_ID/rollback',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'P2 Security Incident Rollback',
      }),
    }
  );

  return response.json();
}
```

---

## 📋 배포 후 체크리스트 (Post-Deployment Checklist)

### 1시간 이내 (Hour 0-1)

- [ ] CloudWatch 대시보드 로드 → 메트릭 수집 확인
- [ ] 로그 확인: 에러율 정상 범위 (< 1%)
- [ ] 모니터링 알림: 임계값 초과 없음
- [ ] 7개 페이지 로드 테스트
  - [ ] /admin/partner-applications
  - [ ] /admin/affiliate-sales-by-partner
  - [ ] /payments
  - [ ] /settings/members
  - [ ] /team/affiliate
  - [ ] /contracts/templates
  - [ ] /tools/profit-calculator

### 1-4시간 (Hour 1-4)

- [ ] RBAC 우회 시도: 0건 (로그 확인)
- [ ] PII 노출: 0건 (감사 로그 확인)
- [ ] 403 에러율: < 2% (평소 대비)
- [ ] API 응답시간: p95 < 1s
- [ ] 사용자 피드백: 권한 거부 등 없음

### 4-24시간 (Hour 4-24)

- [ ] 트렌드 분석: 지표 안정화
- [ ] 성능: LCP < 2.5s, CLS < 0.1
- [ ] 보안: 의심 활동 0건
- [ ] 비용: 추가 호출 5% 이내

---

## 🔔 Slack 알림 설정

### Slack Webhook 통합

```typescript
// lib/slack-notify.ts

import { logger } from '@/lib/logger';

export async function notifySlack(
  channel: string,
  message: string,
  severity: 'info' | 'warning' | 'critical'
) {
  const color = {
    info: '#36a64f',      // Green
    warning: '#ff9900',   // Orange
    critical: '#ff0000',  // Red
  }[severity];

  try {
    await fetch(process.env.SLACK_WEBHOOK_P2_SECURITY || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        attachments: [
          {
            color,
            title: 'P2 Security Alert',
            text: message,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });
  } catch (err) {
    logger.error('[SLACK_NOTIFICATION_FAILED]', { channel, message, err });
  }
}
```

### Slack 채널 설정

```
#p2-security (모든 P0/P1 알림)
#p2-daily-report (일일 통계)
#security-incidents (보안 팀용)
```

---

## 📊 일일 보고서 (Daily Report)

자동화: 매일 09:00 KST

```typescript
// scripts/daily-security-report.ts

import prisma from '@/lib/prisma';

export async function generateDailySecurityReport() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. RBAC 거부 통계
  const rbacDenials = await prisma.auditLog.groupBy({
    by: ['role'],
    where: {
      action: 'RBAC_DENIED',
      timestamp: { gte: yesterday },
    },
    _count: true,
  });

  // 2. PII 접근 통계
  const piiAccess = await prisma.auditLog.groupBy({
    by: ['action'],
    where: {
      action: { startsWith: 'PII_' },
      timestamp: { gte: yesterday },
    },
    _count: true,
  });

  // 3. API 성능
  const apiPerf = await prisma.apiLog.aggregate({
    where: { createdAt: { gte: yesterday } },
    _avg: { durationMs: true },
    _max: { durationMs: true },
    _min: { durationMs: true },
  });

  // 4. 에러율
  const errorRate = await calculateErrorRate(yesterday);

  const report = {
    date: yesterday.toISOString().split('T')[0],
    rbacDenials,
    piiAccess,
    apiPerf,
    errorRate,
    incidents: [],
  };

  // Slack으로 전송
  await notifySlack(
    '#p2-daily-report',
    `
P2 일일 보고서 (${report.date})

RBAC 거부: ${rbacDenials.reduce((sum, r) => sum + r._count, 0)}건
PII 접근: ${piiAccess.reduce((sum, p) => sum + p._count, 0)}건
API Latency (avg): ${Math.round(apiPerf._avg?.durationMs || 0)}ms
에러율: ${(errorRate * 100).toFixed(2)}%

상세: https://dashboard.internal/p2-security
    `,
    errorRate > 0.05 ? 'warning' : 'info'
  );
}
```

---

## 🎯 SLA & KPI (Service Level Agreements)

| 지표 | 목표 | 임계값 | 위반 시 액션 |
|------|------|--------|------------|
| 가용성 | 99.99% | < 99.95% | 배포 취소 |
| 응답시간 (p95) | < 500ms | > 1s | 최적화 필요 |
| 에러율 | < 0.1% | > 1% | 즉시 조사 |
| PII 노출 | 0건 | > 0건 | 즉시 롤백 |
| RBAC 우회 | 0건 | > 0건 | 즉시 롤백 |

---

## 🔐 보안 감사 (Security Audit)

### 주간 감사 체크리스트

```
[ ] 모든 API의 권한 검증 재확인
[ ] PII 마스킹 규칙 검증
[ ] 토큰 서명 검증 테스트
[ ] CSRF 토큰 검증 테스트
[ ] 세션 타임아웃 테스트
[ ] 감사 로그 정상 기록 확인
[ ] 알림 규칙 정상 작동 확인
[ ] 배포 로그 검토
```

### 월간 보안 리뷰

```
1. 침해 시도 분석
2. 거짓 양성 (False Positives) 검토
3. 임계값 조정
4. 알림 규칙 최적화
5. 대시보드 성능 평가
```
