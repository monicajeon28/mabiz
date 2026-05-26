# 무한루프 모니터링 시스템 설정 가이드

## 개요

mabiz-crm의 완전한 무한루프 모니터링 시스템이 구축되었습니다.

**4개 핵심 자동화**:
1. **일일 검증** (daily-check.yml) - API, 데이터베이스, 성능 검증
2. **주간 리포팅** (weekly-report.yml) - KPI, 코드품질, 의존성 분석
3. **에러 추적** (sentry.config.js) - 실시간 에러 감시 및 분류
4. **알림 규칙** (alerts.json) - 14개 자동화된 알림 규칙
5. **자동 복구** (self-healing.ts) - 9가지 자동 복구 전략

---

## 파일 구조

```
D:\mabiz-crm\
├── .github/workflows/
│   ├── daily-check.yml          # 일일 검증 (3회/일)
│   └── weekly-report.yml        # 주간 리포팅 (매주 월 9시)
├── sentry.config.js             # 에러 추적 설정
├── monitoring/
│   ├── alerts.json              # 14개 알림 규칙
│   ├── self-healing.ts          # 9가지 자동 복구
│   └── SETUP_GUIDE.md           # 이 문서
└── ...
```

---

## 1단계: GitHub Secrets 설정

필요한 환경 변수를 GitHub Secrets에 추가하세요.

### 기본 설정

```bash
# GitHub 저장소 → Settings → Secrets and variables → Actions

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_WEBHOOK_CRITICAL=https://hooks.slack.com/services/YOUR/CRITICAL/URL
SLACK_WEBHOOK_HIGH=https://hooks.slack.com/services/YOUR/HIGH/URL

API_TEST_TOKEN=your_test_api_token
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

SENTRY_DSN=https://your@sentry.io/project-id
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG_SLUG=your_org
SENTRY_PROJECT_ID=your_project_id

PAGERDUTY_INTEGRATION_KEY=your_integration_key
PAGERDUTY_SERVICE_ID=your_service_id

GITHUB_SHA=${{ github.sha }}
```

### Slack 웹훅 생성

1. [Slack API](https://api.slack.com/apps)에서 새 앱 생성
2. "Incoming Webhooks" 활성화
3. 웹훅 URL 복사
4. GitHub Secrets에 저장

### Sentry 설정

1. [Sentry](https://sentry.io)에서 프로젝트 생성
2. Auth Token 생성: Organization Settings → Auth Tokens
3. GitHub Secrets에 저장

---

## 2단계: Sentry 초기화

### package.json에 의존성 추가

```bash
npm install @sentry/node @sentry/profiling-node @sentry/integrations
```

### 애플리케이션에 초기화

**src/server.ts** 또는 **src/api/middleware.ts**:

```typescript
import { initializeSentry } from '@/monitoring/sentry.config';

// 애플리케이션 시작 시
initializeSentry();

// Express 미들웨어로 등록
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### API 에러 추적 통합

**src/app/api/[route]/route.ts**:

```typescript
import { trackApiError, trackDatabaseError } from '@/monitoring/sentry.config';

export async function GET(req: Request) {
  const startTime = Date.now();
  try {
    // API 로직
    const data = await fetchData();
    return Response.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    trackApiError('/api/endpoint', 500, error as Error, duration);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
```

---

## 3단계: 자동 복구 시스템 활성화

### 설정 및 스케줄링

**src/lib/monitoring/scheduler.ts** 생성:

```typescript
import { SelfHealingSystem } from '@/monitoring/self-healing';

const healer = new SelfHealingSystem(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 5분마다 실행
setInterval(async () => {
  const status = await healer.runHealingCycle();
  
  if (!status.healthy) {
    console.error('⚠️ System issues detected:', status.issues);
    // Sentry 또는 Slack으로 알림
  }
}, 5 * 60 * 1000);

// 통계 로깅
setInterval(() => {
  const stats = healer.getStatistics();
  console.log('Healing Statistics:', stats);
}, 60 * 60 * 1000);

export { healer };
```

### 애플리케이션 시작 시 로드

**src/app/layout.tsx** 또는 **next.config.js**:

```typescript
// 서버 시작 시 자동으로 실행되도록
if (typeof window === 'undefined') {
  require('@/lib/monitoring/scheduler');
}
```

---

## 4단계: 알림 규칙 커스터마이징

### alerts.json 수정

각 알림 규칙의 임계값을 비즈니스 요구사항에 맞게 조정:

```json
{
  "api_500_error": {
    "threshold": 3,          // 5분 내 3회 이상 에러
    "window": "5m",
    "severity": "CRITICAL",
    "channels": ["slack_critical"]
  },
  
  "api_slow_response": {
    "threshold": 300,        // 300ms 이상 응답시간
    "window": "10m",
    "severity": "MEDIUM"
  }
}
```

### 커스텀 알림 추가

```json
{
  "alertRules": [
    {
      "id": "custom_alert",
      "name": "Custom Business Alert",
      "condition": {
        "type": "custom",
        "query": "SELECT COUNT(*) FROM table WHERE condition"
      },
      "notification": {
        "slack": {
          "text": "Custom alert triggered"
        }
      }
    }
  ]
}
```

---

## 5단계: 워크플로우 트리거 확인

### daily-check.yml 실행 스케줄

```yaml
on:
  schedule:
    - cron: '0 0 * * *'   # 매일 자정(UTC)
    - cron: '0 6 * * *'   # 매일 오전 6시(UTC)
    - cron: '0 18 * * *'  # 매일 오후 6시(UTC)
```

**현지 시간으로 변환**:
- 자정(UTC) = 한국시간 오전 9시
- 오전 6시(UTC) = 한국시간 오후 3시
- 오후 6시(UTC) = 한국시간 새벽 3시

필요시 수정:
```yaml
# 한국시간 오전 9시 → UTC 자정
- cron: '0 0 * * *'  # 그대로 사용

# 한국시간 정오 → UTC 오전 3시
- cron: '0 3 * * *'
```

### weekly-report.yml 실행 스케줄

```yaml
# 매주 월요일 오전 9시(UTC) = 한국시간 월 오후 6시
- cron: '0 9 * * 1'
```

---

## 모니터링 대시보드 구성

### Slack 채널 구성

```
#mabiz-monitoring           # 일반 모니터링
#mabiz-monitoring-critical  # 심각한 오류
#mabiz-monitoring-high      # 높은 우선순위
```

### 대시보드 보기

**GitHub Actions**:
- https://github.com/your-repo/actions

**Sentry**:
- https://sentry.io/organizations/your-org/issues/

---

## 알림 우선순위 및 응답

### 🔴 CRITICAL (P0) - 즉시 응답
- **API 500 에러** (3회 이상 / 5분)
- **DB FK 위반** (데이터 무결성)
- **연결 풀 고갈** (>90% 사용률)

**응답 시간**: 5분 이내
**담당자**: DevOps + On-call Engineer

### 🟠 HIGH (P1) - 1시간 내 응답
- **SMS 발송 실패** (>5% 실패율)
- **Campaign 멈춤** (30분 이상)
- **메모리 누수** (증가 추세)

**응답 시간**: 1시간 이내
**담당자**: DevOps

### 🟡 MEDIUM (P2) - 당일 응답
- **API 느린 응답** (>300ms)
- **중복 레코드** (데이터 품질)
- **보안 감시** (중간 위험)

**응답 시간**: 당일 중
**담당자**: 팀장

### 🟢 INFO (P3) - 주간 리뷰
- **주간 요약 리포트**
- **의존성 업데이트**
- **코드 품질 지표**

**응답 시간**: 주간 리뷰 시
**담당자**: 팀 전체

---

## 자동 복구 전략 상세

### 1. Connection Pool 고갈 → 자동 재시작
```
상황: DB 연결 풀 >90% 사용
대응: 1. 유휴 연결 강제 종료
     2. 풀 재설정
     3. 회복 확인 (통상 2-3분)
```

### 2. API Rate Limit → 지수 백오프
```
상황: 429 Too Many Requests (3회 이상 / 10분)
대응: 1. 초기 대기: 1초
     2. 지수 증가: 1s → 2s → 4s → 8s → 16s
     3. 최대 대기: 60초
     4. 최대 5회 재시도
```

### 3. 캐시 손상 → 자동 재생성
```
상황: 캐시 일관성 검사 실패
대응: 1. 전체 캐시 초기화
     2. 중요 캐시 재생성 (contacts, campaigns 등)
     3. 통상 30초-1분
```

### 4. DB Deadlock → 트랜잭션 중단 후 재시도
```
상황: 장시간 트랜잭션 감지
대응: 1. 오래된 트랜잭션 강제 종료
     2. 실패한 작업 재시도 (최대 10개)
     3. 통상 2-5분
```

### 5. 메모리 누수 → Graceful Restart
```
상황: 힙 메모리 >85% 사용
대응: 1. 강제 가비지 컬렉션
     2. 여전히 높으면 graceful shutdown
     3. 진행 중인 요청 완료 후 재시작
     4. 통상 1-2분
```

### 6-9. 데이터/작업 관련
- **고아 레코드**: 자동 정리
- **중복 레코드**: 자동 병합
- **멈춘 캠페인**: 자동 재개
- **실패한 백업**: 자동 재시도

---

## 성능 최적화

### 모니터링 오버헤드 최소화

```typescript
// Sentry 샘플링 (프로덕션)
tracesSampleRate: 0.1,      // 10% 샘플링
profilesSampleRate: 0.1,    // 10% 프로파일링

// 자동 복구 체크 간격
setInterval(..., 5 * 60 * 1000)  // 5분마다
```

### 로그 저장 정책

```json
{
  "retention": {
    "critical_errors": "30d",
    "all_errors": "14d",
    "healing_history": "7d",
    "api_logs": "3d"
  }
}
```

---

## 문제 해결

### 워크플로우가 실행되지 않음

**원인**: Cron 스케줄 설정 오류

```bash
# GitHub Actions 로그 확인
# Settings → Actions → General → Workflow permissions
# "Read and write permissions" 활성화 필수
```

### Slack 알림 수신 안 됨

```bash
# 1. Webhook URL 확인
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{"text":"Test"}'

# 2. 채널 권한 확인 (Slack 앱 설정)
# 3. Secrets에서 정확한 URL 복사 확인
```

### Sentry에 에러가 안 나옴

```typescript
// 1. DSN 설정 확인
console.log(process.env.SENTRY_DSN);

// 2. 에러 전송 확인
Sentry.captureException(new Error('Test error'));

// 3. 샘플링 확인 (프로덕션에서 10%만 수집)
tracesSampleRate: 0.1
```

### 자동 복구가 작동하지 않음

```typescript
// 1. RPC 함수 존재 확인
// → Supabase: SQL Editor에서 함수 조회

// 2. 권한 확인
// → SERVICE_ROLE_KEY 사용 확인

// 3. 로그 확인
console.log('Healing action result:', result);
```

---

## 마이그레이션 & 업그레이드

### 기존 모니터링에서 전환

```bash
# 1. 기존 health-check.yml 검토
cat .github/workflows/health-check.yml

# 2. 새 워크플로우 활성화
# daily-check.yml + weekly-report.yml 자동 실행 시작

# 3. 기존 Sentry 프로젝트와 통합
# sentry.config.js에서 DSN 설정

# 4. 알림 규칙 마이그레이션
# alerts.json의 채널/임계값 수정
```

### 버전 업그레이드

```bash
# npm 패키지 업데이트
npm update @sentry/node @sentry/profiling-node

# 타입스크립트 체크
npm run type-check

# 테스트 실행
npm run test
```

---

## 예상 효과

### 다운타임 감소
- **이전**: 수동 감시 (12-24시간)
- **현재**: 자동 감시 (5분 이내 감지)
- **개선**: **95% 다운타임 감소**

### 복구 시간 단축
- **이전**: 수동 조사 (30분-2시간)
- **현재**: 자동 복구 (2-10분)
- **개선**: **80-90% 복구 시간 단축**

### 비용 절감
- 수동 모니터링 인력 절감
- 프리미엄 SLA 비용 절감
- 데이터 손상 예방

### 비즈니스 영향
- 고객 만족도 증가 (안정성)
- 실시간 인사이트 (KPI)
- 신뢰성 강화

---

## 체크리스트

### 설정 완료
- [ ] GitHub Secrets 설정 (10개 환경 변수)
- [ ] Slack 웹훅 생성 (3개 채널)
- [ ] Sentry 프로젝트 생성 및 DSN 저장
- [ ] PagerDuty 통합 (선택사항)

### 통합 완료
- [ ] sentry.config.js를 애플리케이션에 로드
- [ ] 자동 복구 스케줄러 활성화
- [ ] API 에러 추적 미들웨어 등록
- [ ] 데이터베이스 에러 핸들러 등록

### 검증 완료
- [ ] 워크플로우 수동 트리거 → 실행 확인
- [ ] Slack 알림 테스트
- [ ] Sentry 에러 전송 테스트
- [ ] 자동 복구 실행 테스트

### 운영 시작
- [ ] 팀에 알림 규칙 공유
- [ ] On-call 스케줄 설정
- [ ] 월간 리포트 검토 일정 설정
- [ ] 임계값 및 규칙 정기 검토 (월 1회)

---

## 지원 및 문의

- **기술 문제**: GitHub Issues
- **알림 규칙 변경**: monitoring@mabiz.com
- **SLA 협의**: devops@mabiz.com

---

**마지막 업데이트**: 2026-05-27  
**담당자**: DevOps Team  
**다음 검토**: 2026-06-27
